"""
Proveedor de datos MQTT -> PostgreSQL (RDS) para SSR Tambo.

Se suscribe al topic del equipo COPSET y guarda cada variable del mensaje como una
fila en la tabla (por defecto ssr_tambo):

    mt_name  = nombre de la variable
    mt_value = valor (texto)
    mt_id, mt_time_2 = los genera la base de datos al insertar

Como mt_time_2 lo pone la BD, los datos se insertan apenas llegan (cada FLUSH_SEGUNDOS)
y no en bloques de varios minutos, para que la hora guardada sea la de la lectura.

Robustez:
  - Reconexión automática al broker y a la BD (conexión persistente con keepalive).
  - Si la BD falla, las filas quedan en memoria y se reintentan. Al detener el servicio,
    lo que no se pudo guardar se escribe en pendientes_tambo.jsonl y se recupera al iniciar.
  - Descarta mensajes repetidos (mismo _terminalTime, p. ej. un reenvío QoS 1) y el mensaje
    retenido que el broker entrega al suscribirse (lectura antigua).
  - Log rotativo (logs_provider.txt, 5 x 5 MB) y resumen periódico de actividad.
  - Alertas opcionales por UltraMsg al grupo admin: sin datos del equipo y BD caída.
  - Compatible con paho-mqtt 1.x y 2.x.

Uso:
    python providerTambo.py               servicio normal
    python providerTambo.py --sin-bd      no toca la BD: imprime las filas que insertaría
    python providerTambo.py --probar-bd   prueba la conexión y la tabla, y termina
"""
import argparse
import importlib.metadata
import json
import logging
import os
import signal
import socket
import sys
import threading
import time
from collections import deque
from datetime import datetime
from logging.handlers import RotatingFileHandler

import paho.mqtt.client as mqtt
import psycopg2
import requests
from dotenv import load_dotenv
from psycopg2 import extras, sql

VERSION = "1.0.0"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(BASE_DIR, ".env")
LOG_PATH = os.path.join(BASE_DIR, "logs_provider.txt")
PENDIENTES_PATH = os.path.join(BASE_DIR, "pendientes_tambo.jsonl")

load_dotenv(ENV_PATH)


def _env(*nombres, defecto=None):
    for nombre in nombres:
        valor = os.getenv(nombre)
        if valor not in (None, ""):
            return valor.strip().strip('"').strip("'")
    return defecto


def _env_bool(nombre, defecto):
    valor = _env(nombre)
    if valor is None:
        return defecto
    return valor.lower() in ("1", "true", "si", "sí", "yes")


# --- Base de datos ---
DB_HOST = _env("DB_HOST")
DB_PORT = int(_env("DB_PORT", defecto="5432"))
DB_USER = _env("DB_USER")
DB_PASS = _env("DB_PASS", "DB_PASSWORD")
DB_NAME = _env("DB_NAME")
DB_SSLMODE = _env("DB_SSLMODE", defecto="require")
TABLE_NAME = _env("TABLE_NAME", defecto="ssr_tambo")

# --- MQTT ---
MQTT_HOST = _env("MQTT_HOST", defecto="localhost")
MQTT_PORT = int(_env("MQTT_PORT", defecto="1883"))
MQTT_USER = _env("MQTT_USER")
MQTT_PASS = _env("MQTT_PASS", "MQTT_PASSWORD")
MQTT_QOS = int(_env("MQTT_QOS", defecto="1"))
MQTT_CLIENT_ID = _env("MQTT_CLIENT_ID", defecto=f"providerTambo-{socket.gethostname()}")
TOPIC = _env("TOPIC", defecto="data/TAMBO/COPSET/5203518640151117058")

# --- Proceso ---
FLUSH_SEGUNDOS = float(_env("FLUSH_SEGUNDOS", defecto="2"))
LOTE_MAX = int(_env("LOTE_MAX", defecto="1000"))              # filas por INSERT
MAX_PENDIENTES = int(_env("MAX_PENDIENTES", defecto="200000"))  # tope en memoria si la BD está caída
RESUMEN_MINUTOS = float(_env("RESUMEN_MINUTOS", defecto="15"))
DESCARTAR_DUPLICADOS = _env_bool("DESCARTAR_DUPLICADOS", True)
# El mensaje retenido que entrega el broker al suscribirse es una lectura antigua: guardarlo
# con mt_time_2 = ahora la duplicaría con hora incorrecta en cada reinicio o reconexión.
IGNORAR_RETENIDOS = _env_bool("IGNORAR_RETENIDOS", True)
# Variables a ignorar además de las que empiezan con "_" (separadas por coma)
CLAVES_EXCLUIDAS = {c.strip() for c in (_env("CLAVES_EXCLUIDAS", defecto="") or "").split(",") if c.strip()}

