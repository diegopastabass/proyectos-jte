# Posibles bugs — proyecto Ranguil

Revisión del 2026-10-25 sobre el código del directorio de trabajo. Es una revisión por lectura: no se ejecutó la app ni se probó contra la base de datos. Los puntos marcados **"verificar"** dependen de datos o configuración que no están en el repo.

Verificaciones hechas:
- `tsc -p tsconfig.app.json --noEmit` del dashboard: sin errores.
- `eslint src` del dashboard: sin errores.
- `npm audit --omit=dev` del dashboard: 21 vulnerabilidades (4 críticas, 12 altas, 5 moderadas).
- Comprobación de dependencias del backend contra `package-lock.json`.

## Resumen

| # | Severidad | Título | Dónde |
|---|---|---|---|
| 1 | Alta | Pantalla en blanco ante errores de la API | `Home.tsx`, `Electrico.tsx`, `metrics.service.ts` |
| 2 | Alta | Script de nivel usa driver MySQL contra PostgreSQL | `MonitoreoEstanqueRanguil.py` |
| 3 | Alta | Exportar un solo día devuelve las últimas 100 filas | `ExportToExcel.tsx` |
| 4 | Alta | Dependencias vulnerables, incluida una sin uso | `DashboardRanguilReact/package.json` |
| 5 | Alta | Credenciales de la base de datos en git | `api-ranguil.zip` |
| 6 | Alta | Backend no compila desde una instalación limpia | `api-ranguil/src/app.module.ts` |
| 7 | Media | Días calculados en UTC; la UI usa hora de Chile | Varios (ver B7) |
| 8 | Media | Zona horaria implícita en los timestamps | `metrics.service.ts` (verificar) |
| 9 | Media | La API no valida parámetros | `main.ts`, `metrics.service.ts` |
| 10 | Media | El monitor de conexión depende de la misma API | `ConnectionMonitorRanguil.py` |
| 11 | Media | Monitor de nivel: alertas repetidas, `.env` no se recarga | `MonitoreoEstanqueRanguil.py` |
| 12 | Media | Caché del navegador sin protección ante JSON corrupto | `fetchWithcache.tsx` |
| 13 | Media | Un fallo en Home corta toda la actualización | `Home.tsx` |
| 14 | Media | Diagnósticos del panel eléctrico con datos viejos | `electrical.ts`, `Electrico.tsx` |
| 15 | Media | Seguridad de la API: sin autenticación, CORS abierto, TLS sin verificar | `main.ts`, `database.config.ts` |
| 16 | Baja | Horómetro y totalizador muestran 0 cuando no hay datos | `Home.tsx` |
| 17 | Baja | Fecha de los días de la API, al convertir con zona horaria | `metrics.service.ts` |
| 18 | Baja | Código duplicado y sin uso | Varios |

---

## Alta

### 1. Pantalla en blanco ante errores de la API
- **Dónde:** `pages/Home.tsx:134-144`, `pages/Electrico.tsx:86`, `components/fetchWithcache.tsx:43,75`, `components/DropdownCard.tsx` (`data.map`), `api-ranguil/src/metrics/metrics.service.ts:111-119`.
- **Qué pasa:** ninguna llamada revisa `res.ok` antes de usar el JSON. Además, `getSnapshot()` captura cualquier error de la base de datos y responde **200** con `snapshot: {}`. El frontend trata esa respuesta como válida, `data` no es `null`, así que no se muestra la pantalla de error. Al pintar, `data.snapshot.caudal.time` (`Home.tsx:494`) lanza un `TypeError` y React desmonta todo: pantalla en blanco. No hay `ErrorBoundary` en el proyecto (búsqueda sin resultados).
- Si `/nivel` u otra serie responde 500, el JSON de error (`{success:false,...}`) se guarda como array y `data.map` falla de la misma forma.
- **Cómo corregir:** en el backend, dejar que `getSnapshot` devuelva 500 en lugar de 200 vacío. En el frontend, revisar `res.ok` en cada `fetch`, y poner un `ErrorBoundary` alrededor de las páginas.

### 2. Script de nivel usa driver MySQL contra PostgreSQL
- **Dónde:** `MonitoreoEstanqueRanguil.py:4` (`import mysql.connector`), `:13-18` (`DB_CONFIG` sin puerto), `:47-60` (`obtener_niveles`).
- **Qué pasa:** la base es PostgreSQL (RDS, puerto 5432; ver `database.config.ts`), pero el script conecta con `mysql.connector`, que usa el puerto 3306 por defecto y no pasa `DB_PORT`. No puede conectar. Además, `monitorear()` no tiene `try/except` alrededor de `procesar_estanque`, así que la primera excepción termina el proceso. Si el script está en producción, **no hay alertas de nivel crítico**.
- **Cómo corregir:** usar `psycopg2` (o `pg` en Node) con `port=DB_PORT`. Envolver cada ciclo en `try/except` para que el proceso no muera.

