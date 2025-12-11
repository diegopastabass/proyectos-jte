import psycopg2
import requests
import time
import logging
from psycopg2.extras import RealDictCursor
from psycopg2 import pool
from logging.handlers import RotatingFileHandler
from datetime import timedelta

# ================== CONFIGURACIÓN ==================

DB_CONFIG = {
    "host": "jte-analytics-bd.cykkfl2nav74.us-east-1.rds.amazonaws.com",
	"port": 5432,
    "user": "JTEanalytics",
    "password": "flCiEV0aluIr0zqpvFJk",
    "dbname": "telemetria", 
    "sslmode": "require"
}

API_URL = "https://api.ultramsg.com/instance79783/messages/chat"
TOKEN = "j51no2r6amlze29z"
TO = "120363419930796519@g.us"

INTERVALO_MONITOREO = 1200

# ================== LOGGING ==================
logger = logging.getLogger("MonitoreoEstanques")
logger.setLevel(logging.INFO)

file_handler = RotatingFileHandler("monitoreo_estanques.log", maxBytes=5_000_000, backupCount=5)
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

def formatear_nombre_estanque(mt_name: str) -> str:
    nombre = mt_name.replace("ssr_", "").replace("_nivel", "")
    return nombre.replace("_", " ").title()

def obtener_niveles():
    """
    Devuelve un dict con las dos últimas mediciones por estanque:
    {
      'Bucalemu Alto': {
          'actual': {'valor': 0.8, 'tiempo': datetime},
          'anterior': {'valor': 0.9, 'tiempo': datetime}
      }
    }
    """
    query = """
    SELECT mt_name, mt_value, mt_time_2
    FROM (
        SELECT
            mt_name,
            mt_value,
            mt_time_2,
            ROW_NUMBER() OVER (PARTITION BY mt_name ORDER BY mt_time_2 DESC) AS rn
        FROM ssr_bucalemu
        WHERE mt_name LIKE '%nivel%'
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
        logger.error(f"❌ Error al obtener niveles: {e}")
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
            logger.warning(f"⚠️ Error en respuesta UltaMsg ({response.status_code}): {response.text}")
    except requests.RequestException as e:
        logger.error(f"❌ Error enviando mensaje a UltaMsg: {e}")

def calcular_tiempo_vaciado(actual, anterior, t_actual, t_anterior):
    """
    Calcula el tiempo restante hasta vaciado en segundos.
    """
    delta_nivel = actual - anterior
    delta_tiempo = (t_actual - t_anterior).total_seconds()

    if delta_tiempo <= 0 or delta_nivel >= 0:
        return None  # No hay pérdida o datos inválidos

    lossrate = delta_nivel / delta_tiempo  # será negativo porque está vaciando
    tiempo_restante = actual / abs(lossrate)

    return str(timedelta(seconds=int(tiempo_restante)))

def monitorear_estanques():
    niveles = obtener_niveles()
    if not niveles:
        logger.warning("⚠️ No se obtuvieron datos de los estanques.")
        return

    for nombre, datos in niveles.items():
        if "actual" not in datos or "anterior" not in datos:
            continue

        actual = datos["actual"]["valor"]
        anterior = datos["anterior"]["valor"]
        t_actual = datos["actual"]["tiempo"]
        t_anterior = datos["anterior"]["tiempo"]

        if actual < 1 and actual < anterior:
            tiempo = calcular_tiempo_vaciado(actual, anterior, t_actual, t_anterior)
            mensaje = (
                f"🚨 ALERTA NIVEL CRÍTICO 🚨\n"
                f"Estanque: {nombre}\n"
                f"Nivel Actual: {actual:.2f} m\n"
                f"Tiempo Estimado de Vaciado: {tiempo if tiempo else 'N/A'}"
            )
            enviar_alerta(mensaje)
        else:
            logger.info(f"✅ Estanque {nombre} en nivel normal ({actual:.2f} m).")

# ================== LOOP PRINCIPAL ==================

if __name__ == "__main__":
    logger.info("🚀 Iniciando servicio de monitoreo de estanques...")

    while True:
        try:
            monitorear_estanques()
        except Exception as e:
            logger.exception(f"❌ Error inesperado en el ciclo de monitoreo: {e}")
        time.sleep(INTERVALO_MONITOREO)
