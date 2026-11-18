# Plan de actualización: Undurraga

Fecha de análisis: 2026-11-16

Alcance: `api-undurraga` (NestJS, puerto 3002), `dashboardUndurraga` (React + Vite + Chart.js) y la ingesta de datos (no está en el repo, ver §0).

Referencia: es el mismo plan que se implementó en Viña Montes (`Montes/PLAN_MEJORAS.md`), adaptado a lo que tiene Undurraga. Gran parte del código del front y de la API de Montes se puede reutilizar casi sin cambios.

Sensores (`undurraga_metrics.sensor_id`), según el código actual:

| id | Uso en el dashboard | Último dato (2026-11-16) |
|----|---------------------|--------------------------|
| 1 | Caudal instantáneo 1 (m³/h) | 2025-12-23 16:42 |
| 2 | Caudal instantáneo 2 (m³/h) | 2025-12-23 16:42 |
| 3 | Totalizador 2 (m³) | 2025-12-23 16:42 |
| 4 | Totalizador 1 (m³) | 2025-12-23 16:42 |
| 5 | Totalizador piscina (m³) | 2026-05-25 17:34 |
| 6 | No se muestra. **Prueba previa a la puesta en marcha**: 7 filas entre el 21 y el 22-10-2025 (§0.2) | 2025-10-22 10:14 |

---

## 0. Lo urgente: el sitio no recibe datos

**El dashboard lleva casi 11 meses sin datos nuevos** en los caudales y totalizadores 1 y 2, y casi 6 meses en la piscina. Nadie se enteró porque Undurraga no tiene monitor de desconexión.

Historial disponible (consultado en la API pública):

| Serie | Días con datos | Rango | Observación |
|-------|----------------|-------|-------------|
| Totalizador 1 | 19 | 2025-10-22 → 2025-12-23 | 13 días en 0 |
| Totalizador 2 | 19 | 2025-10-22 → 2025-12-23 | 16 días en 0 |
| Piscina | 201 | 2025-10-22 → 2026-05-25 | 121 días en 0 y un día con consumo **negativo** (−159 m³) |

Con esto, **mejorar los gráficos no aporta valor hasta que vuelvan los datos**. Antes de invertir en la Fase 2 hay que:

1. **Confirmar con el cliente** si los equipos siguen operando y si el servicio sigue vigente.
2. **Ubicar la ingesta.** La API recibe los datos por `POST /undurraga/` (`{ sensor_id, value }`), pero el script o equipo que los envía **no está en el repo**. Hay que encontrarlo (servidor, PLC, gateway), ver por qué dejó de enviar y versionarlo.
3. **Instalar el monitor de desconexión** (§1.1). Es solo configuración y habría avisado en diciembre.
4. **Confirmar los nombres reales** de "Caudal 1" y "Caudal 2" (¿pozos?, ¿líneas?) y **qué mide el contador de la piscina** (§0.2: parece reiniciarse cada día) para usarlos en el dashboard y en los avisos. El sensor 6 resultó ser una prueba (§0.2).

### 0.1 Verificaciones en la BD

Las mismas que se hicieron en Montes, más la de timestamps duplicados (ver B2):

```sql
-- 1. Tipos de columnas
SELECT column_name, data_type, column_default
FROM information_schema.columns WHERE table_name = 'undurraga_metrics';

-- 2. Zona horaria de la BD (en Montes era America/Santiago y `time` guardaba hora Chile)
SHOW timezone;

-- 3. Índices
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'undurraga_metrics';

-- 4. Volumen y rango por sensor
SELECT sensor_id, COUNT(*), MIN(time), MAX(time) FROM undurraga_metrics GROUP BY 1 ORDER BY 1;

-- 5. Lecturas del mismo sensor con la misma hora exacta (síntoma de B2)
SELECT sensor_id, COUNT(*) AS horas_repetidas, SUM(n) AS filas
FROM (SELECT sensor_id, time, COUNT(*) AS n FROM undurraga_metrics GROUP BY 1, 2 HAVING COUNT(*) > 1) t
GROUP BY 1;

-- 6. Bajadas de los totalizadores (reinicios o lecturas erróneas; la piscina tiene un día negativo)
SELECT sensor_id, time, v, prev
FROM (SELECT sensor_id, time, value AS v, LAG(value) OVER (PARTITION BY sensor_id ORDER BY id) AS prev
      FROM undurraga_metrics WHERE sensor_id IN (3, 4, 5)) t
WHERE v < prev ORDER BY time DESC LIMIT 50;
```

