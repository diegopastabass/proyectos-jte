"""
Servicio unificado de monitoreo de estanques y conexión de equipos.

Este archivo es IDÉNTICO en todos los sitios (se copia con sincronizar.py).
Lo propio de cada sitio vive junto a él:
  - monitor_config.json : sitio, URL base de la API, estanques y umbrales por defecto.
  - .env                : credenciales de UltraMsg y overrides de parámetros/umbrales.

Ambos archivos se releen en cada ciclo, así que un cambio de umbral no requiere reiniciar.

Uso:
  python <archivo>.py                       servicio continuo
  python <archivo>.py --una-vez             ejecuta un solo ciclo
  python <archivo>.py --una-vez --sin-enviar  un ciclo, imprime los mensajes en vez de enviarlos
"""

import argparse
import json
import logging
import os
import subprocess
import sys
import time
from datetime import datetime, timedelta, timezone
from logging.handlers import RotatingFileHandler

import requests
from dotenv import load_dotenv

VERSION = "1.0.0"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(BASE_DIR, ".env")
CONFIG_PATH = os.path.join(BASE_DIR, "monitor_config.json")
ESTADO_PATH = os.path.join(BASE_DIR, "estado_monitor.json")
LOG_PATH = os.path.join(BASE_DIR, "logs_monitor.txt")

# Valores por defecto de los parámetros. Prioridad: .env > monitor_config.json ("parametros") > estos.
PARAMETROS_DEFECTO = {
    "INTERVALO_CHEQUEO_MINUTOS": 1,       # cada cuánto se revisa
    "REPETIR_ALERTA_MINUTOS": 5,          # cada cuánto se repite una alerta de nivel que sigue activa
    "VENTANA_VACIADO_MINUTOS": 30,        # ventana de muestras para estimar la tendencia
    "VENTANA_MAXIMA_MINUTOS": 120,        # ventana máxima si en la normal no hay suficientes muestras
    "MIN_MUESTRAS": 5,                    # muestras mínimas para estimar tendencia
    "MIN_SPAN_MINUTOS": 5,                # duración mínima cubierta por las muestras
    "MUESTRAS_MAX": 500,                  # ?limit= que se pide a la API
    "UMBRAL_DESCONEXION_MINUTOS": 30,
    "RECORDATORIO_DESCONEXION_HORAS": 24, # 0 = no recordar
    "UMBRAL_FALLOS_API": 5,               # ciclos fallidos seguidos antes de avisar al admin
    "API_TIMEOUT": 20,
    "API_INTENTOS": 2,
    "ALERTAR_NIVEL_ESTABLE": False,       # alertar nivel crítico aunque no esté bajando
    "REINICIO_SERVICIO_WINDOWS": "",      # nombre de servicio a reiniciar al detectar desconexión (vacío = no)
    "REINICIO_COOLDOWN_MINUTOS": 60,
}

MAX_TIEMPO_VACIADO_SEG = 7 * 86400

logger = logging.getLogger("MonitorEstanques")


# ================== LOGGING ==================

def configurar_logging():
    logger.setLevel(logging.INFO)
    formato = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s")
    archivo = RotatingFileHandler(LOG_PATH, maxBytes=5_000_000, backupCount=5, encoding="utf-8")
    archivo.setFormatter(formato)
    consola = logging.StreamHandler(sys.stdout)
    consola.setFormatter(formato)
    logger.addHandler(archivo)
    logger.addHandler(consola)


# ================== CONFIGURACIÓN ==================

class ConfigError(Exception):
    """monitor_config.json o .env inválidos."""


def _env(*nombres):
    for nombre in nombres:
        valor = os.getenv(nombre)
        if valor not in (None, ""):
            return valor.strip().strip('"').strip("'")
    return None


def _convertir(valor, tipo):
    if tipo is bool:
        return str(valor).strip().lower() in ("1", "true", "si", "sí", "yes")
    return tipo(valor)


