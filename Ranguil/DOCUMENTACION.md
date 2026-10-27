# Documentación del proyecto Ranguil

Última revisión: 2026-10-25. Describe el código tal como está en el directorio de trabajo (incluye cambios sin commit).

Los bugs encontrados están en [POSIBLES_BUGS.md](POSIBLES_BUGS.md).

---

## 1. Qué hay en el proyecto

| Carpeta / archivo | Qué es | Tecnología |
|---|---|---|
| `DashboardRanguilReact/` | Dashboard principal (vista de agua y monitoreo eléctrico) | React 19, TypeScript, Vite, Bootstrap, Chart.js |
| `api-ranguil/` | API que lee la telemetría desde PostgreSQL | NestJS 11, TypeORM, PostgreSQL |
| `ranguil-electrico/` | Copia independiente del panel eléctrico | React, Vite (mismo código de `electrico/`) |
| `MonitoreoEstanqueRanguil.py` | Alerta por nivel crítico de estanque | Python, WhatsApp vía UltraMsg |
| `ConnectionMonitorRanguil.py` | Alerta si el equipo deja de enviar datos | Python, WhatsApp vía UltraMsg |
| `Pump.tsx`, `Pipe.tsx`, `Tank.tsx` | Copias idénticas de componentes de `DashboardRanguilReact/src/components/` | — |
| `api-ranguil.zip` | Copia comprimida de la API (versionada en git) | — |

Los datos se generan fuera de este repositorio (PLC / colector). Escriben en la tabla `ssr_ranguil` y en `ssr_ranguil_daily_metrics`, cuyo esquema no está en el repo.

---

## 2. Arquitectura general

```
PLC / colector  ──►  PostgreSQL (RDS)  ──►  api-ranguil (NestJS :3009)  ──►  DashboardRanguilReact (navegador)
                      ssr_ranguil            /snapshot, /nivel, ...            localStorage (caché de días)
                      ssr_ranguil_daily_metrics

Python (cron/servicio)  ──►  lee la API o la BD  ──►  WhatsApp (UltraMsg)
```

- **Frontend:** se sirve bajo la ruta base `/ranguil/` (`vite.config.ts`). Rutas: `/ranguil/` (diagrama de agua) y `/ranguil/electrico` (monitoreo eléctrico).
- **API:** URL pública `https://app.jteanalytics.cl/ranguil/...`. Corre con PM2 (`ecosystem.config.js`) en el puerto 3009.
- **Actualización:** el frontend pide datos cada 120 s. La API cachea cada respuesta 60 s (`app.module.ts`, `CacheModule`).
- **Caché del navegador:** los gráficos de días (totalizador, horómetro, kWh) se guardan en `localStorage` y solo se pide lo que falta desde el último día guardado (`components/fetchWithcache.tsx`). Los datos crudos del panel eléctrico (5 min) se guardan en memoria, no en `localStorage` (`electrico/lib/api.ts`).
- **Zona horaria:** la UI usa `America/Santiago`, pero la API agrupa los días en UTC (ver sección 5).

---

## 3. API (api-ranguil)

Archivos principales: `src/main.ts`, `src/app.module.ts`, `src/metrics/metrics.controller.ts`, `src/metrics/metrics.service.ts`.

Todas las rutas son `GET` y no tienen autenticación.

| Ruta | Parámetros | Respuesta | Cómo se calcula |
|---|---|---|---|
| `/snapshot` | — | `{ snapshot, tiempo_vaciado_est_1, tiempo_vaciado_est_1_formatted, tiempo_vaciado_est_2, tiempo_vaciado_est_2_formatted }` | Último registro de cada `mt_name`. El tiempo de vaciado sale de los dos últimos registros del estanque. |
| `/totalizador` | `start`, `end` (obligatorios) | `[{time: "YYYY-MM-DD", value}]` | Diario: último − primero del día. Cachea días cerrados en `ssr_ranguil_daily_metrics`. |
| `/horometro` | `start`, `end` (obligatorios) | Igual que totalizador (minutos por día) | Igual que totalizador |
| `/kwh` | `start`, `end` (obligatorios) | Igual que totalizador (contador del PLC por día) | Igual que totalizador |
| `/nivel` | `start`, `end` u opcional `limit` (por defecto 100) | `[{time: ISO, value}]` ascendente | Crudo del estanque nuevo (cm) |
| `/nivel2` | Igual que `/nivel` | `[{time: ISO, value}]` | Crudo del estanque antiguo (m) |
| `/caudal` | Igual que `/nivel` | `[{time: ISO, value}]` | Crudo de caudal (l/s) |
| `/voltaje` | `start`, `end` opcionales | `{v1, v2, v3}` cada uno `[{time, value}]` | Sin rango: últimas 6 h |
| `/corriente` | `start`, `end` opcionales | `{i1, i2, i3}` | Sin rango: últimas 6 h |
| `/presion` | `start`, `end` opcionales | `[{time, value}]` | Sin rango: últimas 6 h |

