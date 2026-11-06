# Plan de implementación: conciliación bancaria autogestionada

Servicio propio, al estilo de Chipax: se cargan los movimientos bancarios y los documentos del SII, el sistema los cruza y el usuario revisa lo que no pudo conciliar solo.

## Decisiones tomadas

| Tema | Decisión | Por qué |
|---|---|---|
| Ingesta bancaria (primera versión) | **Subir cartolas** Excel/CSV descargadas del banco | Es gratis y robusto, y no obliga a guardar credenciales bancarias |
| Ingesta SII (primera versión) | **Subir el CSV del RCV** (compras y ventas) exportado desde el portal | No hay API pública oficial para el RCV |
| Automatización (fase 3) | Agregador (Fintoc u otro) para el banco y worker Python para el SII | Se evalúa cuando el flujo manual esté probado |
| Open Finance (Ley Fintec) | Dejar la interfaz preparada y conectarla cuando la CMF la habilite (2027) | Será el canal estándar |
| Alcance | **Uso 100% interno** | Sin registro público, planes ni términos de uso. Los usuarios los crea un admin |
| Bancos | **BancoEstado y Banco de Chile** | Son los dos que se usan. Otro banco se agrega después con un lector nuevo |
| Multiempresa | Sí, todo cuelga de `empresa_id` | Permite separar varias razones sociales internas y cuesta poco hacerlo desde el inicio |
| Backend | NestJS 11 + TypeORM + PostgreSQL | Igual que `Mantenimiento/api-mantenimiento` y `Cotizaciones/api-cotizaciones` |
| Frontend | React 19 + Vite + axios + react-router | Igual que `front-mantenimiento` |
| Autenticación | JWT + bcrypt, copiando el módulo `auth` de `api-mantenimiento` | Ya está probado en producción |
| Lectura de archivos | **En la misma API (TypeScript)**, no en un worker aparte | Un solo proceso que desplegar. Python se suma en la fase 3 solo para el SII |
| Montos | `bigint` en la unidad mínima (CLP = peso, USD = centavo) + columna `moneda` | Nada de `float` con dinero |
| Esquema de BD | Scripts SQL numerados en `api-conciliacion/db/` (`synchronize: false`) | Se revisan y ejecutan con psql, igual que `jte_mantenimiento_BD.sql`. Las funciones de recálculo de saldos viven en SQL |
| Despliegue | pm2 (`ecosystem.config.js`, puerto 3041) detrás de `app.jteanalytics.cl/conciliacion` | Igual que el resto de las APIs |

## Arquitectura

```
front-conciliacion (React)  ──HTTP/JWT──►  api-conciliacion (NestJS)
                                               │
                                               ├─ modules/importacion     carga de archivos + lectores por banco / RCV
                                               ├─ modules/conciliacion    motor de matching (TS puro, sin dependencias de Nest)
                                               ├─ modules/reglas          reglas del usuario + aprendizaje
                                               ├─ modules/reportes        flujo de caja, CxC, CxP
                                               └─ PostgreSQL (BD propia "conciliacion", usuario con permisos mínimos)

fase 3:  worker-sii (Python)  ──► descarga del RCV ──► misma tabla documento
         conector agregador   ──► movimientos     ──► misma tabla movimiento
```

El motor de conciliación es **una librería TypeScript pura**: recibe movimientos y documentos y devuelve propuestas con puntaje. No toca la BD, así que se prueba con tests unitarios sin levantar nada.

## Estructura de carpetas

```
ConciliacionBancaria/
├── PLAN_IMPLEMENTACION.md
├── api-conciliacion/
│   ├── src/
│   │   ├── auth/  users/  empresas/
│   │   ├── importacion/
│   │   │   ├── lectores/bancoestado.lector.ts, banco-chile.lector.ts
│   │   │   ├── lectores/rcv.lector.ts
│   │   │   └── lector.interface.ts
│   │   ├── conciliacion/
│   │   │   ├── motor/  (TS puro + tests)
│   │   │   └── conciliacion.service.ts / controller.ts
│   │   ├── reglas/  reportes/
│   │   └── database/migrations/
│   └── test/fixtures/      cartolas y RCV anonimizados
├── front-conciliacion/
└── worker-sii/             (fase 3)
```

