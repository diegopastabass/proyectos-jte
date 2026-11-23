# Diagnóstico de `odbc_lost.log` (MTDP)

Análisis del 2026-11-18 sobre la copia de `INVENTIA/MTopc2/odbc_lost.log` (510 MB, 362.395 statements) y `mt_opc.log`. No se ejecutó nada contra la base de producción.

| Tabla destino | Statements fallidos | Qué pasa |
|---|---:|---|
| `PARC_57_ZAGAL` | 230.067 | Un trigger rechaza el lote entero (ver abajo) |
| `mt_logger` | 126.511 | La tabla no existe |
| Resto (`SSR_IDAHUE`, `SSR_TRINIDAD`, `BUCALEMU_TEST`...) | ~5.800 | Fuera de alcance, ver "Pendientes" |

`mt_opc.log` solo dice `Insert error (execute)`, sin el mensaje de Postgres. La causa se dedujo del contenido de los inserts y se reprodujo en un Postgres local con el mismo esquema.

## 1. PARC_57_ZAGAL

### Causa

MTDP manda cada lectura como **un solo INSERT de varias filas**: sectores 1 a 9, bomba, falla, caudal, totalizador, frecuencia, presión y REG20xx. La tabla, las columnas y los tipos están bien: el insert usa las mismas columnas que la 18 y la 82, que sí funcionan, y `mt_time` es DATE pero acepta `'2026-11-18 18:19:44.683'`.

El problema es el trigger `verificar_salto_totalizador`. Cuando aborta, se pierde **todo el lote**, no solo la fila del totalizador:

- **230.064 de 230.067** statements fallidos traen la fila `PARC_57_ZAGAL--slave.totalizador`. Los otros 3 son reintentos del mismo lote del 2025-12-10 14:58, el día en que se cambió el trigger.
- Hay dos fases:

| Periodo | Fallos/día | Causa |
|---|---:|---|
| 2025-10-20 17:01 – 17:10 | 10 en total | Se creó el trigger. Fallan todos los lotes de esos 10 minutos (primera versión defectuosa) |
| 2025-10-20 → 2025-12-04 | ~10–70 | `RAISE EXCEPTION` ante lecturas erróneas del totalizador: **1.261 de 1.271** lotes traen un valor de ~1.110.000.000 o 0 (el real ronda 12–13 millones) |
| 2025-12-05 → 12-09 | 0 | Sin fallos (equipo sin datos o trigger desactivado) |
| desde 2025-12-10 ~14:45 | ~1.440 (uno por minuto) | La versión actual compara `NEW.mt_value` (varchar) `>= bigint`, lo que da `operator does not exist: character varying >= bigint` en **todos** los INSERT con totalizador, incluido el primero. Coincide con el último totalizador guardado, 2025-12-10 13:29 (consulta 1b de `002_triggers_riego.sql`) |

Reproducido en local: con esa versión, la última línea del log falla con ese mensaje. Con la corrección entra todo el lote, salvo la fila del totalizador, que traía una lectura errónea (1.111.394.227).

Consecuencia: desde el 2025-12-10 la 57 casi no guarda sectores, caudal ni totalizador, y `zagal_57_irrigation_log` (el mapa de calor) queda vacío.

### Corrección

`Zagal/api-zagal-pg/sql/003_fix_insert_parc57.sql`, PASO 1. Reemplaza al PASO 3 de `002`, que quedó marcado como obsoleto:

- Compara como `numeric` y descarta solo la fila mala (`RETURN NULL`), sin abortar el lote.
- El salto permitido crece con el tiempo transcurrido: 10.000 + 5.000 por hora. En el log el totalizador sube como máximo ~4.000/h (~38.000/día) y las lecturas erróneas saltan ~1.100 millones. Así se rechazan aunque el equipo haya estado meses sin datos (la versión de `002` las dejaba pasar después de 1 h sin datos).
- Descarta un 0 si la referencia es mayor que 0.
- `RAISE LOG` en vez de `WARNING`, para que el driver ODBC no le devuelva un aviso a MTDP.

El PASO 0 es solo lectura: muestra triggers, funciones, columnas y zona horaria, para confirmar todo antes de aplicar.

### Reinyección

