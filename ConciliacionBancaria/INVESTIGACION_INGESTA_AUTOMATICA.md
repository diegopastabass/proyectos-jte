# Investigación: obtención automática de cartolas y RCV

Fecha: 2026-11-10. Complementa la **Fase 3** de `PLAN_IMPLEMENTACION.md`.

Objetivo: dejar de subir a mano las cartolas (BancoEstado, Banco de Chile) y el RCV (SII), usando canales permitidos por la normativa vigente.

## Resumen

| Fuente | ¿API oficial? | Canal recomendado hoy | Alternativa |
|---|---|---|---|
| **RCV (SII)** | **No** hay API pública para listar el RCV. Solo hay web services oficiales parciales, con certificado digital | Intermediario con API REST (BaseAPI, API Gateway, Gears), con un usuario autorizado dedicado | Vía oficial: XML del correo de intercambio + web services con certificado digital |
| **Banco de Chile** | **Sí, parcial**: el API Store del banco (`apistore.bancochile.cl`) publica "Movimientos y Saldos" y "Movimientos notificaciones" para cuentas empresa | API del banco, si la habilitan para el contrato Banconexión 2.0 | Agregador (Fintoc cubre Banconexión 2.0, con 24 meses de historia) |
| **BancoEstado** | **No** hay portal de APIs público para empresas | Agregador (Fintoc cubre el portal Empresas, con 12 meses de historia; Boufin también) | Seguir subiendo la cartola a mano |
| **Open Finance (SFA)** | Será el canal estándar | Empieza en **julio de 2027**. Los datos de **personas jurídicas** en bancos llegan en el **mes 12**, o sea **alrededor de julio de 2028** | — |

Descartado: scrapers propios del portal bancario o del SII, y cualquier truco para saltarse el reCAPTCHA del SII (ver 1.4).

---

## 1. SII: Registro de Compras y Ventas

### 1.1 Lo que dice el SII
- El RCV reemplazó a la IECV desde el período agosto de 2017 (Res. Ex. SII N° 61 y 68 de 2017). Se arma solo con los DTE que recibe el SII.
- Se accede desde el portal con Clave Tributaria, ClaveÚnica o certificado digital, ya sea de la empresa o de un **usuario autorizado** por ella.
- El SII **no publica un web service para descargar o listar el RCV**. Los proveedores comerciales lo confirman: actúan como intermediarios usando las credenciales del contribuyente.

### 1.2 Web services oficiales que sí existen (todos con certificado digital)
1. **Autenticación automática** (semilla, luego token): `CrSeed` + `GetTokenFromSeed`. Manual OI2003_AUTAUTOM.
2. **Registro de Aceptación/Reclamo de DTE** (v1.2):
   - Producción: `https://ws1.sii.cl/WSREGISTRORECLAMODTE/registroreclamodteservice?wsdl`
   - Certificación: `https://ws2.sii.cl/WSREGISTRORECLAMODTECERT/registroreclamodteservice?wsdl`
   - Métodos: `listarEventosHistDoc` (acuses y reclamos de un DTE), `consultarFechaRecepcionSii`, `consultarDocDteCedible` e `ingresarAceptacionReclamoDoc`.
   - Lo puede usar el representante legal o un usuario autorizado del emisor, del receptor o del tenedor vigente.
   - **Funciona documento por documento**: sirve para verificar el estado de un DTE que ya conocemos, no para listar el período.
3. **Consulta de estado de DTE** (`QueryEstDte`): también documento por documento.

### 1.3 Correo de intercambio (canal oficial, gratis)
Todo emisor de DTE debe enviar el XML al correo de intercambio del receptor. Si leemos ese buzón por IMAP:
- Tenemos las **compras** con más detalle que el RCV: fecha de vencimiento, forma de pago y referencias. Eso sirve para las cuentas por pagar.
- No hace falta entregarle la clave a nadie: basta con acceso al buzón.
- Limitaciones: hay emisores que no envían el XML y el buzón no informa reclamos. Por eso se complementa con `listarEventosHistDoc` y con un cuadre mensual contra el RCV.
- Las **ventas** salen del sistema con que la empresa emite las facturas (falta saber cuál es).