def cargar_configuracion():
    """Relee .env y monitor_config.json. Devuelve un dict con todo lo necesario para un ciclo."""
    load_dotenv(ENV_PATH, override=True)

    try:
        with open(CONFIG_PATH, encoding="utf-8") as f:
            archivo = json.load(f)
    except FileNotFoundError:
        raise ConfigError(f"No existe {CONFIG_PATH}")
    except json.JSONDecodeError as e:
        raise ConfigError(f"monitor_config.json inválido: {e}")

    for clave in ("sitio", "api_base"):
        if not archivo.get(clave):
            raise ConfigError(f"Falta '{clave}' en monitor_config.json")

    params = {}
    json_params = archivo.get("parametros", {})
    for nombre, defecto in PARAMETROS_DEFECTO.items():
        tipo = type(defecto)
        valor = _env(nombre)
        # Compatibilidad: antes INTERVALO_MINUTOS era la espera tras una alerta (= repetición)
        if valor is None and nombre == "REPETIR_ALERTA_MINUTOS":
            valor = _env("INTERVALO_MINUTOS")
        if valor is None:
            valor = json_params.get(nombre, defecto)
        try:
            params[nombre] = _convertir(valor, tipo)
        except (TypeError, ValueError):
            logger.warning(f"Valor inválido para {nombre}: {valor!r}; se usa {defecto!r}")
            params[nombre] = defecto

    estanques = []
    for e in archivo.get("estanques", []):
        if not e.get("id") or not e.get("endpoint"):
            raise ConfigError(f"Estanque sin 'id' o 'endpoint': {e}")
        sufijo = str(e["id"]).upper()
        estanque = {
            "id": str(e["id"]),
            "nombre": e.get("nombre", str(e["id"])),
            "endpoint": e["endpoint"],
            "divisor": float(e.get("divisor", 1)),
            "unidad": e.get("unidad", "m"),
            "banda_muerta_por_min": float(e.get("banda_muerta_por_min", 0.001)),
        }
        # Umbrales: .env por estanque > .env general > json
        for clave, env_base in (("nivel_alerta", "NIVEL_ALERTA"), ("nivel_rebalse", "NIVEL_REBALSE")):
            valor = _env(f"{env_base}_{sufijo}", env_base)
            if valor is None:
                valor = e.get(clave)
            try:
                estanque[clave] = float(valor) if valor is not None else None
            except ValueError:
                logger.warning(f"Umbral inválido {env_base}_{sufijo}={valor!r}; se usa el del json")
                estanque[clave] = e.get(clave)
        estanques.append(estanque)

    conexion = archivo.get("conexion")
    if conexion:
        conexion = {
            "endpoint": conexion["endpoint"],
            "modo": conexion.get("modo", "equipo"),
            "nombre": conexion.get("nombre", "Equipo"),
            "ignorar": set(conexion.get("ignorar_sensores", [])),
        }

    return {
        "sitio": archivo["sitio"],
        "tz_api": zona_horaria(archivo.get("zona_horaria_api")),
        "api_base": archivo["api_base"].rstrip("/"),
        "estanques": estanques,
        "conexion": conexion,
        "params": params,
        "ultramsg": {
            "url": _env("API_URL"),
            "token": _env("API_TOKEN", "TOKEN"),
            "to": _env("API_TO", "TO"),
            "to_admin": _env("API_TO_ADMIN", "TO_ADMIN"),
        },
    }


def validar_credenciales(cfg):
    um = cfg["ultramsg"]
    faltan = [n for n, v in (("API_URL", um["url"]), ("API_TOKEN", um["token"])) if not v]
    if cfg["estanques"] and not um["to"]:
        faltan.append("API_TO")
    if faltan:
        raise ConfigError(f"Faltan variables en .env: {', '.join(faltan)}")
    if not um["to_admin"]:
        logger.warning("API_TO_ADMIN no está definido: las alertas de desconexión y de API solo quedarán en el log.")


