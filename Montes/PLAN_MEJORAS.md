# Plan de actualización: Viña Montes

Fecha de análisis: 2026-11-12

Alcance: `api-montes` (NestJS, puerto 3018), `dashboard-montes` (React + Vite + Chart.js) y `providerMontes.py` (MQTT → PostgreSQL).

Sensores: `montes_riles_caudal`, `montes_riles_totalizador`, `montes_general_caudal`, `montes_general_totalizador`. El provider inserta **un valor por sensor cada 10 min** (≈ 576 filas/día, ≈ 210.000/año).

---

## 0. Verificaciones en la BD (resultado 2026-11-12)

| Verificación | Resultado | Consecuencia |
|--------------|-----------|--------------|
| Tipos de columnas | `time` = `timestamp without time zone` con `DEFAULT CURRENT_TIMESTAMP`; `name` y `value` = `character varying` | `value` es texto: aplica P3 |
| Zona horaria de la BD | `America/Santiago`; el último dato (22:15:50) coincide con `now()` (22:18 −03) | `time` guarda la **hora local de Chile**. `DATE(time)` ya agrupa por día chileno: **B2 descartado** |
| Índices | Ya existen `idx_montes_time (time DESC)` e `idx_montes_name_time (name, time DESC)` | **P1 ya está hecho** |
| Totalizadores | Valores **enteros** (`75323`, `26196`): resolución de 1 m³. Riles sin cambios entre 18:15 y 22:15; General sube 1–3 m³ cada tanto | El totalizador por hora sale "escalonado" (0, 0, 3, 0, 2…); ver 4.9 |
| Bajadas del totalizador (4b) | Ninguna es un reinicio real. Hay dos causas: **(a)** 2026-04-04 entre 23:16 y 23:56, bajadas de 1–2 m³ que alternan con el valor anterior: es la **hora repetida del fin del horario de verano** (el 5 de abril a las 00:00 el reloj vuelve a las 23:00), y como `time` no tiene zona, las lecturas de las dos pasadas quedan intercaladas al ordenar por `time`. **(b)** 2026-01-19 18:29:59, varias filas con **exactamente la misma hora** (sin microsegundos, así que no vienen de `CURRENT_TIMESTAMP`): una carga en bloque, probablemente de la migración del cliente | Ordenar las series por `id` (orden real de inserción) y no por `time` en los cálculos de diferencias (P2, B5). Revisar la carga del 19-01 (consulta 6) |
| Caudal > 0 repetido (5) | La mayoría de los días tiene 1–3 repeticiones, que pueden ser caudal estable. Hay días anómalos: **2026-08-06** (General 18 y Riles 19 a la vez, ≈ 3 h), 2026-07-31 (Riles 12), 2026-11-05 (General 13), 2026-08-02 (Riles 9), 2026-07-28 (General 9) | Que ambos sensores se congelen juntos el 06-08 calza con B1 (MQTT caído y el provider reinsertando el último valor). Confirmar con la consulta 7 |

Pendiente para cerrar B1 y la carga del 19-01:

```sql
-- 6. Tamaño de la carga en bloque del 2026-01-19
SELECT name, COUNT(*) AS filas, MIN(value::numeric) AS min, MAX(value::numeric) AS max, MIN(id), MAX(id)
FROM montes WHERE time = '2026-01-19 18:29:59' GROUP BY name;

-- 7. Lecturas "congeladas": caudal > 0 sin cambio y totalizador sin cambio en la misma lectura.
--    El provider inserta los 4 sensores con la misma hora, así que se agrupan por `time`.
WITH p AS (
  SELECT time,
         MAX(value::numeric) FILTER (WHERE name = 'montes_general_caudal')      AS caudal,
         MAX(value::numeric) FILTER (WHERE name = 'montes_general_totalizador') AS tot
  FROM montes WHERE name LIKE 'montes_general_%' GROUP BY time
), r AS (
  SELECT time, caudal, tot,
         LAG(caudal) OVER (ORDER BY time) AS pc, LAG(tot) OVER (ORDER BY time) AS pt
  FROM p
)
SELECT time::date AS dia, COUNT(*) AS congeladas, MIN(time), MAX(time)
FROM r WHERE caudal > 0 AND caudal = pc AND tot = pt
GROUP BY 1 ORDER BY 1 DESC LIMIT 30;
```

