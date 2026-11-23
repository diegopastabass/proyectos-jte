# Protocolo MT de Inventia (UDP 7110)

Reconstruido el 2026-11-19 con REA + Ghidra 12.2 a partir de `mt_opc.exe` 3.3.8, `virtual_mt_3.exe` y `mtlib5.dll`. El pseudocódigo está en `re-work/` (excluido de git).

Cada afirmación lleva su nivel de evidencia:

- **[E] Ejecutado.** Se probó enviando tramas a `virtual_mt_3.exe` bajo Wine. El script es `tools/mtproto_probe.py`.
- **[D] Decompilado.** Se leyó en el pseudocódigo de Ghidra con una sola interpretación razonable.
- **[I] Inferido.** Es probable, pero hay que confirmarlo con capturas reales.

## 1. Transporte

- UDP; el servidor escucha en el puerto 7110 (`udp_port`). [D]
- Un datagrama es una trama, de hasta 1.500 bytes (`recvfrom` con buffer de 0x5DC). [D]
- Las tramas de menos de 16 bytes se descartan. [D]

## 2. Cabecera (16 bytes)

| Offset | Tamaño | Campo | Notas |
|---|---|---|---|
| 0 | 4 | receptor | Dirección del destinatario: IP o número de serie [E] |
| 4 | 4 | emisor | En las tramas del equipo es **su número de serie**: `151.22.40.66` ⇔ `1109923479` como uint32 LE [E] |
| 8 | 2 | id de trama | Big-endian. Cada lado lleva su propio contador [E] |
| 10 | 1 | modo A | Se repite en la respuesta [E] |
| 11 | 1 | modo B | `0` = Modbus con id de esclavo en el byte 16 [E]. `1` = sin id de esclavo y sin confirmación [D] |
| 12 | 2 | largo | Bytes después de la cabecera (contenido + CRC Modbus), big-endian. `0` en las confirmaciones [E] |
| 14 | 2 | CRC cabecera | CRC16/Modbus de los bytes 0–13, con **valor inicial = id de trama** (no 0xFFFF). Se guarda big-endian [E] |

Los bytes 10–11 leídos como uint16 BE (`modo`) toman estos valores en `mt_opc`: `0` (Modbus), `8` (Modbus cifrado, opción `secure` con llave USB; no lo usamos), `0xFF` (texto o login proxy en modo `dynamic_by_ip`) y `1` (sin confirmación). [D]

```python
def crc16_modbus(data, init=0xFFFF):        # polinomio 0xA001 (reflejado)
    crc = init
    for b in data:
        crc ^= b
        for _ in range(8):
            crc = (crc >> 1) ^ 0xA001 if crc & 1 else crc >> 1
    return crc

hdr_crc = crc16_modbus(hdr[0:14], init=frame_id)   # hdr[14:16] = hdr_crc.to_bytes(2, "big")
```

## 3. Confirmación (ACK)

Mide 16 bytes y es solo cabecera. Se arma a partir de la trama recibida: [E]

- receptor = emisor recibido; emisor = receptor recibido. `mt_opc` pone 0 en el modo `ruter`. [D]
- Mismo id de trama, mismos bytes 10–11, largo `0` y CRC de cabecera recalculado.
- `mt_opc` confirma toda trama válida que no sea de modo 1, **también los duplicados**, que se confirman pero no se guardan. [D]
- `mt_opc` confirma después de procesar la trama, pero **con `odbc_error="ignore_all"` (el valor por defecto) confirma aunque el insert en la base falle**. Así se pierden datos: `odbc_lost.log`. [D]
- Una trama de 16 bytes recibida por el servidor es la confirmación de un pedido suyo. [D]

## 4. Contenido: Modbus RTU

Desde el byte 16 viene una trama Modbus RTU normal: `esclavo(1) función(1) datos(n) CRC16(2, little-endian, init 0xFFFF)`. [E]

