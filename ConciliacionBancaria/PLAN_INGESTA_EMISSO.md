# Plan: ingesta automática de RCV y cartolas con Emisso

Fecha: 2026-11-21. Concreta la **Fase 3** de `PLAN_IMPLEMENTACION.md` y la recomendación de `INVESTIGACION_INGESTA_AUTOMATICA.md`, ahora con un proveedor único. Fuente: la documentación pública de Emisso (`https://connect.emisso.ai/docs`, en markdown en `/llms.txt` y con contrato en `/docs/openapi.json`), revisada en esta fecha.

## 1. Veredicto

**Sí sirve, y cubre las tres fuentes con un solo proveedor**: el RCV del SII, BancoEstado Empresas y Banco de Chile Empresas. Reemplaza la combinación que proponía la investigación (BaseAPI o API Gateway para el SII y Fintoc para los bancos).

| A favor | En contra |
|---|---|
| Un contrato, una API REST y una sola forma de leer las tres fuentes | **BancoEstado no tiene carga histórica**: solo trae el mes en curso. Lo anterior se sigue subiendo a mano (Fintoc ofrecía 12 meses) |
| **Nosotros no guardamos ninguna clave**: la empresa la entrega en un enlace de Emisso de un solo uso. Solo guardamos la API key y los `conn_…`. Esto elimina la tabla de credenciales cifradas que proponía la investigación | **BancoEstado admite una sola sesión por usuario**: mientras Emisso sincroniza (cada 4 h), esa persona no puede entrar al portal, y si está dentro la sincronización falla (`409`) |
| Emisso sincroniza solo cada 4 h; nosotros solo leemos lo ya guardado (lectura instantánea, sin esperar al banco) | No es un canal oficial: igual que los otros intermediarios, entra al portal con la clave del usuario. El riesgo de que el banco o el SII cambien el portal lo asume Emisso |
| Banco de Chile y BancoEstado entregan la **contraparte con RUT y nombre** ya separados: mejora directa para el motor | Proveedor nuevo: hay que conservar la subida manual como respaldo (ya existe) |
| SII con histórico desde agosto de 2017 (con plan pagado) | BancoEstado no entrega un id por movimiento y puede reemplazar o recalcular movimientos: obliga a diseñar bien la deduplicación (sección 4) |
| Costo bajo y predecible: US$10 por conexión al mes | Los datos de personas naturales pasan por un tercero: hace falta un contrato de encargo de datos (Ley 21.719, vigente desde el 1 de diciembre de 2026) |

## 2. Lo que ofrece, aplicado a este proyecto

### 2.1 Modelo de Emisso

- **Conexión** (`conn_…`) = una empresa conectada a un sistema. Una empresa con SII, BancoEstado y Banco de Chile son **3 conexiones**. Las varias cuentas de un mismo banco van en la misma conexión.
- **Dos pasos para leer**: `*.conexion.sincronizar` encola el trabajo contra el banco o el SII; `*.consultar` lee lo ya guardado al instante y nunca contacta al sistema. Emisso sincroniza solo cada 4 h, así que en régimen normal **solo llamamos a `consultar`**.
- **REST**: `POST https://connect.emisso.ai/api/v1/tools/{toolId}/execute` con `Authorization: Bearer connect_sk_…`, header `X-Connect-Connection: conn_…` y cuerpo `{"input": {...}}`. Paginación con `cursor` opaco.
- **Alta de una empresa**: `conexiones.enlace.crear` devuelve una URL `https://connect.emisso.ai/c/…` que la persona abre para entregar su clave. Vence y sirve una vez. Hay que mostrarla con su dominio completo y diciendo quién la pide, nunca como un aviso del banco o del SII.
- **Estado**: `conexiones.estado.consultar` (credencial vigente, trabajos recientes, `datosListos`) y `GET /v1/syncs/{jobId}` (resultado por alcance en `outcomes`).
- **Webhooks** firmados (Standard Webhooks): `sync.succeeded`, `sync.failed`, `connect_session.consumed`. No están en la prueba gratuita.
- **Límites**: 2.000 llamadas por conexión al mes.