# --- Alertas UltraMsg (opcionales: si falta alguna variable, solo se registran en el log) ---
API_URL = _env("API_URL")
API_TOKEN = _env("API_TOKEN", "TOKEN")
API_TO_ADMIN = _env("API_TO_ADMIN", "TO_ADMIN")
UMBRAL_SIN_DATOS_MINUTOS = float(_env("UMBRAL_SIN_DATOS_MINUTOS", defecto="30"))
UMBRAL_FALLA_BD_MINUTOS = float(_env("UMBRAL_FALLA_BD_MINUTOS", defecto="10"))
NOMBRE_SITIO = _env("NOMBRE_SITIO", defecto="SSR Tambo")

logger = logging.getLogger("providerTambo")
detener = threading.Event()


# ================== LOGGING ==================

def configurar_logging():
    logger.setLevel(logging.INFO)
    formato = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s")
    archivo = RotatingFileHandler(LOG_PATH, maxBytes=5_000_000, backupCount=5, encoding="utf-8")
    archivo.setFormatter(formato)
    consola = logging.StreamHandler(sys.stdout)
    consola.setFormatter(formato)
    logger.addHandler(archivo)
    logger.addHandler(consola)


# ================== BUFFER ==================

class Buffer:
    """Cola de filas (mt_name, mt_value) compartida entre el hilo MQTT y el principal."""

    def __init__(self, maximo):
        self._filas = deque()
        self._lock = threading.Lock()
        self._maximo = maximo
        self.descartadas = 0

    def agregar(self, filas):
        with self._lock:
            self._filas.extend(filas)
            sobrantes = len(self._filas) - self._maximo
            for _ in range(max(0, sobrantes)):
                self._filas.popleft()
            if sobrantes > 0:
                self.descartadas += sobrantes
                logger.warning(f"Buffer lleno ({self._maximo}): se descartaron {sobrantes} filas antiguas")

    def tomar(self, cantidad):
        with self._lock:
            return [self._filas.popleft() for _ in range(min(cantidad, len(self._filas)))]

    def devolver(self, filas):
        """Reinserta al inicio filas que no se pudieron guardar, respetando el orden."""
        with self._lock:
            self._filas.extendleft(reversed(filas))

    def todas(self):
        with self._lock:
            filas = list(self._filas)
            self._filas.clear()
            return filas

    def __len__(self):
        with self._lock:
            return len(self._filas)


buffer = Buffer(MAX_PENDIENTES)


class Estadisticas:
    def __init__(self):
        self.lock = threading.Lock()
        self.mensajes = 0
        self.duplicados = 0
        self.invalidos = 0
        self.filas_insertadas = 0
        self.ultimo_mensaje = None        # time.time() del último mensaje válido
        self.ultimo_terminal_time = None
        self.mqtt_conectado = False

    def resumen_y_reiniciar(self):
        with self.lock:
            texto = (f"mensajes={self.mensajes} duplicados={self.duplicados} invalidos={self.invalidos} "
                     f"filas_insertadas={self.filas_insertadas}")
            self.mensajes = self.duplicados = self.invalidos = self.filas_insertadas = 0
            return texto


stats = Estadisticas()


# ================== PERSISTENCIA LOCAL ==================

def guardar_pendientes(filas):
    """Agrega al archivo local las filas que no se pudieron insertar."""
    if not filas:
        return
    try:
        with open(PENDIENTES_PATH, "a", encoding="utf-8") as f:
            for nombre, valor in filas:
                f.write(json.dumps([nombre, valor], ensure_ascii=False) + "\n")
        logger.warning(f"{len(filas)} filas sin insertar guardadas en {PENDIENTES_PATH}")
    except OSError as e:
        logger.error(f"No se pudieron guardar {len(filas)} filas pendientes: {e}")


def cargar_pendientes():
    """Carga al buffer las filas que quedaron de una ejecución anterior y borra el archivo."""
    if not os.path.exists(PENDIENTES_PATH):
        return
    filas = []
    try:
        with open(PENDIENTES_PATH, encoding="utf-8") as f:
            for linea in f:
                linea = linea.strip()
                if not linea:
                    continue
                try:
                    nombre, valor = json.loads(linea)
                    filas.append((nombre, valor))
                except (ValueError, TypeError):
                    logger.warning(f"Línea inválida en pendientes, se omite: {linea[:100]}")
        os.remove(PENDIENTES_PATH)
    except OSError as e:
        logger.error(f"No se pudo leer {PENDIENTES_PATH}: {e}")
        return
    if filas:
        buffer.agregar(filas)
        logger.info(f"Recuperadas {len(filas)} filas pendientes de la ejecución anterior")


