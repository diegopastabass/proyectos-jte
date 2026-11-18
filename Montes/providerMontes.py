import os
import json
import time
import logging
import threading
from pathlib import Path

import paho.mqtt.client as mqtt
import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv

ENV_PATH = Path(__file__).with_name(".env")
load_dotenv(ENV_PATH)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
log = logging.getLogger("providerMontes")

# Las alertas de desconexión las envía monitorMontes.py (monitor unificado), que lee /montes/latest.

# Cada cuánto se guarda un registro por sensor en la BD.
INTERVALO_SEGUNDOS = int(os.getenv("INTERVALO_SEGUNDOS", "600"))

# topic -> {clave del payload: (sensor en la BD, tipo)}
TOPICS = {
    "MONTES_RILES": {
        "CAUDAL_2": ("montes_riles_caudal", "caudal"),
        "TOTALIZADOR_2": ("montes_riles_totalizador", "totalizador"),
    },
    "MONTES_GENERAL": {
        "CAUDAL_1": ("montes_general_caudal", "caudal"),
        "TOTALIZADOR_1": ("montes_general_totalizador", "totalizador"),
    },
}

lock = threading.Lock()

# Lecturas recibidas en la ventana actual: sensor -> lista de valores.
# Se vacía en cada inserción, así que si el equipo deja de enviar no se reinsertan datos viejos.
ventana = {sensor: [] for claves in TOPICS.values() for sensor, _ in claves.values()}


def a_numero(valor):
    try:
        return float(valor)
    except (TypeError, ValueError):
        return None


def on_connect(client, userdata, flags, rc, *args):
    log.info("Conectado al broker MQTT (rc=%s)", rc)
    client.subscribe([(topic, 0) for topic in TOPICS])


def on_message(client, userdata, msg):
    try:
        payload = json.loads(msg.payload.decode())
    except Exception as e:
        log.warning("Error al decodificar JSON de %s: %s", msg.topic, e)
        return

    if msg.topic not in TOPICS:
        return
    claves = TOPICS[msg.topic]
    with lock:
        for clave, (sensor, _) in claves.items():
            valor = a_numero(payload.get(clave))
            if valor is not None:
                ventana[sensor].append(valor)


def insert_batch():
    """Guarda el promedio del caudal y el último totalizador recibidos en la ventana.
    Un sensor sin lecturas en la ventana no se guarda: queda un hueco en vez de un dato repetido."""
    data_to_insert = []
    with lock:
        for claves in TOPICS.values():
            for sensor, tipo in claves.values():
                valores = ventana[sensor]
                if not valores:
                    continue
                valor = sum(valores) / len(valores) if tipo == "caudal" else valores[-1]
                data_to_insert.append((sensor, round(valor, 4)))
                ventana[sensor] = []

    if not data_to_insert:
        log.warning("Sin lecturas nuevas en la ventana; no se inserta nada")
        return

    try:
        conn = psycopg2.connect(
            host=os.getenv("DB_HOST"),
            port=os.getenv("DB_PORT"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASS") or os.getenv("DB_PASSWORD"),
            database=os.getenv("DB_NAME"),
            sslmode='require',
            connect_timeout=15,
        )
        try:
            with conn, conn.cursor() as cursor:
                execute_values(cursor, "INSERT INTO montes (name, value) VALUES %s", data_to_insert)
        finally:
            conn.close()
        log.info("Batch insertado: %s registros", len(data_to_insert))

    except Exception as e:
        log.error("Error en base de datos: %s", e)


def crear_cliente():
    # paho-mqtt 2.x exige indicar la versión de callbacks; 1.x no la conoce.
    try:
        return mqtt.Client(mqtt.CallbackAPIVersion.VERSION1)
    except AttributeError:
        return mqtt.Client()


if __name__ == "__main__":
    client = crear_cliente()
    client.on_connect = on_connect
    client.on_message = on_message

    try:
        client.connect("localhost", 1883, 60)
        client.loop_start()

        while True:
            time.sleep(INTERVALO_SEGUNDOS)
            insert_batch()

    except KeyboardInterrupt:
        client.loop_stop()
        log.info("Deteniendo servicio...")
