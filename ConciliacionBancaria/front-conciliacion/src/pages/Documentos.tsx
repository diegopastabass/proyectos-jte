import { useEffect, useState } from "react";
import api, { mensajeError } from "../api";
import { Alerta, BadgeDocumento, Cargando, Encabezado, Modal, Paginacion, Vacio } from "../components/comunes";
import { fecha, pesos, tipoDte } from "../formato";
import { useEmpresa, useSesion } from "../sesion";
import type { Direccion, Documento, DocumentoDetalle, EstadoDocumento, Pagina } from "../types";
import { useCarga } from "../useCarga";

const ESTADOS: { valor: EstadoDocumento | "con_saldo" | ""; texto: string }[] = [
  { valor: "con_saldo", texto: "Con saldo" },
  { valor: "pagado", texto: "Pagados" },
  { valor: "excluido", texto: "Por categoría" },
  { valor: "", texto: "Todos" },
];

const POR_PAGINA = 50;

export default function Documentos() {
  const empresa = useEmpresa();
  const [direccion, setDireccion] = useState<Direccion>("emitido");
  const [estado, setEstado] = useState<(typeof ESTADOS)[number]["valor"]>("con_saldo");
  const [busqueda, setBusqueda] = useState("");
  const [q, setQ] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [pagina, setPagina] = useState(1);
  const [abierto, setAbierto] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(busqueda.trim());
      setPagina(1);
    }, 350);
    return () => clearTimeout(t);
  }, [busqueda]);

  const { datos, error, cargando, recargar } = useCarga<Pagina<Documento>>(`/empresas/${empresa.id}/documentos`, {
    direccion,
    estado: estado === "con_saldo" ? "" : estado,
    conSaldo: estado === "con_saldo" ? "true" : "",
    // Un número busca por folio; un texto, por razón social.
    folio: /^\d+$/.test(q) ? q : "",
    q: /^\d+$/.test(q) ? "" : q,
    desde,
    hasta,
    pagina,
    porPagina: POR_PAGINA,
  });

  const cambiar = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPagina(1);
  };

  return (
    <div className="container-fluid py-4 px-lg-5">
      <Encabezado titulo="Documentos tributarios" subtitulo="Facturas y notas del Registro de Compras y Ventas del SII." />

      <ul className="nav nav-tabs mb-3">
        {(
          [
            ["emitido", "Ventas (por cobrar)", "bi-arrow-down-left-circle"],
            ["recibido", "Compras (por pagar)", "bi-arrow-up-right-circle"],
          ] as const
        ).map(([d, texto, icono]) => (
          <li className="nav-item" key={d}>
            <button className={`nav-link ${direccion === d ? "active" : ""}`} onClick={() => cambiar(setDireccion)(d)}>
              <i className={`bi ${icono} me-1`} />
              {texto}
            </button>
          </li>
        ))}
      </ul>

      <div className="card card-suave shadow-sm mb-3">
        <div className="card-body p-3">
          <div className="row g-2 align-items-end">
            <div className="col-md-6">
              <div className="input-group">
                <span className="input-group-text bg-white border-end-0">
                  <i className="bi bi-search text-muted" />
                </span>
                <input className="form-control border-start-0 ps-0" placeholder="Razón social o folio" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
                {busqueda && (
                  <button className="btn btn-outline-secondary" onClick={() => setBusqueda("")}>
                    <i className="bi bi-x" />
                  </button>
                )}
              </div>
            </div>
            <div className="col-6 col-md-3">
              <input type="date" className="form-control" value={desde} onChange={(e) => cambiar(setDesde)(e.target.value)} title="Emitidos desde" />
            </div>
            <div className="col-6 col-md-3">
              <input type="date" className="form-control" value={hasta} onChange={(e) => cambiar(setHasta)(e.target.value)} title="Emitidos hasta" />
            </div>
          </div>
          <div className="d-flex flex-wrap align-items-center gap-2 mt-3">
            <span className="text-muted small me-1">
              <i className="bi bi-funnel me-1" />
              Estado:
            </span>
            {ESTADOS.map((x) => (
              <button
                key={x.valor}
                className={`btn btn-sm ${estado === x.valor ? "btn-primary" : "btn-outline-secondary"}`}
                onClick={() => cambiar(setEstado)(x.valor)}
              >
                {x.texto}
              </button>
            ))}
            <span className="ms-auto text-muted small">
              {cargando && <span className="spinner-border spinner-border-sm me-2" />}
              {datos?.total ?? 0} documentos
            </span>
          </div>
        </div>
      </div>

      <Alerta error={error} />
      {!datos && !error ? (
        <Cargando />
      ) : datos?.items.length === 0 ? (
        <Vacio icono="bi-receipt" texto="Sin documentos para estos filtros." />
      ) : (
        <div className="card card-suave shadow-sm">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 tabla-clic">
              <thead className="table-light">
                <tr>
                  <th>Emisión</th>
                  <th>Documento</th>
                  <th>{direccion === "emitido" ? "Cliente" : "Proveedor"}</th>
                  <th className="text-end">Total</th>
                  <th className="text-end">Saldo</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {datos?.items.map((d) => (
                  <tr key={d.id} onClick={() => setAbierto(d.id)}>
                    <td className="text-nowrap">{fecha(d.fechaEmision)}</td>
                    <td className="text-nowrap">
                      {tipoDte(d.tipoDte)} <span className="fw-semibold">{d.folio}</span>
                    </td>
                    <td>
                      {d.razonSocial}
                      <small className="text-muted d-block">{d.rutContraparte}</small>
                    </td>
                    <td className="monto">{pesos(d.tipoDte === 61 ? -d.montoTotal : d.montoTotal)}</td>
                    <td className="monto fw-semibold">{d.saldoPendiente > 0 && d.estado !== "excluido" ? pesos(d.saldoPendiente) : ""}</td>
                    <td>
                      <BadgeDocumento estado={d.estado} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {datos && <Paginacion total={datos.total} pagina={pagina} porPagina={POR_PAGINA} onCambiar={setPagina} />}

      {abierto !== null && <DocumentoModal id={abierto} onCerrar={() => setAbierto(null)} onCambio={recargar} />}
    </div>
  );
}

function DocumentoModal({ id, onCerrar, onCambio }: { id: number; onCerrar: () => void; onCambio: () => void }) {
  const empresa = useEmpresa();
  const { puede } = useSesion();
  const base = `/empresas/${empresa.id}`;
  const det = useCarga<DocumentoDetalle>(`${base}/documentos/${id}`);
  const d = det.datos;
  const esNotaConSaldo = !!d && d.tipoDte === 61 && d.saldoPendiente > 0;
  // Facturas del mismo emisor/receptor con saldo, para aplicarles la nota de crédito.
  const destinos = useCarga<Pagina<Documento>>(esNotaConSaldo ? `${base}/documentos` : null, {
    direccion: d?.direccion,
    rut: d?.rutContraparte,
    conSaldo: "true",
    porPagina: 100,
  });
  const [destino, setDestino] = useState<number | "">("");
  const [error, setError] = useState("");

  const recargar = () => {
    det.recargar();
    destinos.recargar();
    onCambio();
  };

  const aplicar = async () => {
    try {
      await api.post(`${base}/documentos/${id}/aplicar-nota-credito`, { documentoId: destino });
      setDestino("");
      recargar();
    } catch (e) {
      setError(mensajeError(e));
    }
  };

  const deshacerNota = async (aplicacionId: number) => {
    if (!confirm("¿Deshacer la aplicación de la nota de crédito?")) return;
    try {
      await api.delete(`${base}/notas-credito-aplicaciones/${aplicacionId}`);
      recargar();
    } catch (e) {
      setError(mensajeError(e));
    }
  };

  return (
    <Modal titulo={d ? `${d.tipoNombre ?? tipoDte(d.tipoDte)} ${d.folio}` : "Documento"} onCerrar={onCerrar}>
      {!d ? (
        det.error ? <Alerta error={det.error} /> : <Cargando />
      ) : (
        <>
          <Alerta error={error} onCerrar={() => setError("")} />
          <div className="d-flex flex-wrap justify-content-between gap-2 mb-3 p-3 bg-light rounded">
            <div>
              <div className="fw-semibold">{d.razonSocial}</div>
              <small className="text-muted">
                {d.rutContraparte} · {d.direccion === "emitido" ? "Venta" : "Compra"} · emitido el {fecha(d.fechaEmision)}
              </small>
              {d.refFolio && (
                <small className="d-block text-muted">
                  Referencia: {tipoDte(d.refTipoDte)} {d.refFolio}
                </small>
              )}
            </div>
            <div className="text-end">
              <div className="fs-4 fw-bold monto">{pesos(d.montoTotal)}</div>
              <BadgeDocumento estado={d.estado} />
              {d.saldoPendiente > 0 && d.estado !== "excluido" && <small className="text-muted ms-2">saldo {pesos(d.saldoPendiente)}</small>}
            </div>
          </div>

          <div className="row text-center small mb-3">
            <div className="col">
              <div className="text-muted">Neto</div>
              {pesos(d.montoNeto)}
            </div>
            <div className="col">
              <div className="text-muted">Exento</div>
              {pesos(d.montoExento)}
            </div>
            <div className="col">
              <div className="text-muted">IVA</div>
              {pesos(d.montoIva)}
            </div>
          </div>

          {d.estado === "excluido" && (
            <div className="alert alert-secondary small">
              Este proveedor/cliente se concilia por categoría (ej. combustible): sus pagos no se cruzan factura a factura.
            </div>
          )}

          <h6 className="text-muted">Pagos</h6>
          {d.pagos.length === 0 ? (
            <p className="text-muted small">Sin pagos conciliados.</p>
          ) : (
            <ul className="list-group mb-3">
              {d.pagos.map((p) => (
                <li key={p.id} className="list-group-item d-flex justify-content-between">
                  <span>
                    {fecha(p.fecha)} · <span className="glosa">{p.glosa}</span>
                    <small className="text-muted ms-2">{p.origen === "manual" ? "manual" : "automática"}</small>
                  </span>
                  <span className="monto fw-semibold">{pesos(p.montoAplicado)}</span>
                </li>
              ))}
            </ul>
          )}

          <h6 className="text-muted">Notas de crédito</h6>
          {d.notasCredito.length === 0 ? (
            <p className="text-muted small">Sin notas de crédito aplicadas.</p>
          ) : (
            <ul className="list-group mb-3">
              {d.notasCredito.map((n) => (
                <li key={n.id} className="list-group-item d-flex justify-content-between align-items-center gap-2">
                  <span>
                    {tipoDte(n.tipoDte)} {n.folio}
                    <small className="text-muted ms-2">{n.origen === "auto" ? "aplicada sola (RCV)" : "manual"}</small>
                  </span>
                  <span className="d-flex align-items-center gap-2">
                    <span className="monto fw-semibold">{pesos(n.monto)}</span>
                    {puede("operador") && (
                      <button className="btn btn-outline-danger btn-sm" onClick={() => deshacerNota(n.id)} title="Deshacer">
                        <i className="bi bi-arrow-counterclockwise" />
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {esNotaConSaldo && puede("operador") && (
            <div className="border rounded p-3">
              <label className="form-label fw-semibold">Aplicar esta nota de crédito a</label>
              <div className="d-flex gap-2">
                <select className="form-select" value={destino} onChange={(e) => setDestino(e.target.value === "" ? "" : Number(e.target.value))}>
                  <option value="">— Elegir documento de {d.razonSocial} —</option>
                  {destinos.datos?.items
                    .filter((x) => x.tipoDte !== 61)
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {tipoDte(x.tipoDte)} {x.folio} · {fecha(x.fechaEmision)} · saldo {pesos(x.saldoPendiente)}
                      </option>
                    ))}
                </select>
                <button className="btn btn-primary text-nowrap" disabled={destino === ""} onClick={aplicar}>
                  Aplicar
                </button>
              </div>
              <small className="text-muted">En compras el SII no informa a qué factura corresponde la nota; en ventas se aplica sola.</small>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