### 0.2 Resultados (2026-11-18)

| Verificación | Resultado | Consecuencia |
|--------------|-----------|--------------|
| Tipos | `value` = `numeric`, `time` = **`timestamp with time zone`** (`DEFAULT CURRENT_TIMESTAMP`) | A diferencia de Montes, `time` guarda el instante real: no hay ambigüedad en la hora repetida de abril ni dependencia de la zona del proceso Node. No hace falta convertir columnas |
| Zona horaria | `America/Santiago` | `DATE(time)` agrupa por día chileno |
| Índices | Ya existen `idx_undurraga_sensor_time (sensor_id, time)` e `idx_undurraga_time (time)` | **P1 ya está hecho** (un índice ascendente también sirve para recorrer en orden descendente) |
| Volumen | Sensores 1–4: ≈ 18.800–24.500 filas cada uno entre el 22-10 y el 23-12-2025. Piscina (5): 134.223 filas hasta el 25-05-2026. Sensor 6: **7 filas** entre el 21-10 17:24 y el 22-10 10:14 | El 6 es una prueba anterior a la puesta en marcha (22-10 11:42): quitarlo del snapshot y del dashboard, y opcionalmente borrar esas 7 filas con respaldo |
| Horas repetidas (5, 7) | **Solo la piscina**: 48.744 horas repetidas con 97.598 filas (~73 % de sus filas). **Casi el 99 % de esos pares tiene el mismo valor**: es la misma lectura insertada dos veces. Solo 598 pares (feb–abr) traen valores distintos | Duplicados exactos (B17). Los sensores 1–4 no tienen |
| Bajadas y valor 135 (6, 7) | En febrero y marzo la piscina reporta muchas veces **exactamente 135** (18.740 pares duplicados con ese valor, más las filas sueltas), intercalado con la serie real (1.117, 1.136, 1.461…). Además, el contador vuelve a 0: a medianoche hasta febrero y a media mañana desde abril | 135 parece un valor de falla del sensor o del PLC (B17). Reinicios (B18) |
| Filas escritas a mano (8) | Filas sin fracción de segundo, en pares **00:00:00 / 23:59:59** del mismo día: piscina 200 filas (100 días, 30-10-2025 → 15-02-2026, con 0 a medianoche) y totalizadores 1 y 2, 14 filas (30-10 → 02-11-2025). Caudales: ninguna | Alguien cargó a mano el inicio y el fin de cada día, probablemente para completar días sin datos. **No es un proceso activo** (la última es del 15-02) y para la piscina los valores son coherentes con un contador diario. Revisar las de los totalizadores (consulta 10) |

Lectura de los resultados:

- **La piscina parece un contador que se reinicia cada día** (sube hasta ~1.000–2.000 y vuelve a 0), no un totalizador acumulado como los otros dos. Desde abril los reinicios pasan a media mañana, quizás de forma manual. Hay que confirmarlo con el cliente.
- **Descartado: no hay dos fuentes.** La primera lectura (consultas 5 y 6) sugería un segundo emisor, pero la consulta 7 muestra que casi todos los empates son la **misma lectura duplicada**, y que el 135 es el valor que reportaba el propio sensor, no otra fuente.
- **Las filas a las 00:00:00 y 23:59:59 son cargas manuales** (no las genera la API, que no acepta `time` y siempre guarda microsegundos). Para la piscina tienen sentido (0 al inicio del día y el total al cierre), así que conviene conservarlas.

Resultados de las consultas 9 y 10:

