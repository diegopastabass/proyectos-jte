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
INTERVALO_MONITOREO = int(env_vars.get("MONITOR_INTERVAL", 1200))

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
TO = os.getenv("+56996181706")

# Verificación de variables críticas
for key, value in DB_CONFIG.items():
    if not value:
        raise SystemExit(f"❌ Error: La variable de entorno {key} no se cargó correctamente desde .env")

if not API_URL or not TOKEN or not TO:
    raise SystemExit("❌ Error: Las variables de entorno de API no se cargaron correctamente desde .env")

# ================== LOGGING ==================
LOG_PATH = os.path.join(BASE_DIR, "logs")
os.makedirs(LOG_PATH, exist_ok=True)

logger = logging.getLogger("MonitoreoHumedadViveros")
logger.setLevel(logging.INFO)

file_handler = RotatingFileHandler(
    os.path.join(LOG_PATH, "monitoreo_humedad_viveros.log"),
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
def obtener_mediciones():
    query = """
        SELECT id, sensor_id, value, time
        FROM viveros_tambo
        WHERE sensor_id = 4
        ORDER BY time DESC
        LIMIT 2;
    """
    conn = None
    try:
        conn = connection_pool.getconn()
        with conn.cursor() as cur:
            cur.execute(query)
            rows = cur.fetchall()
        if len(rows) < 2:
            logger.warning("No hay suficientes mediciones para comparar.")
            return {}
        return {
            "actual": {"valor": rows[0]["value"], "tiempo": rows[0]["time"]},
            "anterior": {"valor": rows[1]["value"], "tiempo": rows[1]["time"]}
        }
    except Exception as e:
        logger.error(f"Error al obtener mediciones: {e}", exc_info=True)
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
            logger.info("📩 Alerta enviada con éxito.")
        else:
            logger.warning(f"⚠️ Error en respuesta UltraMsg ({response.status_code}): {response.text}")
    except requests.RequestException as e:
        logger.error(f"Error enviando mensaje a UltraMsg: {e}", exc_info=True)

def monitorear_humedad(sensor_id=3):
    env_vars = recargar_env_txt()
    try:
        hum_umbral = float(env_vars.get("HUM_MONITOREO", "80"))
        intervalo_actual = int(env_vars.get("MONITOR_INTERVAL", INTERVALO_MONITOREO))
    except ValueError:
        logger.warning("Valor inválido en env.txt; usando 5°C como valor por defecto.")
        hum_umbral = 80
        intervalo_actual = INTERVALO_MONITOREO

    datos = obtener_mediciones()
    if not datos:
        logger.warning("No se pudieron obtener mediciones.")
        return intervalo_actual

    actual = datos["actual"]["valor"]
    anterior = datos["anterior"]["valor"]

    if actual < hum_umbral:
        mensaje = (
            f"🚨 ALERTA DE BAJO PORCENTAJE DE HUMEDAD EN CÁMARA DE FRÍO 🚨\n"
            f"Hora: {datetime.now():%Y-%m-%d %H:%M:%S}\n"
            f"Humedad Actual: {actual:.2f} %\n"
            f"Humedad Anterior: {anterior:.2f} %\n"
            f"Umbral Configurado: {hum_umbral:.2f} %\n"
            f"La humedad está por debajo del límite permitido."
        )
        enviar_alerta(mensaje)
    else:
        logger.info(f"✅ Humedad normal ({actual:.2f} % / Umbral {hum_umbral:.2f} %).")

    return intervalo_actual

if __name__ == "__main__":
    logger.info("🚀 Iniciando servicio de monitoreo de temperatura en viveros...")
    while True:
        try:
            intervalo = monitorear_humedad()
        except Exception as e:
            logger.exception(f"Error inesperado en el ciclo de monitoreo: {e}")
            intervalo = INTERVALO_MONITOREO
        time.sleep(intervalo)
