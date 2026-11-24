"""
Monitor de alarmas de Viveros El Tambo (temperatura, humedad y VPD por zona).

- Rangos y alertas activas: GET {API_BASE_URL}/viveros/config, los mismos que muestra
  el dashboard y que el administrador edita desde él. Si la API no responde, usa los
  umbrales del .env (claves antiguas) como respaldo.
- Valores actuales: GET /viveros/latest (y /viveros/min-max para el contexto del día).
- Con estado (estado_alarmas.json): un aviso al salir del rango, un recordatorio cada
  REPETIR_ALERTA_HORAS mientras siga fuera y un aviso al volver. Un reinicio no repite avisos.
- Sensor sin variación: si una señal de las cámaras repite el mismo valor más de
  PEGADO_HORAS (12; la HR de frío repite ~5 h con normalidad) con datos al día, avisa al grupo admin (una vez) y al recuperarse.
- La desconexión y las caídas de la API las avisa monitorConexionViveros.py (F3);
  este monitor no evalúa datos con más de SIN_DATOS_MIN minutos y no duplica esos avisos.

Uso:
  python monitorUnificado.py                       servicio continuo
  python monitorUnificado.py --una-vez             un ciclo
  python monitorUnificado.py --una-vez --sin-enviar  un ciclo; imprime los mensajes y no guarda estado
"""
import argparse
import json
import logging
import os
import sys
import time
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler

import requests
from dotenv import load_dotenv

try:
    from zoneinfo import ZoneInfo
    TZ_CHILE = ZoneInfo("America/Santiago")
except Exception:  # Windows sin tzdata: se usa la hora local del servidor
    TZ_CHILE = None

VERSION = "2.0.0"
SITIO = "Viveros El Tambo"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(BASE_DIR, ".env")
ESTADO_PATH = os.path.join(BASE_DIR, "estado_alarmas.json")

load_dotenv(ENV_PATH, override=True)

# ================== LOGGING ==================
LOG_DIR = os.path.join(BASE_DIR, "logs")
os.makedirs(LOG_DIR, exist_ok=True)

logger = logging.getLogger("MonitoreoUnificadoViveros")
logger.setLevel(logging.INFO)
_formato = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s")
_archivo = RotatingFileHandler(
    os.path.join(LOG_DIR, "monitoreo_unificado_viveros.log"),
    maxBytes=5_000_000,
    backupCount=5,
    encoding="utf-8",
)
_archivo.setFormatter(_formato)
_consola = logging.StreamHandler(sys.stdout)
_consola.setFormatter(_formato)
logger.addHandler(_archivo)
logger.addHandler(_consola)

# ================== DEFINICIÓN DE SEÑALES ==================
# Zona y variable como en GET /config; `sensor` es el sensor_id de /latest.
# El VPD no tiene sensor propio: /latest lo entrega como vpd_<zona> y su hora es la de la T.
ZONAS = {
    "frio": {"nombre": "Cámara de Frío", "t": "6", "hr": "4", "vpd": "vpd_frio"},
    "calor": {"nombre": "Cámara de Calor", "t": "5", "hr": "3", "vpd": "vpd_calor"},
    "exterior": {"nombre": "Exterior (Open-Meteo)", "t": "7", "hr": "8", "vpd": "vpd_ambiente"},
}
NOMBRE_VARIABLE = {"t": "Temperatura", "hr": "Humedad", "vpd": "VPD"}
UNIDAD = {"t": "°C", "hr": "%", "vpd": "kPa"}
DECIMALES = {"t": 1, "hr": 1, "vpd": 2}
# Para volver a "en rango" el valor debe entrar al menos esto: evita avisos alternados en el límite.
HISTERESIS = {"t": 0.3, "hr": 1.0, "vpd": 0.05}
# Valores físicamente posibles; lo demás es un error del transmisor y no se evalúa.
VALIDOS = {"t": (-40.0, 60.0), "hr": (0.0, 100.0), "vpd": (0.0, 10.0)}
# Señales de las cámaras que se vigilan por "sin variación" (el exterior es un modelo meteorológico).
SENSORES_PEGADO = {"5": "T Cámara de Calor", "3": "HR Cámara de Calor", "6": "T Cámara de Frío", "4": "HR Cámara de Frío"}