### 2.2 Las tools que usaríamos

| Fuente | Sincronizar (solo bajo demanda) | Leer | Campos clave |
|---|---|---|---|
| SII | `sii.conexion.sincronizar` con `alcances: ["rcv"]` y `periodo` | `sii.rcv.consultar` con `periodo` y `perspectiva` (`ventas`/`compras`) | `tipoDte`, `folio` (texto), `rutEmisor`, `rutReceptor`, `razonSocial` (de la contraparte), `fechaEmisionDate`, montos enteros, `estado` (`registro`, `pendiente`, `no_incluir`, `reclamado`), `tipoDocRef`, `folioDocRef`, `fechaAcuse`, `fechaReclamo`, y `sincronizacion.completo` |
| BancoEstado | `banco_estado.conexion.sincronizar` con `alcances: ["saldos","movimientos"]` | `banco_estado.movimientos.consultar` con `periodo` y `estado: "definitivo"` | `numeroCuenta`, `fecha`, `descripcion`, `documento`, `monto` (sin signo), `type`, `saldo`, `oficina`, `estado` (`provisorio`/`definitivo`), `counterparty.{name,rut}`. **Sin id por movimiento** |
| Banco de Chile | `bch_empresas.conexion.sincronizar` con `alcances: ["saldos","movimientos","cartolas"]` | `bch_empresas.movimientos.consultar`; para cuadrar, `bch_empresas.cartolas.consultar_v2` y `.cartolas.detalle` | `id` (del banco), `numeroCuenta`, `currency`, `fechaContable`, `monto`, `type`, `saldoContable`, `descripcion`, `counterparty.{name,rut,bank,account}`, `comentario` |

Trampas del contrato que el conector tiene que respetar:

- **Signo invertido**: `type: "debit"` es plata que **entra** (abono, `+`) y `"credit"` la que **sale** (cargo, `−`), según el libro del banco.
- En Banco de Chile, `periodo` filtra por el mes con que se sincronizó, no por la fecha del movimiento.
- En el SII, `folio` viene como texto y `fechaEmision` en `DD/MM/AAAA`: usar `fechaEmisionDate`. Una lista vacía con `sincronizacion: null` significa "mes no cargado", no "cero documentos".
- Alrededor del 1 % de los documentos recibidos aparece días después en el SII: hay que releer también el mes anterior.

### 2.3 Histórico al conectar

| Fuente | Al conectar | Hacia atrás |
|---|---|---|
| SII | Mes actual y los dos anteriores | Desde agosto de 2017, con plan pagado («Cargar histórico») |
| Banco de Chile | 3 meses | Lo que conserve el banco |
| BancoEstado | Mes actual | **Nada**: el historial se arma desde el día en que se conecta |

### 2.4 Costo

Plan Starter, precios sin IVA, cobrados en pesos con IVA:

| Escenario | Conexiones | Al mes |
|---|---|---|
| 1 empresa (SII + BancoEstado + Banco de Chile) | 3 | **US$30** |
| 2 empresas, mismas fuentes | 6 | US$54 en Pro (6 × US$9, sobre el mínimo de US$45) |

Llamadas: leer dos meses cada 4 h, con dos o tres páginas por lectura, son unas 700–1.100 llamadas por conexión al mes, bajo el cupo de 2.000. Si se acerca al cupo, se lee el mes anterior una vez al día en vez de cada 4 h.

La **prueba gratuita dura solo 7 días** (hasta 4 conexiones, sin webhooks, SII con 3 meses). La fase 0 tiene que estar preparada antes de abrir la cuenta.

## 3. Arquitectura propuesta

Sigue la idea de la investigación: **cada conector produce las mismas estructuras que los lectores de archivos** (`CartolaLeida` y `RcvLeido` de `lector.types.ts`) y pasa por `importacion.service`. El motor, los saldos, las contrapartes y la aplicación de notas de crédito no cambian.