## Modelo de datos

```sql
empresa            (id, rut, razon_social, creado_en)
usuario            (id, email, hash_password, nombre)
usuario_empresa    (usuario_id, empresa_id, rol)            -- rol: admin | operador | lector

cuenta_bancaria    (id, empresa_id, banco, numero, moneda, alias)

importacion        (id, empresa_id, tipo,                   -- cartola | rcv_compra | rcv_venta
                    archivo_nombre, archivo_sha256, lector, filas_leidas, filas_nuevas,
                    filas_duplicadas, usuario_id, creado_en)

movimiento         (id, empresa_id, cuenta_id, importacion_id,
                    fecha, monto,                            -- con signo: + abono, − cargo
                    glosa, glosa_normalizada, n_documento_banco, saldo,
                    rut_contraparte, nombre_contraparte,     -- extraídos de la glosa
                    categoria_id NULL,                       -- gastos sin documento (comisiones, impuestos)
                    estado,                                  -- pendiente | parcial | conciliado | ignorado
                    hash_dedup UNIQUE(empresa_id, hash_dedup))

documento          (id, empresa_id, importacion_id,
                    direccion,                               -- emitido (venta) | recibido (compra)
                    tipo_dte,                                -- 33, 34, 46, 56, 61, ...
                    folio, rut_contraparte, razon_social,
                    fecha_emision, monto_neto, monto_exento, monto_iva, monto_total,
                    saldo_pendiente,                         -- se recalcula con cada aplicación
                    estado,                                  -- pendiente | parcial | pagado | anulado
                    UNIQUE(empresa_id, direccion, tipo_dte, folio, rut_contraparte))

conciliacion       (id, empresa_id, creado_por, creado_en, origen,   -- auto | regla | manual
                    score, deshecha_en NULL, deshecha_por NULL)
conciliacion_linea (conciliacion_id, movimiento_id, documento_id NULL, monto_aplicado)
                    -- N:M: un pago cubre varias facturas, o una factura se paga en cuotas

categoria          (id, empresa_id, nombre, tipo)            -- gasto_bancario, impuesto, sueldo, ...
regla              (id, empresa_id, prioridad, activa,
                    condicion_json,                          -- {glosa_contiene, rut, monto_entre, signo, cuenta_id}
                    accion_json)                             -- {categoria_id} | {rut_contraparte} | {ignorar}
aprendizaje        (empresa_id, patron_glosa, rut_contraparte, categoria_id, veces_confirmado)

auditoria          (id, empresa_id, usuario_id, accion, entidad, entidad_id, detalle_json, creado_en)
```

Las conciliaciones **no se borran nunca**: deshacer una marca `deshecha_en` y se recalculan los saldos. Con datos financieros tiene que quedar trazabilidad de quién concilió qué.

### Deduplicación de movimientos

Es habitual subir cartolas que se traslapan. Para eso:
1. `hash_dedup = sha256(cuenta_id | fecha | monto | glosa_normalizada | n_documento_banco | ordinal)`. `ordinal` es la posición del movimiento entre los que son idénticos el mismo día dentro del archivo. Así dos pagos iguales el mismo día no se toman como duplicados.
2. Si la cartola trae saldo, se agrega al hash, que pasa a ser prácticamente único.
3. Si se sube el mismo archivo dos veces (`archivo_sha256` igual), se rechaza de inmediato.

## Lo que mostraron los archivos reales (2026-11-02)

Se revisaron 3 cartolas de BancoEstado (N° 31 a 33, del 24/09 al 26/10/2026, 108 movimientos) y el RCV de octubre (116 compras y 41 ventas):