# Respaldo si GET /config falla: claves del .env que usaba la versión anterior.
RESPALDO_ENV = {
    ("frio", "t"): ("TEMP_CAM_FRIO_INF", "TEMP_CAM_FRIO_SUP", "MONITOR_TEMP_CAM_FRIO", 0.0, 5.0),
    ("frio", "hr"): ("HUM_MONITOREO", None, "MONITOR_HUM_CAM_FRIO", 80.0, None),
    ("calor", "t"): ("TEMP_CAM_CALOR_INF", "TEMP_CAM_CALOR_SUP", "MONITOR_TEMP_CAM_CALOR", 22.0, 30.0),
    ("calor", "hr"): ("HUM_CAM_CALOR", None, "MONITOR_HUM_CAM_CALOR", 80.0, None),
    ("exterior", "t"): (None, "TEMP_AMB", "MONITOR_TEMP_AMB", None, 23.0),
    ("exterior", "hr"): ("HUM_AMB", None, "MONITOR_HUM_AMB", 40.0, None),
    ("exterior", "vpd"): (None, "VPD_AMB", "MONITOR_VPD_AMB", None, 2.0),
}


# ================== UTILIDADES ==================
def ahora():
    return datetime.now(timezone.utc)


def hora_chile(dt):
    local = dt.astimezone(TZ_CHILE) if TZ_CHILE else dt.astimezone()
    return local.strftime("%d-%m-%Y %H:%M")


def parse_iso(texto):
    return datetime.fromisoformat(texto.replace("Z", "+00:00"))