Si con caudal > 0 el totalizador no sube en 30–60 min, el dato está congelado (con caudal de unos pocos m³/h el totalizador tiene que avanzar al menos 1 m³ por hora). También sirve revisar si el 06-08 llegó la alerta "ALERTA DE CONEXIÓN" por WhatsApp.

~~Confirmar la unidad del caudal~~: **confirmado `m³/h`** (2026-11-12). Antes el Excel decía `L/s` ([ExportToExcel.tsx:116](dashboard-montes/src/components/ExportToExcel.tsx:116)).

**Nota sobre fechas en la API.** Como `time` no tiene zona, el driver `pg` lo interpreta en la zona horaria del proceso Node. Hoy funciona porque el servidor corre en hora de Chile, pero si el proceso se moviera a un servidor en UTC todas las horas quedarían corridas 3–4 h. Conviene fijar `TZ=America/Santiago` en `ecosystem.config.js`.

---

## 1. Mejoras pedidas

### 1.1 Gráfico de caudal con selector de día (como Zuñiga)

Referencia: `Zuniga/DashboardZunigaReact/src/components/GraphCard.tsx`. El endpoint de Montes ya acepta `?start=&end=` ([metrics.controller.ts:36](api-montes/src/controllers/metrics.controller.ts:36)), así que el backend casi no cambia.

Propuesta (mejorada respecto a Zuñiga):

- `<input type="date">` nativo en vez de `react-datepicker` (no agrega dependencias), más botones **◀ día anterior / día siguiente ▶** y **Hoy**.
- Vista por defecto: **hoy desde las 00:00** (hora Chile) en vez de "últimos 100 puntos", que hoy equivale a ~16,7 h y cruza la medianoche sin mostrar la fecha.
- Eje X con hora real del día seleccionado (00:00–24:00) y la fecha en el título.
- Resumen del día bajo el gráfico: **máximo (con hora), promedio, mínimo** y horas con caudal > 0.
- Mismo componente para Riles y General.
- Backend: sin cambios de lógica (el filtro `BETWEEN 'día 00:00' AND 'día 23:59:59'` ya es hora Chile, ver §0). Solo validar las fechas (B19).

### 1.2 Limitar el gráfico de totalizador a 15 datos

Causa: `fetchWithCache` ([fetchWithcache.tsx:36](dashboard-montes/src/components/fetchWithcache.tsx:36)) acumula en `localStorage` todo lo que descarga y nunca recorta.

- **Totalizador por hora** (`totalizador-hora`): se dibuja el arreglo completo, por eso el gráfico crece sin fin y repite etiquetas `HH:mm` de días distintos. Es el caso más visible.
- **Totalizador por día**: se recorta a 20 días con `fillMissingDates(…, 20)` ([Home.tsx:174](dashboard-montes/src/pages/Home.tsx:174)), pero el caché igual crece sin límite.

Corrección:

- Mostrar los **últimos 15 días** en los gráficos diarios (Riles y General).
- Para el gráfico por hora, mostrar las **últimas 24 h** (o el día seleccionado, reutilizando el selector de 1.1). Si se prefiere literalmente 15 barras, es un parámetro.
- Podar el caché al guardar (`toCache` con solo los últimos N días) y **cambiar la clave** (`jte_cache_v2_montes…`) para descartar los cachés viejos ya inflados.
- **No cachear el totalizador por hora**: son 24 filas por consulta y el caché lo agrupa mal (B22). Basta con pedir el día directamente.

---

## 2. Bugs encontrados

### 2.1 Datos y cálculos

