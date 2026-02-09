import os
import json
import time
import paho.mqtt.client as mqtt
import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv

load_dotenv()

last_messages = {
    'MONTES_RILES': {},
    'MONTES_GENERAL': {}
}

def on_connect(client, userdata, flags, rc):
    print("Conectado al broker MQTT")
    client.subscribe([("MONTES_RILES", 0), ("MONTES_GENERAL", 0)])

def on_message(client, userdata, msg):
    try:
        topic = msg.topic
        payload = json.loads(msg.payload.decode())
        last_messages[topic] = payload
    except Exception as e:
        print(f"Error al decodificar JSON: {e}")

def insert_batch():
    data_to_insert = []
    
    riles = last_messages.get('MONTES_RILES', {})
    if 'CAUDAL_2' in riles:
        data_to_insert.append(("montes_riles.caudal", riles['CAUDAL_2']))
    if 'TOTALIZADOR_2' in riles:
        data_to_insert.append(("montes_riles.totalizador", riles['TOTALIZADOR_2']))

    general = last_messages.get('MONTES_GENERAL', {})
    if 'CAUDAL' in general:
        data_to_insert.append(("montes_general.caudal", general['CAUDAL']))
    if 'TOTALIZADOR' in general:
        data_to_insert.append(("montes_general.totalizador", general['TOTALIZADOR']))

    if not data_to_insert:
        return

    try:
        conn = psycopg2.connect(
            host=os.getenv("DB_HOST"),
            port=os.getenv("DB_PORT"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD"),
            database=os.getenv("DB_NAME"),
            sslmode='require' 
        )
        
        cursor = conn.cursor()
        query = "INSERT INTO montes (name, value) VALUES %s"
        execute_values(cursor, query, data_to_insert)
        
        conn.commit()
        cursor.close()
        conn.close()
        print(f"Batch insertado exitosamente: {len(data_to_insert)} registros")
        
    except Exception as e:
        print(f"Error en base de datos: {e}")

if __name__ == "__main__":
    client = mqtt.Client()
    client.on_connect = on_connect
    client.on_message = on_message

    try:
        client.connect("localhost", 1883, 60)
        client.loop_start() 

        while True:
            time.sleep(600)
            insert_batch()
            
    except KeyboardInterrupt:
        client.loop_stop()
        print("Deteniendo servicio...")