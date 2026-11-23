# Plan de migración: Inventia MT Data Provider fuera de Windows

Fecha: 2026-11-18 · Estado: propuesta para discusión

## 1. Qué es el software

La carpeta `INVENTIA/MTopc2` es **MT Data Provider (MTDP) v3.3.8** de Inventia (Polonia), instalado como servicio de Windows `MT_OPC` en una instancia EC2 de AWS. Es un *driver* de comunicaciones gratuito que recibe datos de los módulos de telemetría MT (MT-101, MT-151) y los publica por OPC DA/UA, CSV o ODBC.

| Archivo | Qué es |
|---|---|
| `mt_opc.exe` | El servidor (C++/MFC, 32 bits). Escucha UDP 7110, decodifica, escribe por ODBC. Trae embebido un servidor OPC UA |
| `mtlib5.dll` | Librería de protocolo de Inventia (83 KB): armado/decodificación de tramas Modbus, confirmaciones, configuración remota y firmware |
| `config_mtdp.dll` + `sqlite3.dll` | Cola de configuración remota de módulos (SQLite local) |
| `NDIServerU.dll`, `NDIErrors.dll` | Toolkit OPC DA (COM/DCOM) de 2002 |
| `virtual_mt_3.exe` | **Simulador de un módulo MT** por UDP. Muy útil para pruebas |
| `syncmtime.exe`, `winsynctime.exe` | Sincronización de hora de los módulos |
| `sample.xml` | **La configuración real en producción** (35 equipos) |
| `mt_aliases` | Traducción de registros a nombres (`REGF832` → `caudal`) |
| `cloudmtdp.sql` | Los mismos 35 equipos en otro esquema (`devices`, `objects`, `data_blocks`, `tags_formats`). Parece un export para otra versión de MTDP |
| `mt_opc.log`, `odbc_lost.log` | Logs (ver §3) |

### Cómo lo usamos hoy (según `sample.xml`)

- `net_mode="dynamic"`: los equipos tienen IP dinámica detrás del NAT del operador (casi todos salen por `190.196.222.101` con puertos distintos). **El servidor no puede iniciar la conexión: los equipos empujan los datos** y MTDP aprende su IP:puerto en cada mensaje (`mt_devices.log`).
- Todos los bloques Modbus tienen `interval="0"`: **no hay polling, solo mensajes espontáneos** (por evento o por el logger del equipo).
- Las "IPs" `151.22.40.66` de `ip_header_receiver` **son los números de serie** de los módulos, escritos en bytes little-endian (`151.22.40.66` ⇔ `1109923479`, que es el `serial_number` en `cloudmtdp.sql`).
- Salida: **solo ODBC → PostgreSQL en AWS RDS** (`csv_log="false"`, sin clientes OPC conocidos). Cada equipo escribe en su propia tabla: `insert into SSR_RANGUIL (mt_name, mt_value, mt_time, mt_quality)`, con `mt_name = <EQUIPO>--slave.<alias>` y `mt_value` como texto.
- Formatos usados: `int2`, `long4`, `float4`, `bool` (bits de un registro: `AIB17:1`), con `dreg_order` `hi_lo`/`lo_hi` por bloque.
- Escritura hacia equipos habilitada (`odbc_write="1"`, `update="true"`): MTDP revisa la tabla `mt_write` cada segundo. **Hay que confirmar si alguien la usa** (ver §6).

```
 MT-101 / MT-151 ──GPRS──► NAT operador ──UDP 7110──► EC2 Windows (IP elástica)
                                                        mt_opc.exe ──ODBC──► RDS PostgreSQL ──► APIs NestJS / dashboards
```

Lo único que nos amarra a Windows es este proceso. Las APIs (pm2), nginx y los servicios Python ya son portables.

## 2. Pistas sobre el protocolo

No hay especificación pública ni implementación libre del protocolo (busqué; Inventia solo distribuye MTDP y MTManager para Windows desde su portal de clientes). Pero los binarios dejan ver bastante:

- Transporte UDP, puerto 7110. Cabecera con IP/serie de receptor y emisor (`hdr_ip`), id de trama, tipo, dirección y tamaño Modbus, y CRC opcional (`add_crc`).
- Las **confirmaciones (ACK) miden 16 bytes** en ambos sentidos (`TX confirmation (16 bytes)`, `RX confirmation (16 bytes)`).
- `mtlib5.dll` exporta funciones con nombres legibles (`modbus_build`, `modbus_decode`, `mt_confirm`, `msg_read`, `cfg_*`, `firm_*`), lo que facilita mucho desensamblarla con Ghidra.
- `virtual_mt_3.exe` genera tramas de un equipo falso: con él podemos producir ejemplos controlados.
- MTDP tiene `debug="true"`, que registra cada trama en hexadecimal.

Con capturas de tráfico real + el modo debug + el simulador, reconstruir la parte que usamos (recepción espontánea + ACK) es un trabajo acotado.