| Consulta | Resultado | Consecuencia |
|----------|-----------|--------------|
| 9. Peso del 135 | Febrero: 17.761 de 20.071 filas (**88 %**). Marzo: 33.716 de 44.614 (**76 %**). Abril: 2 filas. Ningún otro mes | El sensor estuvo prácticamente pegado en 135 durante febrero y marzo. Descartarlo (§0.3 c) deja esos meses con la lectura real que sí llegó; mantenerlo los deja con consumos arbitrarios. Con estas proporciones es casi seguro un valor de falla, pero la confirmación es del cliente o del técnico |
| 9. Volumen por mes | Diciembre y enero: ~1.500 filas al mes (unas 48 al día, contando los pares manuales). Octubre, noviembre, febrero, marzo y mayo: entre 8.700 y 44.600 | Entre diciembre y enero la piscina casi no envió datos; buena parte de esos días son las cargas manuales |
| 10. Cargas manuales en los totalizadores 1 y 2 | Valores **constantes** del 30-10 al 02-11-2025: 99.101 m³ (totalizador 2) y 106.111 m³ (totalizador 1), sin ceros | Coherentes con un contador acumulado: no rompen nada. Pero dicen "consumo 0" en días en que en realidad no hubo datos. Con la suma de incrementos (P2), lo consumido durante el corte aparece completo el primer día con datos después del corte. Se pueden conservar |

**Verificaciones cerradas.** Lo único pendiente con el cliente es confirmar que 135 es un valor de falla (para ejecutar §0.3 c) y qué mide la piscina.

### 0.3 Limpieza propuesta (no ejecutar hasta confirmar)

Mismo patrón que en Montes con las filas `'error'`: respaldar en una tabla aparte y después borrar.

```sql
BEGIN;
CREATE TABLE IF NOT EXISTS undurraga_metrics_descartadas AS
  SELECT *, ''::text AS motivo FROM undurraga_metrics WITH NO DATA;

-- a) Duplicados exactos (mismo sensor, hora y valor): se conserva la fila con menor id
INSERT INTO undurraga_metrics_descartadas
  SELECT m.*, 'duplicado' FROM undurraga_metrics m
  WHERE EXISTS (SELECT 1 FROM undurraga_metrics o
                WHERE o.sensor_id = m.sensor_id AND o.time = m.time
                  AND o.value = m.value AND o.id < m.id);

-- b) Sensor 6 (prueba previa a la puesta en marcha)
INSERT INTO undurraga_metrics_descartadas
  SELECT *, 'sensor 6 de prueba' FROM undurraga_metrics WHERE sensor_id = 6;

-- c) Solo si el cliente o el técnico confirman que 135 es un valor de falla de la piscina
--    (88 % de las filas de febrero y 76 % de las de marzo, consulta 9)
-- INSERT INTO undurraga_metrics_descartadas
--   SELECT *, 'valor de falla 135' FROM undurraga_metrics WHERE sensor_id = 5 AND value = 135;

DELETE FROM undurraga_metrics m
USING undurraga_metrics_descartadas d
WHERE m.id = d.id;
COMMIT;
```

Los duplicados no alteran el consumo calculado como suma de incrementos (dan 0), pero duplican el volumen de la tabla. El 135 sí lo altera (ver B17).
Y confirmar con el cliente la **unidad del caudal** (el dashboard muestra m³/h, como en Montes).

---

## 1. Mejoras equivalentes a las de Montes

### 1.1 Monitor de desconexión (alta prioridad, bajo esfuerzo)

`/undurraga/snapshot` ya devuelve `{sensor: {value, time}}`, el formato que lee el monitor unificado (`MonitorEstanques/monitorEstanques.py`, v1.1.0). Basta con copiarlo como `Undurraga/monitorUndurraga.py` (agregarlo a `sincronizar.py`) y crear `monitor_config.json`:

```json
{
  "sitio": "Undurraga",
  "api_base": "https://app.jteanalytics.cl/undurraga",
  "estanques": [],
  "conexion": {
    "endpoint": "/snapshot",
    "modo": "sensor",
    "nombre": "Equipos Undurraga",
    "ignorar_sensores": ["3", "4", "6"],
    "nombres": { "1": "Caudal 1", "2": "Caudal 2", "5": "Piscina" }
  }
}
```

- Avisa una vez al grupo admin por sensor, avisa la recuperación, recuerda cada 24 h y alerta si la API falla.
- Se ignoran los totalizadores 1 y 2 suponiendo que van en el mismo equipo que su caudal (confirmar), y el 6, que es una prueba (§0.2).
- **Al instalarlo llegará de inmediato un aviso de desconexión de los tres sensores.** Es lo esperado.