# ================== ESTADO PERSISTENTE ==================

def cargar_estado():
    try:
        with open(ESTADO_PATH, encoding="utf-8") as f:
            estado = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        estado = {}
    for clave in ("desconexion", "alertas", "api"):
        estado.setdefault(clave, {})
    estado.setdefault("ultimo_reinicio", None)
    return estado


def guardar_estado(estado):
    tmp = ESTADO_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(estado, f, ensure_ascii=False, indent=2)
    os.replace(tmp, ESTADO_PATH)


# ================== UTILIDADES DE TIEMPO Y FORMATO ==================

def ahora_utc():
    return datetime.now(timezone.utc)


def zona_horaria(nombre):
    """tzinfo para 'zona_horaria_api'. Sin tzdata (Windows) se usa la zona local del servidor."""
    if not nombre or nombre.upper() == "UTC":
        return timezone.utc
    try:
        from zoneinfo import ZoneInfo
        return ZoneInfo(nombre)
    except Exception:
        logger.warning(f"Zona horaria '{nombre}' no disponible (instalar tzdata); se usa la del servidor.")
        return datetime.now().astimezone().tzinfo


def parse_time(valor, tz_api=timezone.utc):
    """ISO 8601 de la API -> datetime aware en UTC.

    Si la hora viene sin zona (p. ej. Cumpeo entrega hora Chile sin 'Z') se interpreta en tz_api.
    """
    texto = str(valor).strip()
    if texto.endswith("Z"):
        texto = texto[:-1] + "+00:00"
    dt = datetime.fromisoformat(texto)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=tz_api)
    return dt.astimezone(timezone.utc)


def a_iso(dt):
    return dt.isoformat() if dt else None


def desde_iso(texto):
    return datetime.fromisoformat(texto) if texto else None


def hora_local(dt):
    """Hora de Chile si zoneinfo está disponible; si no, la hora local del servidor."""
    try:
        from zoneinfo import ZoneInfo
        return dt.astimezone(ZoneInfo("America/Santiago")).strftime("%Y-%m-%d %H:%M") + " (hora Chile)"
    except Exception:
        return dt.astimezone().strftime("%Y-%m-%d %H:%M") + " (hora local)"


