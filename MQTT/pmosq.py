import time
import paho.mqtt.client as mqtt

PUBLIC_IP = "app.jteanalytics.cl"      
PORT = 443                             
TOPIC = "ssr_compania"
WS_PATH = "/mosquitto/"                

client = mqtt.Client(transport="websockets")

client.ws_set_options(path=WS_PATH)

client.tls_set(None)
client.tls_insecure_set(True)
client._ssl = False  

print(f"Conectando vía WS (sin SSL) a ws://{PUBLIC_IP}:{PORT}{WS_PATH} ...")
try:
    client.connect(PUBLIC_IP, PORT, 60)
except Exception as e:
    print("Error al conectar:", e)
    raise SystemExit

client.loop_start()

contador = 1
try:
    while True:
        mensaje = str(contador)
        resultado = client.publish(TOPIC, mensaje)

        if resultado.rc != mqtt.MQTT_ERR_SUCCESS:
            print(f"Error publicando mensaje {mensaje} (rc={resultado.rc})")
        else:
            print(f"Mensaje publicado: {mensaje}")

        contador += 1
        time.sleep(1)

except KeyboardInterrupt:
    print("\nDesconectando...")
finally:
    client.loop_stop()
    client.disconnect()