### 1.2 Gráfico de caudal con selector de día

Igual que en Montes (`CaudalDiaChart` + `DaySelector`): día completo en hora Chile, botones anterior / siguiente / Hoy y resumen (máximo, promedio, tiempo con caudal, volumen estimado).

Requiere en la API `GET caudal/:sensor?start=&end=`. Hoy solo devuelve las últimas 100 lecturas, que a 1 lectura por minuto son **1 h 40 min**, no un día.

### 1.3 Totalizadores: 15 días, mensual y por hora

- **Diario**: hoy se muestran 30 días por serie. Proponemos 15, como en Montes (es un parámetro).
- **Mensual** (12 meses) con tabla, y **consumo por hora** estimado desde el caudal (más fino que el totalizador).
- Undurraga **no usa caché en localStorage**, así que el problema de Montes (gráfico creciendo sin límite) no existe aquí. Se puede agregar el mismo caché podado y versionado, pero con la tabla diaria del backend (P2) la ganancia es menor.

### 1.4 Tarjetas KPI por equipo

Hoy hay 4 tarjetas con el valor crudo (caudal, contador del totalizador). Igual que en Montes, una tarjeta por equipo con:

- caudal actual y estado de conexión ("hace X min", verde / amarillo / rojo);
- consumo de hoy, de ayer y de 7 días, con la variación;
- el contador del totalizador como dato secundario.

Más una tarjeta para la **piscina** (hoy solo tiene gráfico) y, si aplica, para el sensor 6.

> **Lección de Montes:** no agregar proporciones ni comparaciones entre equipos (por ejemplo "Caudal 2 / Caudal 1" o "Piscina / pozos") sin confirmar con el cliente cómo se relacionan. En Montes se agregó "Riles / General" y hubo que quitarla porque son sistemas independientes.

### 1.5 Aviso de "sin datos" y legibilidad

- Banner cuando un sensor lleva más de 30 min sin datos. **Hoy estaría activo permanentemente**, lo que también deja claro al cliente el estado real.
- Ejes con unidad, barras desde 0, tooltips con unidad y formato `es-CL`, colores por equipo, horas en Chile (ver B7).

### 1.6 Exportador

Mismo exportador de Montes: atajos de rango, opción "Todo" (resumen diario, consumo por hora y caudal en un libro), validación inline, valores numéricos y fechas en hora Chile. Hoy solo exporta los tres totalizadores diarios, no el caudal.

---

## 2. Bugs encontrados

### 2.1 Datos y API