```
Emisso (sincroniza solo cada 4 h)
   │  REST: *.consultar
   ▼
api-conciliacion / módulo ingesta
   EmissoClient ── conectores (sii, banco_estado, bch_empresas)
        │               │ mapean a RcvLeido / CartolaLeida
        │               ▼
        │        ImportacionService (guardarRcv / guardarCartola, con origen 'api')
        │               ▼
        │        documento / movimiento  ──►  motor/ejecutar  ──►  bandeja
        └── job programado (@nestjs/schedule) + «Sincronizar ahora» + webhook (fase 5)
```

### 3.1 Piezas nuevas en la API

- **`EmissoClient`**: `fetch` nativo de Node, Bearer desde `EMISSO_API_KEY`, header de conexión, iterador de páginas por `cursor`, reintentos con backoff ante `429 rate_limited` y `409 connection_busy`, y errores tipados (`428 connection_credential_required` → la conexión pide reconectar; `402 billing_past_due` y `429 quota_exceeded` → pausar sin reintentar).
- **Conectores**: `ConectorRcv.leer(conexion, periodo): RcvLeido[]` (uno por perspectiva) y `ConectorBanco.leer(conexion, periodo): CartolaLeida[]` (uno por cuenta). Son funciones puras de mapeo, testeables con JSON sintético.
- **`IngestaService`**: recorre las conexiones activas, lee el mes en curso y el anterior, llama a `ImportacionService` y, si entró algo nuevo, ejecuta el motor (lo mismo que `POST motor/ejecutar`).
- **Job**: `@nestjs/schedule` cada 4 h, desfasado unos 30 minutos de la cadencia de Emisso; para BancoEstado, después de las 04:00 (cierre nocturno).

### 3.2 Esquema (`db/004_ingesta.sql`)

```sql
CREATE TABLE conexion_externa (
    id                integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    empresa_id        integer NOT NULL REFERENCES empresa (id),
    proveedor         text    NOT NULL DEFAULT 'emisso',
    sistema           text    NOT NULL CHECK (sistema IN ('sii', 'banco_estado', 'bch_empresas')),
    connection_id     text    NOT NULL UNIQUE,          -- conn_… (no es secreto)
    activa            boolean NOT NULL DEFAULT true,
    ultima_lectura_en timestamptz,
    ultimo_error      text,
    creado_en         timestamptz NOT NULL DEFAULT now(),
    UNIQUE (empresa_id, sistema)
);

-- Desde qué fecha manda la API en cada cuenta (ver 4.1).
ALTER TABLE cuenta_bancaria ADD COLUMN api_desde date;

ALTER TABLE importacion ADD COLUMN origen text NOT NULL DEFAULT 'archivo' CHECK (origen IN ('archivo', 'api'));
ALTER TABLE importacion ALTER COLUMN usuario_id DROP NOT NULL;   -- las del job no tienen usuario

ALTER TABLE movimiento ADD COLUMN id_externo text;               -- id del banco (Banco de Chile)
CREATE UNIQUE INDEX ON movimiento (cuenta_id, id_externo) WHERE id_externo IS NOT NULL;
```

En una importación por API, `archivo_nombre` queda como `emisso:banco_estado:2026-11` y `archivo_sha256` es el hash del contenido normalizado. Así, una lectura idéntica a la anterior choca con el `UNIQUE (empresa_id, archivo_sha256)` y no crea una importación vacía cada 4 h.

### 3.3 Pantallas

- **Configuración → Conexiones** (admin): las tres fuentes por empresa, con estado, última lectura y último error. Botones:
  - «Conectar» o «Reconectar»: crea el enlace y lo muestra con su dominio y un texto que explica quién lo pide y para qué, para copiarlo o abrirlo.
  - «Sincronizar ahora»: llama a `sincronizar` y sigue el `jobId`.
  - «Leer ahora»: solo `consultar`.
