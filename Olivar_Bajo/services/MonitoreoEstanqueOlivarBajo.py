import psycopg2
import time
import requests
import os
import logging
from logging.handlers import RotatingFileHandler
from dotenv import load_dotenv

# === Rutas absolutas (no dependen del directorio desde el que se lance) ===
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")
DB_USER = os.getenv("DB_USER")
DB_PASS = os.getenv("DB_PASS")
DB_NAME = os.getenv("DB_NAME")

API_URL = os.getenv("API_URL")
TOKEN = os.getenv("API_TOKEN") or os.getenv("TOKEN")
TO = os.getenv("API_TO") or os.getenv("TO")
TO_ADMIN = os.getenv("API_TO_ADMIN") or os.getenv("TO_ADMIN")

SITIO = "Olivar Bajo"
UMBRAL_SIN_DATOS_MIN = 30  # minutos sin registros nuevos para considerar el equipo desconectado

# === Configurar logging ===
logger = logging.getLogger("MonitoreoOlivarBajo")
logger.setLevel(logging.INFO)
_handler = RotatingFileHandler(os.path.join(BASE_DIR, "olivar_bajo_monitor.log"),
                               maxBytes=5_000_000, backupCount=5, encoding="utf-8")
_handler.setFormatter(logging.Formatter("%(asctime)s - %(levelname)s - %(message)s"))
logger.addHandler(_handler)


def conectar():
    return psycopg2.connect(host=DB_HOST, port=DB_PORT, user=DB_USER, password=DB_PASS, dbname=DB_NAME)


# === Función para obtener la última medición del sensor ===
def get_latest_value():
    """Devuelve (valor, timestamp, minutos_desde_el_registro).

    La antigüedad se calcula en la BD (LOCALTIMESTAMP - time) porque la columna es
    'timestamp' sin zona horaria: así no depende de la hora del servidor del script.
    """
    try:
        conn = conectar()
        cur = conn.cursor()
        cur.execute("""
            SELECT value, time, EXTRACT(EPOCH FROM (LOCALTIMESTAMP - time)) / 60.0
            FROM ssr_olivar_bajo_metrics
            WHERE sensor_id = '1'
            ORDER BY time DESC
            LIMIT 1;
        """)
        result = cur.fetchone()
        cur.close()
        conn.close()

        if result:
            return result[0], result[1], float(result[2])
        logger.warning("No se encontró ninguna medición para sensor_id = 1.")
        return None, None, None

    except Exception as e:
        logger.error(f"Error al consultar la base de datos: {e}")
        return None, None, None


# === Función para obtener duración de desconexión ===
def get_disconnection_duration():
    """
    Busca la última vez que el sensor estuvo en 0 (desconectado)
    y el siguiente registro donde volvió a 1, para calcular la duración.
    """
    try:
        conn = conectar()
        cur = conn.cursor()

        cur.execute("""
            SELECT time FROM ssr_olivar_bajo_metrics
            WHERE sensor_id = '1' AND value = 0
            ORDER BY time DESC
            LIMIT 1;
        """)
        lost_time_row = cur.fetchone()

        if not lost_time_row:
            cur.close()
            conn.close()
            return None

        lost_time = lost_time_row[0]

        cur.execute("""
            SELECT time FROM ssr_olivar_bajo_metrics
            WHERE sensor_id = '1' AND value = 1 AND time > %s
            ORDER BY time ASC
            LIMIT 1;
        """, (lost_time,))
        recovered_time_row = cur.fetchone()

        cur.close()
        conn.close()

        if recovered_time_row:
            return recovered_time_row[0] - lost_time
        return None

    except Exception as e:
        logger.error(f"Error al calcular duración de desconexión: {e}")
        return None


def formatear_minutos(minutos):
    horas, mins = divmod(int(minutos), 60)
    return f"{horas} hora(s) y {mins} minuto(s)" if horas else f"{mins} minuto(s)"