| # | Dónde | Problema | Efecto | Prioridad |
|---|-------|----------|--------|-----------|
| B1 | §0 | Sin datos desde 2025-12-23 (sensores 1–4) y 2026-05-25 (piscina), sin ningún aviso | El cliente ve un dashboard sin información | Crítica |
| B2 | [metrics.service.ts:47](api-undurraga/src/metrics/services/metrics.service.ts:47) | Las lecturas se acumulan en memoria y se insertan cada 2 min **sin hora**: `time` toma `CURRENT_TIMESTAMP` del momento del insert, igual para todas las filas del lote. Con `instances: 2` en pm2 hay un buffer por proceso | La hora guardada no es la de la medición (hasta 2 min de desfase) y un mismo sensor puede quedar con **varias filas a la misma hora**. Por eso existe el `uniqueMap` que deduplica días en [metrics.service.ts:148](api-undurraga/src/metrics/services/metrics.service.ts:148), y el snapshot puede devolver cualquiera de las filas empatadas. En los datos (§0.2) los empates solo aparecen en la piscina, donde se combinan con B17. Al reiniciar se pierde lo que estaba en el buffer | Alta |
| B3 | [metrics.service.ts:121](api-undurraga/src/metrics/services/metrics.service.ts:121) | Consumo diario = última lectura − primera del día | Un reinicio del medidor da consumos negativos (la piscina tiene un día con −159 m³) y se pierde el tramo de medianoche. Además, con horas repetidas (B2) los `JOIN` por `time` multiplican filas | Media |
| B4 | [metrics.service.ts:215](api-undurraga/src/metrics/services/metrics.service.ts:215) | `getCaudal` devuelve las lecturas en orden **descendente** y el front no las ordena | El gráfico de caudal se dibuja con el tiempo al revés (lo más reciente a la izquierda) | Alta |
| B5 | [metrics.controller.ts:73](api-undurraga/src/metrics/controllers/metrics.controller.ts:73) | `sensorId` sin `ParseIntPipe` ni validación; `startDate`/`endDate` sin validar | Un id o fecha inválidos producen un 500 | Baja |
| B6 | [metrics.service.ts:41](api-undurraga/src/metrics/services/metrics.service.ts:41) | `throw new Error(...)` en vez de `BadRequestException` | Errores de entrada responden 500 | Baja |
| B17 | Ingesta de la piscina (fuera del repo) | **El 135 y los duplicados.** En febrero y marzo el sensor reporta muchas veces exactamente 135, intercalado con la lectura real; y casi la mitad de las filas de la piscina son la misma lectura insertada dos veces (§0.2) | Con "última − primera" el consumo diario puede tomar un 135 como inicio o fin del día (de ahí el −159). Con suma de incrementos, cada salto 135 → 1.117 se descarta por imposible y se pierde también el consumo real entre esas lecturas. Hay que confirmar si 135 es un valor de falla, corregirlo en el origen, revisar por qué el emisor envía dos veces y limpiar el historial (§0.3) | Alta |
| B18 | Piscina | El contador **se reinicia** (a medianoche hasta febrero; a media mañana desde abril) | Con "última − primera" un reinicio a mitad del día da negativo o subestima. La suma de incrementos positivos (P2) lo resuelve, una vez descartado el 135 (B17) | Media |

### 2.2 Interfaz

| # | Dónde | Problema | Efecto |
|---|-------|----------|--------|
| B7 | [TimeSeriesChart.tsx:29](dashboardUndurraga/src/components/TimeSeriesChart.tsx:29) | `formatDate` usa `getUTCHours()` | Las horas del gráfico de caudal salen en **UTC**, 3 h (4 en invierno) más que la hora Chile |
| B8 | [Home.tsx:100](dashboardUndurraga/src/pages/Home.tsx:100) | `snapshotArray.reduce(...)` sin valor inicial, y `snapshotData[1].value` sin comprobar | Si `/snapshot` falla o viene vacío, la página queda **en blanco** |
| B9 | [Home.tsx:43](dashboardUndurraga/src/pages/Home.tsx:43) | Un solo `try` para las 6 consultas | Si falla una, no se actualiza nada y no se avisa |
| B10 | [utilities.tsx:10](dashboardUndurraga/src/assets/utilities.tsx:10) | `fillMissingDates` arma fechas con `toISOString()` (UTC) | Desde las 21:00 aparece "mañana" con 0 y desaparece el día más antiguo |
| B11 | [TimeSeriesChart.tsx:86](dashboardUndurraga/src/components/TimeSeriesChart.tsx:86) | `beginAtZero: false` en barras y el truco `title === "Nivel Pozo"` heredado de otro cliente | Barras que exageran diferencias |
| B12 | [MetricCard.tsx](dashboardUndurraga/src/components/MetricCard.tsx) | Valores sin formato (`String(value)`) | Números crudos como `110117` o caudales con muchos decimales |
| B13 | [Navbar.tsx:99](dashboardUndurraga/src/components/Navbar.tsx:99) | Logo móvil con ruta `/src/assets/lgo.png` | En celular no carga el logo en producción |
| B14 | [ExportModal.tsx:32](dashboardUndurraga/src/components/ExportModal.tsx:32) | `<Export />` sin `onClose` | El botón **Cancelar** del exportador no hace nada |
| B15 | [index.html](dashboardUndurraga/index.html) | Título `dashboardundurraga`, `lang="en"`, favicon con ruta `./src/...` | Pestaña con nombre técnico y sin favicon en producción |
| B16 | [Loading.tsx](dashboardUndurraga/src/pages/Loading.tsx), [Home.tsx:207](dashboardUndurraga/src/pages/Home.tsx:207) | `© 2025` fijo | — |

