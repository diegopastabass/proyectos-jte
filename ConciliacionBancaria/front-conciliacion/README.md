# front-conciliacion

Frontend de la conciliación bancaria. Usa la misma línea que `front-mantenimiento` y `front-cotizaciones`: React 19, Vite, Bootstrap 5.3 y bootstrap-icons, solo modo claro. Consume [`api-conciliacion`](../api-conciliacion/README.md).

## Pantallas

| Ruta | Para qué |
|---|---|
| `#/` | Resumen: avance, por conciliar, sugerencias, por cobrar y por pagar, saldo de cada cuenta |
| `#/bandeja` | Sugerencias del motor: aceptar (o elegir una alternativa), rechazar o conciliar a mano |
| `#/movimientos` | Cartolas con filtros. Clic en una fila → conciliar a mano (varias facturas y/o una categoría), deshacer o ignorar |
| `#/documentos` | RCV de ventas y compras. Clic → pagos y notas de crédito; aplicar notas de crédito de compras |
| `#/importar` | Arrastrar cartolas y RCV. Al terminar busca coincidencias solo |
| `#/configuracion` | Contrapartes (COPEC → Combustible, personas), reglas, categorías, cuentas y usuarios |

Lo que el rol no permite no se muestra: un lector no ve los botones de importar ni de conciliar.

## Desarrollo

```bash
npm install
echo "VITE_API_URL=http://localhost:3041" > .env.development.local   # sin esto usa la API de producción
npm run dev
```

La API tiene que permitir el origen del front en `CORS_ORIGINS` (ej. `http://localhost:5173`).

## Producción

```bash
npm run build      # genera dist/
```

- `dist/` se sirve como archivos estáticos **desde cualquier ruta** (ej. `app.jteanalytics.cl/conciliacion-app/`). Usa `base: "./"` y `HashRouter` (las rutas van tras `#`), así que el servidor no necesita reescrituras.
- Por defecto llama a `https://app.jteanalytics.cl/conciliacion`. Para otra URL: `VITE_API_URL=... npm run build`.
- En la API, `CORS_ORIGINS` debe incluir el origen donde quede el front (ej. `https://app.jteanalytics.cl`).