# ================== BASE DE DATOS ==================

class BaseDatos:
    def __init__(self):
        self.conn = None
        partes = TABLE_NAME.split(".")  # admite "esquema.tabla"
        self.query = sql.SQL("INSERT INTO {} (mt_name, mt_value) VALUES %s").format(sql.Identifier(*partes))
        self.falla_desde = None  # time.time() del primer error de la racha actual

    def conectar(self):
        if self.conn is not None and not self.conn.closed:
            return self.conn
        self.conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASS,
            dbname=DB_NAME,
            sslmode=DB_SSLMODE,
            connect_timeout=10,
            application_name="providerTambo",
            keepalives=1,
            keepalives_idle=30,
            keepalives_interval=10,
            keepalives_count=3,
            options="-c statement_timeout=30000",
        )
        logger.info(f"Conectado a PostgreSQL {DB_HOST}:{DB_PORT}/{DB_NAME}")
        return self.conn

    def cerrar(self):
        if self.conn is not None:
            try:
                self.conn.close()
            except Exception:
                pass
        self.conn = None

    def insertar(self, filas):
        """Inserta las filas en una transacción. Lanza la excepción si falla."""
        conn = self.conectar()
        try:
            with conn.cursor() as cur:
                extras.execute_values(cur, self.query, filas, page_size=LOTE_MAX)
            conn.commit()
        except Exception:
            try:
                conn.rollback()
            except Exception:
                pass
            # Ante cualquier error se descarta la conexión: la siguiente vez se abre una nueva
            self.cerrar()
            raise

    def probar(self):
        conn = self.conectar()
        partes = TABLE_NAME.split(".")
        esquema, tabla = (partes if len(partes) == 2 else ("public", partes[0]))
        with conn.cursor() as cur:
            cur.execute(
                """SELECT column_name, data_type, column_default, is_nullable
                   FROM information_schema.columns
                   WHERE table_schema = %s AND table_name = %s
                   ORDER BY ordinal_position""",
                (esquema, tabla),
            )
            columnas = cur.fetchall()
        conn.rollback()
        return columnas


# ================== ALERTAS ==================

def enviar_alerta(mensaje):
    if not (API_URL and API_TOKEN and API_TO_ADMIN):
        logger.warning(f"Alerta (UltraMsg no configurado, solo log): {mensaje}")
        return
    try:
        r = requests.post(
            API_URL,
            data={"token": API_TOKEN, "to": API_TO_ADMIN, "body": mensaje},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=15,
        )
        if r.status_code != 200:
            logger.error(f"UltraMsg respondió {r.status_code}: {r.text[:200]}")
        else:
            logger.info(f"Alerta enviada: {mensaje.splitlines()[0]}")
    except requests.RequestException as e:
        logger.error(f"No se pudo enviar alerta por UltraMsg: {e}")


class Alertas:
    """Avisa una sola vez al entrar en falla y una vez al recuperarse."""

    def __init__(self, inicio):
        self.inicio = inicio
        self.sin_datos = False
        self.bd_caida = False

    def revisar(self, bd):
        ahora = time.time()

        referencia = stats.ultimo_mensaje or self.inicio
        minutos_sin_datos = (ahora - referencia) / 60
        if minutos_sin_datos >= UMBRAL_SIN_DATOS_MINUTOS and not self.sin_datos:
            self.sin_datos = True
            estado_mqtt = "conectado" if stats.mqtt_conectado else "DESCONECTADO"
            enviar_alerta(
                f"🚨 {NOMBRE_SITIO}: SIN DATOS 🚨\n"
                f"No llegan mensajes MQTT hace {minutos_sin_datos:.0f} min.\n"
                f"Topic: {TOPIC}\n"
                f"Broker: {estado_mqtt}"
            )
        elif minutos_sin_datos < UMBRAL_SIN_DATOS_MINUTOS and self.sin_datos:
            self.sin_datos = False
            enviar_alerta(f"✅ {NOMBRE_SITIO}: se reanudó la recepción de datos MQTT.")

        if bd.falla_desde is not None:
            minutos_falla = (ahora - bd.falla_desde) / 60
            if minutos_falla >= UMBRAL_FALLA_BD_MINUTOS and not self.bd_caida:
                self.bd_caida = True
                enviar_alerta(
                    f"🚨 {NOMBRE_SITIO}: FALLA AL GUARDAR EN BD 🚨\n"
                    f"No se puede insertar en {TABLE_NAME} hace {minutos_falla:.0f} min.\n"
                    f"Filas pendientes en memoria: {len(buffer)}"
                )
        elif self.bd_caida:
            self.bd_caida = False
            enviar_alerta(f"✅ {NOMBRE_SITIO}: se recuperó la inserción en {TABLE_NAME}.")