### 2.3 Seguridad (alta prioridad, independiente de los datos)

| # | Dónde | Problema |
|---|-------|----------|
| S1 | [users.controller.ts:11](api-undurraga/src/users/users.controller.ts:11) | `@Roles('0')` **no protege nada**: no hay `JwtAuthGuard` ni `RolesGuard` aplicados (ni por endpoint ni globales). `GET /undurraga/users/email/:email` y `/users/find/:id` son **públicos** y devuelven usuario, email y rol. Verificado el 2026-11-16 con datos ficticios: responden sin pedir token (500 en vez de 401). Con un email inexistente da 500 (desestructura `null`) y con uno existente daría 200, así que además permite **enumerar cuentas** |
| S2 | [auth.controller.ts:9](api-undurraga/src/auth/auth.controller.ts:9) | `POST /undurraga/auth/register` es público: cualquiera puede crear usuarios |
| S3 | [auth.module.ts:14](api-undurraga/src/auth/auth.module.ts:14) | `JWT_SECRET \|\| 'defaultSecret'`: si falta la variable, los tokens se firman con un secreto conocido |
| S4 | [metrics.controller.ts](api-undurraga/src/metrics/controllers/metrics.controller.ts) | `POST /undurraga/` público escribe en la BD. **Se mantiene tal cual** por decisión del 2026-11-18: cambiar el emisor en terreno es complejo. Mitigación posible sin tocar el emisor: permitir el `POST` solo desde la IP del emisor en nginx, cuando se sepa cuál es |

El dashboard **no usa login** (`LoginModal` no se importa en ninguna parte). Si ningún otro sistema usa `undurraga_users`, lo más simple y seguro es **eliminar los módulos `auth` y `users`** (y las dependencias `@nestjs/jwt`, `@nestjs/passport`, `passport*`, `bcrypt`, `@nestjs/swagger`). Si se van a usar, hay que aplicar los guards de verdad y cerrar el registro. Mientras se decide, conviene bloquear `/undurraga/users/` y `/undurraga/auth/register` en nginx.

---

## 3. Rendimiento

Cuando el sitio opera llega **una lectura por minuto por sensor** (≈ 8.600 filas/día con 6 sensores, ≈ 3 millones/año): unas 15 veces más que Montes. Aquí la caché diaria y el índice importan más.

| # | Cambio | Detalle |
|---|--------|---------|
| ~~P1~~ | ~~Índice `(sensor_id, time)`~~ | **Ya existe** (§0.2) |
| P2 | Tabla `undurraga_daily_metrics` | Igual que `montes_daily_metrics`: días cerrados cacheados, hoy siempre calculado, suma de incrementos positivos ordenada por `time, id` (no por `id` como en Montes: aquí `time` es timestamptz y las cargas manuales tienen `id` posterior), NULL para días sin datos. Resuelve B3 y tolera los reinicios diarios de la piscina, **pero solo después de descartar el valor 135 (B17)**: si no, cada salto 135 → 1.117 se lee como imposible y se descarta junto con el consumo real |
| P3 | Snapshot con `DISTINCT ON (sensor_id) ... ORDER BY sensor_id, time DESC, id DESC` | Usa el índice y no depende de empates de hora (B2) |
| P4 | Refresco del front | Cada 5 min (los datos llegan cada minuto, pero el detalle se ve en el gráfico del día) y pausa con la pestaña oculta |
| P5 | Bundle | Quitar `react-hook-form`, `router`, `react-router` (duplicado), `file-saver`, `xlsx` (versión abandonada; reemplazar por `exceljs` cargado solo al exportar, como en Montes) y los componentes sin uso (§5) |

---

## 4. Contrato de la API

Para reutilizar el front de Montes, conviene que la API exponga las mismas rutas. Las actuales se mantienen mientras se despliega:

| Nueva (igual que Montes) | Actual |
|--------------------------|--------|
| `GET latest` (alias de `snapshot`) | `GET snapshot` |
| `GET caudal/:sensor?start=&end=` | `GET caudal/:sensorId` (últimas 100) |
| `GET totalizador/:sensor?start=&end=` | `GET totalizador-1`, `-2`, `-piscina?startDate=&endDate=` |
| `GET totalizador-mes/:sensor?meses=` | — |
| `GET totalizador-hora/:sensor?start=&end=` | — |
| `GET consumo-hora/:sensor?start=&end=` | — |

