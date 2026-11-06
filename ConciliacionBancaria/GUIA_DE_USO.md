# Guía de uso: conciliación bancaria

Para qué sirve: cruzar los **movimientos de la cuenta del banco** con las **facturas del SII** (ventas por cobrar y compras por pagar), y dejar claro qué falta por cobrar, qué falta por pagar y qué movimientos no tienen respaldo.

## 1. Conceptos básicos

| Término | Qué es |
|---|---|
| **Empresa** | La razón social que opera la cuenta bancaria: la dueña de las cartolas y del RCV. **No es un cliente.** Si hay más de una razón social, se crea una empresa por cada una y se cambia entre ellas desde el menú superior. |
| **Movimiento** | Una fila de la cartola: un abono (entra plata) o un cargo (sale plata). |
| **Documento** | Una factura o nota del RCV del SII. Las **ventas** son lo que le cobras a clientes y las **compras** lo que le pagas a proveedores. |
| **Contraparte** | Un cliente, proveedor o persona. Se crean solas al importar el RCV. |
| **Conciliar** | Decir «este movimiento corresponde a esta factura» (o a una categoría si no hay factura). |
| **Categoría** | Destino de un movimiento sin factura: combustible, retiro del dueño, traspaso entre cuentas propias, sueldos, etc. |
| **Motor** | Revisa los movimientos pendientes y propone con qué factura o categoría van. |

## 2. Primera vez: configuración inicial

Conviene seguir este orden. **Importa primero el RCV y configura las contrapartes, y después las cartolas.** Así el motor ya sabe qué hacer con COPEC y con las transferencias al dueño cuando llegue a los movimientos.

1. **Entra** con el usuario administrador.
2. **Crea la empresa.** Si todavía no hay ninguna, la app lo pide al entrar: escribe el RUT y la razón social. Se crea con las categorías iniciales (traspasos, retiro del dueño, remuneraciones, comisiones, impuestos, combustible, gastos e ingresos sin documento).
3. **Importa el RCV** de compras y de ventas (sección 3).
4. **Configura las contrapartes** en *Configuración → Contrapartes*:
   - **Proveedores que se concilian por categoría**, como COPEC: búscalo y en «Se concilia como» elige *Categoría: Combustible y peajes*. Sus cargos se conciliarán solos y sus facturas dejarán de contarse como deuda por pagar.
   - **El dueño:** *Nueva persona o contraparte* → nombre completo tal como está en el banco, tipo *Persona*, categoría *Retiro del dueño*.
   - **Personas a las que se transfiere seguido** (sueldos, honorarios): lo mismo, con su categoría.
   - Escribe el nombre completo. Si la cartola dice `TEF A VALENZUELA CISTERNAS LUIS HUM`, registra `VALENZUELA CISTERNAS LUIS HUMBERTO`. El banco corta el texto a unos 35 caracteres y el motor reconoce el inicio.
5. **(Opcional) Reglas** en *Configuración → Reglas* para movimientos repetidos sin factura. Ejemplo: «la glosa contiene MOVISTAR» + «Cargos» → *Gastos sin documento*.
6. **Importa las cartolas** (sección 3). Al terminar, el motor corre solo y deja lista la bandeja.

Los usuarios se agregan en *Configuración → Usuarios* (sección 7).

## 3. Importar archivos

Entra a **Importar** y arrastra los archivos (o usa «Elegir archivos»). Puedes subir varios a la vez.

| Archivo | Cómo obtenerlo | Formato |
|---|---|---|
| **Cartola de BancoEstado** | Portal empresas de BancoEstado, «Cartola Histórica de Chequera Electrónica» | Excel (`.xlsx`) |
| **Cartola de Banco de Chile** | Portal empresas de Banco de Chile, «Cartola emitida» de la cuenta corriente | Texto (aunque se llame `.xls`) o Excel |
| **RCV de ventas y de compras** | Portal del SII, Registro de Compras y Ventas, detalle del período | CSV |

**No les cambies el nombre.** Los CSV del SII (`RCV_COMPRA_REGISTRO_<rut>_<aaaamm>.csv`) traen el RUT y el período en el nombre y la app los usa para validar.

Qué verifica la importación:
- **Archivo ya subido:** se rechaza.
- **RUT distinto al de la empresa:** se rechaza.
- **Cartola alterada:** si el saldo no cuadra al peso en alguna fila, se rechaza.
- **Movimientos o documentos repetidos** (por ejemplo, dos cartolas que se traslapan): se descartan solos y el resultado dice cuántos eran nuevos.
- **Falta una cartola:** si te saltas el N° 32 entre la 31 y la 33, lo avisa con una advertencia amarilla. Banco de Chile no numera las cartolas: ahí lo detecta comparando saldos y fechas, y también acepta exportaciones parciales que se traslapan.
- **RCV de compras «Reclamado» o «No incluir»:** se rechaza. El «Pendiente» se acepta con una advertencia.

La cuenta bancaria se crea sola con la primera cartola. Las notas de crédito de **ventas** se descuentan solas de su factura.

**Cada cuánto:** sube la cartola nueva cuando quieras revisar (semanal o mensual) y el RCV cada mes. Para conciliar pagos de facturas del mes anterior, el RCV de ese mes también tiene que estar cargado: un pago de septiembre cuya factura es de agosto necesita el RCV de agosto.

## 4. Uso diario

Después de importar:

