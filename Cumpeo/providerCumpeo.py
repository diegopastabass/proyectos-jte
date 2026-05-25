import os
import json
import time
from datetime import datetime
import paho.mqtt.client as mqtt
import psycopg2
from psycopg2 import extras
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

# --- Configuración de Base de Datos ---
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_USER = os.getenv("DB_USER")
DB_PASS = os.getenv("DB_PASS")
DB_NAME = os.getenv("DB_NAME")
TABLE_NAME = os.getenv("TABLE_NAME", "ssr_cumpeo")

# --- Configuración MQTT ---
MQTT_HOST = os.getenv("MQTT_HOST", "localhost")
MQTT_PORT = int(os.getenv("MQTT_PORT", 1883))
TOPIC = os.getenv("TOPIC", "/nivel_cumpeo")
BULK_TIME_SEC = int(os.getenv("BULK_TIME", "300000")) / 1000.0

# --- Configuración de Escalamiento ---
ESC_SUBTRAHEND = float(os.getenv("ESC_SUBTRAHEND", 4000))
ESC_MULTIPLIER = float(os.getenv("ESC_MULTIPLIER", 0.000625))

# Cola temporal en memoria
data_buffer = []

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("Conectado exitosamente al broker MQTT.")
        client.subscribe(TOPIC)
        print(f"Suscrito al topic: {TOPIC}")
    else:
        print(f"Error de conexión, código: {rc}")

def on_message(client, userdata, msg):
    try:
        payload = msg.payload.decode('utf-8')
        data = json.loads(payload)
        arrival_time = datetime.now()

        for key, value in data.items():
            final_value = value
            
            # Verificar si la etiqueta es "NIVEL" para aplicar el escalamiento
            if key.upper() == "NIVEL":
                x = float(value)
                # Aplicación de la fórmula: (x - 4000) * 0.000625
                final_value = (x - ESC_SUBTRAHEND) * ESC_MULTIPLIER
            
            # Guardar en el buffer el valor procesado
            data_buffer.append((key, final_value, arrival_time, arrival_time))

    except json.JSONDecodeError:
        print(f"Error al decodificar JSON ignorado: {msg.payload}")
    except Exception as e:
        print(f"Error procesando mensaje: {e}")

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
            INSERT INTO {TABLE_NAME} (name, value, terminal_time, insert_time)
            VALUES %s
        """
        
        extras.execute_values(cursor, insert_query, records)
        conn.commit()
        print(f"[{datetime.now()}] Éxito: {len(records)} registros guardados en RDS.")

    except (Exception, psycopg2.Error) as error:
        print(f"[{datetime.now()}] Error crítico al insertar en RDS: {error}")
    finally:
        if conn:
            cursor.close()
            conn.close()

def main():
    client = mqtt.Client()
    client.on_connect = on_connect
    client.on_message = on_message

    try:
        client.connect(MQTT_HOST, MQTT_PORT, 60)
        client.loop_start()
    except Exception as e:
        print(f"No se pudo conectar al broker MQTT: {e}")
        return

    last_insert_time = time.time()
    print("Script iniciado con escalamiento de datos activo. Esperando datos...")

    try:
        while True:
            time.sleep(1)
            current_time = time.time()

            if (current_time - last_insert_time) >= BULK_TIME_SEC:
                if data_buffer:
                    records_to_insert = list(data_buffer)
                    data_buffer.clear()
                    insert_bulk_to_rds(records_to_insert)
                else:
                    print(f"[{datetime.now()}] Sin datos nuevos en este ciclo de 5 minutos.")
                
                last_insert_time = current_time

    except KeyboardInterrupt:
        print("\nDetención manual detectada. Cerrando conexiones...")
    finally:
        client.loop_stop()
        client.disconnect()
        
        if data_buffer:
            print(f"Insertando {len(data_buffer)} registros remanentes...")
            insert_bulk_to_rds(data_buffer)

if __name__ == "__main__":
    main()