# ================== MQTT ==================

def a_texto(valor):
    if isinstance(valor, (dict, list)):
        return json.dumps(valor, ensure_ascii=False)
    return str(valor)


def procesar_payload(payload_bytes):
    """Convierte un mensaje en filas (mt_name, mt_value). Devuelve None si se descarta."""
    try:
        data = json.loads(payload_bytes.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        with stats.lock:
            stats.invalidos += 1
        logger.warning(f"Payload no es JSON válido, se omite: {payload_bytes[:200]!r}")
        return None

    if not isinstance(data, dict):
        with stats.lock:
            stats.invalidos += 1
        logger.warning(f"Payload JSON no es un objeto, se omite: {str(data)[:200]}")
        return None

    terminal_time = data.get("_terminalTime")
    with stats.lock:
        if DESCARTAR_DUPLICADOS and terminal_time and terminal_time == stats.ultimo_terminal_time:
            stats.duplicados += 1
            return None
        if terminal_time:
            stats.ultimo_terminal_time = terminal_time

    filas = []
    for clave, valor in data.items():
        if clave.startswith("_") or clave in CLAVES_EXCLUIDAS or valor is None:
            continue
        filas.append((clave, a_texto(valor)))
    return filas


def on_connect(client, userdata, flags, rc, properties=None):
    # Firma válida para paho-mqtt 1.x y 2.x (en 2.x rc es un ReasonCode comparable con int)
    if rc == 0:
        stats.mqtt_conectado = True
        logger.info(f"Conectado al broker MQTT {MQTT_HOST}:{MQTT_PORT}")
        client.subscribe(TOPIC, qos=MQTT_QOS)
        logger.info(f"Suscrito a '{TOPIC}' (QoS {MQTT_QOS})")
    else:
        stats.mqtt_conectado = False
        logger.error(f"El broker rechazó la conexión: {rc}")


def on_disconnect(client, userdata, *args):
    # paho 1.x: (rc[, properties]) / paho 2.x: (flags, rc, properties)
    rc = args[1] if len(args) >= 3 else args[0]
    stats.mqtt_conectado = False
    if rc != 0:
        logger.warning(f"Desconexión inesperada del broker ({rc}). Reintentando automáticamente...")


def on_message(client, userdata, msg):
    try:
        if msg.retain and IGNORAR_RETENIDOS:
            logger.info("Mensaje retenido (lectura anterior) ignorado")
            return
        filas = procesar_payload(msg.payload)
        if filas is None:
            return
        with stats.lock:
            stats.mensajes += 1
            stats.ultimo_mensaje = time.time()
        if filas:
            buffer.agregar(filas)
        else:
            logger.warning(f"Mensaje sin variables útiles: {msg.payload[:200]!r}")
    except Exception as e:
        logger.exception(f"Error procesando mensaje: {e}")


def crear_cliente_mqtt():
    if hasattr(mqtt, "CallbackAPIVersion"):  # paho-mqtt >= 2.0
        client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=MQTT_CLIENT_ID, clean_session=True)
    else:
        client = mqtt.Client(client_id=MQTT_CLIENT_ID, clean_session=True)
    if MQTT_USER:
        client.username_pw_set(MQTT_USER, MQTT_PASS)
    client.on_connect = on_connect
    client.on_disconnect = on_disconnect
    client.on_message = on_message
    client.reconnect_delay_set(min_delay=1, max_delay=60)
    return client


# ================== CICLO PRINCIPAL ==================

