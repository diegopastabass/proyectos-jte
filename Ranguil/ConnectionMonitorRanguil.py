import time
import logging
import requests
from datetime import datetime, timezone
import os
from dotenv import load_dotenv

load_dotenv()

API_URL = os.getenv("API_URL")
TOKEN = os.getenv("TOKEN")
TO = os.getenv("TO")
ENDPOINT = "https://app.jteanalytics.cl/ranguil/snapshot"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_FILE = os.path.join(BASE_DIR, "estado_equipo.log")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8", mode="a"),
        logging.StreamHandler()
    ]
)

equipo_desconectado = False
ultima_alerta_enviada = None

# --- enviar_alerta ---
def enviar_alerta(mensaje: str):
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    data = {"token": TOKEN, "to": TO, "body": mensaje}

    try:
        response = requests.post(API_URL, data=data, headers=headers, timeout=10)
        if response.status_code != 200:
            logging.warning(f"Error UltraMsg: {response.text}")
    except requests.RequestException as e:
        logging.error(f"Error de conexion UltraMsg: {e}")

# --- verificar_estado_endpoint ---
def verificar_estado_endpoint():
    global equipo_desconectado, ultima_alerta_enviada
    try:
        response = requests.get(ENDPOINT, timeout=10)
        response.raise_for_status()
        data = response.json()
        snapshot = data.get("snapshot", {})

        ahora = datetime.now(timezone.utc)
        mas_reciente = None
        ultimo_registro_str = ""

        for sensor, info in snapshot.items():
            if not isinstance(info, dict) or "time" not in info:
                continue

            tiempo_str = info["time"].replace("Z", "+00:00")
            tiempo_sensor = datetime.fromisoformat(tiempo_str)

            if mas_reciente is None or tiempo_sensor > mas_reciente:
                mas_reciente = tiempo_sensor
                ultimo_registro_str = info["time"]

        if mas_reciente is None:
            return

        minutos_inactivo = (ahora - mas_reciente).total_seconds() / 60

        if minutos_inactivo > 30:
            enviar = False
            if not equipo_desconectado:
                enviar = True
            elif ultima_alerta_enviada is not None:
                horas_desde_alerta = (ahora - ultima_alerta_enviada).total_seconds() / 3600
                if horas_desde_alerta >= 24:
                    enviar = True

            if enviar:
                mensaje = (
                    f"🚨 ALERTA DE CONEXIÓN RANGUIL 🚨\n"
                    f"Equipo sin conexión.\n"
                    f"Sin datos hace: {minutos_inactivo:.1f} minutos.\n"
                    f"Último registro: {ultimo_registro_str}"
                )
                enviar_alerta(mensaje)
                logging.info(f"Alerta de equipo enviada. Minutos inactivo: {minutos_inactivo:.1f}")
                ultima_alerta_enviada = ahora
                equipo_desconectado = True
        else:
            if equipo_desconectado:
                equipo_desconectado = False
                logging.info("Equipo Ranguil recuperado.")
                    
    except Exception as e:
        logging.error(f"Error consultando endpoint: {e}")

# --- monitorear ---
def monitorear():
    while True:
        verificar_estado_endpoint()
        time.sleep(300)

if __name__ == "__main__":
    try:
        logging.info("Iniciando monitoreo via API...")
        monitorear()
    except KeyboardInterrupt:
        logging.info("Servicio detenido.")