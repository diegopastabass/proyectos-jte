import requests
import time
import sys
import logging
import os
from logging.handlers import RotatingFileHandler
from dotenv import load_dotenv
from datetime import datetime

# ================== CARGA VARIABLES ==================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(BASE_DIR, ".env")

load_dotenv(ENV_PATH, override=True)


def recargar_env():
    """Recarga el archivo .env para leer cambios en caliente (umbrales, toggles, etc.)."""
    load_dotenv(ENV_PATH, override=True)


# Variables de entorno estáticas (se leen una sola vez al inicio)
API_BASE_URL = os.getenv("API_BASE_URL", "https://app.jteanalytics.cl")
API_URL_WHATSAPP = os.getenv("API_URL")
TOKEN = os.getenv("API_TOKEN")
TO = os.getenv("API_TO")

# Verificación de variables críticas
if not API_URL_WHATSAPP or not TOKEN or not TO:
    raise SystemExit("❌ Error: Las variables de API de WhatsApp (API_URL, API_TOKEN, API_TO) "
                     "no se cargaron correctamente desde .env")

if not API_BASE_URL:
    raise SystemExit("❌ Error: La variable API_BASE_URL no se cargó correctamente desde .env")

# ================== LOGGING ==================
LOG_PATH = os.path.join(BASE_DIR, "logs")
os.makedirs(LOG_PATH, exist_ok=True)

logger = logging.getLogger("MonitoreoUnificadoViveros")
logger.setLevel(logging.INFO)

file_handler = RotatingFileHandler(
    os.path.join(LOG_PATH, "monitoreo_unificado_viveros.log"),
    maxBytes=5_000_000,
    backupCount=5,
    encoding="utf-8"
)
console_handler = logging.StreamHandler(sys.stdout)

formatter = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s")
file_handler.setFormatter(formatter)
console_handler.setFormatter(formatter)
logger.addHandler(file_handler)
logger.addHandler(console_handler)


# ================== DEFINICIÓN DE ALARMAS ==================
# Diccionario central con la configuración de cada métrica a monitorear.
# Cada entrada define: sensor_id, nombre, clave del umbral en .env,
# valor por defecto del umbral, unidad, condición de alerta, y toggle key.
#
# Condiciones soportadas:
#   "mayor"  → alerta si valor > umbral
#   "menor"  → alerta si valor < umbral
#   "rango"  → alerta si valor < umbral_inferior OR valor > umbral_superior
#
# Para condición "rango" se usan:
#   env_umbral_inf / env_umbral_sup  → claves en .env
#   umbral_inf_default / umbral_sup_default → valores por defecto).
ALARMAS = {
    "temp_cam_frio": {
        "sensor_id": 6,
        "nombre": "Temperatura Cámara de Frío",
        "condicion": "rango",        # alerta si valor fuera del rango
        "env_umbral_inf": "TEMP_CAM_FRIO_INF",
        "env_umbral_sup": "TEMP_CAM_FRIO_SUP",
        "umbral_inf_default": 5.0,
        "umbral_sup_default": 30.0,
        "unidad": "°C",
        "toggle_key": "MONITOR_TEMP_CAM_FRIO",
        "emoji_alerta": "🚨",
        "msg_alerta": "La temperatura está fuera del rango permitido.",
    },
    "hum_cam_frio": {
        "sensor_id": 4,
        "nombre": "Humedad Cámara de Frío",
        "condicion": "menor",        # alerta si valor < umbral
        "env_umbral": "HUM_MONITOREO",
        "umbral_default": 80.0,
        "unidad": "%",
        "toggle_key": "MONITOR_HUM_CAM_FRIO",
        "emoji_alerta": "🚨",
        "msg_alerta": "La humedad está por debajo del límite permitido.",
    },
    "temp_cam_calor": {
        "sensor_id": 5,
        "nombre": "Temperatura Cámara de Calor",
        "condicion": "rango",        # alerta si valor fuera del rango
        "env_umbral_inf": "TEMP_CAM_CALOR_INF",
        "env_umbral_sup": "TEMP_CAM_CALOR_SUP",
        "umbral_inf_default": 22.0,
        "umbral_sup_default": 30.0,
        "unidad": "°C",
        "toggle_key": "MONITOR_TEMP_CAM_CALOR",
        "emoji_alerta": "🚨",
        "msg_alerta": "La temperatura está fuera del rango permitido.",
    },
    "hum_cam_calor": {
        "sensor_id": 3,
        "nombre": "Humedad Cámara de Calor",
        "condicion": "menor",
        "env_umbral": "HUM_CAM_CALOR",
        "umbral_default": 80.0,
        "unidad": "%",
        "toggle_key": "MONITOR_HUM_CAM_CALOR",
        "emoji_alerta": "🚨",
        "msg_alerta": "La humedad está por debajo del límite permitido.",
    },
    "temp_ambiente": {
        "sensor_id": 7,
        "nombre": "Temperatura Ambiental",
        "condicion": "mayor",
        "env_umbral": "TEMP_AMB",
        "umbral_default": 23.0,
        "unidad": "°C",
        "toggle_key": "MONITOR_TEMP_AMB",
        "emoji_alerta": "🚨",
        "msg_alerta": "La temperatura ambiental ha superado el límite permitido.",
    },
    "hum_ambiente": {
        "sensor_id": 8,
        "nombre": "Humedad Ambiental",
        "condicion": "menor",
        "env_umbral": "HUM_AMB",
        "umbral_default": 40.0,
        "unidad": "%",
        "toggle_key": "MONITOR_HUM_AMB",
        "emoji_alerta": "🚨",
        "msg_alerta": "La humedad ambiental está por debajo del límite permitido.",
    },
}

