# Homogeneización de servicios de monitoreo de estanques y desconexión

Fecha de análisis: 2026-10-26
> **Estado (2026-10-27):** implementado. Guía de deploy y estado de cada bug en [DEPLOY_MONITOREO.md](DEPLOY_MONITOREO.md). Guindo y Llaveria quedaron fuera porque necesitan una API nueva.

Alcance: scripts Python que vigilan nivel de estanques y/o conexión de equipos y envían alertas por UltraMsg (WhatsApp).

Objetivos pedidos:

1. Consultar la API (`https://app.jteanalytics.cl/<sitio>/...`) en vez de la base de datos.
2. Alerta de desconexión en todos.
3. Mismo formato de mensaje en todos.
4. Más precisión en el tiempo estimado de vaciado (más muestras para el cálculo).

---

## 1. Inventario

### 1.1 Servicios en alcance

| # | Archivo | Fuente actual | Estanques | Desconexión | Rebalse | Cálculo vaciado |
|---|---------|---------------|-----------|-------------|---------|-----------------|
| 1 | `Cuevas/tankService.py` | API `/cuevas/nivel?limit=2` | 1 | ✅ admin + aviso de recuperación | ❌ | 2 puntos |
| 2 | `Zuniga/tankService.py` | API `/zuniga/nivel?limit=2` | 1 | ⚠️ sin anti-spam | ❌ | 2 puntos |
| 3 | `Puquillay/tankService.py` | API `/puquillay/nivel?limit=2` | 1 | ❌ | ❌ | 2 puntos |
| 4 | `Manzano/tankService.py` | API `/manzano/nivel?limit=2` (÷100) | 1 | ❌ | ❌ | 2 puntos |
| 5 | `California/tankService.py` | API `/california/cerro`, `/california/metalico` | 2 | ❌ | ❌ | 2 puntos |
| 6 | `Compania/tankService.py` | API `/compania/nivel` (ventana de tiempo) | 1 | ❌ | ❌ | primer y último punto de la ventana |
| 7 | `Cumpeo/tankService.py` | API `/cumpeo/nivel?limit=2` | 1 | ❌ | ❌ | 2 puntos |
| 8 | `Hornillas/tankServiceHornillas.py` | API `/hornillas/nivel`, `/nivel2` | 2 | ❌ | ❌ | 2 puntos |
| 9 | `VillaCarmen/monitorEstanqueVillaCarmen.py` | API `/villacarmen/nivel?limit=2` | 1 | ✅ admin, repite cada 24 h | ❌ | 2 puntos |
| 10 | `Cocalan/monitorEstanqueCocalan.py` | API `/cocalan/nivel?limit=2` (÷100) | 1 | ✅ admin (pero ver bug B2) | ❌ | 2 puntos |
| 11 | `Auquinco/monitorEstanqueAuquinco.py` | API `/auquinco/nivel?limit=2` | 1 | ❌ | ❌ | 2 puntos (ver bug B1) |
| 12 | `Nerquihue/monitorEstanqueNerquihue.py` | API `/nerquihue/nivel?limit=2` | 1 | ❌ | ❌ | 2 puntos |
| 13 | `Boldos/monitorBoldos.py` | API `/boldos/nivel`, `/nivel2` `?limit=5` | 2 | ❌ | ❌ | **regresión lineal (5 puntos)** |
| 14 | `Ranguil/MonitoreoEstanqueRanguil.py` | **MySQL** `ssr_ranguil` | 2 | ❌ (está en el #22) | ❌ | 2 puntos |
| 15 | `Carmen/monitorEstanqueCarmen.py` | **PostgreSQL** `ssr_carmen_bajo` | 2 | ❌ | ✅ | 2 puntos |
| 16 | `Aromos/monitorAromos.py` | **PostgreSQL** `ssr_aromos` | 1 | ❌ | ❌ | 2 puntos |
| 17 | `Idahue/monitorEstanqueIdahue.py` | **PostgreSQL** `ssr_idahue` | 2 | ❌ | ✅ | 2 puntos |
| 18 | `Gonzalez/monitorEstanqueGonzalez.py` | **PostgreSQL** `ssr_gonzalez` | 2 | ❌ | ✅ | 2 puntos |
| 19 | `Guindo/monitorEstanqueGuindo.py` (= `Llaveria/monitorEstanqueGuindo.py`, copia idéntica) | **MySQL** `apr_guindo_alto` | 1 | ❌ | ✅ | 2 puntos |
| 20 | `Llaveria/monitorEstanqueLlaveria.py` | **MySQL** `apr_llaveria` | 2 | ✅ admin | ❌ | 2 puntos |
| 21 | `Marchigue/tankService.py` | **MySQL** `apr_marchigue` (credenciales en el código) | 1 | ❌ | ❌ | 2 puntos |
| 22 | `Bucalemu/tankServiceBucalemu.py` | **PostgreSQL** `ssr_bucalemu` (pool) | 4 | ✅ admin | ✅ | 2 puntos |

### 1.2 Servicios de solo desconexión

| # | Archivo | Fuente | Criterio | Destino |
|---|---------|--------|----------|---------|
| 23 | `Ranguil/ConnectionMonitorRanguil.py` | API `/ranguil/snapshot` | último dato del equipo > 30 min | **grupo cliente** (`TO`), repite cada 24 h |
| 24 | `Boldos/connectionMonitorBoldos.py` | API `/boldos/snapshot` | por sensor > **10 min** | grupo `TO` **escrito en el código** + intento de reiniciar servicio Windows |
| 25 | `Araucarias/connectionService.py` | API `/araucarias/snapshot` | último dato > 30 min, estado persistido en JSON | admin |
| 26 | `Olivar_Bajo/services/MonitoreoEstanqueOlivarBajo.py` | **PostgreSQL** `ssr_olivar_bajo_metrics` | sensor binario de comunicación (0/1) | grupo cliente |
| 27 | `Zuniga/healthCheckService.py` | — | latido 12:00 / 00:00 ("todo OK") | **grupo cliente** (`API_TO`) |

### 1.3 Fuera de alcance (revisados y descartados)

- `Viveros/services/*`: temperatura y humedad de invernadero, no estanques. Igual comparte patrones útiles (validación de `.env` al inicio, `RotatingFileHandler`, recarga en caliente).
- `*Reports.py`, `reporteMasivo.py`, `corregir_fechas.py`, `provider*.py`, `mqttProvider*.py`, `brokerAutomatizacion.py`, `MQTT/*`: reportes DGA, ingesta o pruebas.
- `Bucalemu/connectionMonitorBucalemu.py`: archivo vacío (0 bytes).
- `Bucalemu/tankServiceBucalemu copy.py`: versión vieja del #22 (ver la sección de seguridad).

---

## 2. La mejor versión de cada función (de dónde sacar cada pieza)

Ningún servicio hace todo bien. Cada pieza se toma del que mejor la resuelve:

| Función | Mejor implementación actual | Por qué |
|---------|-----------------------------|---------|
| Consulta a la API con reintentos y error tipado | `Cuevas/tankService.py` (`obtener_niveles`, `ApiError`) | Reintenta, usa un timeout de 20 s y separa "la API falló" de "no hay datos" |
| Alerta de falla de la API al admin (+ recuperación) | `Cuevas/tankService.py` (`estado_api`) | Avisa después de N ciclos fallidos y una sola vez; avisa cuando se recupera |
| Alerta de desconexión (+ recuperación) | `Cuevas/tankService.py` (`verificar_desconexion`) | Avisa una vez y otra al reconectar; mientras está desconectado no evalúa el nivel con datos viejos |
| Estado de desconexión por estanque | `VillaCarmen` / `Bucalemu` (dict o set por sensor) | Cuevas solo tiene un estado global, y los sitios con 2 o más estanques necesitan uno por estanque |
| Estado que sobrevive a reinicios | `Araucarias/connectionService.py` (`connection_state.json`) | Evita repetir la alerta cada vez que se reinicia el servicio |
| Formato de duración sin desborde a las 24 h | `Cuevas` / `California` / `Hornillas` (`divmod`) | `datetime.utcfromtimestamp(...).strftime("%H:%M:%S")` vuelve a 00 después de 24 h (bug B4) |
| Estimación de vaciado | `Boldos/monitorBoldos.py` (`calcular_tendencia`, regresión lineal) | Usa todas las muestras y clasifica la tendencia (Llenado/Vaciado/Estable) con una banda muerta |
| Muestreo por ventana de tiempo | `Compania/tankService.py` (`obtener_datos_historicos`) | Pide suficientes registros para cubrir X minutos y filtra por hora del lado del cliente |
| Varios estanques con umbral propio | `California` / `Hornillas` (`NIVEL_ALERTA_<X>`) | Umbral por estanque en `.env` |
| Recarga de `.env` en caliente | `Cuevas` / `California` / `Hornillas` (`load_dotenv(ENV_PATH, override=True)`) | Los demás dicen que recargan pero no lo hacen (bug B7) |
| Alerta de rebalse | `Bucalemu` / `Idahue` | Usa la condición "nivel > máximo **y** subiendo" |
| Logging | `Bucalemu` / `Viveros` (`RotatingFileHandler` + consola) | Los demás crecen sin límite en un `.txt` |
| Validación de variables al arrancar | `Viveros/services/monitorUnificado.py` | Si falta `API_TOKEN`, el servicio falla al iniciar y no en silencio |

---

## 3. Diseño del servicio homogéneo

### 3.1 Un solo archivo, configuración por sitio

En vez de 22 copias que se desalinean, conviene **un único `monitorEstanques.py` idéntico en todos los sitios**, donde todo lo específico del sitio vive en `.env` (y opcionalmente en un `estanques.json`). Así, una corrección se copia tal cual a todos los sitios.

`.env` estándar (mismos nombres en todos los sitios):

```ini
# UltraMsg
API_URL=https://api.ultramsg.com/instanceXXXX/messages/chat
API_TOKEN=...
API_TO=...              # grupo del cliente (alertas de nivel)
API_TO_ADMIN=...        # grupo admin (desconexión, falla de API)

# Sitio
SITIO=Cuevas            # aparece en TODOS los mensajes (el grupo admin recibe de ~20 sitios)
API_BASE=https://app.jteanalytics.cl/cuevas

# Tiempos (recargables en caliente)
INTERVALO_MINUTOS=1             # frecuencia de chequeo
REPETIR_ALERTA_MINUTOS=5        # cada cuánto repetir una alerta de nivel que sigue activa
VENTANA_VACIADO_MINUTOS=30      # ventana para estimar la tendencia
UMBRAL_DESCONEXION_MINUTOS=30
UMBRAL_FALLOS_API=5
```

Definición de estanques (en el código del sitio o en `estanques.json`):

```python
ESTANQUES = [
    {"id": "nuevo", "nombre": "Estanque Nuevo", "endpoint": "/nivel",  "divisor": 100,
     "nivel_alerta_env": "NIVEL_ALERTA_NUEVO", "nivel_rebalse_env": "NIVEL_REBALSE_NUEVO"},
    {"id": "viejo", "nombre": "Estanque Viejo", "endpoint": "/nivel2", "divisor": 1,
     "nivel_alerta_env": "NIVEL_ALERTA_VIEJO", "nivel_rebalse_env": None},
]
```

### 3.2 Flujo por ciclo y por estanque

1. `obtener_serie(endpoint)`: GET `API_BASE + endpoint?limit=N` con reintentos. **Siempre** ordena por `time` y se queda con lo más reciente, sin suponer que la API respeta `limit` ni el orden (bugs B1 y B2). Aplica `divisor`.
2. Si la API falla: contador por sitio, `⚠️ ALERTA API` al admin al llegar a `UMBRAL_FALLOS_API` y `✅` al recuperarse.
3. `verificar_desconexion(estanque, ultimo_time)`: estado por estanque, alerta una vez al admin y avisa al reconectar. Si está desconectado, **no** se evalúa el nivel.
4. `calcular_tendencia(serie_ventana)`: regresión lineal, ver 3.3.
5. Reglas de nivel:
   - `nivel < NIVEL_ALERTA` y tendencia ≠ Llenado → `🚨 ALERTA NIVEL CRÍTICO` (con tiempo de vaciado si la tendencia es Vaciado; si no, "N/A").
   - `nivel > NIVEL_REBALSE` y tendencia = Llenado → `⚠️ ALERTA POSIBLE REBALSE` (solo si el estanque tiene rebalse configurado).
6. Antirrepetición por estanque y tipo de alerta: reenvía solo si pasaron `REPETIR_ALERTA_MINUTOS` desde el último envío.
7. Estado (desconexión, último envío por alerta) persistido en `estado_monitor.json`.

### 3.3 Mayor precisión en el tiempo de vaciado

Hoy 20 de los 22 servicios estiman con **2 lecturas consecutivas**: el ruido del sensor (±1 cm) entre dos lecturas separadas por segundos o minutos produce tiempos absurdos, del orden de minutos o de cientos de horas. Propuesta:

- **Ventana por tiempo, no por cantidad de registros**: se toman las muestras de los últimos `VENTANA_VACIADO_MINUTOS` (30 por defecto). La frecuencia de muestreo cambia según el sitio (Compania ≈ 5 s), así que se pide un `limit` amplio (por ejemplo 500) y se filtra por hora del lado del cliente. Los parámetros `start`/`end` de las APIs no sirven para esto porque tienen granularidad de **día** (`${start}T00:00:00Z`).
- **Regresión lineal por mínimos cuadrados** sobre (t, nivel), igual que `Boldos/monitorBoldos.py`. La pendiente da la tasa de descenso en m/s.
- **Requisitos mínimos**: al menos `MIN_MUESTRAS` (por ejemplo 5) y una ventana de al menos `MIN_SPAN_MINUTOS` (por ejemplo 5). Si no se cumplen, se informa "N/A".
- **Banda muerta**: si |pendiente| < 1 mm/min el estanque se considera "Estable" (umbral de Boldos), lo que evita ETAs de 500 h por ruido.
- **Tiempo restante** = `nivel_actual / |pendiente|`, formateado con `divmod`. Si supera 24 h se muestra como `1 d 03:20:00` o como "más de 24 h".
- Opcional: un `NIVEL_MINIMO_UTIL` por estanque (la altura de succión de la bomba) para estimar el tiempo hasta el nivel útil en vez de hasta 0 m.

### 3.4 Formato único de mensajes

Todos los mensajes llevan el **sitio**. Hoy el grupo admin recibe "Estanque: Estanque Nuevo" desde 5 sitios distintos sin saber cuál es.

```
🚨 ALERTA NIVEL CRÍTICO 🚨
Sitio: Ranguil
Estanque: Estanque Nuevo
Nivel Actual: 1.42 m
Tendencia: Vaciado (-12.3 cm/h)
Tiempo Estimado de Vaciado: 11:32:00
```

```
⚠️ ALERTA POSIBLE REBALSE ⚠️
Sitio: Gonzalez
Estanque: Estanque Nuevo
Nivel Actual: 3.12 m
Tendencia: Llenado (+8.0 cm/h)
```

```
⚠️ ALERTA DESCONEXIÓN ⚠️
Sitio: Cocalan
Estanque: Estanque
El equipo no ha reportado datos recientes.
Tiempo sin conexión: 1 hora(s) y 12 minuto(s).
Último dato: 2026-10-26 14:05 (hora Chile)
```

```
✅ CONEXIÓN RESTABLECIDA ✅
Sitio: Cocalan
Estanque: Estanque
Tiempo desconectado: 1 hora(s) y 40 minuto(s).
```

```
⚠️ ALERTA API ⚠️
Sitio: Cuevas
La API de niveles falla desde hace 5 ciclos seguidos; no se puede verificar nivel ni conexión.
Último error: ...
```

Destinos: nivel crítico y rebalse → `API_TO` (cliente). Desconexión, API y recuperaciones → `API_TO_ADMIN`.

### 3.5 Decisiones pendientes (de negocio, no técnicas)

1. **¿Alertar con nivel bajo pero estable?** Hoy Manzano y Cumpeo alertan aunque el nivel no baje, mientras que los otros 20 solo alertan si baja. La propuesta (§3.2) alerta salvo que se esté llenando.
2. **Repetición**: hoy la alerta se repite cada `INTERVALO_MINUTOS` (5 min) mientras dure la condición, y en Compania y Bucalemu cada 30 min. Hay que definir un valor común.
3. **Repetir la alerta de desconexión**: hoy hay tres variantes (una vez, cada 24 h, cada ciclo). Propuesta: una vez + aviso de recuperación + recordatorio opcional cada 24 h.
4. **Umbral de desconexión**: 30 min en todos salvo Boldos (10 min).
5. **Latido diario** (`Zuniga/healthCheckService.py`): ¿integrarlo al servicio único y enviarlo **al admin** en vez de al grupo del cliente?
6. **Estanques no monitoreados que tienen endpoint**: `/cuevas/nivel2`, `/zuniga/nivel2` y `/cumpeo/nivel2` existen en la API, pero el script solo vigila `/nivel`. ¿Se agregan?

---

## 4. Cambios por servicio y funciones finales

Leyenda de funciones finales: **N** = nivel crítico + tiempo de vaciado (regresión), **R** = rebalse, **D** = desconexión + recuperación, **A** = alerta de falla de API, **M** = formato único.
Todos quedan con **N, D, A, M**; la columna "Final" indica los extras.

| # | Sitio | Cambios necesarios | Endpoint(s) API | Final |
|---|-------|-------------------|-----------------|-------|
| 1 | Cuevas | Es la base del nuevo servicio. Agregar sitio al mensaje, regresión, estado por estanque. El archivo **no está en git** (`?? Cuevas/tankService.py`). Decidir si se agrega `/nivel2`. | `/cuevas/nivel` (+`/nivel2`?) | N D A M |
| 2 | Zuniga | Antirrepetición en desconexión (hoy avisa **cada 5 min** mientras está desconectado), no evaluar nivel con datos viejos, `divmod`, `load_dotenv` con ruta, recarga real. Decidir `/nivel2`. | `/zuniga/nivel` (+`/nivel2`?) | N D A M |
| 3 | Puquillay | Agregar D y A. Corregir variables `TOKEN/TO` → `API_TOKEN/API_TO` (B5). Log `logs_ZUNIGA.txt` → `logs_PUQUILLAY.txt`. Nombre "Estanque Nuevo" → nombre real. | `/puquillay/nivel` | N D A M |
| 4 | Manzano | Agregar D y A. Mensaje sin línea de tiempo → formato único. Mantener ÷100. | `/manzano/nivel` (÷100) | N D A M |
| 5 | California | Agregar D y A. Unidad: el mensaje dice `%` y el log dice `m`, hay que verificar cuál entrega la API y unificar. | `/california/cerro`, `/california/metalico` | N D A M |
| 6 | Compania | Agregar D y A. Reemplazar "mínimo de la ventana" por la regla común. Intervalo fijo de 30 min → intervalo común. Usa `limit` amplio porque el muestreo es de unos 5 s. | `/compania/nivel` | N D A M |
| 7 | Cumpeo | Agregar D y A. Alerta sin tiempo → formato único. Decidir `/nivel2`. | `/cumpeo/nivel` (+`/nivel2`?) | N D A M |
| 8 | Hornillas | Agregar D y A. Ya tiene recarga y `divmod`. | `/hornillas/nivel`, `/nivel2` | N D A M |
| 9 | Villa Carmen | Agregar aviso de recuperación y A. Unificar el mensaje de desconexión ("ALERTA DE CONEXIÓN VILLA CARMEN" con "Sensor:"). | `/villacarmen/nivel` | N D A M |
| 10 | Cocalan | **Corregir el endpoint en la API (B2)** o pedir con ventana. Agregar recuperación y A. `utcnow()` → `now(timezone.utc)`. Verificar sensor (B3). | `/cocalan/nivel` (÷100) | N D A M |
| 11 | Auquinco | **Bug B1**: hoy evalúa datos de hace ~6 h. Corregir la API para respetar `limit` o tomar los últimos registros del lado del cliente. Variables `TOKEN/TO` (B5). Agregar D y A. | `/auquinco/nivel` | N D A M |
| 12 | Nerquihue | Agregar D y A. Verificar qué API está desplegada (B1). | `/nerquihue/nivel` | N D A M |
| 13 | Boldos | Ya tiene regresión; agregar D (absorbe #24) y A. `/nivel2` ya devuelve ÷100 desde la API. | `/boldos/nivel`, `/nivel2` | N D A M |
| 14 | Ranguil | **Migrar de MySQL a API**. Mantener ÷100 en el estanque nuevo. Absorber #23. Hoy un error de BD **mata el proceso** (sin try). | `/ranguil/nivel` (÷100), `/ranguil/nivel2` | N D A M |
| 15 | Carmen | **Migrar de PostgreSQL a API**. **Bug B6**: `NameError` en `enviar_alerta`, el servicio se cae con la primera alerta. Variables `API_TOKEN/API_TO` vs `.env` con `TOKEN/TO` (B5). Pozo ÷1, sentina ÷100. La API ignora `limit` (entrega 100 fijos), lo que no afecta si se filtra por ventana. | `/carmen/nivel_bajo`, `/carmen/nivel_sentina` | N **R** D A M |
| 16 | Aromos | **Migrar de PostgreSQL a API** (entrega 300 registros fijos). | `/aromos/nivel` | N D A M |
| 17 | Idahue | **Migrar de PostgreSQL a API**. ÷100. Rebalse 5 m. | `/idahue/nivel_planta1`, `/nivel_planta2` | N **R** D A M |
| 18 | Gonzalez | **Migrar de PostgreSQL a API** (entrega 100 fijos). Rebalse 3 m. | `/gonzalez/nivel`, `/nivel2` | N **R** D A M |
| 19 | Guindo | **No existe API** para `apr_guindo_alto` → hay que crear el endpoint `/nivel` (o agregarlo a otra API MySQL). ÷100, rebalse 3.4 m. Variables `TOKEN/TO` (B5). Borrar la copia `Llaveria/monitorEstanqueGuindo.py`. | **por crear** | N **R** D A M |
| 20 | Llaveria | **No existe API** para `apr_llaveria` → crear `/nivel` y `/nivel2` (sondajes 1 y 2). Desconexión compara `datetime.now()` local con la hora de la BD (B8). | **por crear** | N D A M |
| 21 | Marchigue | **Migrar a API**: la API de **Trinidad** ya expone `getNivel` sobre `apr_marchigue` / `TK_MARCHIGUE--slave.AI12` (verificar la ruta pública). Sacar las credenciales del código (S1). Hoy un error de BD mata el proceso. ÷100. | `/trinidad/nivel` (verificar) | N D A M |
| 22 | Bucalemu | **Migrar a API**: `api-bucalemu-postgres` **no tiene** endpoint de serie por sensor (solo `name/:name`, que devuelve 1 registro) → crear `/nivel?name=...&limit=...` o un endpoint por estanque. Casuto viene en cm (÷100). Umbrales distintos por estanque (Alto 2 m, el resto 1 m; rebalse 4.25 m / 4.30 m). Rama "ESTANQUE VACÍO" inalcanzable (código muerto). El `.env` local no tiene `API_*` y usa `DB_PASS` mientras el código lee `DB_PASSWORD` (B5). | **por crear** | N **R** D A M |
| 23 | Ranguil (conexión) | Se absorbe en el #14. Hoy avisa al **grupo del cliente**; pasaría al admin. | `/ranguil/snapshot` | — |
| 24 | Boldos (conexión) | Se absorbe en el #13 (desconexión por sensor). Quitar `TO` del código. El reinicio de servicio Windows usa el nombre de ejemplo `"NOMBRE_EXACTO_DEL_SERVICIO"`, así que **siempre falla**: completarlo o eliminarlo. | `/boldos/snapshot` | — |
| 25 | Araucarias (conexión) | No tiene estanque (`/nivel` es el **freático**). Mantener solo D con el formato único. Reemplazar `DESFASE_BACKEND = 3h` por comparación en UTC (B9). | `/araucarias/snapshot` | D A M |
| 26 | Olivar Bajo | **Migrar de PostgreSQL a API** (`api-olivar` tiene `latest`/`data`; verificar ruta). Hoy solo detecta el sensor en 0, **no** detecta que dejen de llegar datos: agregar D por antigüedad. `requests.post` sin timeout. Log con ruta relativa. | `/olivar.../latest` (verificar) | D A M (+ estado binario) |
| 27 | Zuniga (latido) | Ver decisión 5 en §3.5. | — | — |

### 4.1 Trabajo previo en las APIs (NestJS)

Antes de migrar algunos scripts hay que tocar estas APIs:

| API | Cambio |
|-----|--------|
| `Auquinco/api-auquinco` `getNivel` | Sin rango ignora `limit` y devuelve las últimas 6 h en orden ASC. Debe aceptar `limit` (DESC + `reverse`, como Ranguil y Cuevas). |
| `Cocalan/api-cocalan` `getNivel` | Sin rango hace `ASC` + `take: limit` dentro de las últimas 6 h, o sea **los 2 registros más antiguos**. Usar `DESC` + `reverse`. |
| `Nerquihue/api-nerquihue` (versión no `-pg`) | Ignora `limit` (100 fijos). Si es la desplegada, corregirla o confirmar que corre `api-nerquihue-pg`. |
| `Aromos/api-aromos` `getNivel2` | Consulta el **mismo** sensor que `getNivel` (`SSR_AROMOS--slave.estanque`): error de copiar y pegar. |
| `Bucalemu/api-bucalemu-postgres` | Crear un endpoint de serie histórica por sensor. |
| Guindo / Llaveria | No tienen API; crear endpoints de nivel (MySQL), por ejemplo en la API de Trinidad, que ya se conecta a la MySQL `apr_*`. |
| Carmen, Gonzalez, Aromos | Ignoran `limit` (devuelven 100 o 300 fijos). No bloquea si el script filtra por ventana, pero conviene alinearlas. |

Relacionado: los `calcularTiempoVaciado` del `snapshot` de casi todas las APIs (los dashboards) también usan `take: 2`. Solo `api-boldos` usa 5 puntos con regresión. Mejorarlos queda fuera de este trabajo, pero es el mismo problema de precisión.

---

## 5. Anomalías encontradas

### Seguridad

- **S1. Credenciales en el código y versionadas en git**:
  - `Marchigue/tankService.py`: host, usuario y contraseña de MySQL, y token de UltraMsg.
  - `Bucalemu/tankServiceBucalemu copy.py`: host RDS, usuario y contraseña de PostgreSQL, y token de UltraMsg.

  Aunque se borren los archivos, quedan en el historial. Hay que **rotar** la contraseña de la BD y el token de UltraMsg, y eliminar la copia.
- **S2.** `Boldos/connectionMonitorBoldos.py` tiene el grupo `TO` escrito en el código.

### Bugs que hoy afectan a producción

- **B1. Auquinco evalúa datos de ~6 h atrás.** La API devuelve todas las lecturas de las últimas 6 h en orden ascendente y el script toma `data_sorted[0]` y `[1]`, que son las **más antiguas**. Si el equipo lleva más de 6 h sin datos, la API devuelve `[]` y el script solo registra "no hay suficientes datos", sin alertar. Si `Nerquihue` corre con la API antigua, le pasa lo mismo.
- **B2. Cocalan evalúa datos de ~6 h atrás** (bug de orden en la API, ver §4.1). Como `time_actual` siempre tiene unas 6 h de antigüedad, la alerta de desconexión queda **permanentemente activa** después del primer aviso.
- **B3.** En la API de Cocalan, `/nivel` usa `SSR_COCALAN--slave.nivel`, pero el cálculo de vaciado del snapshot usa `SSR_COCALAN--slave.estanque`. Hay que confirmar cuál es el sensor del estanque.
- **B4. El tiempo de vaciado vuelve a 0 a las 24 h.** `datetime.utcfromtimestamp(s).strftime("%H:%M:%S")` muestra 30 h como `06:00:00`. Afecta a Zuniga, Puquillay, Manzano, Cumpeo, Villa Carmen, Cocalan, Auquinco, Nerquihue, Ranguil, Aromos, Marchigue, Llaveria, Guindo, Carmen e Idahue/Gonzalez (esta última usa `fromtimestamp`, con el mismo efecto). Además, varios agregan " Hrs" al final de un `HH:MM:SS`.
- **B5. Las variables del `.env` no coinciden con las que lee el código** (según los `.env` locales; hay que confirmar en los servidores):

  | Sitio | El código lee | El `.env` tiene | Efecto |
  |-------|---------------|-----------------|--------|
  | Puquillay | `TOKEN`, `TO` | `API_TOKEN`, `API_TO` | las alertas se envían con token `None` |
  | Auquinco | `TOKEN`, `TO` | `API_TOKEN`, `API_TO` | ídem |
  | Carmen | `API_TOKEN`, `API_TO` | `TOKEN`, `TO` | ídem |
  | Guindo | `API_TOKEN`, `API_TO` | `TOKEN`, `TO` | ídem |
  | Bucalemu | `DB_PASSWORD`, `API_*` | `DB_PASS`, sin `API_*` | no conecta a la BD ni envía alertas |

  Hoy hay tres convenciones: `TOKEN/TO`, `API_TOKEN/API_TO` y la que hace fallback a ambos. El `.env` estándar (§3.1) las unifica.
- **B6. Carmen se cae con la primera alerta.** `enviar_alerta` define `data1` o `data2`, pero hace el `post` con `data`, lo que lanza `NameError`. El `except` solo captura `RequestException` y no hay un `try` externo, así que el proceso muere. Además, con la secuencia `if vaciado` / `if rebalse … else` registra "Todo normal" justo después de alertar (igual que en Guindo).
- **B7. La "configuración dinámica" no es dinámica.** `get_dynamic_config()` lee `os.getenv` sin recargar el `.env`, así que cambiar `NIVEL_ALERTA` exige reiniciar el servicio. Solo Cuevas, California y Hornillas recargan de verdad.
- **B8. Zonas horarias inconsistentes.** Unos usan `datetime.utcnow()` (obsoleto en 3.12), otros `datetime.now()` local (Llaveria, Bucalemu) y otros `now(timezone.utc)`. La alerta de desconexión depende de que la API entregue la hora real en UTC. Conviene verificar sitio por sitio, sobre todo en las APIs MySQL (Trinidad/Marchigue), donde `new Date(DATETIME)` depende de la zona horaria del servidor Node.
- **B9.** `Araucarias/connectionService.py` corrige con `DESFASE_BACKEND = 3h` fijo y compara contra la hora local del servidor. Cuando Chile vuelva a UTC−4 (abril), el cálculo quedará desfasado 1 hora. Hay que comparar todo en UTC.
- **B10. Spam de desconexión en Zuniga**: no tiene estado, así que envía la alerta al admin **cada 5 min** mientras dure la desconexión.
- **B11. Procesos que mueren con un error de BD**: Ranguil (#14) y Marchigue (#21) no envuelven la consulta en `try`, y cualquier `mysql.connector.Error` termina el servicio.
- **B12. `load_dotenv()` sin ruta** en la mayoría de los scripts (todos menos Cuevas, Bucalemu y Araucarias): depende del directorio desde el que los lance pm2, systemd o el programador de tareas. Olivar Bajo también escribe el log con ruta relativa.
- **B13.** El reinicio automático de Boldos nunca funciona (nombre de servicio de ejemplo, ver #24).

### Orden y mantenimiento

- Nombres heredados de copiar y pegar: Puquillay escribe en `logs_ZUNIGA.txt`. Zuniga, Puquillay, Auquinco, Nerquihue y Villa Carmen llaman "Estanque Nuevo" a su único estanque.
- Archivos duplicados o muertos: `Llaveria/monitorEstanqueGuindo.py` (idéntico al de Guindo), `Bucalemu/tankServiceBucalemu copy.py`, `Bucalemu/connectionMonitorBucalemu.py` (vacío).
- Nombre engañoso: `INTERVALO_MINUTOS` no es el intervalo de chequeo (que está fijo en 1 min) sino la **espera después de una alerta**. En Compania sí es el intervalo.
- `Cuevas/tankService.py`, la mejor versión, **no está commiteada**.
- Ningún script tiene `requirements.txt` propio salvo Araucarias y Viveros. Las dependencias reales son `requests` y `python-dotenv`, más `mysql-connector`/`psycopg2` mientras quede acceso directo a BD, y `schedule` en Araucarias.

---

## 6. Orden sugerido de ejecución

1. **Urgente, independiente del resto**: rotar las credenciales (S1); corregir B6 (Carmen) y B5 en los servidores; corregir las APIs de Auquinco y Cocalan (B1, B2).
2. Escribir `monitorEstanques.py` unificado tomando Cuevas como base (§3) y probarlo en uno o dos sitios que ya usan la API (Cuevas y Hornillas, por ejemplo).
3. Desplegarlo en los sitios que ya consultan la API (#2–#13), eliminando los monitores de conexión que absorbe (#23, #24).
4. Migrar los que leen la BD y ya tienen endpoint (Ranguil, Carmen, Aromos, Idahue, Gonzalez, Marchigue vía Trinidad, Olivar Bajo).
5. Crear los endpoints faltantes (Bucalemu, Guindo, Llaveria) y migrarlos.
6. Borrar los archivos duplicados o muertos y commitear todo.
