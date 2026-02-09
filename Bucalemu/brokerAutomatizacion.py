import os
import time
import json
import logging
import psycopg2
import paho.mqtt.client as mqtt
from dotenv import load_dotenv

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler("monitoreo_estanque.log"),
        logging.StreamHandler()
    ]
)

load_dotenv()

MQTT_BROKER = "localhost"
MQTT_PORT = 1883
MQTT_TOPIC = "/DownloadTopic"

def get_tank_level():
    conn = None
    try:
        conn = psycopg2.connect(
            host=os.getenv("DB_HOST"),
            port=os.getenv("DB_PORT"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD"),
            database=os.getenv("DB_NAME"),
            connect_timeout=10
        )
        cur = conn.cursor()
        query = "SELECT mt_value FROM ssr_bucalemu WHERE mt_name = 'CASUTO--slave.AI12' ORDER BY mt_time_2 DESC LIMIT 1"
        cur.execute(query)
        result = cur.fetchone()
        cur.close()
        
        if result:
            val = float(result[0])
            logging.info(f"Nivel leído exitosamente: {val}")
            return val
        
        logging.warning("No se encontraron registros en la tabla ssr_bucalemu")
        return None
        
    except Exception as e:
        logging.error(f"Error crítico en base de datos: {e}")
        return None
    finally:
        if conn:
            conn.close()

def send_mqtt_command(value):
    client = mqtt.Client()
    try:
        client.connect(MQTT_BROKER, MQTT_PORT, 60)
        
        payload = {
            "rw_prot": {
                "Ver": "1.0.1",
                "dir": "down",
                "id": "123456",
                "w_data": [{"name": "DO1", "value": str(value)}]
            }
        }
        
        payload_str = json.dumps(payload, separators=(',', ':'))
        
        msg_info = client.publish(MQTT_TOPIC, payload_str, retain=True)
        
        msg_info.wait_for_publish() 
        
        logging.info(f"Comando MQTT enviado -> DO1: {value}")
        logging.info(f"Payload RAW: {payload_str}") 
        
        client.disconnect()
    except Exception as e:
        logging.error(f"Fallo al enviar mensaje MQTT: {e}")

logging.info("Iniciando servicio de monitoreo de estanque...")

while True:
    level = get_tank_level()
    
    if level is not None:
        if level >= 4:
            send_mqtt_command(1)
        elif level <= 3:
            send_mqtt_command(0)
        else:
            logging.info(f"Nivel en rango neutro ({level}), no se requiere acción.")
            
    time.sleep(60)