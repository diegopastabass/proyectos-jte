import time
import logging
import requests
import mysql.connector
import os
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# --- Configuración ---
DB_CONFIG = {
    "host": os.getenv("MY_HOST"),
    "user": os.getenv("MY_USER"),
    "password": os.getenv("MY_PASSWORD"),
    "database": os.getenv("MY_DATABASE"),
}

API_URL = os.getenv("API_URL")
TOKEN = os.getenv("API_TOKEN")
TO = os.getenv("API_TO")
TO_ADMIN = os.getenv("API_TO_ADMIN")
INTERVALO_MINUTOS = 5

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_FILE = os.path.join(BASE_DIR, "logs_llaveria.txt")

# Diccionario de sensores con sus respectivos nombres para alertas
SENSORES = {
    "BOMBA_LLAVERIA--slave.REGF828": "SONDAJE_1",
    "BOMBA_LLAVERIA_2--slave.REGF828": "SONDAJE_2"
}

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.FileHandler(LOG_FILE, encoding="utf-8", mode="a")]
)

# Estado de desconexión para no repetir alertas
estado_desconexion = {
    "SONDAJE_1": False,
    "SONDAJE_2": False
}

# --- Funciones ---
def obtener_niveles(sensor):
    query = """
        SELECT mt_value, mt_time_2 
        FROM apr_llaveria
        WHERE mt_name = %s
        ORDER BY mt_time_2 DESC
        LIMIT 2;
    """
    
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor()
        cursor.execute(query, (sensor,))
        rows = cursor.fetchall()
        cursor.close()
        conn.close()

        if len(rows) < 2:
            if len(rows) == 1:
                nivel_actual, time_actual = rows[0]
                return float(nivel_actual), None, time_actual, None
            
            logging.warning(f"No hay suficientes datos en la BD para el sensor {sensor}.")
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

def enviar_alerta_nivel(nivel_actual, tiempo_vaciado, nombre_sensor):
    body_msg = (
        f"⚠️ Nivel de Estanque crítico ({nombre_sensor})\n"
        f"Nivel Actual: {nivel_actual:.2f} m\n"
        f"Tiempo Estimado de Vaciado: {tiempo_vaciado} Hrs"
    )
    
    payload = {"token": TOKEN, "to": TO, "body": body_msg}
    headers = {"Content-Type": "application/x-www-form-urlencoded"}

    try:
        response = requests.post(API_URL, data=payload, headers=headers, timeout=10)
        logging.info(f"Respuesta API alerta nivel (status {response.status_code}): {response.text}")
        response.raise_for_status()
    except requests.RequestException as e:
        logging.error(f"Error al enviar alerta de nivel para {nombre_sensor}: {e}")

def enviar_alerta_desconexion(nombre_sensor, tiempo_desconectado_minutos):
    body_msg = (
        f"🔴 Alerta de Desconexión de Equipo\n"
        f"Equipo: {nombre_sensor}\n"
        f"Tiempo sin conexión: {tiempo_desconectado_minutos:.0f} minutos"
    )
    
    payload = {"token": TOKEN, "to": TO_ADMIN, "body": body_msg}
    headers = {"Content-Type": "application/x-www-form-urlencoded"}

    try:
        response = requests.post(API_URL, data=payload, headers=headers, timeout=10)
        logging.info(f"Respuesta API alerta desconexión (status {response.status_code}): {response.text}")
        response.raise_for_status()
    except requests.RequestException as e:
        logging.error(f"Error al enviar alerta de desconexión para {nombre_sensor}: {e}")

def monitorear(nivel_min, sensor_db, nombre_sensor):
    logging.info(f"Consultando datos de {nombre_sensor}...")
    nivel_actual, nivel_anterior, time_actual, time_anterior = obtener_niveles(sensor_db)

    # 1. Chequeo de conexión
    if time_actual is not None:
        ahora = datetime.now()
        tiempo_sin_conexion = (ahora - time_actual).total_seconds() / 60.0

        if tiempo_sin_conexion > 30:
            if not estado_desconexion[nombre_sensor]:
                logging.warning(f"{nombre_sensor} desconectado por {tiempo_sin_conexion:.0f} minutos. Enviando alerta a admin.")
                enviar_alerta_desconexion(nombre_sensor, tiempo_sin_conexion)
                estado_desconexion[nombre_sensor] = True
            else:
                logging.info(f"{nombre_sensor} sigue desconectado ({tiempo_sin_conexion:.0f} min). Alerta ya fue enviada.")
        else:
            if estado_desconexion[nombre_sensor]:
                logging.info(f"{nombre_sensor} ha recuperado la conexión.")
                estado_desconexion[nombre_sensor] = False

    # 2. Chequeo de nivel (sin divisor)
    if nivel_actual is not None and nivel_anterior is not None:
        if nivel_actual < nivel_anterior and nivel_actual < nivel_min:
            tiempo_vaciado = calcular_tiempo_vaciado(
                nivel_actual, nivel_anterior, time_actual, time_anterior
            )
            if tiempo_vaciado:
                enviar_alerta_nivel(nivel_actual, tiempo_vaciado, nombre_sensor)
            else:
                logging.info(f"No se pudo calcular tiempo de vaciado para {nombre_sensor}.")
        else:
            logging.info(f"Condiciones no cumplidas. Todo normal para {nombre_sensor}. Nivel actual: {nivel_actual:.2f} m | Nivel anterior: {nivel_anterior:.2f} m")
    else:
        if time_actual is None:
            logging.warning(f"No se obtuvieron datos válidos para {nombre_sensor}.")
        else:
            logging.info(f"Datos insuficientes para calcular vaciado en {nombre_sensor} (solo hay una medición).")

if __name__ == "__main__":
    # Nivel crítico en metros
    NIVEL_ALERTA = 1.5

    try:
        while True:
            for sensor_db, nombre_sensor in SENSORES.items():
                monitorear(NIVEL_ALERTA, sensor_db, nombre_sensor)
            
            logging.info(f"Esperando {INTERVALO_MINUTOS} minutos para la siguiente consulta...\n")
            time.sleep(INTERVALO_MINUTOS * 60)
    except KeyboardInterrupt:
        logging.info("Servicio detenido manualmente.")
