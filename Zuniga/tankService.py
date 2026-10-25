import time
import logging
import requests
from datetime import datetime
import os
from dotenv import load_dotenv

# --- Cargar variables desde .env ---
load_dotenv()

# --- Configuración desde .env ---
API_URL = os.getenv("API_URL")
TOKEN = os.getenv("API_TOKEN") or os.getenv("TOKEN")
TO = os.getenv("API_TO") or os.getenv("TO")
TO_ADMIN = os.getenv("API_TO_ADMIN")

# Consulta a la API de niveles
NIVEL_URL = "https://app.jteanalytics.cl/zuniga/nivel?limit=2"
API_TIMEOUT = 20          # segundos; mayor al statement_timeout (10 s) de la API
API_INTENTOS = 2          # reintentos dentro de un mismo ciclo
UMBRAL_FALLOS_API = 5     # ciclos consecutivos fallidos antes de avisar al admin

# Estado entre ciclos para la falla de la API
estado_api = {"fallos": 0, "alertado": False}

# Estos valores se recargarán en cada ciclo
def get_dynamic_config():
    return {
        "INTERVALO_MINUTOS": int(os.getenv("INTERVALO_MINUTOS", 5)),
        "NIVEL_ALERTA": float(os.getenv("NIVEL_ALERTA", 2)),
    }

# Nombre de sensores
SENSOR_ESTANQUE = "SSR_ZUNIGA--slave.estanque"

# --- Logging ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_FILE = os.path.join(BASE_DIR, "logs_ZUNIGA.txt")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.FileHandler(LOG_FILE, encoding="utf-8", mode="a")]
)


# --- Funciones ---
class ApiError(Exception):
    """La API no pudo entregar los niveles (timeout, HTTP 5xx, respuesta inválida)."""


def obtener_niveles(nombre_sensor):
    """Obtiene los dos últimos registros desde la API.

    Devuelve (nivel_actual, nivel_anterior, time_actual, time_anterior), o cuatro
    None si la API respondió pero hay menos de 2 registros. Lanza ApiError si la
    API no responde correctamente, para no confundirlo con "sin datos".
    """
    data = None
    ultimo_error = None
    for intento in range(1, API_INTENTOS + 1):
        try:
            response = requests.get(NIVEL_URL, timeout=API_TIMEOUT)
            response.raise_for_status()
            data = response.json()
            break
        except (requests.RequestException, ValueError) as e:
            ultimo_error = e
            logging.warning(f"Intento {intento}/{API_INTENTOS} fallido consultando la API: {e}")
            if intento < API_INTENTOS:
                time.sleep(2)

    if data is None:
        raise ApiError(str(ultimo_error))

    try:
        if len(data) < 2:
            logging.warning(f"No hay suficientes datos desde la API para {nombre_sensor}.")
            return None, None, None, None

        # Ordenar por time ascendente para tener el anterior y luego el actual
        data_sorted = sorted(data, key=lambda x: x["time"])

        registro_anterior = data_sorted[0]
        registro_actual = data_sorted[1]

        def parse_time(t_str):
            if t_str.endswith("Z"):
                t_str = t_str[:-1] + "+00:00"
            return datetime.fromisoformat(t_str).replace(tzinfo=None)

        time_anterior = parse_time(registro_anterior["time"])
        time_actual = parse_time(registro_actual["time"])

        nivel_anterior = float(registro_anterior["value"])
        nivel_actual = float(registro_actual["value"])
    except (KeyError, TypeError, ValueError, AttributeError) as e:
        raise ApiError(f"Respuesta inesperada de la API: {e}")

    return nivel_actual, nivel_anterior, time_actual, time_anterior


def calcular_tiempo_vaciado(nivel_actual, nivel_anterior, time_actual, time_anterior):
    """Estimación de vaciado en HH:MM:SS."""
    delta_nivel = nivel_actual - nivel_anterior
    delta_tiempo = (time_actual - time_anterior).total_seconds()

    if delta_nivel >= 0 or delta_tiempo <= 0:
        return None

    tasa_descenso = abs(delta_nivel) / delta_tiempo
    tiempo_restante_segundos = nivel_actual / tasa_descenso

    return datetime.utcfromtimestamp(tiempo_restante_segundos).strftime("%H:%M:%S")

def enviar_alerta(mensaje: str):
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    data = {"token": TOKEN, "to": TO, "body": mensaje}

    try:
        response = requests.post(API_URL, data=data, headers=headers, timeout=10)
        if response.status_code == 200:
            logging.info(f"📤 Alerta enviada con éxito: {mensaje}")
        else:
            logging.warning(f"⚠️ Error en respuesta UltaMsg ({response.status_code}): {response.text}")
    except requests.RequestException as e:
        logging.error(f"❌ Error enviando mensaje a UltaMsg: {e}")