- **Resumen**: "Datos al día hasta…" por fuente, y un aviso si una conexión pide reconectar.
- **Importar**: la subida manual se mantiene. En una cuenta con `api_desde`, avisa que las filas desde esa fecha las trae la API.

## 4. Deduplicación y consistencia

Es la parte delicada. Hoy `hash_dedup` = `(cuenta, fecha, monto, glosa normalizada, n° operación, saldo, orden si no hay saldo)`, y un documento se identifica por `(empresa, dirección, RUT, tipo, folio)`.

### 4.1 Corte por cuenta entre archivo y API

La glosa de Emisso no tiene por qué coincidir carácter a carácter con la de nuestros lectores de Excel, así que los hashes de las dos fuentes no se pueden comparar. La regla:

- Al activar la API en una cuenta, `api_desde` = día siguiente al último movimiento importado desde archivo.
- La API solo inserta movimientos con `fecha >= api_desde`.
- La subida manual solo inserta movimientos con `fecha < api_desde`, para completar historia (en BancoEstado, la única forma de tener meses anteriores) y avisa cuántas filas omitió.
- Así ningún día queda con dos fuentes, y cambiar de fuente es mover una fecha.

### 4.2 Bancos

| | Banco de Chile | BancoEstado |
|---|---|---|
| Identidad | `id_externo` = `id` del banco | No hay id: hash propio **sin saldo**, porque el banco puede recalcularlo: `(cuenta, fecha, monto con signo, documento, descripción normalizada, n-ésima repetición idéntica del día)` |
| Provisorios | Emisso ya deja fuera los que no traen hora | Leer solo `estado: "definitivo"` |
| Fecha | `fechaContable` (la de la cartola); si falta, el día de `fechaMovimiento` | `fecha` |
| Contraparte | `counterparty.rut` y `.name` → `rut_contraparte` y `contraparte_texto` (hoy se infieren de la glosa) | Igual, cuando Emisso la pudo leer |
| Glosa | `descripcion` + `comentario` si viene | `descripcion` |
| Moneda | Solo `currency: "CLP"` mientras las cuentas sean en pesos | Siempre CLP |

- Un movimiento que ya insertamos y que después el banco deja de mostrar **no se borra**: puede tener conciliaciones encima. Se informa como advertencia de la importación. Al leer solo definitivos, debería ser raro.
- La continuidad de saldos (`revisarContinuidad`) sigue funcionando con `saldo` y `saldoContable`.

### 4.3 RCV

- `perspectiva: ventas` → `rcv_venta` (emitido) con contraparte `rutReceptor`; `compras` → `rcv_compra` (recibido) con contraparte `rutEmisor`. Se valida que el otro RUT sea el de la empresa.
- Compras: solo `estado` `registro` y `pendiente`, igual que el lector del CSV.
- `folio` y `folioDocRef` se pasan a número; `fechaRecepcion` viene solo con la fecha.
- Si `sincronizacion.completo` no es `true`, se importa lo que haya y queda una advertencia.
- Se mantiene el insert-or-ignore: un documento ya cargado no se pisa.
- **Mejora posible** (fase 5): un documento `pendiente` que después aparece `reclamado` hoy queda como deuda. Con la API se puede detectar y avisar o anular si no tiene conciliaciones.

## 5. Fases

### Fase 0 · Validación, sin código (en la prueba de 7 días)

Preparar antes de abrir la cuenta: quién entrega cada clave, el CSV del RCV y las cartolas en Excel del mes en curso para comparar, y un horario acordado para BancoEstado.

1. Crear la organización y una API key con `conexiones:read`, `conexiones:write`, `sii:read`, `banco_estado:read` y `bch_empresas:read`.
2. Conectar el SII, BancoEstado y Banco de Chile de una empresa desde el panel.
3. Comparar con `curl` o con el panel:
   - RCV de ventas y compras de un mes contra el CSV: cantidad, totales y folios.
   - Movimientos del mes de cada banco contra la cartola en Excel: montos, signo, saldos, glosas y qué tan seguido viene `counterparty`.