- El CRC Modbus final solo existe si `add_crc="true"` (firmware 1.31 o superior; en nuestra configuración siempre lo está). [D]
- Con modo B = 1 no hay byte de esclavo y la función queda en el byte 16. [D]

`mt_opc` clasifica la trama según el código de función (`FUN_0041ebb0`): [D]

| Función | Significado |
|---|---|
| 1, 2, 3, 4 | Respuesta a una lectura del servidor |
| 5, 6, 0x10 (y 0x50 si largo = 20) | Respuesta a una escritura del servidor |
| **cualquier otra** | **Mensaje espontáneo del equipo** (lo que usamos en producción) |

### Ejemplo real (ida y vuelta con el simulador oficial) [E]

```
TX servidor→equipo  97 16 28 42 7f 00 00 01 12 34 00 00 00 08 95 02 | 01 03 00 64 00 04 05 d6
RX ACK              7f 00 00 01 97 16 28 42 12 34 00 00 00 00 ae f4
RX datos            7f 00 00 01 97 16 28 42 41 e0 00 00 00 0d 5d 18 | 01 03 08 00 64 00 65 00 66 00 67 5d ec
```

Es una lectura de 4 registros desde la dirección 100 del esclavo 1. Las respuestas traen `100, 101, 102, 103` (`data_mode=1` del simulador).

## 5. Mensajes espontáneos (funciones propias de Inventia)

El despacho está en `FUN_00426840`. El byte 17 trae la función y los bytes 18–19 la subfunción. [D]

| Byte 17 | 18 | 19 | Tipo | Decodificador |
|---|---|---|---|---|
| `'z'` 0x7A | 0 | 0 | **Evento con registros actuales** (`msg`) | `FUN_00422230` |
| `'z'` | otro | | Logger | `FUN_0041ef70` |
| `'y'` 0x79 | 0 | 0 | Logger con período fijo (`log`); tipo 5 → `FUN_004201c0` | `FUN_00420b70` |
| `'y'` | 0 | 2 | Evento (`msg`) | `FUN_00425840` |
| `'C'` 0x43 | | | Evento (`msg`) | `FUN_004249e0` |
| `'P'` 0x50 | | | Por determinar | `FUN_0041e940` |
| 0xF1 0x11 en bytes 16–17, trama de 18 bytes | | | Trama especial: no se valida CRC Modbus ni se guarda (¿*keepalive* o notificación del spooler?) | `FUN_0041c830` |

### 5.1 Evento `'z'` (el más probable en nuestros MT-101) [D]

```
16      esclavo (≠0 → el tag usa el nombre del esclavo: "SSR_RANGUIL--slave")
17      'z'
18-19   00 00
20      N-1 (cantidad de bloques menos uno)
21..    N descriptores de 5 bytes:
          [0]   espacio: 0 → analog_inputs ("AI"), ≠0 → registers ("REG")
          [1-2] dirección inicial (BE)
          [3-4] cantidad de registros MENOS UNO (BE): el bloque trae cantidad+1 registros
+0      timestamp empaquetado de 6 bytes (§5.3)
+6      valores: 2 bytes BE por registro, en el orden de los bloques
fin     CRC16 Modbus (LE)
```

- La decodificación para base y OPC está en `FUN_00422d60`: recorre `dirección..=dirección+campo` y avanza `(campo+1)*2` bytes por bloque. [D]
- Solo se publican los registros que existen en la configuración del equipo (`FUN_0041ec70`); los demás se ignoran. [D]
- Cada registro produce un tag `<equipo>--<esclavo>.<AI|REG><dirección>`, por ejemplo `SSR_RANGUIL--slave.REG3000`. [D]
- Después se aplica el formato configurado en `sample.xml` (`int2`, `long4`, `float4`, `bool`, `signed`, `dreg_order`) y el alias de `mt_aliases`. [I]
- Sufijos de tag por formato en `mt_opc.exe`: `REG`/`AI` (int2), `L` (long4), `F` (float4), `B` (bool, `AIB17:1`) [D]. También `W` y `R`, que por cómo se agrupan serían long8 y float8 [I].
- Con `timestamp="data"` la hora sale de la trama; con `system`, del reloj del servidor. [D]