### 1.4 Portal interno del SII (`www4.sii.cl/consdcvinternetui/...`)
Es el backend JSON que usa la página del RCV (`getResumen`, `getDetalleCompra`, `getDetalleVenta`). **No está documentado** y puede cambiar sin aviso. Los proyectos abiertos que lo usan informan que el detalle pide **reCAPTCHA v3**, y algunos lo pasan con un token fijo copiado del portal. Eso equivale a saltarse un control anti-bots del SII: **no lo vamos a implementar**. Además el SII bloquea el RUT cuando se supera el máximo de sesiones abiertas.

### 1.5 Intermediarios comerciales
| Proveedor | Qué ofrece (según su sitio) | Credencial |
|---|---|---|
| BaseAPI (`baseapi.cl/servicios/rcv`) | `POST /sii/rcv` con período y tipo (compra o venta), responde JSON. Tiene un plan gratuito | RUT + clave SII. Dice que no almacena la clave |
| API Gateway (`apigateway.cl/products/sii/rcv`) | RCV síncrono y asíncrono, cobra por créditos | RUT + clave tributaria |
| Gears (`gears.cl`) | Acceso al RCV | Credenciales del contribuyente |

Ninguno es oficial: por dentro hacen lo mismo que el punto 1.4, y el riesgo de que el SII cambie el portal lo asumen ellos. Hay que revisar sus términos, el precio vigente y cómo tratan las credenciales.

**Mitigación clave:** no usar la clave de la empresa ni la del representante legal. Conviene crear una **persona dedicada como usuario autorizado** con el mínimo de permisos. Falta confirmar en el SII qué tan finos pueden ser los permisos para que solo pueda consultar el RCV.

---

## 2. Bancos

### 2.1 Banco de Chile
- El **API Store** (`apistore.bancochile.cl`) lista, entre otras, **"Movimientos y Saldos"** (recibir los movimientos de la cuenta en el software de gestión) y **"Movimientos notificaciones"** (aviso en línea de transferencias a una cuenta corriente empresa). Para ver la documentación hay que registrarse. El sitio no publica requisitos ni precio, pero lo esperable es un contrato **Banconexión 2.0** vigente y gestionarlo con el ejecutivo.
- Es la mejor opción: es oficial y no obliga a entregar la clave de Banconexión a un tercero.
- Respaldo: **Fintoc** (`cl_banco_de_chile`, portal Banconexión 2.0, CLP/USD, 24 meses). El usuario que se conecte necesita los permisos de "Saldos y Movimientos" y "Cartola Histórica".

### 2.2 BancoEstado
- No hay portal de APIs ni API pública para empresas. El canal oficial es descargar la cartola desde la banca en línea.
- **Fintoc** cubre el **portal Empresas** (`cl_banco_estado`, CLP, 12 meses). Su página de cobertura tiene un error de formato en esa fila, así que hay que confirmarlo con ellos. **Boufin** también lista "Movimientos de Cuenta" para BancoEstado.
- Existe un acuerdo de intercambio de datos por API entre BancoEstado y Khipu, firmado tras un litigio. Muestra que el banco formaliza estos accesos caso a caso, pero no es un producto que se pueda contratar para este uso.
- Se descartan los scrapers de GitHub (`bankapi/bancoestado-empresas`, `FacTronica/ApiBancos`): no tienen soporte, se rompen y obligan a guardar la clave bancaria en nuestro servidor.

### 2.3 Cómo trabajan los agregadores hoy
Hasta que entre en operación el SFA, Fintoc y Boufin se conectan **con las credenciales del usuario en la banca en línea**. En la práctica eso significa entregarle a un tercero la clave de un usuario del banco. Hay que crear un usuario bancario **solo de consulta**, sin poder de firma ni de transferencias.

---

## 3. Normativa