- **La glosa casi nunca trae RUT** (3 de 108). Trae un nombre **truncado a ~35 caracteres**, por ejemplo "TEF BANCOESTADO DE COMITE DE AGUA P". Entonces el nivel 1 del motor (por RUT) casi no se va a usar, y lo que pesa es **el nombre y lo aprendido** (`contraparte_alias`).
- **Muchas facturas comparten monto** (41.650 o 71.028 con varios clientes; COPEC por 20.000 o 40.000 decenas de veces). El cruce solo por monto (nivel 5) es peligroso: en una prueba, una transferencia a una persona por 25.000 calzaba con una factura COPEC por el mismo monto. **Regla nueva:** si la glosa trae un nombre que no se parece al del documento, no se sugiere aunque el monto calce.
- **Transferencias a personas** (el dueño, terceros) y **entre cuentas propias** ("TEF A SERVICIOS AUTOMATIZACION EDUA") son frecuentes y no tienen documento: van a categorías ("Retiro del dueño", "Traspaso entre cuentas propias").
- **COPEC:** muchos cargos redondos (20.000, 40.000) contra muchas facturas. **Decidido (2026-11-02): se concilia como categoría "Combustible y peajes"**; sus facturas quedan `excluido`.
- **Depósitos en efectivo y con documentos** no traen contraparte: solo se pueden cruzar por monto y fecha, y quedan como sugerencia.
- El RCV de **ventas sí trae la referencia** de las notas de crédito (se aplican solas). El de **compras no**: se aplican a mano.
- La cartola trae las fechas **sin año** y el **saldo corrido**, que cuadró al peso en las 3 cartolas: sirve para validar cada archivo.

## Cartola de Banco de Chile: lo que mostró el archivo real (2026-11-02)

`CartolaEmitida.xls` (cuenta corriente, octubre 2026, 266 movimientos) **no es un Excel**: es texto plano separado por `;`, con la extensión `.xls`. Primera línea `<nombre>(<RUT con cero inicial>) cta:<número>`, segunda línea el encabezado y luego una fila por movimiento: `Fecha;Detalle Movimiento;Cheque o Cargo;Deposito o Abono;Saldo;Docto. Nro.;Trn;Caja;Sucursal`.

- **Formato:** fecha con año (`dd/mm/aaaa`); montos con signo y ceros a la izquierda (`+0000500000`); `Detalle` de 40 caracteres fijos (nombres cortados); `Docto. Nro.`, `Trn` y `Caja` siempre en cero (no hay N° de operación). No trae N° de cartola ni saldo inicial/final: se deducen del saldo corrido, que cuadró al peso en las 266 filas (de $0 a $0).
- **Es una cuenta con línea de crédito:** el saldo es negativo en 241 de 266 filas. Las 24 «TRANSFERENCIA DESDE LINEA DE CREDI» (abonos, $2,7 M) y las 9 «AMORTIZACION A LINEA DE CREDITO» (cargos, $2,7 M) casi se anulan entre sí y no son ingresos ni gastos.
- **Glosas:** `APP-TRASPASO A:` / `TRASPASO A:` (transferencias enviadas, nombre como el alias del beneficiario), `APP-TRASPASO DE:` / `TRASPASO DE:` (recibidas), `PAGO:` (compras con tarjeta en comercios y peajes) y operaciones bancarias sueltas.
- **RUT escondido:** los abonos `PAGO:PROVEEDORES 0765177979` traen el RUT del cliente como `0` + cuerpo + DV (`76.517.797-9`). Los 5 que hay calzan con una factura de venta por monto exacto. Hoy `extraerRut` no los reconoce.
- **Resuelto (2026-11-03):** lector `bancochile.lector.ts` (texto plano y xlsx, por contenido). Corrige RUT con ceros a la izquierda y montos con `+`, valida el saldo corrido, deduce saldo inicial/final y período, y extrae el RUT de `PAGO:PROVEEDORES`. También acepta cartolas parciales que se traslapan y avisa de huecos por saldo y fecha. Un `.xls` binario, un PDF o una página web guardada como `.xls` se rechazan con un mensaje que dice qué hacer.
- **Resultado con el archivo real (sin configurar nada):** 266 movimientos importados, 21 conciliados solos (todos correctos: 5 clientes por el RUT de la glosa, 11 compras con tarjeta por nombre y monto, 5 traspasos propios y del dueño). El resto es configuración: personas, línea de crédito, combustible y peajes.
- **Pendiente de producto:** abonos del dueño se concilian como «Retiro del dueño» (conviene una categoría «Aporte del dueño»); pagos parciales de una misma factura en varias transferencias.

