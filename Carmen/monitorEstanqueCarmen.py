import psycopg2
import requests
import time
import logging
import os
from datetime import datetime
from psycopg2.extras import RealDictCursor
from psycopg2 import pool
from logging.handlers import RotatingFileHandler
from dotenv import load_dotenv

# ================== RUTAS ==================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_FILE = os.path.join(BASE_DIR, "monitoreo_estanques.log")
ENV_FILE = os.path.join(BASE_DIR, ".env")

# ================== CONFIGURACION ==================
load_dotenv(ENV_FILE)

DB_CONFIG = {
    "host": os.getenv("DB_HOST"),
    "port": os.getenv("DB_PORT", 5432),
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PASS"),
    "dbname": os.getenv("DB_NAME"),
    "sslmode": os.getenv("DB_SSLMODE", "require")
}

API_URL = os.getenv("API_URL")
TOKEN = os.getenv("API_TOKEN")
TO = os.getenv("API_TO")

def get_dynamic_config():
    return {
        "INTERVALO_MINUTOS": int(os.getenv("INTERVALO_MINUTOS", 1)),
        "NIVEL_ALERTA_CARMEN": float(os.getenv("NIVEL_ALERTA", 1.5)),
    }

SENSOR_CARMEN = "SSR_CARMEN_BAJO_POZO--slave.nivel"
SENSOR_SENTINA = "SSR_CARMEN_BAJO_SENTINA--slave.nivel"

# ================== LOGGING ==================
logger = logging.getLogger("MonitoreoEstanques")
logger.setLevel(logging.INFO)
file_handler = RotatingFileHandler(LOG_FILE, maxBytes=5_000_000, backupCount=5)
console_handler = logging.StreamHandler()
formatter = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s")
file_handler.setFormatter(formatter)
console_handler.setFormatter(formatter)
logger.addHandler(file_handler)
logger.addHandler(console_handler)

# ================== POOL ==================
try:
    connection_pool = psycopg2.pool.SimpleConnectionPool(1, 10, **DB_CONFIG)
    if connection_pool:
        logger.info("Pool de conexiones a PostgreSQL inicializado.")
except Exception as e:
    logger.critical(f"Error inicializando el pool: {e}")
    raise

# ================== OBTENER NIVELES ==================
def obtener_niveles(nombre_sensor, factor_division=1):
    query = """
        SELECT mt_value, mt_time_2 
        FROM ssr_carmen_bajo
        WHERE mt_name = %s
        ORDER BY mt_time_2 DESC
        LIMIT 2;
    """
    conn = None
    try:
        conn = connection_pool.getconn()
        cursor = conn.cursor()
        cursor.execute(query, (nombre_sensor,))
        rows = cursor.fetchall()
        cursor.close()
    except Exception as e:
        logger.error(f"Error en consulta: {e}")
        return None, None, None, None
    finally:
        if conn:
            connection_pool.putconn(conn)

    if len(rows) < 2:
        logger.warning(f"Datos insuficientes para {nombre_sensor}.")
        return None, None, None, None

    val_actual = float(rows[0][0]) / factor_division
    val_anterior = float(rows[1][0]) / factor_division
    
    return val_actual, val_anterior, rows[0][1], rows[1][1]

# ================== CALCULAR TIEMPO ==================
def calcular_tiempo_vaciado(nivel_actual, nivel_anterior, time_actual, time_anterior):
    delta_nivel = nivel_actual - nivel_anterior
    delta_tiempo = (time_actual - time_anterior).total_seconds()

    if delta_nivel >= 0 or delta_tiempo <= 0:
        return None

    tasa_descenso = abs(delta_nivel) / delta_tiempo
    tiempo_restante_segundos = nivel_actual / tasa_descenso

    horas = int(tiempo_restante_segundos // 3600)
    minutos = int((tiempo_restante_segundos % 3600) // 60)
    segundos = int(tiempo_restante_segundos % 60)
    
    return f"{horas:02d}:{minutos:02d}:{segundos:02d}"

# ================== ENVIAR ALERTA ==================
def enviar_alerta(mensaje: str):
    data = {"token": TOKEN, "to": TO, "body": mensaje}
    try:
        response = requests.post(API_URL, data=data, timeout=10)
        if response.status_code == 200:
            logger.info(f"Alerta enviada: {mensaje[:30]}...")
    except Exception as e:
        logger.error(f"Error en envío de alerta: {e}")

# ================== PROCESAR ESTANQUE ==================
def procesar_estanque(sensor, nombre_publico, nivel_vaciado, nivel_rebalse, factor=1, umbral_inclusivo=False):
    res = obtener_niveles(sensor, factor)
    if res[0] is None:
        return False

    n_act, n_ant, t_act, t_ant = res
    logger.info(f"[{nombre_publico}] Nivel Actual: {n_act:.2f} m | Nivel Anterior: {n_ant:.2f} m | Hora: {t_act}")

    condicion_v = (n_act <= nivel_vaciado) if umbral_inclusivo else (n_act < nivel_vaciado)

    if n_act < n_ant and condicion_v:
        tiempo = calcular_tiempo_vaciado(n_act, n_ant, t_act, t_ant)
        mensaje = (
            f"🚨 ALERTA NIVEL CRÍTICO 🚨\n"
            f"Estanque: {nombre_publico}\n"
            f"Nivel: {n_act:.2f} m\n"
            f"Vaciado estimado: {tiempo if tiempo else 'Calculando...'}"
        )
        enviar_alerta(mensaje)
        return True

    elif n_act > n_ant and n_act > nivel_rebalse:
        mensaje = (
            f"🚨 ALERTA REBALSE 🚨\n"
            f"Estanque: {nombre_publico}\n"
            f"Nivel: {n_act:.2f} m"
        )
        enviar_alerta(mensaje)
        return True
    
    return False

# ================== MONITOREAR ==================
def monitorear():
    logger.info("Servicio de monitoreo iniciado.")
    while True:
        cfg = get_dynamic_config()
        
        alerta_carmen = procesar_estanque(
            SENSOR_CARMEN, 
            "Estanque Carmen", 
            cfg["NIVEL_ALERTA_CARMEN"], 
            nivel_rebalse=3.4,
            factor=1,
            umbral_inclusivo=False
        )

        alerta_sentina = procesar_estanque(
            SENSOR_SENTINA,
            "Estanque Sentina",
            nivel_vaciado=1.0,
            nivel_rebalse=2.2,
            factor=100,
            umbral_inclusivo=True
        )

        hay_alerta = alerta_carmen or alerta_sentina
        intervalo = cfg["INTERVALO_MINUTOS"] if hay_alerta else 1
        time.sleep(intervalo * 60)

if __name__ == "__main__":
    try:
        monitorear()
    except KeyboardInterrupt:
        logger.info("Cierre detectado.")