### 3. Exportar un solo día devuelve las últimas 100 filas
- **Dónde:** `components/ExportToExcel.tsx:69-81`.
- **Qué pasa:** si `startDate === endDate` y el tipo es `nivel`, `nivel2`, `caudal`, `voltaje`, `corriente` o `presion`, la URL se construye **sin rango** (`/nivel`). La API devuelve las últimas 100 muestras (≈8 h si el muestreo es de 5 min), sin importar qué día se eligió. El Excel sale con datos de hoy aunque el usuario pidió un día anterior, sin ningún aviso.
- **Cómo corregir:** siempre enviar `?start=&end=`. Si `start === end`, la API ya cubre el día completo (`normalizeDateRange`).

### 4. Dependencias vulnerables, incluida una sin uso
- **Dónde:** `DashboardRanguilReact/package.json`.
- **Qué pasa:**
  - `botstrap@0.20.1` (probablemente un error de tipeo de `bootstrap`) no se importa en ningún archivo, pero arrastra `@slack/client` → `request@2.76.0`. Ahí están las vulnerabilidades críticas (`request`, `@slack/client`, `https-proxy-agent`, `form-data`).
  - `react-router-dom` 7.0.0–7.11.0 tiene una vulnerabilidad alta, con corrección disponible.
  - `xlsx@0.18.5` tiene una vulnerabilidad alta sin corrección en npm.
  - `lodash`, `ws`, `semver` y otros aparecen como altos, con corrección disponible.
- **Cómo corregir:** `npm uninstall botstrap`. Subir `react-router-dom` a la versión corregida. Para `xlsx`, evaluar la versión de SheetJS publicada fuera de npm o cambiar a otra librería (por ejemplo `exceljs`). Después, volver a correr `npm audit --omit=dev`.

### 5. Credenciales de la base de datos en git
- **Dónde:** `api-ranguil.zip` (versionado; commit `d814a70`).
- **Qué pasa:** el zip contiene `api-ranguil/.env` con host, usuario y contraseña de la base RDS. Los `.env` del directorio están en `.gitignore`, pero el zip no lo está, así que el secreto quedó en el historial. Además, el `.env` raíz tiene un token de UltraMsg y un número de teléfono en texto plano (solo local).
- **Cómo corregir:** rotar la contraseña de `JTEanalytics` en RDS. Sacar el zip del índice (`git rm --cached api-ranguil.zip`) y, si el repositorio es compartido o está en un servicio externo, reescribir el historial. Agregar `*.zip` al `.gitignore` si no se necesita.

### 6. Backend no compila desde una instalación limpia
- **Dónde:** `api-ranguil/src/app.module.ts:4` importa `@nestjs/cache-manager`.
- **Qué pasa:** ese paquete no está en `package.json` ni en `package-lock.json` (verificado). `npm ci` no lo instala y `nest build` falla. Funciona solo en máquinas donde alguien lo instaló a mano.
- **Otras observaciones del mismo archivo:** `common@0.2.5` en las dependencias parece un `npm i common` accidental. `typeorm` se usa directamente pero entra solo como peer dependency de `@nestjs/typeorm`.
- **Cómo corregir:** `npm install @nestjs/cache-manager` y confirmar que su versión es compatible con `cache-manager@7`. Quitar `common`.

---

## Media

### 7. Días calculados en UTC; la UI usa hora de Chile
- **Dónde:**
  - Backend: rangos a medianoche UTC (`metrics.service.ts:20-23`) y agrupación `AT TIME ZONE 'UTC'` (`:159`).
  - Frontend: `end` de Home y Electrico calculado en `America/Santiago` (`Home.tsx:103-113`, `Electrico.tsx:66-75`).
  - Exportación: fecha por defecto con `toISOString()` (`ExportToExcel.tsx:49`).
  - Panel eléctrico: las filas diarias se agrupan por `dayUtc` (`electrical.ts:205`), pero el mapa de calor agrupa por `day` de Santiago (`HeatmapCard.tsx:28`).
- **Qué pasa:** en horario de verano (UTC−3), entre las 21:00 y las 24:00 hora de Chile, el "día" de la API ya es el día siguiente. Los totales de "hoy" (totalizador, horómetro, kWh) corresponden a un día que no coincide con el día chileno. En invierno el corte es a las 20:00. Además, la exportación propone **mañana** como fecha de hoy en ese mismo tramo, y el mapa de calor no cuadra con la tabla diaria.
- **Cómo corregir:** elegir una sola definición de día. Lo más simple es agrupar en `America/Santiago` en SQL (`AT TIME ZONE 'America/Santiago'`) y usar la misma zona en la UI y en la exportación.