| Norma | Qué implica para nosotros |
|---|---|
| **Ley 21.521 (Fintec) + NCG 514**, modificada el 1 de junio de 2026 (anexo técnico y portal de desarrolladores de la CMF) | El SFA entra en vigencia en **julio de 2027**. Bancos: historial de transacciones de **personas naturales en el mes 9** y de **personas jurídicas en el mes 12** (alrededor de julio de 2028). Para consumir datos hay que ser un **PSBI inscrito en la CMF** con consentimiento del cliente. Nosotros no lo seríamos: llegaríamos a través de un agregador que sí esté inscrito. Algunas fuentes citan la modificación como NCG 569: hay que confirmar el número en la CMF |
| **Ley 21.719 (datos personales)**, vigente desde el 1 de diciembre de 2026 | Las cartolas y documentos traen datos de personas naturales (honorarios, retiros, sueldos). Hacen falta medidas de seguridad, mínimo de datos, registro de accesos (ya existe la tabla `auditoria`) y contratos con los encargados (agregador e intermediario SII) |
| **Res. SII 61/2017** (RCV) y **Ley 20.956** (8 días para reclamar un DTE) | El RCV de compras distingue REGISTRO, PENDIENTE, RECLAMADO y NO_INCLUIR, igual que el lector actual. Los eventos de acuse o reclamo se consultan con el WS oficial |
| Términos de uso de sii.cl y de la banca en línea | No automatizar el portal saltándose controles (captcha, límite de sesiones). Por eso la automatización va por APIs oficiales o por intermediarios que asumen ese riesgo |

---

## 4. Recomendación

1. **Banco de Chile:** pedir la API oficial "Movimientos y Saldos". Mientras tanto, o si la rechazan, usar Fintoc.
2. **BancoEstado:** usar Fintoc (o Boufin) con un usuario de solo consulta. Si el costo no se justifica, mantener la subida manual: el lector ya existe.
3. **SII:** usar un intermediario (BaseAPI o API Gateway) con un usuario autorizado dedicado, que sincronice el período en curso y el anterior todos los días. Mantener la subida del CSV como respaldo. Si no se quiere entregar ninguna clave del SII, la alternativa es la vía oficial (punto 1.3), que da más trabajo y deja las ventas dependiendo del facturador.
4. **Open Finance:** el diseño de conectores permite cambiar Fintoc por el SFA en 2028 sin tocar el motor.

## 5. Plan de implementación (borrador)

La idea es que cada conector produzca **las mismas estructuras que los lectores actuales** (`CartolaLeida` y `RcvLeido` en `lector.types.ts`) y pase por `importacion.service`. Así el motor, la deduplicación (`hash_dedup`) y los saldos no cambian. Ya no hace falta el `worker-sii` en Python que preveía el plan original: los intermediarios son REST y se consumen desde NestJS.

| Paso | Contenido |
|---|---|
| 1. Base | Tabla `conexion` (empresa, tipo `banco`/`sii`, proveedor, cuenta asociada, credencial **cifrada** con AES-256-GCM y la clave en una variable de entorno fuera de la BD, último sync, último error). En `importacion`, columna `origen` (`archivo`/`api`) e `id_externo` en `movimiento`. Pantalla de Configuración → Conexiones |
| 2. Interfaz | `ConectorBanco.obtener(cuenta, desde, hasta): CartolaLeida` y `ConectorSii.obtener(rut, periodo, tipo): RcvLeido`. Implementación falsa para pruebas |
| 3. SII | Conector del intermediario elegido. Job diario con `@nestjs/schedule` para el período actual y el anterior. Cuadre contra el CSV |
| 4. Banco de Chile | Conector a la API oficial (o a Fintoc). Webhook de "notificaciones" opcional para tener movimientos casi en tiempo real |
| 5. BancoEstado | Conector Fintoc (link + webhook o refresco programado) |
| 6. Operación | Alertas cuando un sync falla o hay credenciales vencidas, reintentos, botón "sincronizar ahora" y registro en `auditoria` |

Cada paso se puede probar por separado. Los pasos 3 a 5 dependen de las respuestas de la sección 6.

## 6. Lo que necesito de ti

**Decisiones**
1. ¿Se acepta entregar credenciales (SII y banco) a un tercero, o solo canales oficiales? Esto define el SII (intermediario o vía oficial) y BancoEstado (agregador o manual).
2. Presupuesto mensual aproximado para agregador e intermediario.

**Datos**

