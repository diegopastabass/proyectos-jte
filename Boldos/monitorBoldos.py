import time
import logging
import requests
import psycopg2
from datetime import datetime
import os
from dotenv import load_dotenv

# --- Cargar variables desde .env ---
load_dotenv()

# --- Configuración desde .env ---
DB_CONFIG = {
    "host": os.getenv("DB_HOST"),
    "port": os.getenv("DB_PORT"),
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PASS"),
    "dbname": os.getenv("DB_NAME"),
}

API_URL = os.getenv("API_URL")
TOKEN = os.getenv("TOKEN")
TO = os.getenv("TO")

# --- Configuración dinámica ---
def get_dynamic_config():
    return {
        "INTERVALO_MINUTOS": int(os.getenv("INTERVALO_MINUTOS", 5)),
        "NIVEL_ALERTA": float(os.getenv("NIVEL_ALERTA", 2)),
    }

# Nombre de sensores
SENSOR_ESTANQUE = "SSR_BOLDOS--slave.estanque"
SENSOR_ESTANQUE_2 = "SSR_BOLDOS--slave.estanque_2"

# --- Logging ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_FILE = os.path.join(BASE_DIR, "logs_BOLDOS.txt")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.FileHandler(LOG_FILE, encoding="utf-8", mode="a")]
)

# --- Funciones ---
def obtener_niveles(nombre_sensor):
    query = """
        SELECT mt_value, mt_time_2 
        FROM ssr_boldos
        WHERE mt_name = %s
        ORDER BY mt_time_2 DESC
        LIMIT 2;
    """
    
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        cursor.execute(query, (nombre_sensor,))
        rows = cursor.fetchall()
        cursor.close()
        conn.close()

        if len(rows) < 2:
            logging.warning(f"No hay suficientes datos para {nombre_sensor}.")
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

    return datetime.utcfromtimestamp(tiempo_restante_segundos).strftime("%H:%M:%S")

def enviar_alerta(mensaje: str):
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    data = {"token": TOKEN, "to": TO, "body": mensaje}

    try:
        response = requests.post(API_URL, data=data, headers=headers, timeout=10)
        if response.status_code == 200:
            logging.info(f"📤 Alerta enviada con éxito: {mensaje}")
        else:
            logging.warning(f"⚠️ Error en respuesta API ({response.status_code}): {response.text}")
    except requests.RequestException as e:
        logging.error(f"❌ Error enviando mensaje a API: {e}")

def procesar_estanque(sensor, nombre_publico, nivel_alerta, divisor=1):
    nivel_actual, nivel_anterior, time_actual, time_anterior = obtener_niveles(sensor)

    if nivel_actual is None:
        return False

    # Aplicar divisor
    nivel_actual = nivel_actual / divisor
    nivel_anterior = nivel_anterior / divisor

    if nivel_actual < nivel_anterior and nivel_actual < nivel_alerta:
        tiempo_vaciado = calcular_tiempo_vaciado(
            nivel_actual, nivel_anterior, time_actual, time_anterior
        )
        if tiempo_vaciado:
            mensaje = (
                f"🚨 ALERTA NIVEL CRÍTICO 🚨\n"
                f"Estanque: {nombre_publico}\n"
                f"Nivel Actual: {nivel_actual:.2f} m\n"
                f"Tiempo Estimado de Vaciado: {tiempo_vaciado}"
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
    while True:
        cfg = get_dynamic_config()
        intervalo_alerta = cfg["INTERVALO_MINUTOS"]   
        nivel_alerta = cfg["NIVEL_ALERTA"]

        logging.info("Iniciando ciclo de monitoreo...")

        alerta_estanque_2 = procesar_estanque(SENSOR_ESTANQUE_2, "Estanque 2", nivel_alerta, divisor=100)
        
        alerta_global = alerta_estanque_1 or alerta_estanque_2
        
        intervalo = intervalo_alerta if alerta_global else 1

        logging.info(
            f"{'⚠ Intervalo aumentado por alerta' if alerta_global else '✓ Intervalo normal'}: "
            f"{intervalo} minuto(s)."
        )

        time.sleep(intervalo * 60)

if __name__ == "__main__":
    try:
        monitorear()
    except KeyboardInterrupt:
        logging.info("Servicio detenido manualmente.")