def vaciar_buffer(bd, sin_bd):
    """Inserta todo lo que haya en el buffer, por lotes. Devuelve False si la BD falló."""
    while len(buffer):
        lote = buffer.tomar(LOTE_MAX)
        if sin_bd:
            for nombre, valor in lote:
                logger.info(f"[SIN BD] {nombre} = {valor}")
            continue
        try:
            bd.insertar(lote)
        except Exception as e:
            buffer.devolver(lote)
            if bd.falla_desde is None:
                bd.falla_desde = time.time()
            logger.error(f"Error al insertar en {TABLE_NAME} ({len(buffer)} filas pendientes): {e}")
            return False
        if bd.falla_desde is not None:
            minutos = (time.time() - bd.falla_desde) / 60
            logger.info(f"BD recuperada tras {minutos:.1f} min con errores")
            bd.falla_desde = None
        with stats.lock:
            stats.filas_insertadas += len(lote)
        logger.debug(f"{len(lote)} filas insertadas")
    return True


def manejar_senal(signum, frame):
    logger.info(f"Señal {signum} recibida, deteniendo...")
    detener.set()


def main():
    parser = argparse.ArgumentParser(description="Proveedor MQTT -> PostgreSQL para SSR Tambo")
    parser.add_argument("--sin-bd", action="store_true", help="no inserta: imprime las filas recibidas")
    parser.add_argument("--probar-bd", action="store_true", help="prueba la conexión y la tabla, y termina")
    args = parser.parse_args()

    configurar_logging()
    try:
        version_paho = importlib.metadata.version("paho-mqtt")
    except importlib.metadata.PackageNotFoundError:
        version_paho = "?"
    logger.info(f"providerTambo v{VERSION} iniciando (paho-mqtt {version_paho})")

    faltantes = [n for n, v in (("DB_HOST", DB_HOST), ("DB_USER", DB_USER), ("DB_PASS", DB_PASS),
                                ("DB_NAME", DB_NAME)) if not v]
    if faltantes and not args.sin_bd:
        logger.error(f"Faltan variables en {ENV_PATH}: {', '.join(faltantes)}")
        sys.exit(1)

    bd = BaseDatos()

    if args.probar_bd:
        try:
            columnas = bd.probar()
        except Exception as e:
            logger.error(f"No se pudo conectar a la BD: {e}")
            sys.exit(1)
        finally:
            bd.cerrar()
        if not columnas:
            logger.error(f"Conexión OK, pero la tabla {TABLE_NAME} no existe o no es visible para {DB_USER}")
            sys.exit(1)
        logger.info(f"Conexión OK. Columnas de {TABLE_NAME}:")
        for nombre, tipo, defecto, nulo in columnas:
            logger.info(f"  {nombre:<12} {tipo:<28} default={defecto} nullable={nulo}")
        sys.exit(0)

    signal.signal(signal.SIGINT, manejar_senal)
    signal.signal(signal.SIGTERM, manejar_senal)
    if hasattr(signal, "SIGBREAK"):  # Windows: Ctrl+Break / cierre de consola
        signal.signal(signal.SIGBREAK, manejar_senal)

    if not args.sin_bd:
        cargar_pendientes()

    client = crear_cliente_mqtt()
    # connect_async + loop_start: si el broker no está disponible, el hilo de paho reintenta solo
    client.connect_async(MQTT_HOST, MQTT_PORT, keepalive=60)
    client.loop_start()
    logger.info(f"Esperando datos en '{TOPIC}'...")

    alertas = Alertas(time.time())
    ultimo_resumen = time.time()
    espera = FLUSH_SEGUNDOS

    try:
        while not detener.wait(espera):
            try:
                ok = vaciar_buffer(bd, args.sin_bd)
                # Si la BD falla, espera más entre reintentos (hasta 60 s)
                espera = FLUSH_SEGUNDOS if ok else min(max(espera * 2, 5), 60)

                alertas.revisar(bd)

                if time.time() - ultimo_resumen >= RESUMEN_MINUTOS * 60:
                    ultimo_resumen = time.time()
                    mqtt_estado = "conectado" if stats.mqtt_conectado else "desconectado"
                    logger.info(f"Resumen {RESUMEN_MINUTOS:g} min: {stats.resumen_y_reiniciar()} "
                                f"pendientes={len(buffer)} mqtt={mqtt_estado}")
            except Exception as e:
                # Nada debe matar el ciclo principal
                logger.exception(f"Error inesperado en el ciclo principal: {e}")
    finally:
        logger.info("Cerrando conexión MQTT...")
        client.disconnect()
        client.loop_stop()
        if len(buffer) and not args.sin_bd:
            logger.info(f"Insertando {len(buffer)} filas antes de salir...")
            vaciar_buffer(bd, args.sin_bd)
            guardar_pendientes(buffer.todas())
        bd.cerrar()
        logger.info("Servicio detenido.")


if __name__ == "__main__":
    main()