3. ¿Con qué sistema emiten las facturas de venta? (facturador gratuito del SII, Nubox, Defontana, LibreDTE, otro)
4. ¿Cuántas empresas (RUT) y cuentas por banco hay que conectar?
5. ¿Alguien de la empresa tiene certificado digital vigente, por ejemplo el que se usa para facturar?

**Gestiones (las tiene que hacer alguien de la empresa)**

6. **Banco de Chile:** hablar con el ejecutivo de empresas y pedir la API "Movimientos y Saldos" del API Store: requisitos, costo, ambiente de pruebas y si sirve con el contrato Banconexión 2.0 actual. Registrarse en `apistore.bancochile.cl`.
7. **BancoEstado:** preguntar al ejecutivo si hay alguna integración por API o archivo (host-to-host) para Cuenta Corriente Empresas. Lo más probable es que no.
8. **Agregador:** pedir cotización a **Fintoc** (y a Boufin para comparar) para cuentas empresa de los dos bancos. Confirmar requisitos, los 12 meses de historia en BancoEstado empresas y su plan para inscribirse como PSBI ante la CMF.
9. **Bancos:** crear en cada banca en línea un **usuario de solo consulta** (sin firma ni transferencias) para el agregador.
10. **SII:** crear un **usuario autorizado dedicado** (persona con Clave Tributaria propia) y averiguar qué permisos mínimos le permiten consultar el RCV. Abrir una cuenta de prueba en BaseAPI o API Gateway.
11. **Legal/administración:** que el representante legal apruebe compartir credenciales y revise los términos de cada proveedor, considerando que la Ley 21.719 rige desde el 1 de diciembre de 2026.

---

## Fuentes
- SII, Web Service de Consulta y Registro de Aceptación/Reclamo a DTE v1.2: https://www.sii.cl/factura_electronica/Webservice_Registro_Reclamo_DTE_V1.2.pdf
- SII, ¿Qué es el RCV?: https://www.sii.cl/preguntas_frecuentes/factura_electronica/001_003_6971.htm
- SII, RCV reemplaza IECV (Res. 61 y 68/2017): https://www.sii.cl/preguntas_frecuentes/factura_electronica/001_003_6232.htm
- SII, Cómo agregar usuarios autorizados: https://www.sii.cl/destacados/factura_electronica/guias_ayuda/como_agregar_usuarios_autorizados.pdf
- devlas-cl/dte-sii (reCAPTCHA en el detalle del RCV y límite de sesiones): https://github.com/devlas-cl/dte-sii
- WelcomeBackLoyalty/sii-service PR #5 (token reCAPTCHA fijo): https://github.com/WelcomeBackLoyalty/sii-service/pull/5
- BaseAPI RCV: https://baseapi.cl/servicios/rcv · API Gateway RCV: https://www.apigateway.cl/products/sii/rcv · Gears FAQ: https://www.gears.cl/faq/
- Banco de Chile API Store: https://apistore.bancochile.cl/banco-chile/sandbox/forum/2
- Banco de Chile, acceso a cuentas en Banconexión 2.0: https://sitiospublicos.bancochile.cl/empresas/centro-de-ayuda/detalle/como-ingreso-a-la-cuenta-corriente
- Fintoc, cobertura de movimientos: https://docs.fintoc.com/docs/movements/overview-data-aggregation/products-and-institutions-movements
- Open Banking Tracker, BancoEstado: https://www.openbankingtracker.com/provider/bancoestado
- Boufin API: https://docs.boufin.com/api/
- DF, acuerdo BancoEstado–Khipu: https://df.cl/mercados/banca-fintech/bancoestado-y-khipu-firman-la-paz-y-sellan-acuerdo-para-intercambio-de
- CMF, modificación NCG 514 (1 de junio de 2026): https://www.cmfchile.cl/portal/prensa/625/w4-article-110881.html
- Fiskil, guía de Open Finance en Chile (calendario por mes): https://blog.fiskil.com/es/guia-open-finance-chile-ley-21521-ncg-514
- El Mostrador, postergación del SFA: https://www.elmostrador.cl/mercados/2026/06/07/finanzas-abiertas-la-postergacion-que-reabrio-la-grieta-entre-banca-y-fintech/
