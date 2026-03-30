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

alertas_activas = set()

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
    global alertas_activas
    try:
        response = requests.get(ENDPOINT, timeout=10)
        response.raise_for_status()
        data = response.json()
        snapshot = data.get("snapshot", {})

        ahora = datetime.now(timezone.utc)

        for sensor, info in snapshot.items():
            if not isinstance(info, dict) or "time" not in info:
                continue

            tiempo_str = info["time"].replace("Z", "+00:00")
            tiempo_sensor = datetime.fromisoformat(tiempo_str)

            minutos_inactivo = (ahora - tiempo_sensor).total_seconds() / 60

            if minutos_inactivo > 10:
                if sensor not in alertas_activas:
                    mensaje = (
                        f"🚨 ALERTA DE CONEXIÓN 🚨\n"
                        f"Sensor: {sensor}\n"
                        f"Sin datos hace: {minutos_inactivo:.1f} minutos.\n"
                        f"Último registro: {info['time']}"
                    )
                    enviar_alerta(mensaje)
                    logging.info(f"Alerta enviada para {sensor}")
                    alertas_activas.add(sensor)
            else:
                if sensor in alertas_activas:
                    alertas_activas.remove(sensor)
                    logging.info(f"{sensor} recuperado.")
                    
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