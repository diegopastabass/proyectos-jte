import psycopg2
import requests
import time
import logging
import os
from psycopg2.extras import RealDictCursor
from psycopg2 import pool
from logging.handlers import RotatingFileHandler
from datetime import timedelta
from dotenv import load_dotenv


# ================== RUTAS ABSOLUTAS ==================
# Obtiene la ruta del directorio donde está este script
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Rutas completas para archivos
LOG_FILE = os.path.join(BASE_DIR, "monitoreo_estanques.log")
ENV_FILE = os.path.join(BASE_DIR, ".env")

# ================== CONFIGURACIÓN (Carga .env) ==================

# Carga las variables de entorno desde el archivo .env
load_dotenv(ENV_FILE)

DB_CONFIG = {
    "host": os.getenv("DB_HOST"),
    "port": os.getenv("DB_PORT", 5432),
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PASSWORD"),
    "dbname": os.getenv("DB_NAME"),
    "sslmode": os.getenv("DB_SSLMODE", "require")
}

API_URL = os.getenv("API_URL")
TOKEN = os.getenv("API_TOKEN")
TO = os.getenv("API_TO")

NOMBRE_ESTANQUE_ESPECIAL = {
    "CASUTO--slave.AI12": "Casuto"
}

INTERVALO_MONITOREO = 600

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

# ================== POOL DE CONEXIONES ==================
try:
    connection_pool = psycopg2.pool.SimpleConnectionPool(
        1, 10, **DB_CONFIG, cursor_factory=RealDictCursor
    )
    if connection_pool:
        logger.info("Pool de conexiones a PostgreSQL inicializado correctamente.")
except Exception as e:
    logger.critical(f"Error inicializando el pool de conexiones: {e}")
    raise

# ================== FUNCIONES ==================

def formatear_nombre_estanque(mt_name: str) -> str:
    # 1. Mapear nombres especiales (como 'CASUTO--slave.AI12')
    if mt_name in NOMBRE_ESTANQUE_ESPECIAL:
        return NOMBRE_ESTANQUE_ESPECIAL[mt_name]

    # 2. Formateo general para el resto
    nombre = mt_name.replace("ssr_", "").replace("_nivel", "")
    return nombre.replace("_", " ").title()

def obtener_niveles():
    """
    Devuelve un dict con las dos últimas mediciones por estanque.
    Incluye los mt_name que contienen '%nivel%' O el nombre especial.
    """
    
    # mt_name especial para Casuto
    casuto_mt_name = list(NOMBRE_ESTANQUE_ESPECIAL.keys())[0]

    query = f"""
    SELECT mt_name, mt_value, mt_time_2
    FROM (
        SELECT
            mt_name,
            mt_value,
            mt_time_2,
            ROW_NUMBER() OVER (PARTITION BY mt_name ORDER BY mt_time_2 DESC) AS rn
        FROM ssr_bucalemu
        WHERE mt_name LIKE '%nivel%' OR mt_name = '{casuto_mt_name}'
    ) AS sub
    WHERE rn <= 2
    ORDER BY mt_name, rn;
    """

    conn = None
    resultados = {}
    try:
        conn = connection_pool.getconn()
        with conn.cursor() as cur:
            cur.execute(query)
            rows = cur.fetchall()

        for row in rows:
            nombre = formatear_nombre_estanque(row["mt_name"])
            if nombre not in resultados:
                resultados[nombre] = {}

            if row["mt_time_2"] is None:
                continue

            if "actual" not in resultados[nombre]:
                resultados[nombre]["actual"] = {
                    "valor": row["mt_value"],
                    "tiempo": row["mt_time_2"],
                }
            else:
                resultados[nombre]["anterior"] = {
                    "valor": row["mt_value"],
                    "tiempo": row["mt_time_2"],
                }

        return resultados
    except Exception as e:
        logger.error(f"Error al obtener niveles: {e}")
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
            logger.info(f"Alerta enviada con éxito: {mensaje}")
        else:
            logger.warning(f"Error en respuesta UltaMsg ({response.status_code}): {response.text}")
    except requests.RequestException as e:
        logger.error(f"Error enviando mensaje a UltaMsg: {e}")

def calcular_tiempo_vaciado(actual, anterior, t_actual, t_anterior):
    """
    Calcula el tiempo restante hasta vaciado en formato HH:MM:SS.
    """
    delta_nivel = actual - anterior
    delta_tiempo = (t_actual - t_anterior).total_seconds()

    if delta_tiempo <= 0 or delta_nivel >= 0:
        return None

    lossrate = delta_nivel / delta_tiempo
    tiempo_restante = actual / abs(lossrate)

    return str(timedelta(seconds=int(tiempo_restante)))