## 3. Hallazgos colaterales (problemas actuales)

1. **Se están perdiendo datos de Zagal parcela 57.** `odbc_lost.log` pesa **510 MB**: son inserts que fallaron. 230 mil son a `PARC_57_ZAGAL`, sin parar desde el **2025-10-20** hasta hoy. Probablemente un trigger de riego (`Zagal/sql/002_triggers_riego.sql`) o un cambio de esquema rechaza el insert. `mt_opc.log` registra ~850 `Insert error` diarios.
2. **126 mil inserts a `mt_logger` fallan**: esa tabla no existe. Llegan de equipos que **no están en `sample.xml`** (sobre todo `151.21.17.58`, `151.25.49.38`, `151.26.12.113`, más los registros del logger de equipos sí configurados). O hay equipos instalados sin dar de alta, o son equipos ajenos apuntando a nuestra IP.
3. **Credenciales en texto plano** en `sample.xml` (usuario y clave de la base). La carpeta está sin trackear en git: antes de commitear hay que agregar un `.gitignore` que excluya `sample.xml`, `*.log` y `mtlib.lic`.
4. **Hardware al final de su vida.** MT-101 y MT-151 LED son GSM/GPRS (2G). Entel apaga 2G por regiones desde 2024 e Inventia retira las versiones MT-151 con PLC desde marzo de 2026. Hay que saber con qué operador y red reporta cada equipo.
5. Cinco equipos registran `44.223.64.208` como IP de cabecera; el resto, `52.207.191.146`. Hay que revisar cuál es la IP elástica vigente y si esos cinco apuntan a una IP antigua.

## 4. Evaluación de las tres opciones

### Opción 3: ejecutar el MTDP oficial en Linux (Wine)

**Viabilidad: alta para lo que usamos.** Es una aplicación Win32 de 32 bits que usa sockets UDP, ODBC y una ventana MFC. No usamos OPC DA (la parte COM/DCOM que peor anda en Wine).

- Wine trae su propio `odbc32.dll`, que **pasa las llamadas a unixODBC** de Linux. El DSN `telemetria_new` se define en `/etc/odbc.ini` con el driver `psqlODBC`. Es el punto que hay que validar primero.
- Se ejecuta en primer plano (`wine mt_opc.exe /show sample.xml`) bajo `Xvfb` o `xvfb-run`, empaquetado en Docker (prefijo Wine 32 bits + Visual C++ 2015-2022 x86) y supervisado por systemd o Docker con `restart: always`. Así no hace falta el modo servicio de Windows.
- Riesgos: Inventia no lo soporta; pueden aparecer fallos raros (hilos, zona horaria, sockets); seguimos atados a una caja negra con los bugs de §3; imagen Docker de ~1 GB.
- Esfuerzo: **2 a 4 días** para una prueba de concepto con el simulador; 1 a 2 semanas para dejarlo en producción con monitoreo.

**Plan B si Wine falla:** dejar solo MTDP en una instancia Windows mínima y llevar todo lo demás (APIs, nginx, Python) a Linux. Ya eso baja buena parte del costo y del dolor de despliegue.

### Opción 2: alternativa de software libre

**No existe una alternativa libre para el protocolo de Inventia.** No encontré implementaciones públicas. Lo que sí hay:

- **DataPortal** de Inventia: SCADA en la nube, comercial. Elimina nuestro servidor pero agrega una suscripción, deja los datos en Inventia y obliga a sacarlos por API. No encaja con nuestro stack propio.
- **Cambiar a protocolos abiertos a medida que se reemplace hardware** (MQTT o Modbus TCP con equipos 4G, por ejemplo Teltonika + PLC, o modelos Inventia nuevos si soportan MQTT). Con eso basta software libre estándar (Mosquitto, Node-RED, Telegraf) o un servicio propio. Es la salida de fondo y calza con el apagado de 2G, pero cuesta hardware y visitas a terreno. Sirve como hoja de ruta, no como solución de corto plazo.

### Opción 1: versión propia desde cero

**Viabilidad: alta si reimplementamos solo lo que usamos.** No hay que copiar MTDP completo (OPC, CSV, firmware, configuración remota). El alcance mínimo es:

1. Escuchar UDP 7110 y aprender `serie → IP:puerto`.
2. Decodificar mensajes espontáneos (normales y del logger) de MT-101/MT-151.
3. Responder el ACK de 16 bytes (si no, el equipo reintenta y duplica).
4. Convertir registros según la configuración (formatos, `dreg_order`, bits, alias).
5. Insertar en PostgreSQL con **el mismo esquema que hoy** (`mt_name`, `mt_value`, `mt_time`, `mt_quality`), para no tocar ninguna API ni dashboard.
6. Opcional, según §6: escritura hacia equipos (`mt_write`) y sincronización de hora.