### 8. Zona horaria implícita en los timestamps (verificar)
- **Dónde:** `metrics.service.ts:55`, `:258` y similares (`new Date(row.mt_time_2).toISOString()`); ventanas `Date.now() - 6h` en `:287`, `:339`, `:386`.
- **Qué pasa:** `mt_time_2` es `timestamp` sin zona. El driver `pg` la interpreta en la zona horaria del proceso Node. Si esa zona no coincide con la zona en que se guardaron los datos, todos los tiempos quedan corridos (por ejemplo 3 h). En las ventanas de "últimas 6 h", el filtro pasa un `Date` con offset; según cómo `pg` serializa esa fecha (no probado aquí), el corte puede correrse igual.
- **Cómo verificar:** comparar `SHOW timezone` en PostgreSQL, `TZ` del proceso Node y la zona de los datos que escribe el colector. Si coinciden, el riesgo baja a bajo.
- **Cómo corregir:** guardar en UTC o usar `timestamptz`, y fijar `process.env.TZ` o convertir explícitamente.

### 9. La API no valida parámetros
- **Dónde:** `api-ranguil/src/main.ts` (no hay `ValidationPipe`), `metrics/models/dto/date-range.dto.ts`, `metrics.service.ts:263-270`, `:443-449`, `:481-487`.
- **Qué pasa:** los decoradores `@IsDateString` y `@IsOptional` no se aplican porque nadie registra el pipe. Consecuencias:
  - `?start=abc&end=2026-10-25` → `new Date('abcT00:00:00Z')` es inválido → `toISOString()` lanza `RangeError` → 500.
  - `?limit=1000000` → se pide toda la tabla. No hay tope.
- **Cómo corregir:** `app.useGlobalPipes(new ValidationPipe({ transform: true }))`. Eso requiere `class-transformer`, que hoy **no está** en `package.json`. Poner un máximo a `limit` (por ejemplo 1000).

### 10. El monitor de conexión depende de la misma API
- **Dónde:** `ConnectionMonitorRanguil.py:96-97` (`except Exception as e: logging.error(...)`).
- **Qué pasa:** el monitor consulta `/snapshot`. Si la API o la base están caídas, el error solo se escribe en el log y **nadie recibe alerta**, que es justo el caso que debería avisar. Además, si hay desfase de zona horaria (bug 8), `minutos_inactivo` puede salir negativo y la alerta nunca se dispara.
- **Cómo corregir:** enviar alerta también cuando la consulta falla varias veces seguidas. Usar una fuente independiente para el monitor, por ejemplo una consulta directa a la base.

### 11. Monitor de nivel: alertas repetidas y `.env` que no se recarga
- **Dónde:** `MonitoreoEstanqueRanguil.py:~25-30` (comentario "se recargarán en cada ciclo"), `:10` (`load_dotenv()` solo al importar), `:84` (`datetime.utcfromtimestamp`), `:125` (`enviar_alerta`).
- **Qué pasa:**
  - **Alertas repetidas:** mientras el nivel esté bajo el umbral, envía un mensaje en cada ciclo, sin límite ni deduplicación (a diferencia de `ConnectionMonitor`).
  - **`.env` no se recarga:** `get_dynamic_config()` lee `os.getenv`, pero `load_dotenv()` solo corre una vez. Cambiar `INTERVALO_MINUTOS` o `NIVEL_ALERTA` en el archivo no tiene efecto hasta reiniciar, aunque el comentario diga lo contrario.
  - **Formato del tiempo:** `utcfromtimestamp` está deprecado desde Python 3.12. Si el vaciado supera 24 h, `%H:%M:%S` da la hora del día: 25 h se muestra como "01:00:00". La API sí muestra horas completas.
- **Cómo corregir:** llamar `load_dotenv(override=True)` dentro del ciclo, guardar el último estado de alerta y avisar solo al cambiar de estado, y formatear las horas con `total_seconds() // 3600`.

### 12. Caché del navegador sin protección ante JSON corrupto
- **Dónde:** `components/fetchWithcache.tsx:31` y `:61`.
- **Qué pasa:** `JSON.parse(cached)` no tiene `try/catch`. Si el valor de `localStorage` queda corrupto (por ejemplo por un corte al escribir), cada carga falla hasta que el usuario borra el almacenamiento. El panel queda sin gráficos de días y no hay forma de recuperarlo desde la UI.
- **Cómo corregir:** envolver el parseo en `try/catch` y tratar el error como caché vacía.