def duracion(segundos):
    minutos = int(segundos // 60)
    h, m = divmod(minutos, 60)
    d, h = divmod(h, 24)
    partes = []
    if d:
        partes.append(f"{d} d")
    if h:
        partes.append(f"{h} h")
    if m or not partes:
        partes.append(f"{m} min")
    return " ".join(partes)


def numero(v, dec):
    return f"{v:.{dec}f}".replace(".", ",")


def env_float(clave, defecto):
    try:
        return float(os.getenv(clave, defecto))
    except (TypeError, ValueError):
        return defecto


def parametros():
    load_dotenv(ENV_PATH, override=True)
    return {
        "api": os.getenv("API_BASE_URL", "https://app.jteanalytics.cl").rstrip("/") + "/viveros",
        "whatsapp": os.getenv("API_URL"),
        "token": os.getenv("API_TOKEN"),
        "to": os.getenv("API_TO"),
        "to_admin": os.getenv("API_TO_ADMIN"),
        "intervalo": int(env_float("MONITOR_INTERVAL", 600)),
        "repetir_h": env_float("REPETIR_ALERTA_HORAS", 2),
        "sin_datos_min": env_float("SIN_DATOS_MIN", 30),
        "pegado_h": env_float("PEGADO_HORAS", 12),
    }


# ================== API ==================
def get_json(url):
    r = requests.get(url, timeout=15)
    r.raise_for_status()
    return r.json()


def obtener_umbrales(p):
    """Rangos desde GET /config. Devuelve {(zona, variable): {min, max, alerta}} y el origen."""
    try:
        cfg = get_json(f"{p['api']}/config")
        umbrales = {}
        for z in cfg["zonas"]:
            for v, r in z["variables"].items():
                umbrales[(z["id"], v)] = {"min": r["min"], "max": r["max"], "alerta": bool(r["alerta"])}
        return umbrales, "API"
    except (requests.RequestException, ValueError, KeyError) as e:
        logger.warning(f"No se pudo leer {p['api']}/config ({e}); se usan los umbrales del .env.")
        umbrales = {}
        for (zona, var), (k_inf, k_sup, k_toggle, d_inf, d_sup) in RESPALDO_ENV.items():
            umbrales[(zona, var)] = {
                "min": env_float(k_inf, d_inf) if k_inf else None,
                "max": env_float(k_sup, d_sup) if k_sup else None,
                "alerta": os.getenv(k_toggle, "1") == "1",
            }
        return umbrales, ".env"


# ================== ESTADO ==================
def cargar_estado():
    try:
        with open(ESTADO_PATH, encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, ValueError):
        return {"alarmas": {}, "pegados": {}}


def guardar_estado(estado):
    tmp = ESTADO_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(estado, f, ensure_ascii=False, indent=2)
    os.replace(tmp, ESTADO_PATH)


# ================== ENVÍO ==================
class Envio:
    def __init__(self, p, simular):
        self.p = p
        self.simular = simular

    def enviar(self, mensaje, admin=False):
        destino = self.p["to_admin"] if admin and self.p["to_admin"] else self.p["to"]
        if self.simular:
            print(f"\n--- Mensaje a {'grupo admin' if admin else 'grupo cliente'} ---\n{mensaje}\n")
            return True
        if not (self.p["whatsapp"] and self.p["token"] and destino):
            logger.error("Faltan API_URL, API_TOKEN o el destinatario en .env: el aviso queda solo en el log.")
            return False
        try:
            r = requests.post(
                self.p["whatsapp"],
                data={"token": self.p["token"], "to": destino, "body": mensaje},
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                timeout=10,
            )
            if r.status_code == 200:
                logger.info("📩 Aviso enviado.")
                return True
            logger.warning(f"UltraMsg respondió {r.status_code}: {r.text}")
        except requests.RequestException as e:
            logger.error(f"Error enviando a UltraMsg: {e}")
        return False


# ================== EVALUACIÓN ==================
def clasificar(valor, u):
    if u["min"] is not None and valor < u["min"]:
        return "bajo"
    if u["max"] is not None and valor > u["max"]:
        return "alto"
    return "ok"


def recuperado(valor, u, var):
    h = HISTERESIS[var]
    return (u["min"] is None or valor >= u["min"] + h) and (u["max"] is None or valor <= u["max"] - h)


def texto_rango(u, var):
    unidad, dec = UNIDAD[var], DECIMALES[var]
    if u["min"] is not None and u["max"] is not None:
        return f"{numero(u['min'], dec)} a {numero(u['max'], dec)} {unidad}"
    if u["min"] is not None:
        return f"mínimo {numero(u['min'], dec)} {unidad}"
    return f"máximo {numero(u['max'], dec)} {unidad}"


def decodificar(sensor, valor):
    """Las T de las cámaras llegan como entero con signo ×10 leído sin signo: 6553,5 = −0,1 °C.
    La API nueva ya las corrige; esto cubre la API anterior."""
    if sensor in ("5", "6") and valor > 6000:
        return round(valor - 6553.6, 1)
    return valor


def lectura(datos, zona, var):
    """(valor, hora) de /latest para la zona y variable, o (None, None)."""
    clave = ZONAS[zona][var]
    if var == "vpd":
        valor = datos.get(clave)
        info_t = datos.get(ZONAS[zona]["t"])
        hora = info_t.get("time") if isinstance(info_t, dict) else None
        return (float(valor), hora) if isinstance(valor, (int, float)) and hora else (None, None)
    info = datos.get(clave)
    if not isinstance(info, dict) or info.get("value") is None or not info.get("time"):
        return None, None
    valor = decodificar(clave, float(info["value"]))
    lo, hi = VALIDOS[var]
    if not lo <= valor <= hi:
        logger.warning(f"Valor imposible en {zona}/{var}: {valor}; se ignora.")
        return None, None
    return valor, info["time"]


def mensaje_alarma(tipo, zona, var, valor, u, minmax, desde=None, condiciones=None):
    unidad, dec = UNIDAD[var], DECIMALES[var]
    nombre = f"{NOMBRE_VARIABLE[var]} {ZONAS[zona]['nombre']}"
    if tipo == "alerta":
        lado = "bajo el mínimo" if clasificar(valor, u) == "bajo" else "sobre el máximo"
        lineas = [f"🚨 ALERTA: {nombre.upper()} 🚨", f"Sitio: {SITIO}", f"Valor actual: {numero(valor, dec)} {unidad} ({lado})"]
    elif tipo == "recordatorio":
        lineas = [
            f"⏰ RECORDATORIO: {nombre.upper()}",
            f"Sitio: {SITIO}",
            f"Sigue fuera de rango desde {hora_chile(desde)} ({duracion((ahora() - desde).total_seconds())}).",
            f"Valor actual: {numero(valor, dec)} {unidad}",
        ]
    else:
        lineas = [
            f"✅ NORMALIZADO: {nombre.upper()}",
            f"Sitio: {SITIO}",
            f"Volvió al rango después de {duracion((ahora() - desde).total_seconds())}.",
            f"Valor actual: {numero(valor, dec)} {unidad}",
        ]
    lineas.append(f"Rango permitido: {texto_rango(u, var)}")
    if condiciones:  # VPD: la T y la HR con que se calculó
        cond = " · ".join(f"{NOMBRE_VARIABLE[v]}: {numero(x, DECIMALES[v])} {UNIDAD[v]}" for v, x in condiciones.items())
        lineas.append(f"Condiciones: {cond}")
    lo, hi = VALIDOS[var]
    if minmax and var != "vpd" and lo <= minmax["min"] <= hi and lo <= minmax["max"] <= hi:
        lineas.append(f"Hoy: mínimo {numero(minmax['min'], dec)} {unidad} · máximo {numero(minmax['max'], dec)} {unidad}")
    lineas.append(f"Hora: {hora_chile(ahora())} (hora Chile)")
    return "\n".join(lineas)


def evaluar_alarmas(datos, minmax, umbrales, estado, envio, p):
    activas = 0
    for zona in ZONAS:
        for var in ("t", "hr", "vpd"):
            u = umbrales.get((zona, var))
            clave = f"{zona}_{var}"
            previo = estado["alarmas"].get(clave)
            if not u or not u["alerta"] or (u["min"] is None and u["max"] is None):
                if previo:  # alerta desactivada o sin rango: se olvida sin avisar
                    estado["alarmas"].pop(clave, None)
                continue
            activas += 1
            valor, hora = lectura(datos, zona, var)
            if valor is None:
                logger.info(f"Sin dato para {clave}.")
                continue
            antiguedad = (ahora() - parse_iso(hora)).total_seconds() / 60
            if antiguedad > p["sin_datos_min"]:
                logger.info(f"{clave}: dato de hace {int(antiguedad)} min; no se evalúa (la desconexión la avisa F3).")
                continue
            sensor_mm = (minmax or {}).get(ZONAS[zona][var]) if var != "vpd" else None

            condiciones = None
            if var == "vpd":
                condiciones = {v: lectura(datos, zona, v)[0] for v in ("t", "hr")}
                condiciones = {v: x for v, x in condiciones.items() if x is not None}
            fuera = clasificar(valor, u) != "ok"
            if not previo and fuera:
                if envio.enviar(mensaje_alarma("alerta", zona, var, valor, u, sensor_mm, condiciones=condiciones)):
                    t = ahora().isoformat()
                    estado["alarmas"][clave] = {"desde": t, "ultimo_aviso": t}
                logger.warning(f"🚨 {clave}: {valor} fuera de {texto_rango(u, var)}")
            elif previo and fuera:
                ultimo = parse_iso(previo["ultimo_aviso"])
                if (ahora() - ultimo).total_seconds() >= p["repetir_h"] * 3600:
                    if envio.enviar(mensaje_alarma("recordatorio", zona, var, valor, u, sensor_mm, parse_iso(previo["desde"]), condiciones)):
                        previo["ultimo_aviso"] = ahora().isoformat()
                logger.info(f"{clave}: sigue fuera ({valor}).")
            elif previo and recuperado(valor, u, var):
                if envio.enviar(mensaje_alarma("normalizado", zona, var, valor, u, sensor_mm, parse_iso(previo["desde"]), condiciones)):
                    estado["alarmas"].pop(clave, None)
                logger.info(f"✅ {clave}: normalizado ({valor}).")
            else:
                logger.info(f"✅ {clave}: {valor} ({texto_rango(u, var)})")
    return activas


def evaluar_pegados(datos, estado, envio, p):
    """Avisa al grupo admin si una señal repite el mismo valor más de PEGADO_HORAS."""
    for sensor, nombre in SENSORES_PEGADO.items():
        info = datos.get(sensor)
        if not isinstance(info, dict) or info.get("value") is None or not info.get("time"):
            continue
        hora = parse_iso(info["time"])
        if (ahora() - hora).total_seconds() / 60 > p["sin_datos_min"]:
            continue
        valor = decodificar(sensor, float(info["value"]))
        reg = estado["pegados"].get(sensor)
        if not reg or reg["valor"] != valor:
            if reg and reg.get("avisado"):
                envio.enviar(
                    f"✅ SENSOR CON VARIACIÓN: {nombre}\nSitio: {SITIO}\n"
                    f"Volvió a cambiar después de {duracion((ahora() - parse_iso(reg['desde'])).total_seconds())}.\n"
                    f"Valor actual: {numero(valor, 1)}",
                    admin=True,
                )
            estado["pegados"][sensor] = {"valor": valor, "desde": ahora().isoformat(), "avisado": False}
            continue
        horas = (ahora() - parse_iso(reg["desde"])).total_seconds() / 3600
        if horas >= p["pegado_h"] and not reg["avisado"]:
            if envio.enviar(
                f"⚠️ SENSOR SIN VARIACIÓN: {nombre}\nSitio: {SITIO}\n"
                f"Marca {numero(valor, 1)} sin cambios desde {hora_chile(parse_iso(reg['desde']))} "
                f"({duracion(horas * 3600)}). Revisar el sensor en terreno.",
                admin=True,
            ):
                reg["avisado"] = True


def ciclo(simular=False):
    p = parametros()
    envio = Envio(p, simular)
    estado = cargar_estado()
    try:
        datos = get_json(f"{p['api']}/latest")
    except (requests.RequestException, ValueError) as e:
        logger.error(f"No se pudo leer {p['api']}/latest: {e}. (El aviso de API caída lo envía F3.)")
        return p["intervalo"]
    try:
        hoy = (datetime.now(TZ_CHILE) if TZ_CHILE else datetime.now()).strftime("%Y-%m-%d")
        minmax = get_json(f"{p['api']}/min-max?date={hoy}")
    except (requests.RequestException, ValueError):
        minmax = None

    umbrales, origen = obtener_umbrales(p)
    activas = evaluar_alarmas(datos, minmax, umbrales, estado, envio, p)
    evaluar_pegados(datos, estado, envio, p)
    if not simular:
        guardar_estado(estado)
    logger.info(
        f"📋 Ciclo completado: {activas} alarma(s) activa(s), umbrales desde {origen}, "
        f"{len(estado['alarmas'])} fuera de rango. Próximo ciclo en {p['intervalo']} s."
    )
    return p["intervalo"]


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Monitor de alarmas de Viveros")
    parser.add_argument("--una-vez", action="store_true", help="ejecuta un solo ciclo")
    parser.add_argument("--sin-enviar", action="store_true", help="imprime los mensajes y no guarda estado")
    args = parser.parse_args()

    logger.info(f"🚀 Monitor de alarmas de Viveros v{VERSION}")
    if args.una_vez:
        ciclo(simular=args.sin_enviar)
        sys.exit(0)
    while True:
        try:
            intervalo = ciclo(simular=args.sin_enviar)
        except Exception as e:  # el servicio no debe morir por un error inesperado
            logger.exception(f"Error inesperado en el ciclo: {e}")
            intervalo = 600
        time.sleep(intervalo)