def formatear_duracion(segundos):
    """'2 día(s), 3 hora(s) y 5 minuto(s)'."""
    minutos_totales = max(int(segundos // 60), 0)
    dias, resto = divmod(minutos_totales, 1440)
    horas, minutos = divmod(resto, 60)
    partes = []
    if dias:
        partes.append(f"{dias} día(s)")
    if horas:
        partes.append(f"{horas} hora(s)")
    partes.append(f"{minutos} minuto(s)")
    if len(partes) == 1:
        return partes[0]
    return ", ".join(partes[:-1]) + " y " + partes[-1]


def formatear_tiempo_vaciado(segundos):
    """HH:MM:SS sin desbordar a las 24 h ('1 d 03:20:00')."""
    if segundos > MAX_TIEMPO_VACIADO_SEG:
        return "más de 7 días"
    segundos = int(segundos)
    dias, resto = divmod(segundos, 86400)
    horas, resto = divmod(resto, 3600)
    minutos, seg = divmod(resto, 60)
    hhmmss = f"{horas:02d}:{minutos:02d}:{seg:02d}"
    return f"{dias} d {hhmmss}" if dias else hhmmss


def formatear_nivel(valor, unidad):
    return f"{valor:.1f} %" if unidad == "%" else f"{valor:.2f} {unidad}"


def formatear_tasa(pendiente_por_seg, unidad):
    por_hora = pendiente_por_seg * 3600
    if unidad == "m":
        return f"{por_hora * 100:+.1f} cm/h"
    return f"{por_hora:+.1f} {unidad}/h"


# ================== ENVÍO DE MENSAJES ==================

class Notificador:
    def __init__(self, ultramsg, sin_enviar=False):
        self.um = ultramsg
        self.sin_enviar = sin_enviar

    def _enviar(self, destino, mensaje, etiqueta):
        if not destino:
            logger.warning(f"Sin destinatario para alerta {etiqueta}; solo se registra:\n{mensaje}")
            return False
        if self.sin_enviar:
            print(f"\n----- [{etiqueta}] (no enviado) -----\n{mensaje}\n")
            logger.info(f"[sin enviar] {etiqueta}: {mensaje!r}")
            return True
        data = {"token": self.um["token"], "to": destino, "body": mensaje}
        headers = {"Content-Type": "application/x-www-form-urlencoded"}
        try:
            r = requests.post(self.um["url"], data=data, headers=headers, timeout=10)
            if r.status_code == 200:
                logger.info(f"📤 Alerta {etiqueta} enviada: {mensaje!r}")
                return True
            logger.warning(f"⚠️ UltraMsg respondió {r.status_code} ({etiqueta}): {r.text}")
        except requests.RequestException as e:
            logger.error(f"❌ Error enviando alerta {etiqueta} a UltraMsg: {e}")
        return False

    def cliente(self, mensaje):
        return self._enviar(self.um["to"], mensaje, "cliente")

    def admin(self, mensaje):
        return self._enviar(self.um["to_admin"], mensaje, "admin")


# ================== CONSULTA A LA API ==================

class ApiError(Exception):
    """La API no entregó datos válidos (timeout, HTTP de error, JSON inesperado)."""


def consultar_api(url, params, cfg):
    p = cfg["params"]
    ultimo_error = None
    for intento in range(1, p["API_INTENTOS"] + 1):
        try:
            r = requests.get(url, params=params, timeout=p["API_TIMEOUT"])
            r.raise_for_status()
            return r.json()
        except (requests.RequestException, ValueError) as e:
            ultimo_error = e
            logger.warning(f"Intento {intento}/{p['API_INTENTOS']} fallido en {url}: {e}")
            if intento < p["API_INTENTOS"]:
                time.sleep(2)
    raise ApiError(str(ultimo_error))


def obtener_serie(estanque, cfg):
    """Serie [(time_utc, nivel)] ordenada ascendente y en la unidad final (ya dividida)."""
    url = cfg["api_base"] + estanque["endpoint"]
    data = consultar_api(url, {"limit": cfg["params"]["MUESTRAS_MAX"]}, cfg)
    if not isinstance(data, list):
        raise ApiError(f"Respuesta inesperada (se esperaba una lista): {str(data)[:200]}")
    serie = []
    for registro in data:
        try:
            serie.append((parse_time(registro["time"], cfg["tz_api"]), float(registro["value"]) / estanque["divisor"]))
        except (KeyError, TypeError, ValueError) as e:
            raise ApiError(f"Registro inválido {registro!r}: {e}")
    # No se asume que la API respete limit ni el orden
    serie.sort(key=lambda x: x[0])
    return serie[-cfg["params"]["MUESTRAS_MAX"]:]


def obtener_snapshot(cfg):
    """{sensor: time_utc} desde el endpoint de snapshot."""
    conexion = cfg["conexion"]
    data = consultar_api(cfg["api_base"] + conexion["endpoint"], None, cfg)
    if isinstance(data, dict) and isinstance(data.get("snapshot"), dict):
        data = data["snapshot"]
    if not isinstance(data, dict):
        raise ApiError(f"Snapshot con formato inesperado: {str(data)[:200]}")
    tiempos = {}
    for sensor, info in data.items():
        if sensor in conexion["ignorar"] or not isinstance(info, dict) or not info.get("time"):
            continue
        try:
            tiempos[sensor] = parse_time(info["time"], cfg["tz_api"])
        except (TypeError, ValueError):
            logger.warning(f"Snapshot: hora inválida para {sensor}: {info.get('time')!r}")
    return tiempos


def registrar_resultado_api(clave, error, cfg, estado, notif):
    """Cuenta ciclos fallidos por endpoint; avisa al admin al llegar al umbral y al recuperarse."""
    reg = estado["api"].setdefault(clave, {"fallos": 0, "alertado": False})
    sitio = cfg["sitio"]
    if error is None:
        if reg["alertado"]:
            notif.admin(f"✅ API RECUPERADA ✅\nSitio: {sitio}\nEndpoint: {clave}")
        reg["fallos"], reg["alertado"] = 0, False
        return
    reg["fallos"] += 1
    logger.error(f"{clave}: error de API ({reg['fallos']} ciclo(s) seguido(s)): {error}")
    if reg["fallos"] >= cfg["params"]["UMBRAL_FALLOS_API"] and not reg["alertado"]:
        enviado = notif.admin(
            f"⚠️ ALERTA API ⚠️\n"
            f"Sitio: {sitio}\n"
            f"Endpoint: {clave}\n"
            f"La API falla desde hace {reg['fallos']} ciclos seguidos; "
            f"no se puede verificar nivel ni conexión.\n"
            f"Último error: {str(error)[:300]}"
        )
        reg["alertado"] = enviado


# ================== TENDENCIA Y TIEMPO DE VACIADO ==================

def seleccionar_ventana(serie, p):
    """Muestras de la ventana normal; si son pocas, las últimas MIN_MUESTRAS dentro de la ventana máxima."""
    ultimo = serie[-1][0]
    ventana = [m for m in serie if m[0] >= ultimo - timedelta(minutes=p["VENTANA_VACIADO_MINUTOS"])]
    if len(ventana) < p["MIN_MUESTRAS"]:
        limite = ultimo - timedelta(minutes=p["VENTANA_MAXIMA_MINUTOS"])
        ventana = [m for m in serie[-p["MIN_MUESTRAS"]:] if m[0] >= limite]
    return ventana


def calcular_tendencia(serie, estanque, p):
    """Regresión lineal por mínimos cuadrados sobre la ventana.

    Devuelve (tendencia, pendiente_por_seg, segundos_vaciado, n_muestras).
    tendencia: 'Vaciado' | 'Llenado' | 'Estable' | 'Indeterminada'
    """
    ventana = seleccionar_ventana(serie, p)
    n = len(ventana)
    if n < 2:
        return "Indeterminada", None, None, n
    t0 = ventana[0][0]
    x = [(t - t0).total_seconds() for t, _ in ventana]
    y = [v for _, v in ventana]
    if n < p["MIN_MUESTRAS"] or x[-1] < p["MIN_SPAN_MINUTOS"] * 60:
        return "Indeterminada", None, None, n

    media_x, media_y = sum(x) / n, sum(y) / n
    sxx = sum((xi - media_x) ** 2 for xi in x)
    if sxx == 0:
        return "Indeterminada", None, None, n
    pendiente = sum((xi - media_x) * (yi - media_y) for xi, yi in zip(x, y)) / sxx

    banda = estanque["banda_muerta_por_min"] / 60
    if pendiente > banda:
        return "Llenado", pendiente, None, n
    if pendiente < -banda:
        nivel_actual = y[-1]
        segundos = nivel_actual / abs(pendiente) if nivel_actual > 0 else 0
        return "Vaciado", pendiente, segundos, n
    return "Estable", pendiente, None, n


# ================== DESCONEXIÓN ==================

def evaluar_desconexion(clave, nombre, ultimo_dato, cfg, estado, eventos):
    """Actualiza el estado de desconexión de un elemento. Devuelve True si está desconectado.

    ultimo_dato=None significa que la API respondió pero no hay ningún registro.
    Los avisos se acumulan en `eventos` para enviarlos agrupados al final del ciclo.
    """
    p = cfg["params"]
    ahora = ahora_utc()
    reg = estado["desconexion"].get(clave)

    if ultimo_dato is not None and ultimo_dato > ahora + timedelta(minutes=5):
        logger.warning(f"{nombre} - el último dato ({ultimo_dato.isoformat()}) está en el futuro; "
                       f"revisar zona horaria de la API o reloj del servidor.")

    desconectado = ultimo_dato is None or (ahora - ultimo_dato) > timedelta(minutes=p["UMBRAL_DESCONEXION_MINUTOS"])

    if not desconectado:
        logger.info(f"{nombre} - último dato hace {formatear_duracion((ahora - ultimo_dato).total_seconds())}.")
        if reg:
            if reg.get("alertado_en"):
                inicio = desde_iso(reg.get("ultimo_dato")) or desde_iso(reg["alertado_en"])
                eventos["recuperados"].append((nombre, (ahora - inicio).total_seconds()))
            logger.info(f"{nombre} - conexión restablecida.")
            del estado["desconexion"][clave]
        return False

    sin_datos = "sin registros" if ultimo_dato is None else formatear_duracion((ahora - ultimo_dato).total_seconds())
    logger.warning(f"{nombre} - SIN DATOS RECIENTES ({sin_datos}).")

    if reg is None:
        reg = {"ultimo_dato": a_iso(ultimo_dato), "alertado_en": None}
        estado["desconexion"][clave] = reg
    reg["ultimo_dato"] = a_iso(ultimo_dato)

    recordar = p["RECORDATORIO_DESCONEXION_HORAS"]
    alertado_en = desde_iso(reg.get("alertado_en"))
    if alertado_en is None:
        eventos["nuevos"].append((clave, nombre, ultimo_dato))
    elif recordar > 0 and ahora - alertado_en >= timedelta(hours=recordar):
        eventos["recordatorios"].append((clave, nombre, ultimo_dato))
    return True


def enviar_eventos_desconexion(eventos, cfg, estado, notif):
    sitio = cfg["sitio"]
    ahora = ahora_utc()

    def bloque(nombre, ultimo_dato):
        if ultimo_dato is None:
            return f"{nombre}\nNo hay registros en la API."
        return (f"{nombre}\n"
                f"Tiempo sin datos: {formatear_duracion((ahora - ultimo_dato).total_seconds())}.\n"
                f"Último dato: {hora_local(ultimo_dato)}")

    for tipo, titulo in (("nuevos", "⚠️ ALERTA DESCONEXIÓN ⚠️"),
                         ("recordatorios", "⚠️ ALERTA DESCONEXIÓN (recordatorio) ⚠️")):
        items = eventos[tipo]
        if not items:
            continue
        cuerpo = "\n\n".join(bloque(nombre, ultimo) for _, nombre, ultimo in items)
        mensaje = f"{titulo}\nSitio: {sitio}\nEl equipo no ha reportado datos recientes.\n\n{cuerpo}"
        if notif.admin(mensaje):
            for clave, _, _ in items:
                if clave in estado["desconexion"]:
                    estado["desconexion"][clave]["alertado_en"] = a_iso(ahora)

    if eventos["recuperados"]:
        cuerpo = "\n\n".join(f"{nombre}\nTiempo desconectado: {formatear_duracion(seg)}."
                             for nombre, seg in eventos["recuperados"])
        notif.admin(f"✅ CONEXIÓN RESTABLECIDA ✅\nSitio: {sitio}\n\n{cuerpo}")

    if eventos["nuevos"]:
        reiniciar_servicio_windows(cfg, estado, notif)


def reiniciar_servicio_windows(cfg, estado, notif):
    servicio = cfg["params"]["REINICIO_SERVICIO_WINDOWS"]
    if not servicio:
        return
    if os.name != "nt":
        logger.warning("REINICIO_SERVICIO_WINDOWS está definido pero el servidor no es Windows; se omite.")
        return
    ultimo = desde_iso(estado.get("ultimo_reinicio"))
    cooldown = timedelta(minutes=cfg["params"]["REINICIO_COOLDOWN_MINUTOS"])
    if ultimo and ahora_utc() - ultimo < cooldown:
        logger.info(f"Reinicio de '{servicio}' omitido (cooldown).")
        return
    estado["ultimo_reinicio"] = a_iso(ahora_utc())
    try:
        subprocess.run(["powershell", "-Command", f"Restart-Service -Name '{servicio}' -Force"],
                       check=True, capture_output=True, text=True, timeout=120)
        logger.info(f"Servicio '{servicio}' reiniciado.")
        notif.admin(f"⚙️ REINICIO AUTOMÁTICO ⚙️\nSitio: {cfg['sitio']}\n"
                    f"Se reinició el servicio '{servicio}' por interrupción en la llegada de datos.")
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError) as e:
        detalle = getattr(e, "stderr", None) or str(e)
        logger.error(f"No se pudo reiniciar '{servicio}': {detalle}")
        notif.admin(f"❌ ERROR DE REINICIO ❌\nSitio: {cfg['sitio']}\n"
                    f"Falló el reinicio del servicio '{servicio}'.\n{str(detalle)[:300]}")


# ================== ALERTAS DE NIVEL ==================

def debe_repetir(clave, cfg, estado):
    ultimo = desde_iso(estado["alertas"].get(clave))
    return ultimo is None or ahora_utc() - ultimo >= timedelta(minutes=cfg["params"]["REPETIR_ALERTA_MINUTOS"])


def evaluar_nivel(estanque, serie, cfg, estado, notif):
    p = cfg["params"]
    sitio, nombre, unidad = cfg["sitio"], estanque["nombre"], estanque["unidad"]
    nivel = serie[-1][1]
    tendencia, pendiente, seg_vaciado, n = calcular_tendencia(serie, estanque, p)
    tasa = f" ({formatear_tasa(pendiente, unidad)})" if pendiente is not None else ""
    logger.info(f"{nombre}: nivel {formatear_nivel(nivel, unidad)}, tendencia {tendencia}{tasa}, {n} muestra(s).")

    clave_critico = f"{estanque['id']}:critico"
    clave_rebalse = f"{estanque['id']}:rebalse"

    # Nivel crítico
    critico = (estanque["nivel_alerta"] is not None and nivel < estanque["nivel_alerta"]
               and tendencia != "Llenado"
               and (tendencia != "Estable" or p["ALERTAR_NIVEL_ESTABLE"]))
    if critico:
        if debe_repetir(clave_critico, cfg, estado):
            tiempo = formatear_tiempo_vaciado(seg_vaciado) if seg_vaciado is not None else "N/A"
            mensaje = (f"🚨 ALERTA NIVEL CRÍTICO 🚨\n"
                       f"Sitio: {sitio}\n"
                       f"Estanque: {nombre}\n"
                       f"Nivel Actual: {formatear_nivel(nivel, unidad)}\n"
                       f"Tendencia: {tendencia}{tasa}\n"
                       f"Tiempo Estimado de Vaciado: {tiempo}")
            if notif.cliente(mensaje):
                estado["alertas"][clave_critico] = a_iso(ahora_utc())
    else:
        estado["alertas"].pop(clave_critico, None)

    # Posible rebalse
    subiendo = tendencia == "Llenado" or (tendencia == "Indeterminada" and len(serie) >= 2 and serie[-1][1] > serie[-2][1])
    rebalse = estanque["nivel_rebalse"] is not None and nivel > estanque["nivel_rebalse"] and subiendo
    if rebalse:
        if debe_repetir(clave_rebalse, cfg, estado):
            mensaje = (f"⚠️ ALERTA POSIBLE REBALSE ⚠️\n"
                       f"Sitio: {sitio}\n"
                       f"Estanque: {nombre}\n"
                       f"Nivel Actual: {formatear_nivel(nivel, unidad)}\n"
                       f"Tendencia: {tendencia}{tasa}")
            if notif.cliente(mensaje):
                estado["alertas"][clave_rebalse] = a_iso(ahora_utc())
    else:
        estado["alertas"].pop(clave_rebalse, None)


# ================== CICLO ==================

def ejecutar_ciclo(cfg, estado, notif):
    eventos = {"nuevos": [], "recordatorios": [], "recuperados": []}

    for estanque in cfg["estanques"]:
        try:
            serie = obtener_serie(estanque, cfg)
            registrar_resultado_api(estanque["endpoint"], None, cfg, estado, notif)
        except ApiError as e:
            registrar_resultado_api(estanque["endpoint"], e, cfg, estado, notif)
            continue

        ultimo = serie[-1][0] if serie else None
        # Con el equipo desconectado los datos son viejos y no sirven para evaluar nivel
        if evaluar_desconexion(f"estanque:{estanque['id']}", f"Estanque: {estanque['nombre']}",
                               ultimo, cfg, estado, eventos):
            continue
        evaluar_nivel(estanque, serie, cfg, estado, notif)

    conexion = cfg["conexion"]
    if conexion:
        try:
            tiempos = obtener_snapshot(cfg)
            registrar_resultado_api(conexion["endpoint"], None, cfg, estado, notif)
        except ApiError as e:
            registrar_resultado_api(conexion["endpoint"], e, cfg, estado, notif)
            tiempos = None
        if tiempos is not None:
            if conexion["modo"] == "sensor":
                for sensor, t in sorted(tiempos.items()):
                    evaluar_desconexion(f"sensor:{sensor}", f"Sensor: {sensor}", t, cfg, estado, eventos)
            else:
                ultimo = max(tiempos.values()) if tiempos else None
                evaluar_desconexion("equipo", f"Equipo: {conexion['nombre']}", ultimo, cfg, estado, eventos)

    enviar_eventos_desconexion(eventos, cfg, estado, notif)


def main():
    parser = argparse.ArgumentParser(description="Monitoreo unificado de estanques y conexión")
    parser.add_argument("--una-vez", action="store_true", help="ejecuta un solo ciclo y termina")
    parser.add_argument("--sin-enviar", action="store_true", help="imprime los mensajes en vez de enviarlos")
    args = parser.parse_args()

    configurar_logging()
    try:
        cfg = cargar_configuracion()
        validar_credenciales(cfg)
    except ConfigError as e:
        logger.critical(f"Configuración inválida: {e}")
        sys.exit(1)

    logger.info(f"Monitor de estanques v{VERSION} iniciado. Sitio: {cfg['sitio']}, "
                f"{len(cfg['estanques'])} estanque(s), conexión por snapshot: {'sí' if cfg['conexion'] else 'no'}.")
    estado = cargar_estado()

    while True:
        inicio = time.monotonic()
        try:
            cfg = cargar_configuracion()
        except ConfigError as e:
            logger.error(f"Configuración inválida, se mantiene la anterior: {e}")
        notif = Notificador(cfg["ultramsg"], sin_enviar=args.sin_enviar)
        try:
            ejecutar_ciclo(cfg, estado, notif)
        except Exception:
            logger.exception("Error inesperado en el ciclo de monitoreo")
        # En modo prueba no se persiste: el servicio real no debe creer que ya avisó
        if not args.sin_enviar:
            try:
                guardar_estado(estado)
            except OSError as e:
                logger.error(f"No se pudo guardar el estado: {e}")

        if args.una_vez:
            break
        espera = cfg["params"]["INTERVALO_CHEQUEO_MINUTOS"] * 60 - (time.monotonic() - inicio)
        time.sleep(max(espera, 5))


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.info("Servicio detenido manualmente.")
