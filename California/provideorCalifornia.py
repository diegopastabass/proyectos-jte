import os
import json
import time
from datetime import datetime
import paho.mqtt.client as mqtt
import psycopg2
from psycopg2 import extras
from dotenv import load_dotenv

load_dotenv()

# Configuraciones principales
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_USER = os.getenv("DB_USER")
DB_PASS = os.getenv("DB_PASS")
DB_NAME = os.getenv("DB_NAME")
TABLE_NAME = os.getenv("TABLE_NAME", "ssr_california")

MQTT_HOST = os.getenv("MQTT_HOST", "localhost")
MQTT_PORT = int(os.getenv("MQTT_PORT", 1883))
TOPIC = os.getenv("TOPIC", "data/CALIFORNIA/CALIFORNIA/CALIFORNIA")
BULK_TIME_SEC = int(os.getenv("BULK_TIME", "300000")) / 1000.0

data_buffer = []

# on_connect
def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("Conectado al broker MQTT")
        client.subscribe(TOPIC)
    else:
        print(f"Error de conexión: {rc}")

# on_message
def on_message(client, userdata, msg):
    try:
        # Capturar la hora de llegada real del servidor inmediatamente
        arrival_time = datetime.now()

        payload = msg.payload.decode('utf-8')
        data = json.loads(payload)
        
        terminal_time_str = data.get("_terminalTime", "")
        if terminal_time_str:
            mt_time = datetime.strptime(terminal_time_str, "%Y-%m-%d %H:%M:%S.%f").date()
        else:
            mt_time = arrival_time.date()

        for key, value in data.items():
            if key in ["_terminalTime", "_groupName"]:
                continue
            
            # Se guarda arrival_time como 5to elemento para insertar en mt_time_2
            data_buffer.append((key, str(value), mt_time, '1', arrival_time))

    except json.JSONDecodeError:
        pass
    except Exception as e:
        print(f"Error procesando mensaje: {e}")

# insert_bulk_to_rds
def insert_bulk_to_rds(records):
    if not records:
        return

    conn = None
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASS,
            dbname=DB_NAME
        )
        cursor = conn.cursor()

        insert_query = f"""
            INSERT INTO {TABLE_NAME} (mt_name, mt_value, mt_time, mt_quality, mt_time_2)
            VALUES %s
        """
        
        extras.execute_values(cursor, insert_query, records)
        conn.commit()
        print(f"[{datetime.now()}] {len(records)} registros insertados.")

    except (Exception, psycopg2.Error) as error:
        print(f"[{datetime.now()}] Error en RDS: {error}")
    finally:
        if conn:
            cursor.close()
            conn.close()

# main
def main():
    client = mqtt.Client()
    client.on_connect = on_connect
    client.on_message = on_message

    try:
        client.connect(MQTT_HOST, MQTT_PORT, 60)
        client.loop_start()
    except Exception as e:
        print(f"Error al conectar con MQTT: {e}")
        return

    last_insert_time = time.time()
    
    try:
        while True:
            time.sleep(1)
            current_time = time.time()

            if (current_time - last_insert_time) >= BULK_TIME_SEC:
                if data_buffer:
                    records_to_insert = list(data_buffer)
                    data_buffer.clear()
                    insert_bulk_to_rds(records_to_insert)
                
                last_insert_time = current_time

    except KeyboardInterrupt:
        print("\nDeteniendo script...")
    finally:
        client.loop_stop()
        client.disconnect()
        
        if data_buffer:
            insert_bulk_to_rds(data_buffer)

if __name__ == "__main__":
    main()