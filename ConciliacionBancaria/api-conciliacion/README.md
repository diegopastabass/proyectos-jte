# api-conciliacion

API de conciliación bancaria: importa cartolas de BancoEstado y de Banco de Chile y el RCV del SII, y permite conciliar movimientos con documentos. Contexto y fases en [../PLAN_IMPLEMENTACION.md](../PLAN_IMPLEMENTACION.md).

## Puesta en marcha

1. Crear la BD y cargar el esquema (en RDS, con un usuario propio y no el de monitoreo):
   ```bash
   createdb conciliacion
   psql -d conciliacion -v ON_ERROR_STOP=1 -f db/001_esquema.sql
   psql -d conciliacion -v ON_ERROR_STOP=1 -f db/002_motor.sql
   ```
2. Copiar `env.example` a `.env` y completarlo. `JWT_SECRET` es obligatorio: la API no arranca sin él.
3. `npm install`
4. Crear el primer administrador (la contraseña se pide por consola):
   ```bash
   npm run crear-admin -- correo@empresa.cl "Nombre Apellido"
   ```
5. Desarrollo: `npm run start:dev`. Producción: `npm run build` y `pm2 start ecosystem.config.js` (puerto 3041).

## Probar un archivo sin tocar la BD

```bash
npm run probar-lectores -- ../Excel_Cartola_Historica_Chequera_Electronica.xlsx ../RCV_VENTA_76907914-9_202610.csv
```

Sirve cuando el banco o el SII cambian el formato: muestra lo que se leyó o el error exacto.

## Datos reales

Las cartolas y los RCV **no van a git**: el `.gitignore` de `ConciliacionBancaria/` excluye `*.xlsx`, `*.csv` y `datos/`. Los tests usan archivos sintéticos con la misma estructura y RUTs inventados.

## Endpoints

Todas las rutas exigen `Authorization: Bearer <token>`, salvo el login. Las rutas `/empresas/:empresaId/...` exigen pertenecer a la empresa. Roles: **lector** solo consulta, **operador** importa y concilia, **admin** gestiona cuentas, categorías y usuarios. El admin global pasa siempre.

| Método | Ruta | Rol | Qué hace |
|---|---|---|---|
| POST | `/auth/login` | público | `{email, password}` → `access_token` (dura 8 h) |
| GET/POST | `/usuarios` | admin global | listar / crear usuarios |
| GET | `/empresas` | — | empresas del usuario, con su rol |
| POST | `/empresas` | admin global | crea la empresa con categorías iniciales |
| PUT | `/empresas/:id/usuarios` | admin | `{usuarioId, rol}` asigna o cambia el rol |
| GET/POST | `/empresas/:id/cuentas` | lector / admin | cuentas bancarias (también se crean solas al importar) |
| GET/POST | `/empresas/:id/categorias` | lector / admin | categorías para gastos sin documento |
| GET/POST | `/empresas/:id/contrapartes` | lector / operador | clientes, proveedores y personas |
| GET/POST | `/empresas/:id/importaciones` | lector / operador | historial / subir archivo (multipart, campo `archivo`) |
| GET | `/empresas/:id/movimientos` | lector | filtros: `cuentaId estado signo desde hasta q pagina porPagina` |
| GET/PATCH | `/empresas/:id/movimientos/:mid` | lector / operador | detalle con conciliaciones / `{ignorado, nota}` |
| GET | `/empresas/:id/documentos` | lector | filtros: `direccion estado conSaldo tipoDte rut folio desde hasta q` |
| GET | `/empresas/:id/documentos/:did` | lector | detalle con pagos y notas de crédito |
| POST | `/empresas/:id/documentos/:ncId/aplicar-nota-credito` | operador | `{documentoId, monto?}` (para compras: su RCV no trae la referencia) |
| DELETE | `/empresas/:id/notas-credito-aplicaciones/:aid` | operador | deshace la aplicación |
| GET/POST | `/empresas/:id/conciliaciones` | lector / operador | listar / conciliar a mano (N:M) |
| DELETE | `/empresas/:id/conciliaciones/:cid` | operador | deshace (no borra) |
| PATCH | `/empresas/:id/contrapartes/:cid` | admin | `{categoriaId}` para conciliarla por categoría (`null` lo revierte) |
| POST | `/empresas/:id/motor/ejecutar` | operador | `{cuentaId?, desde?, hasta?, soloSugerir?}` → resumen |
| GET | `/empresas/:id/sugerencias` | lector | `estado` (por defecto `pendiente`), `scoreMin`; trae movimientos, documentos y categorías |
| POST | `/empresas/:id/sugerencias/:sid/aceptar` | operador | `{alternativa?}`: índice en `alternativas` |
| POST | `/empresas/:id/sugerencias/:sid/rechazar` | operador | no se vuelve a proponer para ese movimiento |
| GET/POST | `/empresas/:id/reglas` | lector / operador | `{nombre, prioridad?, condicion, accion}` |
| PATCH/DELETE | `/empresas/:id/reglas/:rid` | operador | modificar / eliminar |

Ejemplo de conciliación de un abono que paga dos facturas:

