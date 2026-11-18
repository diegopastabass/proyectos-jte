import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api, { mensajeError } from "../api";
import { Alerta, AvisoBusquedaMonto, BadgeDocumento, BotonMonto, BadgeMovimiento, Cargando, Modal } from "../components/comunes";
import ConciliarModal from "../components/ConciliarModal";
import { fecha, pesos, resolverBusqueda, tipoDte } from "../formato";
import { useEmpresa, useSesion } from "../sesion";
import type { BalanceProyecto, Documento, Movimiento, Pagina, ProyectoDetalle as TProyecto } from "../types";
import { useCarga } from "../useCarga";
import { ProyectoForm } from "./Proyectos";

export default function ProyectoDetalle() {
  const { id } = useParams();
  const empresa = useEmpresa();
  const { puede } = useSesion();
  const base = `/empresas/${empresa.id}`;
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [pestana, setPestana] = useState<"movimientos" | "documentos">("movimientos");
  const [editando, setEditando] = useState(false);
  const [agregando, setAgregando] = useState(false);
  const [movAbierto, setMovAbierto] = useState<number | null>(null);
  const [error, setError] = useState("");
  const { datos: p, error: errorCarga, cargando, recargar } = useCarga<TProyecto>(`${base}/proyectos/${id}`, { desde, hasta });
  const operador = puede("operador");

  if (!p) return <div className="container py-4">{errorCarga ? <Alerta error={errorCarga} /> : <Cargando />}</div>;

  const quitar = async (tipo: "movimientoIds" | "documentoIds", itemId: number) => {
    try {
      await api.post(`${base}/proyectos/asignar`, { proyectoId: null, [tipo]: [itemId] });
      recargar();
    } catch (e) {
      setError(mensajeError(e));
    }
  };

  const alternarActivo = async () => {
    try {
      await api.patch(`${base}/proyectos/${p.id}`, { activo: !p.activo });
      recargar();
    } catch (e) {
      setError(mensajeError(e));
    }
  };

  const b = p.balance;
  const totalComposicion = p.porCategoria.reduce((s, c) => s + c.gastos, 0);

  return (
    <div className="container py-4">
      <Link to="/proyectos" className="small">
        <i className="bi bi-arrow-left me-1" />
        Proyectos
      </Link>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-1 mb-3">
        <div>
          <h2 className="mb-0">
            {p.nombre} {!p.activo && <span className="badge text-bg-secondary fs-6 align-middle">Cerrado</span>}
          </h2>
          <small className="text-muted">
            {p.codigo && <span className="me-2">{p.codigo}</span>}
            {p.fechaInicio && `${fecha(p.fechaInicio)}${p.fechaFin ? ` → ${fecha(p.fechaFin)}` : ""}`}
            {p.descripcion && <span className="d-block">{p.descripcion}</span>}
          </small>
        </div>
        <div className="d-flex flex-wrap gap-2 align-items-center">
          {cargando && <span className="spinner-border spinner-border-sm text-secondary" />}
          <input type="date" className="form-control form-control-sm" style={{ width: 150 }} value={desde} onChange={(e) => setDesde(e.target.value)} title="Desde" />
          <input type="date" className="form-control form-control-sm" style={{ width: 150 }} value={hasta} onChange={(e) => setHasta(e.target.value)} title="Hasta" />
          {operador && (
            <>
              <button className="btn btn-sm btn-outline-secondary" onClick={() => setEditando(true)}>
                <i className="bi bi-pencil me-1" /> Editar
              </button>
              <button className="btn btn-sm btn-outline-secondary" onClick={alternarActivo}>
                {p.activo ? "Cerrar proyecto" : "Reactivar"}
              </button>
            </>
          )}
        </div>
      </div>

      <Alerta error={error} onCerrar={() => setError("")} />
      <Balance b={b} presupuesto={p.presupuesto} />

      {p.porCategoria.length > 0 && (
        <>
          <h5 className="mt-4 mb-2">Composición</h5>
          <div className="card card-suave shadow-sm">
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Concepto</th>
                    <th className="text-end">Gastos</th>
                    <th className="text-end">Ingresos</th>
                    <th className="d-none d-md-table-cell" style={{ width: "30%" }} />
                  </tr>
                </thead>
                <tbody>
                  {p.porCategoria.map((c) => (
                    <tr key={`${c.categoriaId}-${c.nombre}`}>
                      <td>
                        <i className={`bi ${c.categoriaId ? "bi-tag" : c.nombre.startsWith("Facturas") ? "bi-receipt" : "bi-hourglass-split"} me-2 text-muted`} />
                        {c.nombre}
                      </td>
                      <td className="monto text-danger">{c.gastos ? pesos(c.gastos) : ""}</td>
                      <td className="monto text-success">{c.ingresos ? pesos(c.ingresos) : ""}</td>
                      <td className="d-none d-md-table-cell">
                        {c.gastos > 0 && totalComposicion > 0 && (
                          <div className="progress" style={{ height: 6 }}>
                            <div className="progress-bar bg-danger" style={{ width: `${(c.gastos / totalComposicion) * 100}%` }} />
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <small className="text-muted">Los montos de la composición incluyen IVA.</small>
        </>
      )}

      <div className="d-flex flex-wrap justify-content-between align-items-end gap-2 mt-4 mb-2">
        <ul className="nav nav-tabs border-0">
          <li className="nav-item">
            <button className={`nav-link ${pestana === "movimientos" ? "active" : ""}`} onClick={() => setPestana("movimientos")}>
              <i className="bi bi-bank me-1" /> Movimientos ({p.movimientos.length})
            </button>
          </li>
          <li className="nav-item">
            <button className={`nav-link ${pestana === "documentos" ? "active" : ""}`} onClick={() => setPestana("documentos")}>
              <i className="bi bi-receipt me-1" /> Documentos ({p.documentos.length})
            </button>
          </li>
        </ul>
        {operador && p.activo && (
          <button className="btn btn-sm btn-primary" onClick={() => setAgregando(true)}>
            <i className="bi bi-plus-lg me-1" /> Agregar {pestana}
          </button>
        )}
      </div>

      <div className="card card-suave shadow-sm">
        <div className="table-responsive">
          {pestana === "movimientos" ? (
            <table className="table table-hover align-middle mb-0 tabla-clic">
              <thead className="table-light">
                <tr>
                  <th>Fecha</th>
                  <th>Glosa</th>
                  <th className="d-none d-md-table-cell">Categoría</th>
                  <th className="text-end">Monto</th>
                  <th className="text-end" title="Parte sin factura: lo que suma al balance">
                    Cuenta
                  </th>
                  <th className="text-end d-none d-lg-table-cell">IVA</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {p.movimientos.map((m) => (
                  <tr key={m.id} onClick={() => setMovAbierto(m.id)}>
                    <td className="text-nowrap">{fecha(m.fecha)}</td>
                    <td>
                      <span className="glosa">{m.glosa}</span>
                      {m.nComprobantes > 0 && <i className="bi bi-paperclip text-primary ms-2" title="Con boleta" />}
                      <span className="ms-2">
                        <BadgeMovimiento estado={m.estado} />
                      </span>
                    </td>
                    <td className="d-none d-md-table-cell small text-muted">{m.categorias}</td>
                    <td className={`monto ${m.monto > 0 ? "text-success" : "text-danger"}`}>{pesos(m.monto)}</td>
                    <td className="monto fw-semibold">{m.sinDocumento !== Math.abs(m.monto) ? pesos(m.sinDocumento) : ""}</td>
                    <td className="monto d-none d-lg-table-cell text-muted">{m.iva ? pesos(m.iva) : ""}</td>
                    <td className="text-end" onClick={(e) => e.stopPropagation()}>
                      {operador && (
                        <button className="btn btn-sm btn-link text-danger" title="Sacar del proyecto" onClick={() => quitar("movimientoIds", m.id)}>
                          <i className="bi bi-x-lg" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {p.movimientos.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center text-muted py-4">
                      Sin movimientos sin factura (gastos con boleta, peajes, etc.) en este proyecto.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="table align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Documento</th>
                  <th>Emisión</th>
                  <th className="text-end">Neto</th>
                  <th className="text-end">IVA</th>
                  <th className="text-end">Total</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {p.documentos.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <span className={`badge me-2 ${d.direccion === "emitido" ? "text-bg-success" : "text-bg-danger"}`}>{d.direccion === "emitido" ? "Venta" : "Compra"}</span>
                      {tipoDte(d.tipoDte)} {d.folio} · {d.razonSocial}
                    </td>
                    <td className="text-nowrap">{fecha(d.fechaEmision)}</td>
                    <td className="monto">{pesos(d.montoNeto)}</td>
                    <td className="monto">{pesos(d.montoIva)}</td>
                    <td className="monto fw-semibold">{pesos(d.montoTotal)}</td>
                    <td>
                      <BadgeDocumento estado={d.estado} />
                    </td>
                    <td className="text-end">
                      {operador && (
                        <button className="btn btn-sm btn-link text-danger" title="Sacar del proyecto" onClick={() => quitar("documentoIds", d.id)}>
                          <i className="bi bi-x-lg" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {p.documentos.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center text-muted py-4">
                      Sin facturas en este proyecto.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {pestana === "movimientos" && (
        <small className="text-muted">
          Un movimiento pagado con factura solo suma por la parte que no cubre la factura: la factura ya cuenta en Documentos.
        </small>
      )}

      {editando && (
        <ProyectoForm
          proyecto={p}
          onCerrar={() => setEditando(false)}
          onGuardado={() => {
            setEditando(false);
            recargar();
          }}
        />
      )}
      {agregando && (
        <AgregarModal
          proyectoId={p.id}
          tipo={pestana}
          onCerrar={() => setAgregando(false)}
          onAgregado={() => {
            setAgregando(false);
            recargar();
          }}
        />
      )}
      {movAbierto !== null && <ConciliarModal movimientoId={movAbierto} onCerrar={() => setMovAbierto(null)} onCambio={recargar} />}
    </div>
  );
}

function Fila({ texto, valor, clase = "" }: { texto: string; valor: number; clase?: string }) {
  return (
    <div className={`d-flex justify-content-between small ${clase}`}>
      <span className="text-muted">{texto}</span>
      <span className="monto">{pesos(valor)}</span>
    </div>
  );
}

/** Ingresos, gastos, resultado e IVA del proyecto. */
function Balance({ b, presupuesto }: { b: BalanceProyecto; presupuesto?: number | null }) {
  return (
    <div className="row g-3">
      <div className="col-md-6 col-xl-3">
        <div className="card card-suave shadow-sm h-100">
          <div className="card-body">
            <div className="text-muted mb-1">
              <i className="bi bi-arrow-down-left-circle text-success me-1" /> Ingresos (neto)
            </div>
            <div className="fs-3 fw-bold text-success monto text-start">{pesos(b.ingresos.neto)}</div>
            <Fila texto="IVA cobrado (débito)" valor={b.ingresos.iva} />
            <Fila texto="Total facturado/recibido" valor={b.ingresos.total} />
            {b.porCobrar > 0 && <Fila texto="Por cobrar" valor={b.porCobrar} clase="text-warning-emphasis" />}
          </div>
        </div>
      </div>
      <div className="col-md-6 col-xl-3">
        <div className="card card-suave shadow-sm h-100">
          <div className="card-body">
            <div className="text-muted mb-1">
              <i className="bi bi-arrow-up-right-circle text-danger me-1" /> Gastos (neto)
            </div>
            <div className="fs-3 fw-bold text-danger monto text-start">{pesos(b.gastos.neto)}</div>
            <Fila texto="IVA crédito fiscal" valor={b.gastos.ivaCredito} />
            {b.gastos.ivaBoletas > 0 && <Fila texto="IVA en boletas (no recuperable)" valor={b.gastos.ivaBoletas} />}
            <Fila texto="Total pagado/por pagar" valor={b.gastos.total} />
            {b.porPagar > 0 && <Fila texto="Por pagar" valor={b.porPagar} clase="text-warning-emphasis" />}
          </div>
        </div>
      </div>
      <div className="col-md-6 col-xl-3">
        <div className="card card-suave shadow-sm h-100">
          <div className="card-body">
            <div className="text-muted mb-1">
              <i className="bi bi-graph-up-arrow me-1" /> Resultado
            </div>
            <div className={`fs-3 fw-bold monto text-start ${b.resultado < 0 ? "text-danger" : "text-dark"}`}>{pesos(b.resultado)}</div>
            <small className="text-muted">Ingresos netos − gastos netos</small>
            {b.ingresos.neto > 0 && (
              <div className="small">
                <span className="text-muted">Margen </span>
                {Math.round((b.resultado / b.ingresos.neto) * 100)}%
              </div>
            )}
            {!!presupuesto && (
              <div className="small">
                <span className="text-muted">Presupuesto usado </span>
                {Math.round((b.gastos.neto / presupuesto) * 100)}% de {pesos(presupuesto)}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="col-md-6 col-xl-3">
        <div className="card card-suave shadow-sm h-100">
          <div className="card-body">
            <div className="text-muted mb-1">
              <i className="bi bi-percent me-1" /> IVA {b.iva.saldo >= 0 ? "a pagar" : "a favor"}
            </div>
            <div className="fs-3 fw-bold monto text-start">{pesos(Math.abs(b.iva.saldo))}</div>
            <Fila texto="Débito (ventas)" valor={b.iva.debito} />
            <Fila texto="Crédito (compras)" valor={b.iva.credito} />
            <Fila texto="IVA pagado en total" valor={b.gastos.ivaCredito + b.gastos.ivaBoletas} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Buscar movimientos o documentos sin proyecto y agregarlos de a varios. */
function AgregarModal({
  proyectoId,
  tipo,
  onCerrar,
  onAgregado,
}: {
  proyectoId: number;
  tipo: "movimientos" | "documentos";
  onCerrar: () => void;
  onAgregado: () => void;
}) {
  const empresa = useEmpresa();
  const base = `/empresas/${empresa.id}`;
  const [busqueda, setBusqueda] = useState("");
  const [porMonto, setPorMonto] = useState(false);
  const [q, setQ] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [direccion, setDireccion] = useState("");
  const [elegidos, setElegidos] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setQ(resolverBusqueda(busqueda, porMonto)), 350);
    return () => clearTimeout(t);
  }, [busqueda, porMonto]);

  const filtros = { sinProyecto: "true", q, desde, hasta, porPagina: 200 };
  const movs = useCarga<Pagina<Movimiento>>(tipo === "movimientos" ? `${base}/movimientos` : null, filtros);
  const docs = useCarga<Pagina<Documento>>(tipo === "documentos" ? `${base}/documentos` : null, { ...filtros, direccion });
  const filas: { id: number; fecha: string; texto: string; monto: number }[] =
    tipo === "movimientos"
      ? (movs.datos?.items ?? []).map((m) => ({ id: m.id, fecha: m.fecha, texto: m.glosa, monto: m.monto }))
      : (docs.datos?.items ?? []).map((d) => ({
          id: d.id,
          fecha: d.fechaEmision,
          texto: `${d.direccion === "emitido" ? "Venta" : "Compra"} · ${tipoDte(d.tipoDte)} ${d.folio} · ${d.razonSocial}`,
          monto: d.direccion === "emitido" ? d.montoTotal : -d.montoTotal,
        }));
  const cargando = tipo === "movimientos" ? movs.cargando : docs.cargando;

  const alternar = (id: number) =>
    setElegidos((a) => {
      const n = new Set(a);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const agregar = async () => {
    setEnviando(true);
    setError("");
    try {
      await api.post(`${base}/proyectos/asignar`, {
        proyectoId,
        [tipo === "movimientos" ? "movimientoIds" : "documentoIds"]: [...elegidos],
      });
      onAgregado();
    } catch (e) {
      setError(mensajeError(e));
      setEnviando(false);
    }
  };

  return (
    <Modal
      titulo={`Agregar ${tipo} al proyecto`}
      onCerrar={onCerrar}
      tamano="xl"
      pie={
        <>
          <span className="me-auto text-muted">{elegidos.size} seleccionados</span>
          <button className="btn btn-outline-secondary" onClick={onCerrar}>
            Cancelar
          </button>
          <button className="btn btn-primary" disabled={enviando || elegidos.size === 0} onClick={agregar}>
            {enviando && <span className="spinner-border spinner-border-sm me-1" />}
            Agregar
          </button>
        </>
      }
    >
      <Alerta error={error} onCerrar={() => setError("")} />
      <div className="row g-2 mb-3">
        <div className="col-md-5">
          <div className="input-group">
            <input
              className="form-control"
              placeholder={tipo === "movimientos" ? "Glosa o monto (ej. 5500CLP)" : "Razón social o monto (ej. 5500CLP)"}
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              autoFocus
            />
            <BotonMonto activo={porMonto} onCambiar={setPorMonto} />
          </div>
          <AvisoBusquedaMonto q={q} />
        </div>
        {tipo === "documentos" && (
          <div className="col-md-3">
            <select className="form-select" value={direccion} onChange={(e) => setDireccion(e.target.value)}>
              <option value="">Ventas y compras</option>
              <option value="emitido">Ventas</option>
              <option value="recibido">Compras</option>
            </select>
          </div>
        )}
        <div className="col-6 col-md-2">
          <input type="date" className="form-control" value={desde} onChange={(e) => setDesde(e.target.value)} title="Desde" />
        </div>
        <div className="col-6 col-md-2">
          <input type="date" className="form-control" value={hasta} onChange={(e) => setHasta(e.target.value)} title="Hasta" />
        </div>
      </div>
      <div className="border rounded" style={{ maxHeight: 420, overflowY: "auto" }}>
        <table className="table table-sm table-hover align-middle mb-0 tabla-clic">
          <tbody>
            {filas.map((f) => (
              <tr key={f.id} className={elegidos.has(f.id) ? "table-primary" : ""} onClick={() => alternar(f.id)}>
                <td style={{ width: 32 }}>
                  <input type="checkbox" className="form-check-input" checked={elegidos.has(f.id)} readOnly />
                </td>
                <td className="text-nowrap">{fecha(f.fecha)}</td>
                <td>
                  <span className={tipo === "movimientos" ? "glosa" : ""}>{f.texto}</span>
                </td>
                <td className={`monto ${f.monto > 0 ? "text-success" : "text-danger"}`}>{pesos(f.monto)}</td>
              </tr>
            ))}
            {filas.length === 0 && (
              <tr>
                <td className="text-center text-muted py-4">{cargando ? <span className="spinner-border spinner-border-sm" /> : `No hay ${tipo} sin proyecto para estos filtros.`}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {tipo === "movimientos" && <small className="text-muted">Las facturas con que se concilió cada movimiento se agregan solas.</small>}
    </Modal>
  );
}