Con validación de sensor y fechas, `TZ=America/Santiago` en pm2 y en la conexión, y errores 400/404 en vez de 500.

---

## 5. Limpieza

- Componentes sin uso: `BurgerMenu`, `Card`, `DropdownCard`, `DropDownCardv2`, `DropDownCardv3`, `Elbow`, `Level`, `LoginModal`, `Navbar copy`, `Pipe`, `Pump`, `States`, `ToggelCardButton`, `ToggleThemeButton`, y `TimeSeriesChart` y `utilities.tsx` una vez reemplazados.
- `index.css` y `App.css` no se importan.
- Assets sin uso: `react.svg`, `logo_login.png`.
- `CreateMetricDto` sí se usa (ingesta); `metric.response.ts` se puede reemplazar por el tipo `Punto` de Montes.

---

## 6. Orden sugerido

| Fase | Contenido | Esfuerzo |
|------|-----------|----------|
| 0 | Confirmar con el cliente el estado de los equipos, los nombres y qué mide la piscina; ubicar la ingesta (y por qué la piscina se envía dos veces); confirmar si 135 es un valor de falla | 0,5 día + coordinación |
| 1 | Monitor de desconexión (§1.1) y bloqueo de `/users` y `/auth/register` en nginx (S1, S2) | 1–2 h |
| 2 | Seguridad en la API: eliminar o proteger `auth`/`users` (S1–S3); clave en el `POST` cuando se conozca el emisor (S4) | 0,5 día |
| 3 | Ingesta y datos: hora de medición en el `POST` y sin buffer por proceso (B2), limpieza de §0.3 (duplicados, sensor 6 y, si se confirma, el 135), sensor 6 fuera del snapshot, tabla diaria (P2, B3), snapshot con `DISTINCT ON` (P3), rutas nuevas (§4), B4–B6 | 1 día |
| 4 | Front (portando lo de Montes): KPIs, caudal del día, consumo por hora, diario 15 días, mensual, piscina, aviso sin datos, exportador, bugs B7–B16, limpieza | 1–1,5 días |

Las fases 1 y 2 conviene hacerlas ya, aunque no haya datos: el monitor deja registro de cuándo vuelven y los endpoints públicos de usuarios son un riesgo hoy. **La Fase 4 tiene sentido solo cuando los datos vuelvan a llegar.**

### Lecciones del despliegue de Montes

- Antes de copiar `src` al servidor, revisar que el **puerto** de `main.ts` coincida con el de nginx (`/undurraga/` → 3002 en el `nginx.conf` del repo; verificar el del servidor). En Montes, el puerto del servidor estaba editado a mano y al copiar `src` volvió al del repo, lo que dio un 502 que el navegador mostró como error de CORS.
- Si se cambia `package.json`, ejecutar `npm ci` en el servidor (en Montes faltaba `pg` como dependencia y solo funcionaba porque estaba instalado a mano).
- Migración de BD antes que la API.

---

## 7. Estado de implementación (2026-11-18)

Implementado todo el plan. Sin commitear. Pendiente del cliente: confirmar el 135 (paso 1c de la migración), los nombres de "Equipo 1" y "Equipo 2" y por qué los equipos no envían datos.