| # | Dónde | Problema | Efecto | Prioridad |
|---|-------|----------|--------|-----------|
| B1 | [providerMontes.py:71](providerMontes.py:71) | `insert_batch` reinserta el **último mensaje recibido** cada 10 min aunque el PLC esté desconectado (`last_messages` nunca se limpia) | Durante una caída se guardan valores repetidos con hora nueva: el caudal aparece "plano" y el badge de actualización queda **verde** aunque no lleguen datos. Evidencia probable: 2026-08-06, ambos caudales congelados ≈ 3 h (§0) | Alta |
| ~~B2~~ | [metrics.service.ts:94](api-montes/src/services/metrics.service.ts:94) | ~~Consumo diario agrupado por día UTC~~ | **Descartado** (§0): `time` se guarda en hora Chile, así que `DATE(time)` ya es el día chileno | — |
| B3 | [utilities.tsx:10](dashboard-montes/src/assets/utilities.tsx:10) | `fillMissingDates` arma las fechas con `toISOString()` (UTC) | Después de las 21:00 aparece "mañana" con 0 y desaparece el día más antiguo | Media |
| B4 | [metrics.service.ts:94](api-montes/src/services/metrics.service.ts:94) | Consumo diario = `MAX − MIN` del día | Si el totalizador se reinicia o da la vuelta, el día queda con un consumo enorme. Además pierde el tramo entre la última lectura del día y la primera del siguiente | Media |
| B5 | [metrics.service.ts:152](api-montes/src/services/metrics.service.ts:152) | En el totalizador por hora, la primera hora de cada consulta se calcula como `max − min` de esa hora y no contra la hora anterior | Como el caché reconsulta el último día en cada carga, la primera hora de ese día queda subestimada | Baja |
| B6 | [ExportToExcel.tsx:123](dashboard-montes/src/components/ExportToExcel.tsx:123) | La fecha del Excel sale de `toISOString()` (UTC) y la hora de `toLocaleTimeString` (local) | Filas entre 21:00 y 23:59 quedan con la fecha del día siguiente | Media |
| B7 | [ExportToExcel.tsx:116](dashboard-montes/src/components/ExportToExcel.tsx:116) | Unidad del caudal `L/s` en el Excel vs `m³/h` en el dashboard | Uno de los dos está mal frente al cliente | Alta |
| B22 | [fetchWithcache.tsx:32](dashboard-montes/src/components/fetchWithcache.tsx:32) | El caché agrupa por `time.split("T")[0]`, pero la API devuelve las horas en ISO UTC: las horas de 21:00 a 23:59 de un día quedan con la fecha del día siguiente | En el caché del totalizador por hora, al reconsultar se mezclan días: pueden quedar horas duplicadas o faltantes | Media |
| B23 | [metrics.service.ts:124](api-montes/src/services/metrics.service.ts:124) | Sin `start`/`end`, el totalizador por hora usa `toISOString()` (UTC) contra una columna en hora Chile; Postgres ignora la `Z` | La ventana "últimas 24 h" queda corrida 3 h (hoy el front no usa esa rama) | Baja |

### 2.2 Interfaz

