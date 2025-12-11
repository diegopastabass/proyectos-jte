import time
import paho.mqtt.client as mqtt

BROKER_IP = "52.207.191.146" 
PORT = 1883
TOPIC = "sensor/datos"

client = mqtt.Client(transport="tcp")

print(f"Conectando a {BROKER_IP} por puerto {PORT}...")
client.connect(BROKER_IP, PORT, 60)
client.loop_start()

contador = 1
try:
    while True:
        mensaje = str(contador)
        client.publish(TOPIC, mensaje)
        print(f"Mensaje publicado por TCP: {mensaje}")
        
        contador += 1
        time.sleep(1)

except KeyboardInterrupt:
    print("\nDesconectando...")
    client.loop_stop()
    client.disconnect()