4. Probar la sesión única de BancoEstado: qué pasa si alguien está en el portal durante una sincronización.
5. **Decisión**: seguir o no. Guardar respuestas reales anonimizadas como base de los JSON sintéticos de los tests (los datos reales no van a git).

### Fase 1 · Base

`db/004_ingesta.sql`, entidad `ConexionExterna`, variables `EMISSO_API_KEY` y `EMISSO_BASE_URL`, `EmissoClient` con tests (paginación, errores, reintentos) y refactor de `ImportacionService` para aceptar una lectura con `origen: 'api'` y sin archivo.

### Fase 2 · RCV

Conector SII, lectura del mes en curso y el anterior, endpoint para leer bajo demanda y tests de mapeo. Correrlo en paralelo con la subida del CSV de un mes y cuadrar.

### Fase 3 · Bancos

Conectores de BancoEstado y Banco de Chile, `api_desde` por cuenta, la deduplicación de la sección 4 y tests (signo invertido, repeticiones idénticas en el día, saldo recalculado, corte por fecha).

### Fase 4 · Pantallas y job

Configuración → Conexiones, enlace de conexión, «Sincronizar ahora», job cada 4 h y estado en Resumen.

### Fase 5 · Automatización completa

- Motor tras cada ingesta con datos nuevos.
- Webhook `POST /webhooks/emisso` con verificación de firma sobre el cuerpo crudo: al llegar `sync.succeeded` se lee esa conexión, y el job queda de respaldo.
- Aviso de pendientes o de conexión caída por WhatsApp (UltraMsg, como los monitores).
- Detección de documentos reclamados.

Cada fase se puede desplegar por separado: con la 2 ya se deja de subir el RCV a mano.

## 6. Riesgos

| Riesgo | Mitigación |
|---|---|
| Emisso deja de operar o falla un conector | La subida manual sigue disponible. Quitar `api_desde` devuelve la cuenta al modo archivo |
| La sesión única de BancoEstado bloquea a quien usa el portal | Acordar con esa persona; si molesta, crear un usuario de BancoEstado solo de consulta para Emisso |
| Un movimiento cambia o desaparece después de importado | Solo definitivos, hash sin saldo, sin borrar nunca y con advertencia |
| Documentos que el SII publica tarde | Releer siempre el mes anterior |
| Credencial vencida o cambiada (`428`) | Estado visible en Conexiones y aviso; nunca reintentar con la clave anterior (BancoEstado bloquea la cuenta tras varios rechazos) |
| Cupo de llamadas | Medir en la fase 0; leer el mes anterior con menos frecuencia |
| Datos personales en un tercero | Contrato de encargo con Emisso y registro en la tabla `auditoria` de cada ingesta |

## 7. Lo que necesito de ti

**Decisiones**

1. ¿Se acepta que la empresa entregue sus claves del SII y de los bancos a Emisso? Con el enlace, la clave no pasa por nosotros, pero sí queda en Emisso.
2. ¿Qué clave del SII? Para leer el RCV basta la **clave tributaria de la empresa** (no permite emitir). La de una persona sirve si después se quiere emitir.
3. ¿Se acepta que BancoEstado quede sin historia automática anterior a la fecha de conexión?

**Datos**

4. ¿Cuántas empresas (RUT) y cuántas cuentas por banco? Define el plan (Starter o Pro) y el costo.
5. ¿Quién entra al portal de BancoEstado y en qué horario? Por la sesión única.

**Gestiones**

6. Abrir la cuenta en Emisso **cuando la fase 0 esté preparada**, para aprovechar los 7 días de prueba.
7. Revisar con el representante legal los términos de Emisso y el contrato de encargo de datos.
8. (Opcional) Crear en cada banco un usuario solo de consulta para la conexión.
