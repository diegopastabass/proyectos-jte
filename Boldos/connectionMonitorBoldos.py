import time
import logging
import requests
from datetime import datetime, timezone
import os
from dotenv import load_dotenv

load_dotenv()

API_URL = os.getenv("API_URL")
TOKEN = os.getenv("TOKEN")
TO = "120363426638885842@g.us"
ENDPOINT = "https://app.jteanalytics.cl/boldos/snapshot"

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

# --- formatear_tiempo ---
def formatear_tiempo(minutos_totales: float) -> str:
    minutos_totales = int(minutos_totales)
    dias = minutos_totales // 1440
    horas = (minutos_totales % 1440) // 60
    minutos = minutos_totales % 60
    
    partes = []
    if dias > 0:
        partes.append(f"{dias} d")
    if horas > 0:
        partes.append(f"{horas} h")
    if minutos > 0 or (dias == 0 and horas == 0):
        partes.append(f"{minutos} m")
        
    return " ".join(partes)

# --- verificar_estado_endpoint ---
def verificar_estado_endpoint():
    logging.info("Verificando estado del endpoint...")
    global alertas_activas
    try:
        response = requests.get(ENDPOINT, timeout=10)
        response.raise_for_status()
        data = response.json()
        snapshot = data.get("snapshot", {})

        ahora = datetime.now(timezone.utc)
        logging.info(f"Ahora: {ahora}")

        nuevas_alertas = []

        for sensor, info in snapshot.items():
            if not isinstance(info, dict) or "time" not in info:
                continue

            tiempo_str = info["time"].replace("Z", "+00:00")
            tiempo_sensor = datetime.fromisoformat(tiempo_str)

            minutos_inactivo = (ahora - tiempo_sensor).total_seconds() / 60

            logging.info(f"Sensor: {sensor}, Minutos inactivo: {minutos_inactivo}")

            if minutos_inactivo > 10:
                if sensor not in alertas_activas:
                    hora_legible = tiempo_sensor.astimezone().strftime("%Y-%m-%d %H:%M:%S")
                    tiempo_formateado = formatear_tiempo(minutos_inactivo)
                    nuevas_alertas.append(
                        f"Sensor: {sensor}\n"
                        f"Sin datos hace: {tiempo_formateado}.\n"
                        f"Último registro: {hora_legible}"
                    )
                    logging.info(f"Alerta registrada para {sensor}")
                    alertas_activas.add(sensor)
            else:
                if sensor in alertas_activas:
                    alertas_activas.remove(sensor)
                    logging.info(f"{sensor} recuperado.")
                else:
                    logging.info(f"{sensor} funcionando correctamente.")
                    
        if nuevas_alertas:
            mensaje_alerta = "🚨 ALERTA DE CONEXIÓN APR LOS BOLDOS 🚨\n\nEquipos sin datos:\n\n" + "\n\n".join(nuevas_alertas)
            enviar_alerta(mensaje_alerta)
            logging.info("Alerta agrupada enviada.")

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