| # | Dónde | Problema | Efecto |
|---|-------|----------|--------|
| B8 | [Home.tsx:97](dashboard-montes/src/pages/Home.tsx:97) | `latestData` parte como `{}`, así que `if (!latestData)` nunca se cumple | Si `/latest` falla o falta un sensor, `latestData.montes_riles_caudal.value` lanza error y la página queda **en blanco** |
| B9 | [Home.tsx:44](dashboard-montes/src/pages/Home.tsx:44) | Un solo `try` para todas las consultas | Si falla una, las siguientes no se actualizan y no se muestra ningún aviso |
| B10 | [Home.tsx:102](dashboard-montes/src/pages/Home.tsx:102) | No se pasa `text` al `Navbar` | El badge de la barra superior muestra siempre "Desconocida" sin color |
| B11 | [Navbar.tsx:95](dashboard-montes/src/components/Navbar.tsx:95) | Vista móvil copiada de otro cliente: enlaza a `/undurraga/` y usa `/src/assets/lgo.png` | En celular el logo no carga y el enlace lleva a otro dashboard |
| B12 | [ExportModal.tsx:32](dashboard-montes/src/components/ExportModal.tsx:32) | `<Export />` sin `onClose` | El botón **Cancelar** del exportador no hace nada |
| B13 | [ExportToExcel.tsx:48](dashboard-montes/src/components/ExportToExcel.tsx:48) | `baseUrl` termina en `/` y las rutas empiezan con `/` (`montes//totalizador`) | Funciona solo porque nginx une las barras; frágil |
| B14 | [ExportToExcel.tsx:190](dashboard-montes/src/components/ExportToExcel.tsx:190) | `<hr />` dentro de un `<select>` | HTML inválido; usar `<optgroup>` |
| B15 | [TimeSeriesChart.tsx:133](dashboard-montes/src/components/TimeSeriesChart.tsx:133) | `beginAtZero: false` en gráficos de **barras** | El eje no parte en 0 y exagera visualmente las diferencias de consumo entre días |
| B16 | [TimeSeriesChart.tsx:56](dashboard-montes/src/components/TimeSeriesChart.tsx:56) | Badge verde ≤ 10 min, amarillo ≤ 20 min, pero los datos llegan cada 10 min y el front consulta cada 2 min | El badge pasa a amarillo en operación normal |
| B17 | [index.html](dashboard-montes/index.html) | favicon apunta a `/src/assets/montes.jpeg`, `lang="en"` | Sin favicon en producción |

### 2.3 Backend y seguridad

| # | Dónde | Problema |
|---|-------|----------|
| B18 | [metrics.controller.ts:17](api-montes/src/controllers/metrics.controller.ts:17) | `POST /` público, sin autenticación, que escribe en la BD. El DTO usa `mt_name`/`mt_value` y la tabla `name`/`value`, así que hoy además falla. Nadie lo usa (el provider inserta directo): **eliminarlo** |
| B19 | [metrics.service.ts](api-montes/src/services/metrics.service.ts) | `start`/`end` llegan como texto sin validar (`DateRangeDto` existe pero no se usa): una fecha inválida produce un 500 |
| B20 | [providerMontes.py:41](providerMontes.py:41) | La alerta de desconexión no dice "Montes", no avisa la recuperación, no tiene reintentos y va a `API_TO`. Alinear con el formato de `HOMOGENEIZACION_MONITOREO.md` §3.4 |
| B21 | [package.json](dashboard-montes/package.json) | `xlsx@0.18.5` (versión de npm abandonada, con avisos de seguridad conocidos). Pasar a la versión oficial de SheetJS desde su CDN o a `exceljs` |

---

## 3. Rendimiento

El volumen es bajo (~210 mil filas/año) y el índice `(name, time DESC)` ya existe, así que hoy no es lento. Lo que queda: cada consulta aplica una regex y un cast a `numeric` por fila (porque `value` es texto) y el totalizador diario recalcula todo el rango en cada carga.

