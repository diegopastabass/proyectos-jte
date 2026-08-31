import os
import json
import time
import logging
import threading
import requests
import psycopg2
from psycopg2 import sql
from dotenv import load_dotenv
import paho.mqtt.client as mqtt

load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_PATH = os.path.join(BASE_DIR, 'telemetria.log')

logging.basicConfig(
    filename=LOG_PATH,
    level=logging.INFO,
    format='%(asctime)s %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

# ──────────────────────────────────────────────
# Mapeo MQTT key → (sensor_id, función de transformación)
# ──────────────────────────────────────────────
SENSOR_MAP = {
    "HR_CALOR": (3, lambda x: x / 10),            # Humedad cámara calor
    "HR_FRIO":  (4, lambda x: (x - 4000) * 0.00625),  # Humedad cámara frío
    "T_CALOR":  (5, lambda x: x / 10),            # Temperatura cámara calor
    "T_FRIO":   (6, lambda x: (x - 4000) * 0.00625),  # Temperatura cámara frío
}

MQTT_BROKER = os.getenv("MQTT_BROKER", "localhost")
MQTT_PORT = int(os.getenv("MQTT_PORT", 1883))
MQTT_TOPIC = "/CAMARA_VET"

# ──────────────────────────────────────────────
# Conexión BD
# ──────────────────────────────────────────────
def get_db_connection():
    try:
        conn = psycopg2.connect(
            host=os.getenv("DB_HOST"),
            port=os.getenv("DB_PORT"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASS"),
            dbname=os.getenv("DB_NAME"),
            sslmode='require'
        )
        return conn
    except Exception as e:
        logging.error(f"[ERROR] Conexion DB fallida: {e}")
        return None

# ──────────────────────────────────────────────
# Fetch API (temperatura y humedad ambiental)
# ──────────────────────────────────────────────
def fetch_weather_data():
    url = f"{os.getenv('API_URL_OPEN_METEO')}?latitude={os.getenv('LAT')}&longitude={os.getenv('LNG')}&current=temperature_2m,relative_humidity_2m"
    try:
        response = requests.get(url, timeout=10)
        
        try:
            data = response.json()
        except ValueError:
            logging.error(f"[ERROR] La respuesta no es JSON válido. Texto: {response.text}")
            return None, None

        if 'current' in data:
            logging.info("[FETCH] [SUCCESS] Datos leídos correctamente")
            return data['current']['temperature_2m'], data['current']['relative_humidity_2m']
        else:
            logging.error(f"[ERROR] Respuesta inesperada de la API: {data}")
            return None, None

    except Exception as e:
        logging.error(f"[ERROR] Fallo al conectar o procesar API: {e}")
        return None, None

# ──────────────────────────────────────────────
# Inserción datos ambientales (sensor 7 y 8)
# ──────────────────────────────────────────────
def insert_data(conn, temp, hum):
    try:
        cursor = conn.cursor()
        table_name = os.getenv("DB_TABLE")
        
        query = sql.SQL("""
            INSERT INTO {} (sensor_id, value, time)
            VALUES 
            (7, %s, NOW()),
            (8, %s, NOW())
        """).format(sql.Identifier(table_name))
        
        cursor.execute(query, (temp, hum))
        conn.commit()
        cursor.close()
        logging.info("[INSERT] [SUCCESS] Insercion exitosa (ambiental)")
    except Exception as e:
        conn.rollback()
        logging.error(f"[ERROR] Fallo al insertar registros ambientales: {e}")

# ──────────────────────────────────────────────
# Inserción datos cámaras (sensores 3, 4, 5, 6)
# ──────────────────────────────────────────────
def insert_camara_data(payload):
    """Recibe el dict parseado del mensaje MQTT y hace insert por cada sensor válido."""
    rows = []

    for key, (sensor_id, transform_fn) in SENSOR_MAP.items():
        raw_value = payload.get(key)

        # Ignorar si la clave no existe en el payload
        if raw_value is None:
            continue

        # Ignorar valores no numéricos (ej: T_FRIO = "AI2")
        try:
            numeric_value = float(raw_value)
        except (ValueError, TypeError):
            logging.warning(f"[MQTT] Valor no numérico para {key}: {raw_value} — se omite")
            continue

        transformed = round(transform_fn(numeric_value), 2)
        rows.append((sensor_id, transformed))

    if not rows:
        logging.warning("[MQTT] No hay datos válidos para insertar en este mensaje")
        return

    conn = get_db_connection()
    if not conn:
        return

    try:
        cursor = conn.cursor()
        table_name = os.getenv("DB_TABLE")

        # Construir INSERT dinámico con N filas
        values_template = ", ".join(["(%s, %s, NOW())"] * len(rows))
        query = sql.SQL(
            "INSERT INTO {} (sensor_id, value, time) VALUES " + values_template
        ).format(sql.Identifier(table_name))

        # Aplanar lista de tuplas a lista de valores
        params = [val for row in rows for val in row]

        cursor.execute(query, params)
        conn.commit()
        cursor.close()

        sensor_ids = [r[0] for r in rows]
        logging.info(f"[INSERT] [SUCCESS] Insercion exitosa (cámaras) — sensores: {sensor_ids}")
    except Exception as e:
        conn.rollback()
        logging.error(f"[ERROR] Fallo al insertar registros de cámaras: {e}")
    finally:
        conn.close()

# ──────────────────────────────────────────────
# Callbacks MQTT
# ──────────────────────────────────────────────
def on_connect(client, userdata, flags, rc):
    if rc == 0:
        logging.info(f"[MQTT] Conectado al broker {MQTT_BROKER}:{MQTT_PORT}")
        client.subscribe(MQTT_TOPIC)
        logging.info(f"[MQTT] Suscrito al topic {MQTT_TOPIC}")
    else:
        logging.error(f"[MQTT] Error de conexión, código: {rc}")

def on_message(client, userdata, msg):
    try:
        raw = msg.payload.decode("utf-8")
        payload = json.loads(raw)
        logging.info(f"[MQTT] Mensaje recibido en {msg.topic}: {raw}")
        insert_camara_data(payload)
    except json.JSONDecodeError:
        logging.error(f"[MQTT] Payload no es JSON válido: {msg.payload}")
    except Exception as e:
        logging.error(f"[MQTT] Error procesando mensaje: {e}")

def on_disconnect(client, userdata, rc):
    if rc != 0:
        logging.warning(f"[MQTT] Desconexión inesperada (rc={rc}). Se intentará reconectar automáticamente.")

# ──────────────────────────────────────────────
# Hilo MQTT
# ──────────────────────────────────────────────
def start_mqtt_client():
    """Inicia el cliente MQTT en un hilo daemon que se reconecta automáticamente."""
    client = mqtt.Client()
    client.on_connect = on_connect
    client.on_message = on_message
    client.on_disconnect = on_disconnect

    while True:
        try:
            client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)
            client.loop_forever()
        except Exception as e:
            logging.error(f"[MQTT] No se pudo conectar al broker: {e}. Reintentando en 10s...")
            time.sleep(10)

# ──────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────
def main():
    logging.info("[INFO] Iniciando servicio")

    # Iniciar cliente MQTT en hilo separado (daemon para que muera con el proceso principal)
    mqtt_thread = threading.Thread(target=start_mqtt_client, daemon=True)
    mqtt_thread.start()
    logging.info("[INFO] Hilo MQTT iniciado")

    # Loop principal: polling de datos ambientales
    frecuencia = int(os.getenv("FREC_MUESTREO", 300))
    
    while True:
        temp, hum = fetch_weather_data()
        
        if temp is not None and hum is not None:
            conn = get_db_connection()
            if conn:
                insert_data(conn, temp, hum)
                conn.close()
        
        time.sleep(frecuencia)

if __name__ == "__main__":
    main()