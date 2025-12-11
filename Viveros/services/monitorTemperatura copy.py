import psycopg2
import requests
import time
import logging
import os
from psycopg2.extras import RealDictCursor
from psycopg2 import pool
from logging.handlers import RotatingFileHandler
from dotenv import load_dotenv

# ================== CONFIGURACIÓN INICIAL ==================
ENV_PATH = ".env"

def recargar_env():
    """Recarga dinámicamente las variables del archivo .env"""
    load_dotenv(ENV_PATH, override=True)

# Carga inicial
recargar_env()

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
TO = os.getenv("API_TO")

INTERVALO_MONITOREO = int(os.getenv("MONITOR_INTERVAL", 1200))  # 20 min por defecto

# ================== LOGGING ==================
logger = logging.getLogger("MonitoreoTemperaturaViveros")
logger.setLevel(logging.INFO)

file_handler = RotatingFileHandler("monitoreo_temperatura_viveros.log", maxBytes=5_000_000, backupCount=5)
console_handler = logging.StreamHandler()

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
    if connection_pool:
        logger.info("✅ Pool de conexiones a PostgreSQL inicializado correctamente.")
except Exception as e:
    logger.critical(f"❌ Error inicializando el pool de conexiones: {e}")
    raise

# ================== FUNCIONES ==================

def obtener_mediciones(sensor_id=3):
    query = """
        SELECT id, sensor_id, value, time
        FROM viveros_tambo
        WHERE sensor_id = %s
        ORDER BY time DESC
        LIMIT 2;
    """

    conn = None
    try:
        conn = connection_pool.getconn()
        with conn.cursor() as cur:
            cur.execute(query, (sensor_id,))
            rows = cur.fetchall()

        if len(rows) < 2:
            logger.warning("⚠️ No hay suficientes mediciones para comparar.")
            return {}

        return {
            "actual": {"valor": rows[0]["value"], "tiempo": rows[0]["time"]},
            "anterior": {"valor": rows[1]["value"], "tiempo": rows[1]["time"]}
        }

    except Exception as e:
        logger.error(f"❌ Error al obtener mediciones: {e}")
        return {}
    finally:
        if conn:
            connection_pool.putconn(conn)

def enviar_alerta(mensaje: str):
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    data = {"token": TOKEN, "to": TO, "body": mensaje}

    try:
        response = requests.post(API_URL, data=data, headers=headers, timeout=10)
        if response.status_code == 200:
            logger.info(f"📤 Alerta enviada con éxito: {mensaje}")
        else:
            logger.warning(f"⚠️ Error en respuesta UltraMsg ({response.status_code}): {response.text}")
    except requests.RequestException as e:
        logger.error(f"❌ Error enviando mensaje a UltraMsg: {e}")

def monitorear_temperatura(sensor_id=3):
    # Recarga el .env en cada iteración para reflejar cambios dinámicos
    recargar_env()
    try:
        temp_umbral = float(os.getenv("TEMP_MONITOREO", "5"))
    except ValueError:
        logger.warning("⚠️ Valor no válido en TEMP_MONITOREO, usando 5°C como valor por defecto.")
        temp_umbral = 5.0

    datos = obtener_mediciones(sensor_id)
    if not datos:
        logger.warning("⚠️ No se pudieron obtener mediciones.")
        return

    actual = datos["actual"]["valor"]
    anterior = datos["anterior"]["valor"]

    if actual > temp_umbral and actual > anterior:
        mensaje = (
            f"🚨 ALERTA DE SOBRECALENTAMIENTO 🚨\n"
            f"Sensor ID: {sensor_id}\n"
            f"Temperatura Actual: {actual:.2f} °C\n"
            f"Temperatura Anterior: {anterior:.2f} °C\n"
            f"Umbral Configurado: {temp_umbral:.2f} °C\n"
            f"La temperatura está aumentando por encima del límite permitido."
        )
        enviar_alerta(mensaje)
    else:
        logger.info(f"✅ Temperatura normal ({actual:.2f} °C / Umbral {temp_umbral:.2f} °C).")

# ================== LOOP PRINCIPAL ==================

if __name__ == "__main__":
    logger.info("🚀 Iniciando servicio de monitoreo de temperatura en viveros...")

    while True:
        try:
            monitorear_temperatura()
        except Exception as e:
            logger.exception(f"❌ Error inesperado en el ciclo de monitoreo: {e}")
        time.sleep(INTERVALO_MONITOREO)
