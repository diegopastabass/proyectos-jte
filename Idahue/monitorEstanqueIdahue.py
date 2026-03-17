import time
import logging
import requests
import psycopg2
import os
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# --- Configuración ---
DB_CONFIG = {
    "host": os.getenv("DB_HOST"),
    "port": os.getenv("DB_PORT"),
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PASS"),
    "dbname": os.getenv("DB_NAME"),
    "sslmode": os.getenv("DB_SSLMODE", "require"),
}

API_URL = os.getenv("API_URL")
TOKEN = os.getenv("API_TOKEN")
TO = os.getenv("API_TO")
INTERVALO_MINUTOS = 5

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_FILE = os.path.join(BASE_DIR, "logs.txt")

SENSOR_NIVEL_P1 = "PLANTA1_IDAHUE--slave.nivel"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.FileHandler(LOG_FILE, encoding="utf-8", mode="a")]
)

# --- Funciones ---
def obtener_niveles(sensor):
    query = """
        SELECT mt_value, mt_time_2 
        FROM ssr_idahue
        WHERE mt_name = %s
        ORDER BY mt_time_2 DESC
        LIMIT 2;
    """
    
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        cursor.execute(query, (sensor,))
        rows = cursor.fetchall()
        cursor.close()
        conn.close()

        if len(rows) < 2:
            logging.warning("No hay suficientes datos en la BD.")
            return None, None, None, None

        nivel_actual, time_actual = rows[0]
        nivel_anterior, time_anterior = rows[1]

        return float(nivel_actual), float(nivel_anterior), time_actual, time_anterior
    
    except Exception as e:
        logging.error(f"Error de conexión a BD: {e}")
        return None, None, None, None

def calcular_tiempo_vaciado(nivel_actual, nivel_anterior, time_actual, time_anterior):
    delta_nivel = nivel_actual - nivel_anterior
    delta_tiempo = (time_actual - time_anterior).total_seconds()

    if delta_nivel >= 0 or delta_tiempo <= 0:
        return None

    tasa_descenso = abs(delta_nivel) / delta_tiempo
    tiempo_restante_segundos = nivel_actual / tasa_descenso

    # Corrección para compatibilidad con datetime
    return str(datetime.utcfromtimestamp(tiempo_restante_segundos).strftime("%H:%M:%S"))

def enviar_alerta(nivel_actual, tiempo_vaciado):
    body_msg1 = (
        f"⚠️ Nivel de Estanque crítico\n"
        f"Nivel Actual: {nivel_actual:.2f} m\n"
        f"Tiempo Estimado de Vaciado: {tiempo_vaciado} Hrs"
    )
    body_msg2 = (
        f"⚠️ Nivel de Estanque en Rebalse\n"
        f"Nivel Actual: {nivel_actual:.2f} m"
    )
    if (tiempo_vaciado is not None):
        data1 = {"token": TOKEN, "to": TO, "body": body_msg1}
    else:
        data2 = {"token": TOKEN, "to": TO, "body": body_msg2}

    headers = {"Content-Type": "application/x-www-form-urlencoded"}

    try:
        response = requests.post(API_URL, data=data, headers=headers, timeout=10)
        logging.info(f"Respuesta API (status {response.status_code}): {response.text}")
        response.raise_for_status()
    except requests.RequestException as e:
        logging.error(f"Error al enviar alerta: {e}")

def monitorear(nivel_min, nivel_max, sensor, divisor):
    logging.info("Consultando datos de estanque...")
    nivel_actual, nivel_anterior, time_actual, time_anterior = obtener_niveles(sensor)

    if nivel_actual is not None and nivel_anterior is not None:
        if nivel_actual / divisor < nivel_anterior / divisor and nivel_actual / divisor < nivel_min:
            tiempo_vaciado = calcular_tiempo_vaciado(
                nivel_actual / divisor, nivel_anterior / divisor, time_actual, time_anterior
            )
            if tiempo_vaciado:
                enviar_alerta(nivel_actual / divisor, tiempo_vaciado)
            else:
                logging.info("No se pudo calcular tiempo de vaciado.")
        if nivel_actual / divisor > nivel_anterior / divisor and nivel_actual / divisor > nivel_max:
            enviar_alerta(nivel_actual / divisor, None)
        else:
            logging.info("Condiciones no cumplidas. Todo normal. Nivel actual: {} m | Nivel anterior: {} m | Sensor: {}".format(nivel_actual / divisor, nivel_anterior / divisor, sensor))
    else:
        logging.warning("No se obtuvieron datos válidos.")

if __name__ == "__main__":
    try:
        while True:
            monitorear(1.5, 5, SENSOR_NIVEL_P1, 100)
            logging.info(f"Esperando {INTERVALO_MINUTOS} minutos para la siguiente consulta...")
            time.sleep(INTERVALO_MINUTOS * 60)
    except KeyboardInterrupt:
        logging.info("Servicio detenido manualmente.")