# ================== FUNCIONES DE CONSULTA API ==================

def obtener_datos_actuales():
    """Consulta GET /viveros/latest → último valor de cada sensor.
    
    Retorna un dict con claves "1".."8" (string), cada una con {value, time}.
    Retorna None si la consulta falla.
    """
    url = f"{API_BASE_URL}/viveros/latest"
    try:
        response = requests.get(url, timeout=15)
        response.raise_for_status()
        data = response.json()
        logger.info(f"📡 Datos actuales obtenidos correctamente desde API.")
        return data
    except requests.RequestException as e:
        logger.error(f"Error al consultar {url}: {e}", exc_info=True)
        return None
    except ValueError as e:
        logger.error(f"Respuesta no válida (JSON) desde {url}: {e}", exc_info=True)
        return None


def obtener_minmax_dia():
    """Consulta GET /viveros/min-max?date=YYYY-MM-DD → min/max del día por sensor.
    
    Retorna un dict con claves "3".."8" (string), cada una con {min, max}.
    Retorna None si la consulta falla.
    """
    date = datetime.now().strftime("%Y-%m-%d")
    url = f"{API_BASE_URL}/viveros/min-max?date={date}"
    try:
        response = requests.get(url, timeout=15)
        response.raise_for_status()
        data = response.json()
        logger.info(f"📊 Min/Max del día obtenidos correctamente desde API.")
        return data
    except requests.RequestException as e:
        logger.error(f"Error al consultar {url}: {e}", exc_info=True)
        return None
    except ValueError as e:
        logger.error(f"Respuesta no válida (JSON) desde {url}: {e}", exc_info=True)
        return None


# ================== FUNCIÓN DE ALERTA ==================

def enviar_alerta(mensaje: str):
    """Envía un mensaje de alerta vía WhatsApp (UltraMsg API)."""
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    data = {"token": TOKEN, "to": TO, "body": mensaje}
    try:
        response = requests.post(API_URL_WHATSAPP, data=data, headers=headers, timeout=10)
        if response.status_code == 200:
            logger.info("📩 Alerta enviada con éxito.")
        else:
            logger.warning(f"⚠️ Error en respuesta UltraMsg ({response.status_code}): {response.text}")
    except requests.RequestException as e:
        logger.error(f"Error enviando mensaje a UltraMsg: {e}", exc_info=True)


# ================== LÓGICA DE MONITOREO ==================

def evaluar_condicion(valor, umbral, condicion):
    """Evalúa si se debe disparar la alerta según la condición configurada.
    
    Args:
        valor: Valor actual del sensor.
        umbral: Valor umbral configurado (float para mayor/menor,
                dict {"inf": float, "sup": float} para rango).
        condicion: "mayor", "menor" o "rango".
    
    Returns:
        True si se debe disparar la alerta.
    """
    if condicion == "mayor":
        return valor > umbral
    elif condicion == "menor":
        return valor < umbral
    elif condicion == "rango":
        return valor < umbral["inf"] or valor > umbral["sup"]
    return False


