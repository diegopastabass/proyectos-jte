import time
import logging
import requests
from datetime import datetime, timedelta, timezone
import os
from dotenv import load_dotenv

# --- Cargar variables desde .env ---
load_dotenv()

# --- Configuración desde .env ---
API_URL = os.getenv("API_URL")
TOKEN = os.getenv("API_TOKEN")
TO = os.getenv("API_TO")

# Estos valores se recargarán en cada ciclo
def get_dynamic_config():
    return {
        "INTERVALO_MINUTOS": int(os.getenv("INTERVALO_MINUTOS", 30)),
        "NIVEL_ALERTA": float(os.getenv("NIVEL_ALERTA", 3.5)),
    }

# Nombre de sensores
SENSOR_ESTANQUE = "SALA_BOMBAS_NIVEL_METROS"

# --- Logging ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_FILE = os.path.join(BASE_DIR, "logs_compania.txt")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.FileHandler(LOG_FILE, encoding="utf-8", mode="a")]
)


# --- Funciones ---
def obtener_datos_historicos(minutos):
    """Obtiene registros de la API de los últimos X minutos."""
    # Como los datos llegan aprox cada 5 segundos (12 por minuto),
    # calculamos cuántos pedir para cubrir el intervalo con un margen.
    limit = max(100, minutos * 12 + 50)
    url = f"https://app.jteanalytics.cl/compania/nivel?limit={limit}"
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        if not data:
            return []
            
        def parse_time(t_str):
            if t_str.endswith("Z"):
                t_str = t_str[:-1] + "+00:00"
            return datetime.fromisoformat(t_str).replace(tzinfo=None)
            
        # Utilizamos timezone.utc para evitar el warning de deprecación de utcnow
        ahora = datetime.now(timezone.utc).replace(tzinfo=None)
        limite_tiempo = ahora - timedelta(minutes=minutos)
        
        datos_filtrados = []
        for d in data:
            d_time = parse_time(d["time"])
            if d_time >= limite_tiempo:
                datos_filtrados.append({
                    "time": d_time,
                    "value": float(d["value"])
                })
                
        # Ordenar por time ascendente (más antiguo primero)
        datos_filtrados.sort(key=lambda x: x["time"])
        return datos_filtrados
        
    except Exception as e:
        logging.error(f"Error obteniendo niveles desde la API: {e}")
        return []


def calcular_tiempo_vaciado(nivel_actual, nivel_anterior, time_actual, time_anterior):
    """Estimación de vaciado."""
    delta_nivel = nivel_actual - nivel_anterior
    delta_tiempo = (time_actual - time_anterior).total_seconds()

    if delta_nivel >= 0 or delta_tiempo <= 0:
        return None

    tasa_descenso = abs(delta_nivel) / delta_tiempo
    tiempo_restante_segundos = int(nivel_actual / tasa_descenso)

    # Convertimos los segundos a formato amigable (ej: hh:mm:ss)
    return str(timedelta(seconds=tiempo_restante_segundos))

def enviar_alerta(mensaje: str):
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    data = {"token": TOKEN, "to": TO, "body": mensaje}

    try:
        response = requests.post(API_URL, data=data, headers=headers, timeout=10)
        if response.status_code == 200:
            logging.info(f"📤 Alerta enviada con éxito:\n{mensaje}")
        else:
            logging.warning(f"⚠️ Error en respuesta UltaMsg ({response.status_code}): {response.text}")
    except requests.RequestException as e:
        logging.error(f"❌ Error enviando mensaje a UltaMsg: {e}")

def procesar_estanque(sensor, nombre_publico, nivel_alerta, intervalo_minutos):
    datos = obtener_datos_historicos(intervalo_minutos)

    if not datos:
        logging.warning(f"No hay suficientes datos en los últimos {intervalo_minutos} minutos para {nombre_publico}.")
        return False

    # Verificar si el estanque cumplió condición de alerta en cualquier momento del periodo
    min_dato = min(datos, key=lambda x: x["value"])
    nivel_minimo = min_dato["value"]

    # Nivel actual (el último registro del periodo)
    dato_final = datos[-1]
    nivel_actual = dato_final["value"]

    if nivel_minimo < nivel_alerta:
        # Calcular tendencia de vaciado usando el inicio y el final de este periodo
        dato_inicial = datos[0]
        nivel_anterior = dato_inicial["value"]

        tiempo_vaciado = None
        if nivel_actual <= nivel_anterior:
            tiempo_vaciado = calcular_tiempo_vaciado(
                nivel_actual, nivel_anterior, dato_final["time"], dato_inicial["time"]
            )

        mensaje = (
            f"🚨 ALERTA NIVEL CRÍTICO 🚨\n"
            f"Estanque: {nombre_publico}\n"
            f"Nivel Mínimo (Últimos {intervalo_minutos} min): {nivel_minimo:.2f} m\n"
            f"Nivel Actual: {nivel_actual:.2f} m\n"
        )
        if tiempo_vaciado:
            mensaje += f"Tiempo Estimado de Vaciado: {tiempo_vaciado}"
        else:
            mensaje += f"Tiempo Estimado de Vaciado: N/A"

        enviar_alerta(mensaje)
        return True
    else:
        logging.info(f"{nombre_publico}: condiciones normales. Nivel actual: {nivel_actual:.2f} m (Mínimo en últimos {intervalo_minutos} min: {nivel_minimo:.2f} m)")
        return False

def monitorear():
    """Bucle principal."""
    while True:
        cfg = get_dynamic_config()
        intervalo = cfg["INTERVALO_MINUTOS"]   
        nivel_alerta = cfg["NIVEL_ALERTA"]

        logging.info(f"Iniciando ciclo de monitoreo (Intervalo: {intervalo} minutos)...")

        procesar_estanque(SENSOR_ESTANQUE, "Estanque Nuevo", nivel_alerta, intervalo)

        logging.info(f"✓ Ciclo finalizado. Durmiendo {intervalo} minuto(s)...")
        time.sleep(intervalo * 60)



if __name__ == "__main__":
    try:
        monitorear()
    except KeyboardInterrupt:
        logging.info("Servicio detenido manualmente.")