## Motor de conciliación

> **Estado al 2026-11-02:** implementado. Con las 3 cartolas de BancoEstado y el RCV de octubre, en la primera corrida, de 108 movimientos: **54 se concilian solos (50 %), todos revisados y correctos**, **15 quedan como sugerencia** y **39 sin propuesta**. Las 54 automáticas: 13 COPEC → Combustible, 29 retiros del dueño, 8 traspasos, 1 regla Movistar y 3 facturas. Los 39 sin propuesta son en su mayoría transferencias a personas no registradas (Valenzuela, Tapia, Vilches, Martínez Espina L/D), pagos de septiembre cuyas facturas no están en el RCV de octubre, y depósitos sin factura del mismo monto.
>
> Diferencias con el diseño original: los umbrales son 0,90 (automático) y 0,40 (sugerencia), y se agregó la **contraparte con categoría** (COPEC, la propia empresa, el dueño). El detalle está en `api-conciliacion/README.md`, sección "Motor de sugerencias".

Entrada: movimientos pendientes y documentos con saldo. Los **abonos** se cruzan con documentos **emitidos** (cobros). Los **cargos**, con documentos **recibidos** (pagos).

**Preparación**
- La glosa se normaliza: mayúsculas, sin tildes y con espacios colapsados.
- El RUT se saca de la glosa con regex y se **valida el dígito verificador (módulo 11)** para descartar números que no son RUT.
- El folio se saca de la glosa si aparece (por ejemplo "FACT 1234", "F1234", "FOLIO 1234").
- Se aplica el `aprendizaje`: si esa glosa ya se asoció antes a un RUT, se usa ese RUT.

**Niveles de cruce** (se evalúan en orden; gana el primero que supera el umbral):

| Nivel | Criterio | Score base |
|---|---|---|
| 1 | RUT igual + monto = saldo pendiente + fecha dentro de la ventana (por defecto −5/+60 días desde la emisión) | 0,95 |
| 2 | Folio en la glosa + monto = saldo pendiente | 0,95 |
| 3 | Folio en la glosa + RUT igual, con monto distinto (pago parcial) | 0,80 |
| 4 | RUT igual + **combinación de 2 a 6 documentos** cuya suma es exactamente el monto | 0,85 (baja si hay más de una combinación posible) |
| 5 | Sin RUT, pero el monto calza exacto con **un único** documento pendiente dentro de la ventana | 0,60 |
| 6 | Reglas del usuario: categorizan sin documento (comisiones, impuestos, sueldos) | 1,00 (las define el usuario) |

**Ajustes al score**
- Más de un candidato con el mismo score: −0,3 y nunca se concilia solo.
- Cercanía en fecha: hasta +0,05.

**Umbrales** (configurables por empresa)
- `score ≥ 0,90` → se concilia solo (`origen = auto`).
- `0,50 ≤ score < 0,90` → queda en la bandeja de sugerencias.
- `score < 0,50` → se descarta.

El nivel 4 es un problema de *subset-sum*. Se acota a los documentos pendientes del mismo RUT (como máximo unos 30) y a combinaciones de hasta 6. Con montos enteros se resuelve por búsqueda con poda, en milisegundos.

**Casos chilenos**
- **Nota de crédito (61):** resta del saldo de la factura que referencia. En ventas el RCV trae la referencia y se aplica sola al importar. En compras no la trae: se aplica a mano (`POST .../aplicar-nota-credito`), con sugerencia por mismo RUT y monto.
- **Factura exenta (34) y factura de compra (46):** se cruzan por `monto_total` igual que las demás. En la 46, el IVA lo retiene quien compra.
- **Boletas de honorarios:** no están en el RCV. Se importan en la fase 2 desde el informe de BHE recibidas del SII, y se cruzan contra el **monto líquido** (retención 2026: 15,25%).
- **Transbank:** los abonos llegan agrupados y con la comisión ya descontada. Se resuelven en la fase 2 importando la liquidación de Transbank.
- **Boletas de venta (39/41):** el RCV trae un resumen diario, no el detalle. No se concilian una por una. Se agrupan con Transbank o con depósitos.

