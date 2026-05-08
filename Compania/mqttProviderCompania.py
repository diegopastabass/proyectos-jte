import os
import json
import psycopg2
import paho.mqtt.client as mqtt
from dotenv import load_dotenv

load_dotenv()

with open('dataprovider.conf', 'r') as f:
    APP_CONFIG = json.load(f)

TOPIC_TABLE_MAP = {item['topic']: item['tablename'] for item in APP_CONFIG}

def get_db_connection():
    return psycopg2.connect(
        host=os.getenv('DB_HOST'),
        port=os.getenv('DB_PORT'),
        user=os.getenv('DB_USER'),
        password=os.getenv('DB_PASS'),
        dbname=os.getenv('DB_NAME'),
        sslmode='require'
    )

# Lógica de inserción ajustada a ssr_compania
def save_measurement(tablename, terminal_time, sensor_name, value):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Ajuste de nombres de columnas: mt_name, mt_value, mt_time_2
        # mt_id se genera automáticamente si es serial o debe ser manejado por la lógica
        query = f"""
            INSERT INTO {tablename} (mt_name, mt_value, mt_time_2)
            VALUES (%s, %s, %s)
        """
        
        cur.execute(query, (sensor_name, value, terminal_time))
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error BD: {e}")

# Callbacks MQTT
def on_connect(client, userdata, flags, rc):
    print(f"Conectado al broker. Código: {rc}")
    for item in APP_CONFIG:
        client.subscribe(item['topic'])
        print(f"Suscrito a: {item['topic']}")

def on_message(client, userdata, msg):
    try:
        topic = msg.topic
        payload = json.loads(msg.payload.decode())
        
        if topic not in TOPIC_TABLE_MAP:
            return

        tablename = TOPIC_TABLE_MAP[topic]
        terminal_time = payload.get('_terminalTime')

        for key, value in payload.items():
            if not key.startswith('_'): 
                save_measurement(tablename, terminal_time, key, str(value))
                
        print(f"Datos guardados en tabla {tablename}")

    except Exception as e:
        print(f"Error procesando mensaje: {e}")

# Ejecución Principal
if __name__ == '__main__':
    client = mqtt.Client()
    client.on_connect = on_connect
    client.on_message = on_message

    client.connect("localhost", 1883, 60)
    client.loop_forever()