def monitorear_estanques():
    global INTERVALO_MONITOREO # Permite modificar la variable global

    niveles = obtener_niveles()
    if not niveles:
        logger.warning("No se obtuvieron datos de los estanques.")
        return

    # Reiniciar el intervalo de monitoreo al valor por defecto
    INTERVALO_MONITOREO_TEMP = 600
    alerta_activa = False # Para saber si se activó alguna condición y cambiar el intervalo

    for nombre, datos in niveles.items():
        if "actual" not in datos or "anterior" not in datos:
            continue

        actual = datos["actual"]["valor"]
        anterior = datos["anterior"]["valor"]
        t_actual = datos["actual"]["tiempo"]
        t_anterior = datos["anterior"]["tiempo"]

        if (actual < 1 and actual < anterior) and not (nombre == "Bucalemu Alto" or nombre == "Casuto" ):
            tiempo = calcular_tiempo_vaciado(actual, anterior, t_actual, t_anterior)
            mensaje = (
                f"⚠️ ALERTA NIVEL CRÍTICO ⚠️\n"
                f"Estanque: {nombre}\n"
                f"Nivel Actual: {actual:.2f} m\n"
                f"Tiempo Estimado de Vaciado: {tiempo if tiempo else 'N/A'}"
            )
            INTERVALO_MONITOREO_TEMP = max(INTERVALO_MONITOREO_TEMP, 1800)
            alerta_activa = True
            enviar_alerta(mensaje)

        elif (((nombre == 'Bucalemu Bajo' and actual > 4.30) or (nombre != 'Bucalemu Bajo' and actual > 4.25)) and (nombre != "Casuto")) and actual > anterior:
            mensaje = (
                f"⚠️ ALERTA POSIBLE REBALSE ⚠️\n"
                f"Estanque: {nombre}\n"
                f"Nivel Actual: {actual:.2f} m\n"
                f"Condición: Sobrellenado en curso."
            )
            INTERVALO_MONITOREO_TEMP = max(INTERVALO_MONITOREO_TEMP, 1800)
            alerta_activa = True
            enviar_alerta(mensaje)

        elif (((nombre == "Casuto" and actual/100 > 4.30)) and (actual > anterior)):
            mensaje = (
                f"⚠️ ALERTA POSIBLE REBALSE ⚠️\n"
                f"Estanque: {nombre}\n"
                f"Nivel Actual: {actual/100:.2f} m\n"
                f"Condición: Sobrellenado en curso."
            )
            INTERVALO_MONITOREO_TEMP = max(INTERVALO_MONITOREO_TEMP, 1800)
            alerta_activa = True
            enviar_alerta(mensaje)

        elif (actual < 2 and actual < anterior) and (nombre == "Bucalemu Alto"):
            tiempo = calcular_tiempo_vaciado(actual, anterior, t_actual, t_anterior)
            mensaje = (
                f"⚠️ ALERTA NIVEL CRÍTICO ⚠️\n"
                f"Estanque: {nombre}\n"
                f"Nivel Actual: {actual:.2f} m\n"
                f"Tiempo Estimado de Vaciado: {tiempo if tiempo else 'N/A'}"
            )
            INTERVALO_MONITOREO_TEMP = max(INTERVALO_MONITOREO_TEMP, 1800)
            alerta_activa = True
            enviar_alerta(mensaje)
            
        elif (actual/100 < 2 and actual < anterior) and (nombre == "Casuto"):
            tiempo = calcular_tiempo_vaciado(actual, anterior, t_actual, t_anterior)
            mensaje = (
                f"⚠️ ALERTA NIVEL CRÍTICO ⚠️\n"
                f"Estanque: {nombre}\n"
                f"Nivel Actual: {actual/100:.2f} m\n"
                f"Tiempo Estimado de Vaciado: {tiempo if tiempo else 'N/A'}"
            )
            INTERVALO_MONITOREO_TEMP = max(INTERVALO_MONITOREO_TEMP, 1800)
            alerta_activa = True
            enviar_alerta(mensaje)
            

        elif actual < 0.5 and anterior > actual:
            mensaje = (
                f"⚠️ ALERTA ESTANQUE VACÍO ⚠️\n"
                f"Estanque: {nombre}\n"
                f"Nivel Actual: {actual:.2f} m\n"
                f"Condición: El estanque está completamente vacío."
            )
            INTERVALO_MONITOREO_TEMP = max(INTERVALO_MONITOREO_TEMP, 1800)
            alerta_activa = True
            enviar_alerta(mensaje)

        else:
            logger.info(f"Estanque {nombre} en nivel normal ({actual:.2f} m).")
            
    if alerta_activa:
        INTERVALO_MONITOREO = INTERVALO_MONITOREO_TEMP
        logger.info(f"Alerta(s) activa(s). Intervalo de monitoreo ajustado a {INTERVALO_MONITOREO} segundos.")
    else:
        INTERVALO_MONITOREO = 600


# ================== LOOP PRINCIPAL ==================

if __name__ == "__main__":
    logger.info("Iniciando servicio de monitoreo de estanques...")

    while True:
        try:
            monitorear_estanques()
        except Exception as e:
            logger.exception(f"Error inesperado en el ciclo de monitoreo: {e}")
        
        # Uso la variable global actualizada por monitorear_estanques
        logger.info(f"Esperando {INTERVALO_MONITOREO} segundos para el próximo monitoreo...")
        time.sleep(INTERVALO_MONITOREO)