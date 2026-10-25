# Ranguil Eléctrico (demo)

Versión alternativa del dashboard de Ranguil enfocada en variables eléctricas.
React + Vite + Bootstrap + Chart.js. Consume los mismos endpoints que el original
(`https://app.jteanalytics.cl/ranguil/*`): `snapshot`, `voltaje`, `corriente`,
`caudal`, `presion`, `kwh`, `horometro`, `totalizador`.

```bash
npm install
npm run dev     # http://localhost:5173/ranguil-electrico/
npm run build
```

## Qué calcula

| Sección | Origen |
|---|---|
| Consumo específico (kWh/m³), costo, utilización, productividad | `kwh`, `totalizador`, `horometro` (caché localStorage, ventana de 15 días) |
| Arranques, desbalance de tensión/corriente, eventos de tensión, potencia aparente | `voltaje` + `corriente` crudos (5 min) |
| Curva caudal vs corriente, diagnóstico por cruce | `corriente` + `caudal` + `presion` |
| Mapa de calor hora × día | series crudas de los últimos 15 días |

Las series crudas se mantienen en memoria (≈560 KB por endpoint en 15 días) y los
refrescos piden solo desde el último día recibido; los diarios usan `fetchWithCache`.

## Parámetros a validar con el cliente (⚙ en la UI)

- **Factor kWh** (`lib/config.ts`, por defecto 10): el registro `kwh` del PLC es ~12 veces
  menor que la energía aparente integrada desde V·I, y con factor 1 el consumo específico
  sería 0,07 kWh/m³ (menor al mínimo hidráulico). Confirmar contra el medidor.
- Tarifa ($/kWh), tensión nominal fase-neutro y corriente de placa del motor.
- Las muestras llegan cada 5 min: los arranques y picos de corriente tienen esa resolución.