# === Función para enviar alerta por UltraMsg ===
def send_alert(message: str, destino: str = None):
    destino = destino or TO
    if not destino:
        logger.error(f"Sin destinatario configurado; alerta no enviada: {message!r}")
        return False
    payload = {"token": TOKEN, "to": destino, "body": message}
    try:
        response = requests.post(API_URL, data=payload, timeout=10)
        if response.status_code == 200:
            logger.info(f"Alerta enviada correctamente: {message!r}")
            return True
        logger.warning(f"Error al enviar alerta. Status: {response.status_code}, Respuesta: {response.text}")
    except requests.RequestException as e:
        logger.error(f"Error de conexión al enviar alerta: {e}")
    return False


# === Bucle principal ===
def monitor():
    interval = 120  # segundos = 2 minutos
    last_status = None  # Puede ser 0 o 1
    sin_datos_alertado = False

    logger.info("=== Iniciando monitoreo del estanque Olivar Bajo ===")

    while True:
        try:
            value, timestamp, minutos = get_latest_value()

            if value is None:
                logger.error("No se pudo obtener una lectura válida del sensor.")
            elif minutos > UMBRAL_SIN_DATOS_MIN:
                # El equipo dejó de escribir: el último valor (aunque sea 1) ya no es confiable
                logger.warning(f"Sin registros nuevos hace {formatear_minutos(minutos)} (último: {timestamp}).")
                if not sin_datos_alertado:
                    sin_datos_alertado = send_alert(
                        f"⚠️ ALERTA DESCONEXIÓN ⚠️\n"
                        f"Sitio: {SITIO}\n"
                        f"El equipo no ha reportado datos recientes.\n\n"
                        f"Estanque Cerro\n"
                        f"Tiempo sin datos: {formatear_minutos(minutos)}.",
                        TO_ADMIN,
                    )
            else:
                if sin_datos_alertado:
                    send_alert(f"✅ CONEXIÓN RESTABLECIDA ✅\nSitio: {SITIO}\n\nEstanque Cerro", TO_ADMIN)
                    sin_datos_alertado = False

                logger.info(f"Lectura actual: value={value}, timestamp={timestamp}")

                # Si el sensor indica pérdida de comunicación
                if value == 0:
                    if last_status != 0:
                        send_alert(f"⚠️ Pérdida de Comunicación ⚠️\nSitio: {SITIO}\nEstanque Cerro.")
                        interval = 600  # 10 minutos
                        logger.info("Intervalo cambiado a 10 minutos por pérdida de conexión.")
                    last_status = 0

                # Si el sensor indica conexión recuperada
                elif value == 1:
                    if last_status == 0:
                        diff = get_disconnection_duration()
                        if diff:
                            hours, remainder = divmod(diff.total_seconds(), 3600)
                            minutes, seconds = divmod(remainder, 60)
                            duration_str = f"{int(hours):02d} h {int(minutes):02d} m {int(seconds):02d} s Sin conexión."
                        else:
                            duration_str = "Duración de desconexión no disponible."

                        send_alert(f"✅ Comunicación Recuperada ✅\nSitio: {SITIO}\nEstanque Cerro.\n{duration_str}")
                        interval = 120  # 2 minutos
                        logger.info(f"Intervalo cambiado a 2 minutos por recuperación de conexión. {duration_str}")
                    elif last_status is None:
                        logger.info("Primera lectura detectada en estado conectado (value=1).")
                    last_status = 1

                else:
                    logger.warning(f"Valor inesperado para el sensor: {value}")
        except Exception:
            logger.exception("Error inesperado en el ciclo de monitoreo")

        logger.info(f"Esperando {interval / 60} minutos para la próxima verificación...")
        time.sleep(interval)


# === Punto de entrada ===
if __name__ == "__main__":
    try:
        monitor()
    except KeyboardInterrupt:
        logger.info("Monitoreo detenido manualmente.")
        print("\nMonitoreo detenido.")