def enviar_alerta_admin(mensaje: str):
    if not TO_ADMIN:
        logging.warning("⚠️ No se puede enviar alerta de administrador porque API_TO_ADMIN no está definido.")
        return

    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    data = {"token": TOKEN, "to": TO_ADMIN, "body": mensaje}

    try:
        response = requests.post(API_URL, data=data, headers=headers, timeout=10)
        if response.status_code == 200:
            logging.info(f"📤 Alerta de Admin enviada con éxito: {mensaje}")
        else:
            logging.warning(f"⚠️ Error en respuesta UltaMsg (Admin) ({response.status_code}): {response.text}")
    except requests.RequestException as e:
        logging.error(f"❌ Error enviando mensaje a UltaMsg (Admin): {e}")

def procesar_estanque(sensor, nombre_publico, nivel_alerta):
    try:
        nivel_actual, nivel_anterior, time_actual, time_anterior = obtener_niveles(sensor)
    except ApiError as e:
        estado_api["fallos"] += 1
        logging.error(f"Error obteniendo niveles desde la API ({estado_api['fallos']} ciclo(s) seguido(s)): {e}")
        if estado_api["fallos"] >= UMBRAL_FALLOS_API and not estado_api["alertado"]:
            enviar_alerta_admin(
                f"⚠️ ALERTA API ⚠️\n"
                f"Estanque: {nombre_publico}\n"
                f"La API de niveles falla desde hace {estado_api['fallos']} ciclos seguidos, "
                f"por lo que no se puede verificar el nivel ni la desconexión del equipo.\n"
                f"Último error: {e}"
            )
            estado_api["alertado"] = True
        return False

    if estado_api["alertado"]:
        enviar_alerta_admin(f"✅ La API de niveles se recuperó ({nombre_publico}).")
    estado_api["fallos"] = 0
    estado_api["alertado"] = False

    # Verificar si el equipo está desconectado (más de 30 minutos sin datos)
    if time_actual is not None:
        tiempo_desconectado = datetime.utcnow() - time_actual
        if tiempo_desconectado.total_seconds() > 1800:
            horas = int(tiempo_desconectado.total_seconds() // 3600)
            minutos = int((tiempo_desconectado.total_seconds() % 3600) // 60)
            
            tiempo_str = f"{minutos} minuto(s)"
            if horas > 0:
                tiempo_str = f"{horas} hora(s) y " + tiempo_str
                
            mensaje = (
                f"⚠️ ALERTA DESCONEXIÓN ⚠️\n"
                f"Estanque: {nombre_publico}\n"
                f"El equipo no ha reportado datos recientes.\n"
                f"Tiempo sin conexión: {tiempo_str}."
            )
            enviar_alerta_admin(mensaje)
            return True

    if nivel_actual is None:
        return False

    nivel_actual = nivel_actual
    nivel_anterior = nivel_anterior

    if nivel_actual < nivel_anterior and nivel_actual < nivel_alerta:
        tiempo_vaciado = calcular_tiempo_vaciado(
            nivel_actual, nivel_anterior, time_actual, time_anterior
        )
        if tiempo_vaciado:
            mensaje = (
                f"🚨 ALERTA NIVEL CRÍTICO 🚨\n"
                f"Estanque: {nombre_publico}\n"
                f"Nivel Actual: {nivel_actual:.2f} m\n"
                f"Tiempo Estimado de Vaciado: {tiempo_vaciado if tiempo_vaciado else 'N/A'}"
            )
            enviar_alerta(mensaje)
            return True
        else:
            logging.info(f"No se pudo calcular tiempo de vaciado para {nombre_publico}.")
            return False
    else:
        logging.info(f"{nombre_publico}: condiciones normales.")
        return False

def monitorear():
    """Bucle principal con intervalo dinámico."""
    while True:
        cfg = get_dynamic_config()
        intervalo_alerta = cfg["INTERVALO_MINUTOS"]   
        nivel_alerta = cfg["NIVEL_ALERTA"]

        logging.info("Iniciando ciclo de monitoreo...")

        alerta_nuevo = procesar_estanque(SENSOR_ESTANQUE, "Estanque Nuevo", nivel_alerta)

        hay_alerta = alerta_nuevo

        # Intervalos dinámicos
        intervalo = intervalo_alerta if hay_alerta else 1

        logging.info(
            f"{'⚠ Intervalo aumentado por alerta' if hay_alerta else '✓ Intervalo normal'}: "
            f"{intervalo} minuto(s)."
        )

        time.sleep(intervalo * 60)



if __name__ == "__main__":
    try:
        monitorear()
    except KeyboardInterrupt:
        logging.info("Servicio detenido manualmente.")