Notas:
- Las rutas diarias sin `start`/`end` lanzan error (`Se requiere rango de fechas válido.`), que el filtro devuelve como 500 genérico.
- Los nombres de sensor en la BD tienen prefijo `SSR_RANGUIL--slave.` (por ejemplo `SSR_RANGUIL--slave.estanque`). La API lo quita en `/snapshot`.

### Módulos y configuración

- `ConfigModule` lee `.env` (variables `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME`, `PORT`).
- `DatabaseConfig` (`src/database/database.config.ts`): PostgreSQL, pool máximo 5, `statement_timeout` 10 s, `synchronize: false`, SSL con `rejectUnauthorized: false`.
- `HttpExceptionFilter`: responde `{success:false, statusCode, message}`. Los errores que no son `HttpException` se devuelven como 500 con "Internal server error".
- CORS: `origin: '*'`.

---

## 4. Frontend (DashboardRanguilReact)

### Estructura

```
src/
├── main.tsx, App.tsx          Rutas: /ranguil/ (Home) y /ranguil/electrico (Electrico)
├── pages/
│   ├── Home.tsx               Diagrama de agua + gráficos (desktop y móvil)
│   ├── Electrico.tsx          Panel de monitoreo eléctrico
│   ├── Loading.tsx, Error.tsx Pantallas de carga y error
├── components/                Gráficos, tarjetas, diagrama SCADA, exportación
│   ├── fetchWithcache.tsx     Caché de días en localStorage
│   ├── ExportToExcel.tsx      Exportación a .xlsx
├── config/estanques.ts        Constantes de estanques (altura, alarma, m³/m, divisor de nivel)
├── electrico/
│   ├── lib/api.ts             Carga de datos crudos (5 min) en memoria
│   ├── lib/electrical.ts      Cálculos: muestras, KPIs, salud, diagnóstico, resumen diario
│   ├── lib/config.ts          Parámetros del usuario (tarifa, factor kWh, V nominal, A placa)
│   ├── lib/time.ts            Utilidades de fecha (zona Santiago y UTC)
│   └── components/            ~15 tarjetas del panel eléctrico
```

### Componentes principales

| Página | Componente | Función |
|---|---|---|
| Home | `ScadaDiagram` | Dibuja estanques, bomba, tuberías e instrumentos con los valores del snapshot |
| Home | `DropdownCard`, `DropDownCardv2/v3/v4` | Gráficos Chart.js (líneas o barras) |
| Home | `ExportModal` → `ExportToExcel` | Exporta un tipo de dato a Excel para un rango de fechas |
| Home, Electrico | `Navbar` | Barra superior; muestra la antigüedad del último dato (verde ≤10 min, amarillo ≤20, rojo >20) |
| Electrico | `HealthScore`, `DiagnosticsCard`, `KpiCard`, `TrendChart`, `EfficiencyChart`, `HeatmapCard`, `DailySummaryTable` | Salud del equipo, hallazgos, KPIs y tablas |
| Electrico | `SettingsModal` | Edita tarifa, factor kWh, tensión nominal y corriente de placa (se guardan en `localStorage`) |

`CaudalChart.tsx` no se usa en ninguna página.

### Flujo de datos en Home

1. Cada 120 s pide en paralelo: `/snapshot`, `/nivel`, `/nivel2`, `/caudal`, `/voltaje`, `/corriente`, `/presion`.
2. Pide con caché de días: `/totalizador`, `/horometro`, `/kwh` (ventana de 15 días, `CHART_DAYS`).
3. Pinta el diagrama con el snapshot y los gráficos con las series.