### 5.2 Logger `'y'` 0/0 [D]

```
22-26   fecha base: año-2000, mes, día, hora, minuto (1 byte cada uno; año-2000 < 38)
28      N-1
29..    N descriptores de 5 bytes: tipo (1/2 = binarios BI/BO, 3/4 = registros), dirección (BE), cantidad (BE)
+0      período (2 bytes, 14 bits útiles)
+2..    registros: contador de 4 bytes BE × período / 10 = segundos desde la fecha base (resto = décimas), seguidos de los valores
```

Va a la tabla `mt_logger`, o a `odbc_logger_table` si está definida. **Hay que confirmarlo con capturas** antes de implementarlo.

### 5.3 Timestamp empaquetado (6 bytes `b0..b5`) [D]

```
año      = (b4 >> 1) + 2000
mes      = ((b4 & 1) << 3 | b5 >> 5) + 1
día      = (b5 & 0x1F) + 1
hora     = b2 >> 3
minuto   = (b2 & 7) << 3 | b3 >> 5
segundo  = (b3 & 0x1F) * 2 + (b0 >> 7)
ms       = (((b0 & 0x7F) << 8 | b1) * 1000) >> 15
```

## 6. Estado por equipo que mantiene `mt_opc`

- **Dirección actual.** En modo `dynamic`, `serie → IP:puerto` se aprende de cada trama del equipo (`mt_devices.log`). Sin una trama previa no se le puede escribir. [D]
- **Último id de trama.** Se descarta como duplicado (`FRAME_ID ERROR`) si el id está dentro de los 8 anteriores, con manejo de vuelta del contador. Se desactiva con `ignore_frame_id`. [D]
- **Última hora de recepción** (variable `active`, para saber si el equipo está vivo). [D]
- **Equipos desconocidos.** Si el emisor no está en la configuración, sus tramas igual se decodifican con nombre `<ip>--<esclavo>` y se intentan guardar en `mt_logger`. Es la tabla que no existe y llena `odbc_lost.log`. [D]

## 7. Opciones de configuración no documentadas

Aparecen en las cadenas de `mt_opc.exe`:

- `net_mode`: `static`, `ruter`, `dynamic`, `static_real_ip`, `dynamic_by_ip`. Por el uso en el código, `dynamic` sería el valor interno 2. [I]
- `confirm_quickly`, `ignore_frame_id`, `internet_mode`, `host_ip`, `use_spooler`, `unsolicited_status`.

## 8. Fuera de alcance por ahora

- **Configuración remota y firmware.** Usan modo B ≠ 0 y contenido con `'q'` (consulta de serie, CID y fecha de configuración) o `'r'` (leer o escribir parámetros), más la cola SQLite de `config_mtdp.dll`. [D]
- **Cifrado `secure`.** Requiere la llave USB (`Dongle not found!`). No lo usamos.
- **OPC DA/UA y CSV.**

## 9. Pendiente de confirmar con tráfico real

1. Qué funciones envían de verdad nuestros equipos (`'z'`, `'y'` 0/2, `'C'`) y con qué bloques.
2. El formato exacto del logger y de la trama `F1 11`.
3. Si el receptor que ponen los equipos en modo dinámico es `255.255.255.255` (proxy por defecto según el manual) o la IP del servidor.
4. El formateo exacto de los valores que escribe `mt_opc` (`2.950618` → `%f`; enteros sin decimales; `mt_quality = '1'`) y su orden de inserción.

Método: capturar UDP 7110 en el servidor actual una o dos semanas y comparar cada trama decodificada contra la fila que insertó `mt_opc` (§ Fase 0 de `PLAN_MIGRACION_INVENTIA.md`).