### 13. Un fallo en Home corta toda la actualización
- **Dónde:** `pages/Home.tsx:136-144`.
- **Qué pasa:** las cargas se hacen con `await` en secuencia dentro de un mismo `try`. Si `fetchWithCache("totalizador")` falla, no se actualizan ni el nivel, ni el caudal, ni la presión, ni la corriente en ese ciclo. El error solo queda en la consola.
- **Cómo corregir:** usar `Promise.allSettled` y actualizar cada estado por separado.

### 14. Diagnósticos del panel eléctrico con datos viejos
- **Dónde:** `electrico/lib/electrical.ts:339-343` (`lastRun` puede ser de días atrás), `:276-277` (la eficiencia asume que `eff[-2]` es "el último día cerrado"), `:408` y `Electrico.tsx:145-147` (asumen que la última fila es "hoy").
- **Qué pasa:**
  - Si la bomba lleva días detenida, `lastRun` es antiguo y los hallazgos de sobrecarga, baja carga o presión baja se muestran como si fueran actuales.
  - Si el día en curso tiene ≤20 m³ (por ejemplo, justo después de medianoche UTC, bug 7), se excluye del cálculo de eficiencia y "el último día cerrado" pasa a ser anteayer. Lo mismo afecta a la tabla de KPIs de `Electrico.tsx`.
- **Cómo corregir:** los hallazgos deben indicar la antigüedad del último arranque, y "hoy" debe calcularse por fecha, no por posición en el arreglo.

### 15. Seguridad de la API
- **Dónde:** `api-ranguil/src/main.ts:15` (`origin: '*'`), `src/database/database.config.ts:20` (`rejectUnauthorized: false`), todas las rutas.
- **Qué pasa:**
  - Ninguna ruta tiene autenticación. Cualquiera con la URL puede leer la telemetría de la planta.
  - CORS permite cualquier origen.
  - La conexión a RDS no verifica el certificado, así que un intermediario podría leer o alterar las consultas.
- **Cómo corregir:** restringir CORS al dominio del dashboard. Usar `rejectUnauthorized: true` con el certificado de RDS (`rds-ca`). Si la API es pública por diseño, documentarlo; si no, agregar una clave o autenticación.

---

## Baja

### 16. Horómetro y totalizador muestran 0 cuando no hay datos
- **Dónde:** `pages/Home.tsx:163-170`.
- **Qué pasa:** si la serie diaria llega vacía (o la API falló), `ultimoHorometro` y `ultimoTotalizador` valen 0. El diagrama muestra "0.00 m³" y "0 h 0 m" como si fueran datos reales.
- **Cómo corregir:** mostrar "Sin datos" cuando la serie esté vacía.

### 17. Fecha de los días de la API, al convertir con zona horaria
- **Dónde:** `metrics.service.ts:136-139` y `:178-180` (`row.mt_day.toISOString().split('T')[0]`).
- **Qué pasa:** `pg` devuelve las columnas `DATE` como `Date` a medianoche **local**. Si el servidor está en una zona al este de UTC, `toISOString()` corre la fecha un día hacia atrás. Con la zona de Chile (al oeste de UTC) no pasa, pero depende de la configuración del servidor.
- **Además:** los días sin datos no se guardan en `ssr_ranguil_daily_metrics`, así que se recalculan en cada petición.
- **Cómo corregir:** configurar `pg` para devolver `DATE` como texto, o usar `to_char(mt_day, 'YYYY-MM-DD')` en la consulta.

### 18. Código duplicado y sin uso
- `ranguil-electrico/src/lib/electrical.ts` es idéntico a `DashboardRanguilReact/src/electrico/lib/electrical.ts`. Cualquier cambio en uno tiene que replicarse en el otro.
- `Pump.tsx`, `Pipe.tsx` y `Tank.tsx` en la raíz son copias idénticas de los componentes de `src/components/`.
- `components/CaudalChart.tsx` no se usa en ninguna página.
- `DashboardRanguilReact/dist/` está versionado; los artefactos de build pueden quedar desactualizados respecto a `src/`.
- La URL `https://app.jteanalytics.cl/ranguil` está escrita a mano en unos 15 lugares. Conviene una constante o variable de entorno.
- `main.tsx` importa `BrowserRouter` desde `react-router`, que no está declarado en `package.json` (solo llega como dependencia de `react-router-dom`).

---

## Preguntas abiertas (no son bugs confirmados)

- ¿Qué zona horaria tiene el servidor de la API y la base de datos? Define si los bugs 7 y 8 aplican.
- ¿`MonitoreoEstanqueRanguil.py` está corriendo hoy? Si no, el bug 2 no tiene impacto práctico, pero sí hay que corregirlo antes de usarlo.
- ¿`solar` viene en mV? El código divide entre 1000 y muestra "V". Confirmar la unidad con quien configura el PLC.
- ¿El repositorio es privado? Define la urgencia del bug 5.
