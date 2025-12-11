import psycopg2
import time
import requests
import os
import logging
from dotenv import load_dotenv
from datetime import datetime

# === Cargar variables de entorno ===
load_dotenv()

DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")
DB_USER = os.getenv("DB_USER")
DB_PASS = os.getenv("DB_PASS")
DB_NAME = os.getenv("DB_NAME")

API_URL = os.getenv("API_URL")
TOKEN = os.getenv("TOKEN")
TO = os.getenv("TO")

# === Configurar logging ===
logging.basicConfig(
    filename="olivar_bajo_monitor.log",
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)

# === Función para obtener la última medición del sensor ===
def get_latest_value():
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASS,
            database=DB_NAME,
        )
        cur = conn.cursor()
        cur.execute("""
            SELECT value, time 
            FROM ssr_olivar_bajo_metrics 
            WHERE sensor_id = 1 
            ORDER BY time DESC 
            LIMIT 1;
        """)
        result = cur.fetchone()
        cur.close()
        conn.close()

        if result:
            return result[0], result[1]
        else:
            logging.warning("No se encontró ninguna medición para sensor_id = 1.")
            return None, None

    except Exception as e:
        logging.error(f"Error al consultar la base de datos: {e}")
        return None, None

# === Función para obtener duración de desconexión ===
def get_disconnection_duration():
    """
    Busca la última vez que el sensor estuvo en 0 (desconectado)
    y el siguiente registro donde volvió a 1, para calcular la duración.
    """
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASS,
            database=DB_NAME,
        )
        cur = conn.cursor()

        # Obtener el último time donde value = 0
        cur.execute("""
            SELECT time FROM ssr_olivar_bajo_metrics
            WHERE sensor_id = 1 AND value = 0
            ORDER BY time DESC
            LIMIT 1;
        """)
        lost_time_row = cur.fetchone()

        if not lost_time_row:
            cur.close()
            conn.close()
            return None

        lost_time = lost_time_row[0]

        # Obtener el primer time donde volvió a 1 después de esa pérdida
        cur.execute("""
            SELECT time FROM ssr_olivar_bajo_metrics
            WHERE sensor_id = 1 AND value = 1 AND time > %s
            ORDER BY time ASC
            LIMIT 1;
        """, (lost_time,))
        recovered_time_row = cur.fetchone()

        cur.close()
        conn.close()

        if recovered_time_row:
            recovered_time = recovered_time_row[0]
            diff = recovered_time - lost_time
            return diff
        else:
            return None

    except Exception as e:
        logging.error(f"Error al calcular duración de desconexión: {e}")
        return None

# === Función para enviar alerta por UltraMsg ===
def send_alert(message: str):
    payload = {
        "token": TOKEN,
        "to": TO,
        "body": message,
    }

    try:
        response = requests.post(API_URL, data=payload)
        if response.status_code == 200:
            logging.info(f"Alerta enviada correctamente: {message}")
        else:
            logging.warning(f"Error al enviar alerta. Status: {response.status_code}, Respuesta: {response.text}")
    except Exception as e:
        logging.error(f"Error de conexión al enviar alerta: {e}")

# === Bucle principal ===
def monitor():
    interval = 120  # segundos = 2 minutos
    last_status = None  # Puede ser 0 o 1

    logging.info("=== Iniciando monitoreo del estanque Olivar Bajo ===")

    while True:
        value, timestamp = get_latest_value()

        if value is not None:
            logging.info(f"Lectura actual: value={value}, timestamp={timestamp}")

            # Si el sensor indica pérdida de conexión
            if value == 0:
                if last_status != 0:
                    send_alert("⚠️ Perdida de Comunicación ⚠️ \nEstanque Cerro.")
                    interval = 600  # 10 minutos
                    logging.info("Intervalo cambiado a 10 minutos por pérdida de conexión.")
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

                    message = f"✅ Comunicación Recuperada ✅\nEstanque Cerro.\n{duration_str}"
                    send_alert(message)
                    interval = 120  # 2 minutos
                    logging.info(f"Intervalo cambiado a 2 minutos por recuperación de conexión. {duration_str}")
                elif last_status is None:
                    logging.info("Primera lectura detectada en estado conectado (value=1).")
                last_status = 1

            # Si el valor es otro
            else:
                logging.warning(f"Valor inesperado para el sensor: {value}")

        else:
            logging.error("No se pudo obtener una lectura válida del sensor.")

        logging.info(f"Esperando {interval / 60} minutos para la próxima verificación...\n")
        time.sleep(interval)

# === Punto de entrada ===
if __name__ == "__main__":
    try:
        monitor()
    except KeyboardInterrupt:
        logging.info("Monitoreo detenido manualmente.")
        print("\nMonitoreo detenido.")