## API (primera versión)

```
POST   /auth/login
GET    /empresas                         empresas del usuario
POST   /empresas/:id/cuentas

POST   /empresas/:id/importaciones       multipart: archivo + tipo + cuenta_id (detecta el banco si se omite)
GET    /empresas/:id/importaciones

GET    /empresas/:id/movimientos         ?estado=&cuenta=&desde=&hasta=&q=
GET    /empresas/:id/documentos          ?direccion=&estado=&rut=&desde=&hasta=
POST   /empresas/:id/conciliacion/ejecutar    corre el motor sobre lo pendiente
GET    /empresas/:id/conciliacion/sugerencias
POST   /empresas/:id/conciliaciones      manual: {movimientos[], documentos[], montos[]}
POST   /empresas/:id/conciliaciones/:cid/aceptar     acepta una sugerencia
DELETE /empresas/:id/conciliaciones/:cid             deshacer (soft)

GET    /empresas/:id/reglas  · POST · PATCH · DELETE
GET    /empresas/:id/reportes/resumen     % conciliado, pendientes por cobrar y por pagar
```

Todos los endpoints validan que el usuario pertenezca a `empresa_id` mediante un guard común.

## Pantallas del frontend

1. **Login** y selector de empresa.
2. **Importar:** arrastrar el archivo. Muestra el banco detectado, cuántas filas son nuevas y cuántas duplicadas, y los errores por fila.
3. **Bandeja de conciliación** (la pantalla principal): movimientos pendientes a la izquierda y la sugerencia con su score a la derecha. Teclas para aceptar, rechazar, buscar documento o categorizar.
4. **Movimientos** y **Documentos**: tablas con filtros y estado.
5. **Reglas:** crear desde un movimiento ("siempre que la glosa contenga X → categoría Y").
6. **Resumen:** % conciliado del mes, cuentas por cobrar y por pagar con antigüedad (0–30, 31–60, 61–90, >90 días).

## Fases

### Fase 0: insumos y base del proyecto
- [x] Cartolas de BancoEstado (xlsx) y de Banco de Chile (`CartolaEmitida.xls`, texto, octubre 2026).
- [ ] Cartola de Banco de Chile **en Excel real**, si el portal la ofrece: el lector ya la acepta (mismas columnas), pero solo está probado con un xlsx sintético.
- [x] CSV del RCV de compras y ventas (octubre 2026).
- [x] `api-conciliacion` (Nest 11 + TypeORM 0.3, como Mantenimiento). Auth reescrito a partir del de Mantenimiento: el token expira, no hay secreto por defecto, se valida el body y hay permisos por empresa.
- [x] `front-conciliacion` con Vite + React 19 + Bootstrap 5.3 (la misma línea que Mantenimiento y Cotizaciones, solo modo claro).
- [x] Esquema `db/001_esquema.sql`, probado en Postgres 18. **Pendiente: crear la BD y su usuario en RDS.**
- [x] `env.example` (sin punto inicial, porque el `.gitignore` raíz excluye `.env.*`).

**Listo cuando:** se puede hacer login contra la API local y las migraciones corren limpias.

### Fase 1: primera versión usable
- [x] Interfaz `LectorCartola` + lectores de **BancoEstado** y **Banco de Chile** (texto plano y xlsx, detectados por contenido; 2026-11-03).
  - Revisar en las cartolas reales cómo trae cada banco el RUT y el nombre de la contraparte en las transferencias. De eso depende que funcione el nivel 1 del motor.
  - xlsx con `exceljs` y csv con `csv-parse`. Si algún banco entrega `.xls` antiguo, se usa SheetJS (**desde cdn.sheetjs.com, no la versión de npm**, que está desactualizada).