### Flujo de datos en Electrico

1. `fetchRawSeries()` pide voltaje, corriente, caudal y presión desde el último día recibido (ventana de 15 días).
2. `fetchWithCache` pide kWh, horómetro y totalizador diarios.
3. `buildSamples()` alinea todo en muestras de 5 min. Luego `buildDailyRows()`, `computeHealth()` y `computeFindings()` calculan los indicadores.

---

## 5. Mapeo de variables y transformaciones

Esta sección dice **dónde** se hace cada conversión. Casi todas están en el frontend; la API entrega los valores crudos.

### 5.1 Snapshot (`/snapshot`)

| Variable | Unidad cruda | Backend | Frontend (archivo:línea) | Se muestra como |
|---|---|---|---|---|
| `estanque` | cm | Sin cambio | `Home.tsx:173` `/ DIVISOR_NIVEL_NUEVO (100)`; `Electrico.tsx:288` | m |
| `estanque_2` | m | Sin cambio | `Home.tsx:174` (sin división) | m |
| `caudal` | l/s | Sin cambio | Sin cambio | l/s |
| `freatico` | cm | Sin cambio | `Home.tsx:269` y `ScadaDiagram.tsx` `/100` | m |
| `presion` | décimas de bar | Sin cambio | `Home.tsx:282` `/10`; `Electrico.tsx:287` `/10`; `ScadaDiagram.tsx` `/10` | bar |
| `solar` | ¿mV? | Sin cambio | `Home.tsx:204` y `ScadaDiagram.tsx` `/1000` | "V" (unidad por confirmar) |
| `v1`, `v2`, `v3` | décimas de V | Sin cambio | `Home.tsx:357` `/10`; `Electrico.tsx:132-134` con `V_DIV` | V |
| `i1`, `i2`, `i3` | centésimas de A | Sin cambio | `Home.tsx:354` `/100`; `Electrico.tsx:135-137` con `I_DIV` | A |
| `totalizador` | m³ acumulados | Sin cambio | Sin cambio | m³ |
| `horometro` | minutos acumulados | Sin cambio | `ScadaDiagram.tsx` `formatMinutes` | h m |
| `kwh` | contador del PLC | Sin cambio | `electrical.ts:214` `× kwhFactor` | kWh |
| `automatico`, `bomba`, `falla` | 0/1 | Sin cambio | Se comparan con `=== 1` o `.toString()` | Estados |

El tiempo de vaciado (`tiempo_vaciado_est_*`) lo calcula la **API** (`metrics.service.ts:62-97`) con la pendiente entre los dos últimos registros. El frontend solo muestra el texto formateado.

### 5.2 Series

| Serie | Backend | Frontend | Se muestra como |
|---|---|---|---|
| `nivel` (estanque nuevo) | Crudo, cm | `Home.tsx:221-223` divisor 100 | m |
| `nivel2` (estanque antiguo) | Crudo, m | Sin división | m |
| `caudal` | Crudo, l/s | Sin división | l/s |
| `voltaje` v1-v3 | Crudo | `Home.tsx:324` divisor 10 | V |
| `corriente` i1-i3 | Crudo | `Home.tsx:335` divisor 100 | A |
| `presion` | Crudo | `Home.tsx:343` divisor 10 | bar |
| `totalizador` diario | **Backend:** último − primero del día (`metrics.service.ts:159-181`) | Sin cambio | m³ |
| `horometro` diario | **Backend:** último − primero del día | `Home.tsx:271` `minutesToHHMM` | HH:MM |
| `kwh` diario | **Backend:** último − primero del día | `electrical.ts:214` `× kwhFactor` | kWh reales |

### 5.3 Cálculos del panel eléctrico (`electrical.ts`)

| Cálculo | Fórmula | Línea |
|---|---|---|
| Potencia aparente | `kVA = (V1·I1 + V2·I2 + V3·I3) / 1000` | `:114` |
| Energía del día | `kWh = kWh_PLC × kwhFactor` | `:214` |
| Costo | `kWh × tarifaClpKwh` | `:226` |
| kWh/m³ | `kWh / m³` del día | `:225` |
| kVAh | `Σ kVA × 5/60` | `:219` |
| Factor de potencia implícito | `kWh / kVAh`, solo si el día tiene ≥90 % de muestras | `:231` |
| Desbalance de corriente | `max|Ix − media| / media × 100` (P95 del día) | `:51`, `:229` |
| Estado en operación | Corriente media > 1 A | `:115` |
| Arranques | Transiciones detenida → operando | `:125-134` |
| Salud | Promedio ponderado: tensión 25 %, balance 25 %, arranques 15 %, eficiencia 20 %, carga 15 % | `:320-322` |