Implementación sugerida: **Python** (`asyncio` + `asyncpg`), como los servicios que ya mantenemos, o NestJS para alinearse con las APIs. Son unas 1.500 a 2.500 líneas. La configuración pasa de `sample.xml` a una tabla o YAML, con un script que convierte el XML actual.

Ventajas: código nuestro, multiplataforma; arreglamos de raíz los bugs de §3; métricas y alertas propias (equipo sin reportar, tramas rechazadas); alta de equipos nuevos sin editar XML a mano; base para el monitor de desconexión.

Riesgos: ingeniería inversa (ver §5); detalles del protocolo que solo aparecen en casos raros (equipos con contraseña, cifrado `secure`, firmwares viejos); el ACK tiene que ser exacto.

Esfuerzo: **3 a 6 semanas** hasta producción, incluido un período en paralelo.

### Comparación

| Criterio | 3. Wine | 2. Software libre / hardware nuevo | 1. Desarrollo propio |
|---|---|---|---|
| Tiempo hasta salir de Windows | Días | Meses o años | Semanas |
| Riesgo técnico | Medio (prueba barata) | Bajo técnico, alto en costo y logística | Medio (ingeniería inversa) |
| Dependencia de Inventia | Se mantiene | Desaparece | Desaparece en el servidor |
| Corrige los bugs actuales | No | Sí | Sí |
| Costo | Muy bajo | Hardware + terreno | Horas de desarrollo |
| Toca equipos en terreno | No | Sí | No |

## 5. Recomendación: combinar 3 y 1, con 2 como hoja de ruta

Usar Wine como **puente** para salir de Windows pronto y, en paralelo, construir el receptor propio y validarlo contra MTDP antes del corte. Ninguno de los dos caminos obliga a tocar los equipos: **siguen enviando a la misma IP elástica**, que en AWS se puede reasignar de la instancia Windows a la Linux.

### Fase 0: diagnóstico y preparación (1 semana)
- [ ] Corregir la pérdida de datos de `PARC_57_ZAGAL` y decidir qué hacer con `mt_logger` y los equipos no configurados (§3).
- [ ] Agregar `.gitignore` y sacar las credenciales del repo.
- [ ] Capturar tráfico UDP 7110 en el Windows actual durante varios días (`pktmon` o Wireshark/`tshark`) e, idealmente, activar `debug="true"` en una copia o por ventanas cortas.
- [ ] Inventario: firmware y operador de cada equipo, uso real de `mt_write`, de OPC y de MTManager remoto.
- [ ] Confirmar la IP elástica vigente (§3.5).

### Fase 1: prueba de concepto con Wine (en paralelo, 2 a 4 días)
- [ ] Contenedor Docker con Wine 32 bits, VC++ x86, unixODBC y psqlODBC.
- [ ] Probar `mt_opc.exe` contra `virtual_mt_3.exe` y una base PostgreSQL local.
- [ ] Probar con tráfico real: reenviar las capturas o poner un relay UDP delante.
- [ ] Si funciona, migrar todo el servidor a Linux con MTDP en Wine. Si no, aplicar el Plan B.

### Fase 2: receptor propio (3 a 6 semanas)
- [ ] Documentar el protocolo (`PROTOCOLO.md`) a partir de capturas, logs debug, simulador y Ghidra sobre `mtlib5.dll`.
- [ ] Decodificador con pruebas unitarias basadas en tramas reales capturadas.
- [ ] Servicio UDP + ACK + escritura en PostgreSQL con el esquema actual.
- [ ] **Modo sombra**: un relay UDP en Linux reenvía cada paquete al MTDP (que sigue respondiendo los ACK) y entrega una copia al servicio nuevo, que escribe en tablas `_shadow`. Comparar fila a fila durante 2 a 4 semanas.
- [ ] Corte: el servicio nuevo pasa a responder los ACK y a escribir en las tablas reales. MTDP queda apagado pero disponible para volver atrás.

### Fase 3: hoja de ruta de hardware (largo plazo)
- [ ] Plan de recambio de equipos 2G según el calendario de apagado del operador.
- [ ] Equipos nuevos con MQTT o Modbus TCP, integrados en el mismo servicio como otra "entrada".

## 6. Preguntas abiertas

1. ¿Alguien escribe en `mt_write` o en las variables `.update`, es decir, comandos o cambios hacia los equipos desde dashboards o scripts? Si nadie lo hace, la Fase 2 se simplifica bastante.
2. ¿Se usa MTManager de forma remota a través de este servidor para configurar equipos o actualizar firmware?
3. ¿Hay algún cliente OPC (SCADA de terceros) conectado al servidor?
4. ¿Qué operador y red usan los equipos? ¿Hay equipos MT nuevos (LTE) en compra?
5. ¿Los equipos `151.21.17.58`, `151.25.49.38` y `151.26.12.113` son nuestros?
6. ¿Hay restricciones legales o contractuales con Inventia sobre ingeniería inversa? En general se permite para interoperabilidad, pero conviene confirmarlo internamente.