- [x] Lector del RCV (compras y ventas), probado con los archivos reales.
- [x] Endpoint de importación con deduplicación, validación del RUT de la empresa, aviso de cartola faltante y notas de crédito automáticas.
- [x] Motor de sugerencias (`src/motor/`), con tests unitarios sobre casos sacados de los datos reales. Ver detalle abajo.
- [x] Conciliación manual N:M y deshacer (más aplicar/deshacer notas de crédito a mano).
- [x] Pantallas: resumen, importar (busca coincidencias solo al terminar), bandeja de sugerencias, movimientos con conciliación manual, documentos con notas de crédito y configuración (contrapartes, reglas, categorías, cuentas y usuarios).
- [x] `auditoria` para importaciones, conciliaciones, notas de crédito y usuarios.
- [x] API desplegada en `app.jteanalytics.cl/conciliacion` con pm2, esquema 001+002 y primer admin creado (2026-11-02).
- [ ] Volver a desplegar la API (endpoints nuevos para el front) y publicar `front-conciliacion/dist/`.

**Listo cuando:** con un mes real de una empresa se importa todo, se concilia solo al menos el 60% y el resto se puede resolver desde la bandeja.

### Fase 2: precisión y reportes
- [x] Nivel 4 (un pago cubre varias facturas), adelantado a la fase 1.
- [x] Reglas del usuario + categorías (API). **Pendiente:** "crear regla desde este movimiento" en el front.
- [x] Aprendizaje: glosa (o RUT) → contraparte en `contraparte_alias`, usado por el motor.
- [x] Notas de crédito asociadas a su factura (adelantado a la fase 1).
- [ ] Importar BHE recibidas (honorarios líquidos).
- [ ] Importar la liquidación de Transbank y cruzarla con sus abonos agrupados.
- [ ] Reporte de resumen, cuentas por cobrar y por pagar con antigüedad, y exportar a Excel.

**Listo cuando:** se concilia solo el 85% o más de un mes típico.

### Fase 3: ingesta automática
- [ ] Evaluar un agregador (Fintoc, Floid, Prometeo): precio y requisitos, y confirmar que cubra **cuentas empresa** de BancoEstado y Banco de Chile. Fintoc exige empresa con 6 meses de actividad y cuenta a nombre de la empresa. Prometeo anunció un acuerdo con BancoEstado.
- [ ] `ConectorBancario` con la misma salida que `LectorCartola`, para que el resto del sistema no cambie.
- [ ] `worker-sii` (Python) que descarga el RCV automáticamente y lo deja en `documento`. Las credenciales SII se guardan **cifradas** (gestor de secretos o, como mínimo, cifrado con una clave fuera de la BD).
- [ ] Conciliación programada (cron diario) + aviso por WhatsApp/correo con los pendientes. Para WhatsApp se puede reutilizar UltraMsg, que ya usan los monitores.

### Fase 4: Open Finance
- [ ] Cuando la CMF habilite el Sistema de Finanzas Abiertas, implementar un `ConectorBancario` sobre esa API.

## Seguridad

- En la fase 1 **no se guardan credenciales** de bancos ni del SII. Solo se suben archivos.
- BD y usuario de Postgres propios, separados de los de monitoreo.
- Los archivos subidos se procesan en memoria y no se guardan (solo se guarda su `sha256`). Si después hace falta conservarlos, se cifran.
- Guard por empresa en todos los endpoints, con un test que confirme que el usuario A no ve datos de la empresa B.
- Al ser interno no hay registro abierto: los usuarios los crea un admin. Igual se respeta la ley de datos personales (Ley 21.719) con los datos de clientes y proveedores (RUT, nombres).

## Pendientes por confirmar

- **¿Cuántas razones sociales y cuántos movimientos al mes?** Con menos de unos 10.000 movimientos al mes por empresa no hace falta optimizar nada especial.
- **¿Quiénes lo van a usar y con qué permisos?** Por ejemplo: quién concilia y quién solo mira reportes. Con eso se definen los roles (`admin | operador | lector`).