### 5.4 Constantes

| Constante | Valor | Archivo |
|---|---|---|
| `NIVEL_MAX_M` | 3.2 m (estanque lleno) | `config/estanques.ts` |
| `NIVEL_ALARMA_M` | 0.5 m | `config/estanques.ts` |
| `M3_POR_M` | 60/7 ≈ 8.57 m³/m | `config/estanques.ts` |
| `DIVISOR_NIVEL_NUEVO` | 100 (cm → m) | `config/estanques.ts` |
| `CHART_DAYS` | 15 días | `components/fetchWithcache.tsx` |
| `SAMPLE_MIN` | 5 min | `electrico/lib/electrical.ts` |
| `RUN_THRESHOLD_A` | 1 A | `electrico/lib/electrical.ts` |
| Configuración por defecto | tarifa 130 CLP/kWh, factor kWh 10, V nominal 220, A placa 15 | `electrico/lib/config.ts` |

---

## 6. Scripts Python

### MonitoreoEstanqueRanguil.py
- Lee los dos últimos registros de cada estanque y calcula la tasa de descenso.
- Si el nivel baja y está bajo `NIVEL_ALERTA`, envía un mensaje por WhatsApp (UltraMsg) con el tiempo estimado de vaciado.
- Lee `.env` (`INTERVALO_MINUTOS`, `NIVEL_ALERTA`, credenciales). Si hay alerta, espera `INTERVALO_MINUTOS`; si no, revisa cada minuto.
- Escribe en `logs.txt`.

### ConnectionMonitorRanguil.py
- Cada 5 min consulta `/snapshot` y toma el registro más reciente de todos los sensores.
- Si ese registro tiene más de 30 min, envía **una** alerta de equipo sin conexión.
- Vuelve a avisar solo si pasaron 24 h desde la última alerta y el equipo sigue desconectado. Al reconectarse se limpia el estado.
- Escribe en `estado_equipo.log`.

---

## 7. Configuración y dependencias

### Variables de entorno

| Variable | Dónde | Uso |
|---|---|---|
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME` | `api-ranguil/.env` y `.env` raíz | Conexión a PostgreSQL. El `.env` raíz también tiene `DB_HOST=localhost` (duplicado). |
| `PORT` | `api-ranguil/.env` | Puerto de la API (3009) |
| `API_URL`, `TOKEN`, `TO` | `.env` raíz | UltraMsg (WhatsApp) |
| `INTERVALO_MINUTOS`, `NIVEL_ALERTA` | `.env` raíz | Parámetros de `MonitoreoEstanqueRanguil.py` |

Los `.env` están en `.gitignore`. **Sin embargo, `api-ranguil.zip` sí está versionado y contiene `api-ranguil/.env`** (ver POSIBLES_BUGS.md).

### Scripts

- `api-ranguil`: `npm run build` (nest build), `npm run start:prod` (node dist/main), `npm run start:dev`.
- `DashboardRanguilReact`: `npm run dev`, `npm run build` (tsc + vite), `npm run lint`.

### Dependencias

- Frontend: `react@19`, `react-router-dom@7`, `chart.js@4`, `react-chartjs-2`, `xlsx@0.18.5`, `file-saver`, `bootstrap@5`, y `botstrap@0.20.1` (sin uso; ver bugs).
- API: `@nestjs/core`, `@nestjs/typeorm`, `@nestjs/config`, `pg`, `class-validator`, `cache-manager`. Falta `@nestjs/cache-manager` (ver bugs).

---

## 8. Cómo verificar

- Frontend: `npx tsc -p tsconfig.app.json --noEmit` y `npx eslint src` pasan sin errores (revisado 2026-10-25).
- Auditoría de dependencias del frontend: `npm audit --omit=dev` reporta 21 vulnerabilidades (4 críticas, 12 altas).
- API: sin `node_modules` en el repo; no se pudo compilar en esta revisión.