| # | Cambio | Detalle | Impacto |
|---|--------|---------|---------|
| ~~P1~~ | ~~Índice `(name, time DESC)`~~ | **Ya existe** (`idx_montes_name_time`, §0). `idx_montes_time` solo sirve si alguna consulta filtra por tiempo sin nombre; hoy ninguna lo hace | — |
| P2 | Tabla `montes_daily_metrics` | Hoy **no existe**. Copiar el patrón de `Tambo/api-tambo` (`diario()` + `totalizadorPorDia()`): días pasados se leen de la tabla, solo hoy se recalcula. El día es directamente `time::date` (ya está en hora Chile). Calcular el consumo como **suma de incrementos positivos** entre lecturas seguidas (`GREATEST(v − LAG(v) OVER (PARTITION BY name ORDER BY id), 0)`; **por `id`, no por `time`**, para que la hora repetida de abril y las filas con hora duplicada no generen falsos incrementos), descartando saltos imposibles (por ejemplo, más de lo que permite el caudal máximo en 10 min): así un reinicio del medidor o una lectura en 0 no inflan el día (resuelve B4) | El totalizador diario y el futuro resumen mensual dejan de recalcular el histórico |
| P3 | Columna `value` numérica | Confirmado: es `character varying`. Migrar a `double precision` (`ALTER TABLE montes ALTER COLUMN value TYPE double precision USING value::double precision`, en horario de baja demanda y después de verificar que no hay valores no numéricos) y quitar la regex `~ '^[0-9]+…'` y los `::numeric` | Elimina el cast por fila y permite que el índice sirva mejor |
| P7 | `time` a `timestamptz` (opcional) | `ALTER TABLE montes ALTER COLUMN time TYPE timestamptz USING time AT TIME ZONE 'America/Santiago'`. Resuelve de raíz la hora repetida de abril y la dependencia de la zona horaria del proceso Node. Las consultas con `'AAAA-MM-DD 00:00:00'` siguen funcionando porque la sesión está en `America/Santiago`. Las filas ya guardadas de la hora repetida quedan asignadas a una sola de las dos pasadas | Datos futuros sin ambigüedad |
| P4 | Caché del front | Podar a N días (§1.2), versionar la clave, y lanzar las 3 consultas cacheadas en paralelo (hoy van una tras otra después del `Promise.all`) | Menos datos en `localStorage` y carga inicial más rápida |
| P5 | Refresco | Consultar cada 2 min cuando los datos llegan cada 10 min es exceso. Alinear a ~5 min y pausar cuando la pestaña está oculta (`visibilitychange`) | Menos carga en la API |
| P6 | Bundle | Quitar dependencias sin uso (`react-hook-form`, `router`, `react-router` duplicado con `react-router-dom`) y componentes muertos (§5) | Build más liviano |

---

## 4. Mejoras de valor para el cliente (visualización y experiencia)

Ordenadas por valor estimado / esfuerzo.

### 4.1 Tarjetas KPI que respondan "¿cuánto consumí?"

Hoy las tarjetas muestran el **contador bruto del totalizador** (ej. `1.234.567,89 m³`), que no le dice nada al usuario. Propuesta por cada línea (Riles y General):

- Caudal actual (con indicador de conexión por sensor: verde / amarillo / rojo + "hace X min").
- **Consumo hoy** y **consumo ayer**.
- **Consumo últimos 7 días** con la variación (%) contra los 7 anteriores.
- El contador bruto queda como dato secundario (tooltip o texto pequeño).

### ~~4.2 Relación Riles / General~~ (descartada)

> **Descartada el 2026-11-13:** Riles y General son dos sistemas de extracción independientes, usados para fines distintos, así que el porcentaje entre ambos no tiene significado. Se quitó la tarjeta, el pie de los tooltips, la columna de la tabla mensual y la del Excel. Lo que sigue es la propuesta original, que partía de un supuesto equivocado.

Para una viña, el agua que se convierte en RIL respecto del agua total es un indicador de eficiencia y de cumplimiento ambiental. Propuesta:

- Gráfico diario de barras **agrupadas** General vs Riles (reemplaza los dos gráficos separados y permite comparar de un vistazo).
- KPI "% Riles / General" del día y de los últimos 15 días.

### 4.3 Resumen mensual

Gráfico y tabla de consumo por mes (últimos 12 meses) para General y Riles, apoyado en `montes_daily_metrics`. Útil para reportes internos y declaraciones.

### 4.4 Totalizador General por hora

Hoy solo existe el de Riles en pantalla (el de General sí está en el exportador). Agregar un selector Riles / General en el gráfico por hora, o mostrar ambos.

### 4.5 Aviso de "sin datos"

Banner superior cuando el último dato tiene más de 30 min ("Sin datos de Riles desde las 14:20"). Requiere corregir B1, si no el aviso nunca se activa.

### 4.6 Legibilidad de los gráficos