def construir_mensaje_alerta(config, valor_actual, umbral, minmax_sensor):
    """Construye el mensaje de alerta con toda la información relevante.
    
    Args:
        config: Diccionario de configuración de la alarma.
        valor_actual: Valor actual del sensor.
        umbral: float para mayor/menor, dict {"inf": float, "sup": float} para rango.
        minmax_sensor: Dict con {min, max} del día, o None.
    """
    hora_actual = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    unidad = config["unidad"]
    emoji = config["emoji_alerta"]

    lineas = [
        f"{emoji} ALERTA: {config['nombre'].upper()} {emoji}",
        f"Hora de monitoreo: {hora_actual}",
        f"Valor Actual: {valor_actual:.2f} {unidad}",
    ]

    if minmax_sensor:
        lineas.append(f"Máximo del día: {minmax_sensor.get('max', 'N/D')} {unidad}")
        lineas.append(f"Mínimo del día: {minmax_sensor.get('min', 'N/D')} {unidad}")

    if config["condicion"] == "rango":
        lineas.append(f"Rango Permitido: {umbral['inf']:.2f} — {umbral['sup']:.2f} {unidad}")
    else:
        lineas.append(f"Umbral Configurado: {umbral:.2f} {unidad}")

    lineas.append(config["msg_alerta"])

    return "\n".join(lineas)