| Área | Cambios |
|------|---------|
| Monitor | `monitorUndurraga.py` (copia del monitor unificado, agregado a `sincronizar.py`) + `monitor_config.json` + `.env` local con las credenciales de UltraMsg de los demás sitios. Vigila `/snapshot` por sensor (1, 2 y piscina) y avisa solo al admin. Probado contra producción en modo prueba: detecta los tres equipos sin datos |
| BD | `api-undurraga/migrations/001-mejoras-2026-11.sql`: respalda y borra duplicados exactos y el sensor 6 (1a, 1b); el 135 queda comentado (1c); crea `undurraga_daily_metrics` |
| API | **Ingesta (`POST /`) con el mismo contrato** (ruta, cuerpo, validación, respuestas y errores); por dentro guarda la hora de llegada de cada lectura, descarta reenvíos idénticos en 5 s, vacía el buffer cada 30 s y al reiniciar (B2). Módulos `auth` y `users` eliminados con sus dependencias (S1–S3). Snapshot con `DISTINCT ON` y sin el sensor 6 (P3). Rutas nuevas iguales a Montes (§4), con las anteriores funcionando (`snapshot`, `totalizador-1`, `-2`, `-piscina`, `caudal/:id`). Consumo diario cacheado con suma de incrementos (B3, B18). Caudal en orden cronológico (B4). Validación de sensor y fechas con 400/404 (B5, B6). Días y horas calculados con `AT TIME ZONE 'America/Santiago'`, sin depender de la sesión ni del proceso. `ecosystem.config.js` apuntaba a `dist/src/main.js` pero la compilación genera `dist/main.js`: corregido |
| Dashboard | Portado de Montes: tarjetas por equipo y piscina (4 tarjetas → 3, con consumo hoy / ayer / 7 días), caudal del día con selector y resumen, consumo por hora, diario 15 días y mensual 12 meses con tabla (las tres líneas lado a lado, sin proporciones entre ellas), aviso "sin datos", exportador nuevo (la piscina sin caudal), B7–B16, limpieza (§5) y dependencias (`exceljs` en vez de `xlsx` + `file-saver`). Nombres provisorios en `src/config.ts` |

Verificado con un PostgreSQL local con el mismo esquema que producción (`numeric`, `timestamptz`) y datos sintéticos que reproducen los problemas reales:
- **Consumo diario:** el de Equipo 1 (173 m³) coincide con el volumen integrado desde el caudal (173,2 m³).
- **Piscina:** con reinicio diario y lecturas duplicadas da 300 m³ por día, el valor correcto. Las cargas manuales hechas después dan sus totales exactos (1.039,5 y 1.048 m³).
- **El 135:** los días con ese valor dan 1.724 m³ antes de la limpieza 1c y 300 m³ después.
- **Validaciones y rutas eliminadas:** responden 400 y 404, incluidas `/users` y `/auth/register`.
- **Ingesta:** el `POST` responde igual que antes con JSON y con formulario.
- **Navegador:** dashboard en escritorio y móvil. La exportación se verificó leyendo el `.xlsx` generado.

**No** probado contra la BD de producción.

### Despliegue (en este orden)

1. **Monitor** (puede ir ya, no depende del resto): copiar `monitorUndurraga.py`, `monitor_config.json` y `.env` a una carpeta del servidor, instalar `requests`, `python-dotenv` y `tzdata` (Windows), probar con `python monitorUndurraga.py --una-vez --sin-enviar` y dejarlo como servicio. Llegará de inmediato un aviso de los tres equipos sin datos.
2. **BD**: ejecutar `migrations/001-mejoras-2026-11.sql` (1a y 1b). Cuando el cliente confirme el 135, descomentar y ejecutar 1c, y vaciar `undurraga_daily_metrics`.
3. **API**: copiar `src`, **`package.json` y `package-lock.json`** (se quitaron dependencias), ejecutar `npm ci && npm run build`. Antes de reiniciar:
   - revisar con `pm2 describe api-undurraga` qué `script` usa: si es `dist/src/main.js`, recrear el proceso con el `ecosystem.config.js` nuevo (`pm2 delete api-undurraga && pm2 start ecosystem.config.js`), porque la compilación genera `dist/main.js`;
   - confirmar que `main.ts` del servidor escucha en **3002**, el puerto de `/undurraga/` en nginx.
4. **Dashboard**: `npm ci && npm run build` y publicar `dist/` en `/undurraga/`. **Debe ir después de la API**: el dashboard nuevo usa rutas que la API anterior no tiene.

Variables opcionales de la API: `TOTALIZADOR_MAX_M3H` (500) e `INTERVALO_MAX_MINUTOS` (15). `JWT_SECRET` y `JWT_EXPIRES_IN` del `.env` ya no se usan. La tabla `undurraga_users` sigue existiendo (paso 3 de la migración, opcional).