1. **Resumen:** muestra el avance, cuántos movimientos faltan y el saldo por cobrar y por pagar. Con «Buscar coincidencias» vuelves a correr el motor.
2. **Bandeja:** revisa lo que el motor no se atrevió a conciliar solo (sección 5).
3. **Movimientos → «Por conciliar»:** lo que quedó sin propuesta, uno a uno (sección 6).
4. **Documentos:** consulta qué facturas siguen pendientes de cobro o de pago.

### Qué hace el motor solo

El motor concilia **sin preguntarte** lo que tiene una confianza de **90 % o más**: COPEC contra su categoría, tus traspasos, el retiro del dueño, lo que cubren tus reglas, y los pagos donde el nombre y el monto calzan sin dudas. El resto queda como sugerencia.

## 5. La bandeja de sugerencias

Cada tarjeta muestra, a la izquierda, el movimiento del banco y, a la derecha, lo que propone el motor, con el motivo y el % de confianza.

| Botón | Qué hace |
|---|---|
| **Aceptar** | Concilia con la propuesta marcada. |
| **Otra opción** | Si hay varias, elige la que corresponde con el círculo y luego «Aceptar». |
| **Rechazar** | Descarta la propuesta; no vuelve a aparecer para ese movimiento. |
| **Otra** | Abre la conciliación manual. |
| **Aceptar las visibles** | Acepta todas las que estás viendo de una vez (pide confirmación). |

Cómo leer el porcentaje:
- **Verde (90 %+):** casi seguro. El motor lo concilia solo.
- **Azul (60 a 90 %):** probable, conviene mirarlo un segundo.
- **Amarillo o gris (menos de 60 %):** dudoso. Suele ser «solo coincide el monto», por ejemplo un depósito sin nombre. Revísalo con cuidado.

Usa los filtros *Probables* y *Dudosas* para no aceptar a ciegas las dudosas con «Aceptar las visibles».

**El sistema aprende.** Cada vez que concilias un pago con una factura, queda guardado qué texto del banco corresponde a qué cliente. Con el uso, hay más conciliaciones automáticas.

## 6. Conciliar a mano

En **Movimientos**, haz clic en cualquier fila. Se abre «Conciliar movimiento»:

- **Una factura:** marca la factura de la lista. Vienen ordenadas por monto exacto y parecido de nombre; con el buscador puedes encontrar otra por razón social, RUT o folio.
- **Varias facturas con un solo pago:** marca varias. Cada una trae su monto a aplicar.
- **Pago parcial o abono:** baja el monto de la factura. El movimiento queda *Parcial* hasta completar.
- **Sin factura** (comisión, retiro, traspaso): elige una **categoría** en «Sin documento».
- **Factura más categoría:** si el movimiento es mayor que las facturas, el resto va a una categoría.
- **Ignorar:** para un movimiento que no hay que conciliar (duplicado, de prueba). Se puede revertir.
- **Deshacer:** si ya estaba conciliado, el botón «Deshacer» en la misma ventana devuelve todo a como estaba. Nada se borra: queda registrado quién hizo qué.

El botón «Conciliar» solo se activa si lo que aplicas no supera el monto disponible. Un abono se aplica a ventas y un cargo a compras.

### Notas de crédito de compras

El SII no informa de qué factura es la nota de crédito de **compras**. En **Documentos → Compras**, abre la nota de crédito y elige a qué factura del mismo proveedor aplicarla.

## 7. Usuarios y permisos

Solo un administrador entra a *Configuración → Usuarios*.

| Rol | Qué puede hacer |
|---|---|
| **Lector** | Consultar todo. |
| **Operador** | Lo anterior, más importar, conciliar, aceptar o rechazar sugerencias y manejar reglas y personas. |
| **Administrador** | Lo anterior, más cuentas, categorías, asignar categorías a contrapartes y usuarios de la empresa. |

El **administrador general** crea usuarios nuevos y puede restablecer contraseñas. Cada usuario cambia la suya desde su nombre, arriba a la derecha → «Cambiar contraseña». Mínimo 10 caracteres.

La sesión dura 8 horas.

## 8. Preguntas frecuentes

**¿Por qué un movimiento no tiene sugerencia?** Casi siempre es una persona no registrada, o una factura que no está cargada (falta el RCV de ese mes). Registra a la persona en *Contrapartes* o carga el RCV faltante, y luego usa «Buscar coincidencias».

**Cambié una categoría o agregué una regla, ¿se aplica a lo ya importado?** Sí, pero hay que correr «Buscar coincidencias». Lo ya conciliado no se toca.

**¿Qué pasa con las facturas de COPEC?** Aparecen como *Por categoría*, no como pendientes. Siguen en la base de datos pero no cuentan como deuda por pagar.

**Se me conciliaron mal varios movimientos.** Ábrelos desde *Movimientos → Conciliados* y usa «Deshacer». Después revisa la contraparte o la regla que causó el error.

**¿Se guardan mis archivos?** No. Se leen en el momento y solo se guardan los datos y una huella para detectar repetidos.

**Importé una cartola dos veces.** La segunda se rechaza. Si fue una cartola distinta que se traslapa, los movimientos repetidos se descartan solos.

## 9. Limitaciones actuales

- Hay lectores para **BancoEstado** (Excel) y **Banco de Chile** (texto o Excel). Un Excel antiguo (`.xls` binario), un PDF o una página web guardada como `.xls` no se pueden leer: la aplicación avisa y pide descargarla de otra forma.
- Los depósitos en efectivo y con documentos no traen el nombre de quien paga: solo se pueden proponer por monto, así que quedan para revisión.
- Las boletas de honorarios y la liquidación de Transbank aún no se importan.
- La descarga del banco y del SII es manual: no hay conexión automática todavía.
