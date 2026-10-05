import time
import logging
import requests
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv

# --- Cargar variables desde .env ---
load_dotenv()

# --- Configuración desde .env ---
API_URL = os.getenv("API_URL")
# Soporte para nombres de variables como API_TOKEN o TOKEN
TOKEN = os.getenv("API_TOKEN") or os.getenv("TOKEN")
TO = os.getenv("API_TO") or os.getenv("TO")

# --- Logging ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_FILE = os.path.join(BASE_DIR, "logs_health_check.txt")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8", mode="a"),
        logging.StreamHandler()
    ]
)

def verificar_api():
    """Verifica si la API UltraMsg responde y envía un mensaje si está todo OK."""
    if not API_URL or not TOKEN or not TO:
        logging.error("Faltan variables de entorno (API_URL, TOKEN, TO). Verifica tu archivo .env.")
        return

    mensaje = "✅ El servicio y la API UltraMsg están funcionando de manera correcta. No hay ningún problema."
    
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    data = {
        "token": TOKEN,
        "to": TO,
        "body": mensaje
    }

    try:
        logging.info("Verificando estado de la API UltraMsg...")
        response = requests.post(API_URL, data=data, headers=headers, timeout=10)
        
        if response.status_code == 200:
            logging.info("API funcionando correctamente. Mensaje de estado enviado.")
        else:
            logging.error(f"Error en respuesta UltraMsg ({response.status_code}): {response.text}")
    except requests.RequestException as e:
        logging.error(f"Error de conexión con la API UltraMsg: {e}")

def get_next_target_time():
    """Calcula el próximo momento para ejecutar la verificación (12:00 o 00:00)."""
    now = datetime.now()
    
    target1 = now.replace(hour=12, minute=0, second=0, microsecond=0)
    target2 = now.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
    
    if now < target1:
        return target1
    else:
        return target2

def main_loop():
    logging.info("Servicio de Health Check iniciado (Monitoreo 12:00 y 24:00).")
    
    while True:
        next_time = get_next_target_time()
        sleep_seconds = (next_time - datetime.now()).total_seconds()
        
        if sleep_seconds > 0:
            logging.info(f"Próxima verificación programada para: {next_time.strftime('%Y-%m-%d %H:%M:%S')} (en {int(sleep_seconds)} segundos)")
            time.sleep(sleep_seconds)
            
        verificar_api()
        
        # Esperar un poco antes de calcular el próximo ciclo para no repetir en el mismo segundo
        time.sleep(2)

if __name__ == "__main__":
    try:
        main_loop()
    except KeyboardInterrupt:
        logging.info("Servicio de Health Check detenido manualmente.")