```json
{ "lineas": [
  { "movimientoId": 10, "documentoId": 5, "monto": 41650 },
  { "movimientoId": 10, "documentoId": 6, "monto": 30000 }
] }
```

Y un cargo sin documento, como un retiro del dueño: `{ "lineas": [{ "movimientoId": 11, "categoriaId": 2, "monto": 15000 }] }`.

## Motor de sugerencias

`POST /empresas/:id/motor/ejecutar` revisa los movimientos pendientes. Lo que tiene **score ≥ 0,90** se concilia solo (origen `auto`, o `regla`). Lo que queda entre **0,40 y 0,90** pasa a sugerencia para revisar. La lógica está en `src/motor/motor.ts` (una función pura con sus tests en `motor.spec.ts`).

Orden en que decide:

1. **Reglas del usuario** (score 1). Ejemplo: `{"nombre": "Recargas Movistar", "condicion": {"glosaContiene": "MOVISTAR", "signo": "cargo"}, "accion": {"categoriaId": 7}}`. Toda regla exige `glosaContiene` (o una cuenta más un rango de monto), para que no aplique a todo.
2. **Contraparte**, en este orden: RUT en la glosa, luego alias aprendido, luego parecido del nombre. Las palabras raras pesan más ("AUQUINC" identifica, "AGUA POTABLE" casi no). La inicial truncada sirve para descartar: "MARTINEZ ESPINA **L**" no es "MARTINEZ ESPINA EDUARDO".
   - Si la contraparte tiene **categoría**, se usa esa categoría. Así funcionan COPEC → Combustible, la propia empresa → Traspaso y el dueño → Retiro.
   - Si no, se buscan **sus documentos**: el mismo monto, o una combinación de 2 a 6 que sume el monto. Se aceptan facturas emitidas desde 180 días antes del pago hasta 31 días después.
3. **Sin nombre ni RUT** (depósitos): solo el mismo monto, con la factura emitida a lo más 7 días después del pago. Nunca se concilia solo.

Para no equivocarse:

- Si la glosa trae un nombre que **no se reconoce** (por ejemplo, una persona no registrada), **no se propone nada por monto**.
- Un texto que calza con varias contrapartes ("COMITE DE AGUA P") **nunca** se concilia solo. Lo aprendido solo prioriza dentro de ese grupo.
- Si dos pagos compiten por una factura, gana el de mayor score. A igualdad, gana el pago posterior a la emisión.

**Aprendizaje:** cada conciliación con documento guarda "texto de la glosa (o RUT) → contraparte" en `contraparte_alias`. Con 2 confirmaciones de un texto inequívoco ya concilia solo. Deshacer la conciliación descuenta lo aprendido.

### Configuración inicial recomendada

Después de importar el primer RCV de compras:

```bash
# COPEC → "Combustible y peajes": sus cargos se categorizan solos y sus facturas quedan 'excluido'
curl -X PATCH .../empresas/1/contrapartes/<id COPEC> -d '{"categoriaId": <id Combustible y peajes>}'
# El dueño (persona): sus transferencias → "Retiro del dueño"
curl -X POST .../empresas/1/contrapartes -d '{"nombre": "MARTINEZ ESPINA EDUARDO NICOLAS", "tipo": "persona", "categoriaId": <id Retiro del dueño>}'
```

Conviene hacer lo mismo con las personas a las que se transfiere seguido (sueldos, honorarios), usando su categoría correspondiente. La propia empresa ya se crea como "Traspaso entre cuentas propias".

## Qué valida la importación

- **Archivo repetido** (mismo hash) → 409.
- **RUT de la empresa** en la cartola o en el nombre del RCV distinto al de la empresa → 400.
- **Saldo corrido** de la cartola: si una fila no cuadra al peso, el archivo se rechaza (señal de que fue editado o de que cambió el formato).
- **Movimientos repetidos** entre cartolas que se traslapan: se descartan uno por uno (`filasDuplicadas`).
- **Cartola faltante**: si se salta un N° de cartola, se avisa en `advertencias`.
- **RCV de compras** `RECLAMADO` o `NO_INCLUIR`: se rechazan. `PENDIENTE` se acepta con advertencia.
- **Notas de crédito de venta** que traen la factura referenciada se aplican solas.

## Notas técnicas

- Montos en `bigint` (pesos). En TypeScript llegan como `number` (`numero.transformer.ts`).
- Los saldos y estados de documentos y movimientos los recalculan las funciones SQL `recalcular_documentos` y `recalcular_movimientos`, siempre dentro de la misma transacción del cambio.
- Con UPDATE/DELETE, `em.query` de TypeORM devuelve `[filas, cantidad]`. Para UPDATE … RETURNING se usa `actualizarDevolviendo` (`common/auditoria.ts`).
- Una contraparte con categoría deja sus documentos en estado `excluido`. Siguen en la BD (sirven para el IVA), pero no cuentan como deuda por pagar o cobrar.
- Cambios de esquema: nuevo script `db/00N_*.sql` y ajustar `src/entities.ts` (TypeORM no sincroniza).