def ejecutar_monitoreo():
    """Ejecuta un ciclo completo de monitoreo sobre todas las alarmas configuradas.
    
    1. Recarga .env para leer toggles y umbrales en caliente.
    2. Consulta la API una sola vez por ciclo (latest + min-max).
    3. Itera sobre ALARMAS: verifica toggle → obtiene dato → evalúa condición → alerta.
    
    Returns:
        Intervalo en segundos para el próximo ciclo.
    """
    recargar_env()

    # Leer intervalo de monitoreo (recargable en caliente)
    try:
        intervalo = int(os.getenv("MONITOR_INTERVAL", "600"))
    except ValueError:
        logger.warning("Valor inválido para MONITOR_INTERVAL; usando 600s por defecto.")
        intervalo = 600

    # Obtener datos de la API
    datos = obtener_datos_actuales()
    minmax = obtener_minmax_dia()

    if not datos:
        mensaje_error = (
            f"⚠️ ALERTA: SIN CONEXIÓN A API ⚠️\n"
            f"Hora: {datetime.now():%Y-%m-%d %H:%M:%S}\n"
            f"No se pudo obtener datos desde {API_BASE_URL}/viveros/latest.\n"
            f"Posible caída del servidor o problemas de red."
        )
        enviar_alerta(mensaje_error)
        logger.error("❌ No se pudieron obtener datos de la API. Se envió alerta.")
        return intervalo

    # Resumen de toggles activos para el log
    toggles_activos = []
    toggles_inactivos = []

    for key, config in ALARMAS.items():
        # Verificar toggle de activación
        try:
            toggle = int(os.getenv(config["toggle_key"], "1"))
        except ValueError:
            toggle = 1  # Si el valor es inválido, se activa por defecto

        if toggle == 0:
            toggles_inactivos.append(config["nombre"])
            continue

        toggles_activos.append(config["nombre"])

        sensor_id = str(config["sensor_id"])

        # Obtener valor actual del sensor desde la respuesta de la API
        sensor_data = datos.get(sensor_id)

        if not sensor_data or sensor_data.get("value") is None:
            # Sin datos para este sensor → posible falla del sensor
            mensaje_sin_datos = (
                f"⚠️ ALERTA: SIN DATOS DE SENSOR ⚠️\n"
                f"Hora: {datetime.now():%Y-%m-%d %H:%M:%S}\n"
                f"No se encontraron datos para: {config['nombre']} (Sensor ID: {sensor_id})\n"
                f"Posible desconexión o falla de transmisión del sensor."
            )
            enviar_alerta(mensaje_sin_datos)
            logger.warning(f"⚠️ Sin datos para {config['nombre']} (sensor {sensor_id})")
            continue

        valor_actual = float(sensor_data["value"])

        # Obtener umbral(es) (recargable en caliente desde .env)
        if config["condicion"] == "rango":
            # Umbral por rango: inferior y superior
            try:
                umbral_inf = float(os.getenv(
                    config["env_umbral_inf"], str(config["umbral_inf_default"])))
            except ValueError:
                umbral_inf = config["umbral_inf_default"]
                logger.warning(
                    f"Valor inválido para {config['env_umbral_inf']}; "
                    f"usando {umbral_inf} como valor por defecto.")
            try:
                umbral_sup = float(os.getenv(
                    config["env_umbral_sup"], str(config["umbral_sup_default"])))
            except ValueError:
                umbral_sup = config["umbral_sup_default"]
                logger.warning(
                    f"Valor inválido para {config['env_umbral_sup']}; "
                    f"usando {umbral_sup} como valor por defecto.")
            umbral = {"inf": umbral_inf, "sup": umbral_sup}
        else:
            # Umbral simple (mayor/menor)
            try:
                umbral = float(os.getenv(config["env_umbral"], str(config["umbral_default"])))
            except ValueError:
                umbral = config["umbral_default"]
                logger.warning(
                    f"Valor inválido para {config['env_umbral']}; "
                    f"usando {umbral} como valor por defecto."
                )

        # Obtener min/max del día para este sensor
        minmax_sensor = None
        if minmax:
            minmax_sensor = minmax.get(sensor_id)

        # Evaluar condición de alerta
        if evaluar_condicion(valor_actual, umbral, config["condicion"]):
            mensaje = construir_mensaje_alerta(config, valor_actual, umbral, minmax_sensor)
            enviar_alerta(mensaje)
            if config["condicion"] == "rango":
                logger.warning(
                    f"🚨 ALERTA {config['nombre']}: "
                    f"{valor_actual:.2f} {config['unidad']} "
                    f"(fuera del rango {umbral['inf']:.2f} — {umbral['sup']:.2f} {config['unidad']})"
                )
            else:
                logger.warning(
                    f"🚨 ALERTA {config['nombre']}: "
                    f"{valor_actual:.2f} {config['unidad']} "
                    f"({'>' if config['condicion'] == 'mayor' else '<'} "
                    f"{umbral:.2f} {config['unidad']})"
                )
        else:
            if config["condicion"] == "rango":
                logger.info(
                    f"✅ {config['nombre']}: "
                    f"{valor_actual:.2f} {config['unidad']} "
                    f"(Rango: {umbral['inf']:.2f} — {umbral['sup']:.2f} {config['unidad']})"
                )
            else:
                logger.info(
                    f"✅ {config['nombre']}: "
                    f"{valor_actual:.2f} {config['unidad']} "
                    f"(Umbral: {umbral:.2f} {config['unidad']})"
                )

    # Log resumen de toggles
    if toggles_inactivos:
        logger.info(f"⏸️  Alarmas DESACTIVADAS: {', '.join(toggles_inactivos)}")

    logger.info(f"📋 Ciclo completado. {len(toggles_activos)} alarmas evaluadas. "
                f"Próximo ciclo en {intervalo}s.")

    return intervalo


# ================== LOOP PRINCIPAL ==================
if __name__ == "__main__":
    logger.info("🚀 Iniciando servicio unificado de monitoreo de viveros...")
    logger.info(f"📡 API Base URL: {API_BASE_URL}")
    logger.info(f"📋 Alarmas configuradas: {len(ALARMAS)}")

    # Mostrar configuración inicial
    for key, config in ALARMAS.items():
        toggle = os.getenv(config["toggle_key"], "1")
        estado = "🟢 ON" if toggle == "1" else "🔴 OFF"
        if config["condicion"] == "rango":
            u_inf = os.getenv(config["env_umbral_inf"], str(config["umbral_inf_default"]))
            u_sup = os.getenv(config["env_umbral_sup"], str(config["umbral_sup_default"]))
            logger.info(f"  {estado} {config['nombre']} — Rango: {u_inf} — {u_sup} {config['unidad']}")
        else:
            umbral = os.getenv(config["env_umbral"], str(config["umbral_default"]))
            logger.info(f"  {estado} {config['nombre']} — Umbral: {umbral} {config['unidad']}")

    logger.info("=" * 60)

    while True:
        try:
            intervalo = ejecutar_monitoreo()
        except Exception as e:
            logger.exception(f"Error inesperado durante el ciclo de monitoreo: {e}")
            intervalo = 600  # fallback
        time.sleep(intervalo)