1. `reinyeccion/extraer_odbc_lost.py`: lee el log línea a línea (20 s para 510 MB) y escribe un CSV con la hora original del equipo y `mt_time_2` corregida. Le aplica al totalizador el mismo filtro que el trigger. Con el log actual salen **5,58 M filas** (5,18 M únicas) y **3.962 lecturas erróneas** descartadas. Se comprobó que no descarta ninguna lectura válida.
2. `003`, PASO 3: tabla de staging + `\copy`, revisión, e INSERT con `session_replication_role = replica` para no disparar los triggers. Es idempotente: probado en local, al repetirlo inserta 0 filas.
3. `003`, PASO 3e: reconstruye `zagal_57_irrigation_log` desde los sectores reinyectados. Toma las corridas de '1', con corte si faltan datos más de `:corte` (2 h por defecto), y no toca riegos que ya existan. En local generó 858 riegos entre oct-2025 y nov-2026.

**Ojo con la hora.** `mt_time_2` es la hora de inserción (`DEFAULT now()`), no la del equipo, y el reloj del equipo no coincide con ella. Al cruzar `mt_opc.log` (hora del servidor, Chile) con `odbc_lost.log`, el equipo de la 57 adelanta **+3,82 h** respecto del servidor en nov-2026, o sea ~49 min respecto de UTC. Los otros equipos adelantan entre 3,1 y 4,6 h. Antes de generar el CSV:

- Ver la zona de la sesión (PASO 0d). Si es UTC, el `--offset` ronda **-49**. Si es America/Santiago, ronda **-229**.
- Confirmar con la consulta 0e, que calibra el desfase por mes con datos ya guardados. El reloj del equipo pudo moverse en el año: el milisegundo fijo de las muestras cambia varias veces (.183, .583, .983...), señal de resincronizaciones. Si hace falta, `--offset` acepta tramos: `"2025-10-01=-40,2026-06-01=-49"`.

## 2. mt_logger

MTDP escribe en `mt_logger` (nombre por defecto, `mt_name = "<IP>--1.<registro>"`) lo que llega de equipos **sin `<network>` en `sample.xml`**, o de equipos que todavía no se habían agregado. La tabla no existe, así que hoy son ~600 errores al día.

| IP | Lotes | Desde | Registros | Nota |
|---|---:|---|---|---|
| 151.21.17.58 | 83.022 | 2026-04-09 | AI17, AI18 cada minuto | Sin configurar |
| 151.25.49.38 | 26.643 | 2026-08-17 | AI23, REG826, REG827 | Mismo mapa que SSR_CUMPEO (configurado con .41) |
| 151.26.12.113 | 394 | 2026-11-17 | REG830-835, AI17, AI24 | Sin configurar, recién aparece |
| IPs ya configuradas | ~16.000 | — | — | Días previos a agregarlas: DOS_BALSAS 29-oct→2-nov, PLANTA2_IDAHUE feb-mar 2026, SSR_CUMPEO_6 jul-ago 2026... |
| 0.0.0.0 y 10.x | ~70 | — | — | Ruido. Hay relojes en 1902 y 2027 |

**Recomendación: crear la tabla** (`reinyeccion/mt_logger.sql`) con retención de 90 días, en vez de ignorar los errores:

- MTDP no tiene un parámetro para dejar de escribir los equipos desconocidos.
- Hoy esos errores entierran los importantes: el de la 57 pasó un año sin notarse.
- Quedan registrados los equipos nuevos antes de configurarlos.
- Volumen chico: ~3.000 filas al día.

Además, identificar las 3 IPs de la tabla y agregarlas a `sample.xml`.

## Orden sugerido

1. `003`, PASO 0 (lectura). Confirmar que la función actual es la defectuosa, ver si el trigger es BEFORE o AFTER y anotar la zona horaria.
2. `003`, PASO 1, y verificar con el PASO 2. Anotar la hora.
3. `mt_logger.sql`.
4. Calibrar el offset (0e), generar el CSV y correr el PASO 3. Revisar 3e antes del COMMIT.
5. Archivar o rotar `odbc_lost.log`, para que los fallos nuevos se vean.

## Pendientes (fuera de alcance)

- `SSR_IDAHUE`: 2.853 lotes entre 2026-02-08 y 2026-03-28. No hay `<network>` con ese nombre en el `sample.xml` actual (hoy son PLANTA1/PLANTA2_IDAHUE); probablemente la tabla no existía.
- `SSR_TRINIDAD`: 1.690 lotes entre el 2 y el 3 de septiembre de 2026.
- `SSR_BALSAS`: 39 lotes, el 2026-11-02.
- `BUCALEMU_TEST`: 670 lotes de 2011 (relojes de equipo erróneos).
- El cuerpo real de `update_zagal_57_interval` no está en el repo. El PASO 3e asume que el log de riego tiene `mt_name`, `start_time` y `end_time`; confirmarlo con el PASO 0c.