- Título y unidad en el eje Y, tooltips con unidad (`12,4 m³/h`) y formato `es-CL`.
- Barras desde 0 (B15).
- Colores distintos para Riles y General, iguales en todos los gráficos.
- Quitar el truco `title === "Nivel Pozo"` heredado de otro cliente ([TimeSeriesChart.tsx:147](dashboard-montes/src/components/TimeSeriesChart.tsx:147)).

### 4.7 Exportador

- Atajos de rango: hoy, últimos 7 días, mes actual, mes anterior.
- Opción "todo" en un solo Excel (una hoja por sensor, más una hoja resumen diaria).
- Validar `inicio ≤ fin` y mostrar errores en el modal en vez de `alert()`.

### 4.8 Resolución del caudal (opcional, provider)

El caudal se guarda como **una muestra instantánea cada 10 min**: los picos entre muestras se pierden. Opciones: guardar cada 1–2 min o guardar el promedio de los mensajes recibidos en la ventana. Mejora directamente el gráfico de 1.1.

### 4.9 Consumo por hora más fino

Los totalizadores llegan como enteros (1 m³ de resolución, §0), así que las barras por hora salen escalonadas (0, 0, 3, 0, 2…) y engañan. Opciones: mostrar el consumo por hora **integrando el caudal** (caudal × 10 min, con la unidad confirmada) y dejar el totalizador para los totales diarios; o mostrar el acumulado del día como línea en vez de barras por hora. Pedir al PLC/MQTT el totalizador con decimales, si el equipo lo entrega, resuelve el problema de raíz.

---

## 5. Limpieza

- Componentes sin uso: `BurgerMenu`, `Card`, `DropdownCard`, `DropDownCardv2`, `DropDownCardv3`, `Elbow`, `Level`, `LoginModal`, `Pipe`, `Pump`, `States`, `ToggelCardButton`, `ToggleThemeButton`.
- CSS sin importar: `index.css` y `App.css` (plantilla de Vite).
- `passport-jwt` y `JWT_SECRET` sin uso en la API.
- Footer `© 2025` fijo → año dinámico.
- Variable `DB_PASSWORD` (provider) vs `DB_PASS` (API): unificar nombres.

---

## 6. Orden sugerido

| Fase | Contenido | Esfuerzo |
|------|-----------|----------|
| 0 | ~~Verificaciones 1–5~~ (hechas). Pendiente: consultas 6 y 7, y unidad del caudal con el cliente | 0,5 h |
| 1 | Pedidas: selector de día en caudal (1.1) y límite de 15 en totalizador (1.2) | 1 día |
| 2 | Bugs de pantalla y exportador: B6–B17 | 0,5 día |
| 3 | Datos: B1 (provider), B4–B5, B22–B23, P2 tabla diaria (ordenando por `id`), P3 columna numérica, `TZ` en pm2, P7 opcional | 1 día |
| 4 | Valor: KPIs de consumo (4.1), General por hora (4.4), aviso sin datos (4.5), legibilidad (4.6) | 1,5–2 días |
| 5 | Resumen mensual (4.3), exportador (4.7), resolución del caudal (4.8) | 1–1,5 días |
| 6 | Seguridad y limpieza: B18–B21, P3, P5, P6, §5 | 0,5 día |

Las fases 1 y 2 no dependen de la BD y se pueden entregar primero. La fase 3 conviene hacerla antes de la 4, porque los KPIs de consumo usan el consumo diario corregido.

---

## 7. Estado de implementación (2026-11-12)

Implementado todo el plan salvo P7 (opcional, queda comentado en la migración). Sin commitear.

