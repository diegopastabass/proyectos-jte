import os
import json
import time
import requests
import paho.mqtt.client as mqtt
import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv

load_dotenv()

API_URL = os.getenv("API_URL")
API_TOKEN = os.getenv("API_TOKEN")
API_TO = os.getenv("API_TO")

last_messages = {
    'MONTES_RILES': {},
    'MONTES_GENERAL': {}
}

last_seen = {
    'MONTES_RILES': time.time(),
    'MONTES_GENERAL': time.time()
}

alertas_activas = set()

def on_connect(client, userdata, flags, rc):
    print("Conectado al broker MQTT")
    client.subscribe([("MONTES_RILES", 0), ("MONTES_GENERAL", 0)])

def on_message(client, userdata, msg):
    try:
        topic = msg.topic
        payload = json.loads(msg.payload.decode())
        last_messages[topic] = payload
        last_seen[topic] = time.time()
    except Exception as e:
        print(f"Error al decodificar JSON: {e}")

def enviar_alerta(mensaje: str):
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    data = {"token": API_TOKEN, "to": API_TO, "body": mensaje}

    try:
        response = requests.post(API_URL, data=data, headers=headers, timeout=10)
        if response.status_code != 200:
            print(f"Error UltraMsg: {response.text}")
    except requests.RequestException as e:
        print(f"Error de conexion UltraMsg: {e}")

def verificar_desconexion():
    ahora = time.time()
    for topic, ultimo_tiempo in last_seen.items():
        minutos_inactivo = (ahora - ultimo_tiempo) / 60
        if minutos_inactivo > 30:
            if topic not in alertas_activas:
                mensaje = (
                    f"🚨 ALERTA DE CONEXIÓN 🚨\n"
                    f"Sensor: {topic}\n"
                    f"Sin datos hace: {minutos_inactivo:.1f} minutos."
                )
                enviar_alerta(mensaje)
                print(f"Alerta enviada para {topic}")
                alertas_activas.add(topic)
        else:
            if topic in alertas_activas:
                alertas_activas.remove(topic)
                print(f"{topic} recuperado.")

def insert_batch():
    data_to_insert = []
    
    riles = last_messages.get('MONTES_RILES', {})
    if 'CAUDAL_2' in riles:
        data_to_insert.append(("montes_riles_caudal", riles['CAUDAL_2']))
    if 'TOTALIZADOR_2' in riles:
        data_to_insert.append(("montes_riles_totalizador", riles['TOTALIZADOR_2']))

    general = last_messages.get('MONTES_GENERAL', {})
    if 'CAUDAL_1' in general:
        data_to_insert.append(("montes_general_caudal", general['CAUDAL_1']))
    if 'TOTALIZADOR_1' in general:
        data_to_insert.append(("montes_general_totalizador", general['TOTALIZADOR_1']))

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
            verificar_desconexion()
            
    except KeyboardInterrupt:
        client.loop_stop()
        print("Deteniendo servicio...")