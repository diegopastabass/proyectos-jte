# -*- coding: utf-8 -*-
import psycopg2
import requests
import time
import logging
import os
from psycopg2.extras import RealDictCursor
from psycopg2 import pool
from logging.handlers import RotatingFileHandler
from dotenv import load_dotenv
from datetime import datetime

# ================== CARGA VARIABLES ==================
BASE_DIR = os.path.dirname(__file__)
ENV_PATH = os.path.join(BASE_DIR, ".env")
TXT_ENV_PATH = os.path.join(BASE_DIR, "env.txt")

load_dotenv(ENV_PATH, override=True)

def recargar_env_txt():
    vars_dict = {}
    try:
        with open(TXT_ENV_PATH, "r", encoding="utf-8") as f:
            for line in f:
                if "=" in line and not line.strip().startswith("#"):
                    key, value = line.strip().split("=", 1)
                    vars_dict[key.strip()] = value.strip()
    except FileNotFoundError:
        pass
    return vars_dict

env_vars = recargar_env_txt()

DB_CONFIG = {
    "host": os.getenv("DB_HOST"),
    "port": os.getenv("DB_PORT"),
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PASSWORD"),
    "dbname": os.getenv("DB_NAME"),
    "sslmode": os.getenv("DB_SSLMODE", "require"),
}

API_URL = os.getenv("API_URL")
TOKEN = os.getenv("API_TOKEN")
TO = '+56996181706'

# ================== LOGGING ==================
LOG_PATH = os.path.join(BASE_DIR, "logs")
os.makedirs(LOG_PATH, exist_ok=True)

logger = logging.getLogger("MonitoreoTemperaturaAmbientalViveros")
logger.setLevel(logging.INFO)

file_handler = RotatingFileHandler(
    os.path.join(LOG_PATH, "monitoreo_temperatura_ambiental_viveros.log"),
    maxBytes=5_000_000,
    backupCount=5,
    encoding="utf-8"
)
console_handler = logging.StreamHandler(open("CONOUT$", "w", encoding="utf-8"))
formatter = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s")
file_handler.setFormatter(formatter)
console_handler.setFormatter(formatter)
logger.addHandler(file_handler)
logger.addHandler(console_handler)

# ================== POOL DE CONEXIONES ==================
try:
    connection_pool = psycopg2.pool.SimpleConnectionPool(
        1, 10, **DB_CONFIG, cursor_factory=RealDictCursor
    )
    logger.info("✅ Pool de conexiones a PostgreSQL inicializado correctamente.")
except Exception as e:
    logger.critical(f"❌ Error inicializando el pool de conexiones: {e}", exc_info=True)
    raise SystemExit(1)

# ================== FUNCIONES ==================
def obtener_estadisticas_ultima_hora(sensor_id=7):
    query = """
        SELECT 
            MAX(value) AS max_temp,
            MIN(value) AS min_temp,
            (SELECT time FROM viveros_tambo 
                WHERE sensor_id = %s AND time >= NOW() - INTERVAL '1 hour'
                ORDER BY value DESC LIMIT 1) AS hora_max,
            (SELECT time FROM viveros_tambo 
                WHERE sensor_id = %s AND time >= NOW() - INTERVAL '1 hour'
                ORDER BY value ASC LIMIT 1) AS hora_min
        FROM viveros_tambo
        WHERE sensor_id = %s AND time >= NOW() - INTERVAL '1 hour';
    """
    conn = None
    try:
        conn = connection_pool.getconn()
        with conn.cursor() as cur:
            cur.execute(query, (sensor_id, sensor_id, sensor_id))
            result = cur.fetchone()
        if not result or result["max_temp"] is None:
            return None  # sin datos
        return result
    except Exception as e:
        logger.error(f"Error al obtener estadísticas de la última hora: {e}", exc_info=True)
        return None
    finally:
        if conn:
            connection_pool.putconn(conn)

def enviar_alerta(mensaje: str):
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    data = {"token": TOKEN, "to": TO, "body": mensaje}
    try:
        response = requests.post(API_URL, data=data, headers=headers, timeout=10)
        if response.status_code == 200:
            logger.info("📩 Alerta enviada con éxito.")
        else:
            logger.warning(f"⚠️ Error en respuesta UltraMsg ({response.status_code}): {response.text}")
    except requests.RequestException as e:
        logger.error(f"Error enviando mensaje a UltraMsg: {e}", exc_info=True)

def esperar_inicio_de_hora():
    ahora = datetime.now()
    segundos_hasta_proxima_hora = 3600 - (ahora.minute * 60 + ahora.second)
    logger.info(f"⏳ Esperando {segundos_hasta_proxima_hora} segundos hasta el inicio de la próxima hora.")
    time.sleep(segundos_hasta_proxima_hora)

def monitorear_temperatura(sensor_id=7):
    env_vars = recargar_env_txt()
    try:
        temp_umbral = float(env_vars.get("TEMP_AMB", "5"))
    except ValueError:
        logger.warning("Valor inválido en env.txt; usando 5°C como valor por defecto.")
        temp_umbral = 5.0

    datos = obtener_estadisticas_ultima_hora(sensor_id)
    hora_actual = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    if not datos:
        mensaje = (
            f"⚠️ ALERTA: SIN DATOS DE SENSOR ⚠️\n"
            f"Hora de monitoreo: {hora_actual}\n"
            f"No se registraron datos del sensor {sensor_id} en la última hora.\n"
            f"Posible desconexión o falla de transmisión."
        )
        enviar_alerta(mensaje)
        logger.warning("⚠️ No se encontraron datos en la última hora.")
        return

    max_temp = datos["max_temp"]
    min_temp = datos["min_temp"]
    hora_max = datos["hora_max"].strftime("%Y-%m-%d %H:%M:%S") if datos["hora_max"] else "N/D"
    hora_min = datos["hora_min"].strftime("%Y-%m-%d %H:%M:%S") if datos["hora_min"] else "N/D"

    if max_temp > temp_umbral:
        mensaje = (
            f"🚨 ALERTA DE ALTA TEMPERATURA AMBIENTAL 🚨\n"
            f"Hora de monitoreo: {hora_actual}\n"
            f"Temperatura máxima última hora: {max_temp:.2f} °C (a las {hora_max})\n"
            f"Temperatura mínima última hora: {min_temp:.2f} °C (a las {hora_min})\n"
            f"Umbral configurado: {temp_umbral:.2f} °C\n"
            f"La temperatura ha superado el límite permitido."
        )
        enviar_alerta(mensaje)
    else:
        logger.info(
            f"✅ Temperatura estable ({max_temp:.2f}°C máx / {min_temp:.2f}°C mín | Umbral {temp_umbral:.2f}°C)"
        )

# ================== LOOP PRINCIPAL ==================
if __name__ == "__main__":
    logger.info("🚀 Iniciando servicio de monitoreo de temperatura ambiental...")
    while True:
        esperar_inicio_de_hora()
        try:
            monitorear_temperatura()
        except Exception as e:
            logger.exception(f"Error inesperado durante el monitoreo: {e}")
