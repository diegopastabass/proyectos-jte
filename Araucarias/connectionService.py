import os
import json
import time
import logging
from datetime import datetime, timedelta

import requests
import schedule
from dotenv import load_dotenv

# Configuración de Logs
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("connection_service.log"),
        logging.StreamHandler()
    ]
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, '.env'))

API_URL = os.getenv("API_URL")
TOKEN = os.getenv("API_TOKEN")
TO = os.getenv("API_TO_ADMIN")

SNAPSHOT_URL = "https://app.jteanalytics.cl/araucarias/snapshot"
NOMBRE_EQUIPO = "ARAUCARIAS"
INTERVALO_MINUTOS = 5
UMBRAL_DESCONEXION = timedelta(minutes=30)
DESFASE_BACKEND = timedelta(hours=3)  # El backend entrega los timestamps +3h respecto a la hora real

# Guarda el timestamp del episodio ya alertado para no repetir la alerta (sobrevive a reinicios)
STATE_FILE = os.path.join(BASE_DIR, "connection_state.json")


def cargar_estado():
    try:
        with open(STATE_FILE) as f:
            return json.load(f).get("episodio_alertado")
    except (FileNotFoundError, json.JSONDecodeError):
        return None


def guardar_estado(episodio_alertado):
    with open(STATE_FILE, "w") as f:
        json.dump({"episodio_alertado": episodio_alertado}, f)


def get_snapshot():
    try:
        response = requests.get(SNAPSHOT_URL, timeout=10)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        logging.error(f"Fallo al obtener snapshot: {e}")
        return None


def parse_timestamp(iso_time: str) -> datetime:
    # Se descarta la zona horaria y se corrige el desfase para comparar con la hora local
    dt = datetime.fromisoformat(iso_time.replace('Z', '+00:00')).replace(tzinfo=None)
    return dt - DESFASE_BACKEND


def get_ultimo_timestamp(snapshot: dict):
    tiempos = [
        parse_timestamp(v["time"])
        for v in snapshot.values()
        if isinstance(v, dict) and v.get("time")
    ]
    return max(tiempos) if tiempos else None


def formatear_duracion(delta: timedelta) -> str:
    total_minutos = int(delta.total_seconds() // 60)
    horas, minutos = divmod(total_minutos, 60)
    return f"{horas}h {minutos}m"


def enviar_alerta(mensaje: str) -> bool:
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    data = {"token": TOKEN, "to": TO, "body": mensaje}

    try:
        response = requests.post(API_URL, data=data, headers=headers, timeout=10)
        if response.status_code == 200:
            logging.info(f"📤 Alerta enviada con éxito: {mensaje}")
            return True
        logging.warning(f"⚠️ Error en respuesta UltraMsg ({response.status_code}): {response.text}")
    except requests.RequestException as e:
        logging.error(f"❌ Error enviando mensaje a UltraMsg: {e}")
    return False


def verificar_conexion():
    snapshot = get_snapshot()
    if not snapshot:
        return

    ultimo = get_ultimo_timestamp(snapshot)
    if ultimo is None:
        logging.error("El snapshot no contiene timestamps válidos")
        return

    antiguedad = datetime.now() - ultimo
    episodio_alertado = cargar_estado()

    if antiguedad <= UMBRAL_DESCONEXION:
        logging.info(f"✅ Equipo conectado. Último dato: {ultimo:%Y-%m-%d %H:%M:%S} ({formatear_duracion(antiguedad)})")
        if episodio_alertado:
            logging.info("🔄 Conexión restablecida, episodio de desconexión cerrado")
            guardar_estado(None)
        return

    # Un mismo episodio de desconexión se identifica por su último timestamp recibido
    episodio_actual = ultimo.isoformat()
    if episodio_alertado == episodio_actual:
        logging.info(f"⏳ Desconexión continuada ({formatear_duracion(antiguedad)}), ya fue alertada")
        return

    mensaje = (
        f"⚠️ ALERTA DE CONEXIÓN {NOMBRE_EQUIPO} ⚠️\n"
        f"Tiempo desconectado: {formatear_duracion(antiguedad)}"
    )
    if enviar_alerta(mensaje):
        guardar_estado(episodio_actual)


if __name__ == "__main__":
    logging.info(f"Servicio de conexión iniciado (cada {INTERVALO_MINUTOS} min)")
    verificar_conexion()
    schedule.every(INTERVALO_MINUTOS).minutes.do(verificar_conexion)

    while True:
        schedule.run_pending()
        time.sleep(1)