| Área | Cambios |
|------|---------|
| BD | `api-montes/migrations/001-mejoras-2026-11.sql`: `value` a `double precision` (P3), tabla `montes_daily_metrics` (P2), P7 comentado |
| API | Consumo diario con caché en tabla y suma de incrementos ordenada por `id` (B4, B5); nuevos `GET totalizador-mes/:name?meses=` y `GET consumo-hora/:name` (volumen por hora desde el caudal, 4.9); sensores y fechas validados (B19); `POST /` eliminado (B18); B23; `TZ` y zona de sesión fijadas; valores siempre numéricos; dependencia `pg` agregada (faltaba en `package.json`); `passport-jwt` eliminado. Si la tabla diaria no existe, calcula sin caché y lo avisa en el log |
| Provider | No reinserta datos viejos: guarda solo lo recibido en la ventana (B1); caudal = promedio de la ventana (4.8); `.env` con ruta; `DB_PASS` o `DB_PASSWORD`. Las alertas pasaron al monitor unificado (B20) |
| Monitor | `monitorMontes.py` (copia del monitor unificado) + `monitor_config.json`: desconexión por equipo y falla de API, solo al admin |
| Dashboard | Tarjetas de consumo hoy / ayer / 7 días (4.1); caudal del día con selector y resumen (1.1); consumo por hora General y Riles (4.4, 4.9); diario 15 días (1.2) y mensual 12 meses con tabla (4.3); aviso "sin datos" (4.5); gráficos legibles (4.6); exportador nuevo (4.7, B6, B7, B12–B14); caché local podada y versionada (P4, B22); refresco cada 5 min y pausa con la pestaña oculta (P5); B3, B8–B11, B15–B17; limpieza (§5, P6). `xlsx` + `file-saver` reemplazados por `exceljs`, que se carga solo al exportar (B21) |

Verificado: API contra un PostgreSQL local con el mismo esquema que producción, datos reales de caudal (21 días) y casos borde (hora repetida de abril, lectura en 0, reinicio del medidor); dashboard en navegador (escritorio y móvil) y exportación leyendo el `.xlsx` generado. **No** probado contra la BD de producción (IP privada) ni el provider con MQTT real.

### Despliegue (en este orden)

1. **BD**: ejecutar `migrations/001-mejoras-2026-11.sql`. Hay filas con `value = 'error'` (2026-02-09, provider antiguo): el paso 1b las respalda en `montes_valores_invalidos` y las saca de `montes` antes del `ALTER`. **La API nueva debe desplegarse después de la migración**: sin ella, cualquier consulta que incluya esas filas (por ejemplo, el resumen mensual, que abarca febrero) falla al convertir `'error'` a número.
2. **API**: `npm ci && npm run build`, y reiniciar con `pm2 restart ecosystem.config.js --update-env` (toma `TZ`). La API escucha en el **3020**, que es el puerto de `/montes/` en nginx (el 3018 es de `/demo-mediciones/`).
3. **Dashboard**: `npm ci && npm run build` y publicar `dist/` en `/montes/`. Si se publica antes que la API, "Consumo por hora" y "Consumo mensual" muestran error hasta actualizar la API.
4. **Provider**: reemplazar `providerMontes.py` y reiniciarlo. Variable opcional en su `.env`: `INTERVALO_SEGUNDOS` (600). Ya no envía alertas.
5. **Monitor de desconexión**: copiar `monitorMontes.py` y `monitor_config.json` junto al provider (comparten `.env`), agregar `API_TO_ADMIN` al `.env`, probar con `python monitorMontes.py --una-vez --sin-enviar` y dejarlo como servicio (pm2/NSSM). Es el script unificado de los monitores de estanque (`MonitorEstanques/monitorEstanques.py`, ver `DEPLOY_MONITOREO.md`): avisa una vez al admin por equipo (Riles, General) tras 30 min sin datos, avisa la recuperación, recuerda cada 24 h y alerta si la API falla 5 ciclos seguidos. Parámetros en el `.env` (`UMBRAL_DESCONEXION_MINUTOS`, `RECORDATORIO_DESCONEXION_HORAS`, etc.).

Variables opcionales de la API: `TOTALIZADOR_MAX_M3H` (200; incrementos por sobre esto se descartan) e `INTERVALO_MAX_MINUTOS` (15; tope por lectura al integrar el caudal). `JWT_SECRET` en `api-montes/.env` ya no se usa.
