import { Fragment, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Alerta, Cargando, Encabezado, Vacio } from "../components/comunes";
import { BANCOS, pesos } from "../formato";
import { useEmpresa } from "../sesion";
import type { CuentaBancaria, Proyecto, ReporteCategorias, ReporteContraparte } from "../types";
import { useCarga } from "../useCarga";

const PESTANAS = [
  { id: "categorias", texto: "Por categoría", icono: "bi-tags" },
  { id: "proyectos", texto: "Por proyecto", icono: "bi-briefcase" },
  { id: "contrapartes", texto: "Por proveedor y cliente", icono: "bi-people" },
] as const;

const TIPOS_CATEGORIA: Record<string, string> = {
  gasto: "Gasto",
  ingreso: "Ingreso",
  traspaso: "Traspaso",
  retiro: "Retiro",
  impuesto: "Impuesto",
  otro: "Otro",
};

const NOMBRES_MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const nombreMes = (m: string) => `${NOMBRES_MES[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`;

/** Atajos de período: año en curso, mes en curso y mes anterior. */
function periodos() {
  const hoy = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const a = hoy.getFullYear();
  const m = hoy.getMonth();
  return [
    { texto: "Todo", desde: "", hasta: "" },
    { texto: `Año ${a}`, desde: `${a}-01-01`, hasta: `${a}-12-31` },
    { texto: "Este mes", desde: iso(new Date(Date.UTC(a, m, 1))), hasta: iso(new Date(Date.UTC(a, m + 1, 0))) },
    { texto: "Mes anterior", desde: iso(new Date(Date.UTC(a, m - 1, 1))), hasta: iso(new Date(Date.UTC(a, m, 0))) },
  ];
}

export default function Reportes() {
  const empresa = useEmpresa();
  const base = `/empresas/${empresa.id}`;
  const [pestana, setPestana] = useState<(typeof PESTANAS)[number]["id"]>("categorias");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [cuentaId, setCuentaId] = useState("");
  const [proyectoId, setProyectoId] = useState("");
  const cuentas = useCarga<CuentaBancaria[]>(`${base}/cuentas`);
  const proyectos = useCarga<Proyecto[]>(`${base}/proyectos`, { incluirInactivos: "true" });

  return (
    <div className="container py-4">
      <Encabezado titulo="Reportes" subtitulo="En qué se fue la plata: por categoría, por proyecto y por proveedor." />

      <div className="card card-suave shadow-sm mb-3">
        <div className="card-body p-3">
          <div className="row g-2 align-items-end">
            <div className="col-6 col-md-3 col-xl-2">
              <label className="form-label small text-muted mb-1">Desde</label>
              <input type="date" className="form-control" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </div>
            <div className="col-6 col-md-3 col-xl-2">
              <label className="form-label small text-muted mb-1">Hasta</label>
              <input type="date" className="form-control" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </div>
            {pestana !== "proyectos" && (
              <>
                <div className="col-6 col-md-3 col-xl-3">
                  <select className="form-select" value={cuentaId} onChange={(e) => setCuentaId(e.target.value)}>
                    <option value="">Todas las cuentas</option>
                    {cuentas.datos?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {BANCOS[c.banco] ?? c.banco} {c.numero}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-6 col-md-3 col-xl-3">
                  <select className="form-select" value={proyectoId} onChange={(e) => setProyectoId(e.target.value)}>
                    <option value="">Todos los proyectos</option>
                    {proyectos.datos?.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.codigo ? `${p.codigo} · ` : ""}
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>
          <div className="d-flex flex-wrap gap-2 mt-2">
            {periodos().map((p) => (
              <button
                key={p.texto}
                className={`btn btn-sm ${desde === p.desde && hasta === p.hasta ? "btn-primary" : "btn-outline-secondary"}`}
                onClick={() => {
                  setDesde(p.desde);
                  setHasta(p.hasta);
                }}
              >
                {p.texto}
              </button>
            ))}
          </div>
        </div>
      </div>

      <ul className="nav nav-tabs mb-3">
        {PESTANAS.map((p) => (
          <li className="nav-item" key={p.id}>
            <button className={`nav-link ${pestana === p.id ? "active" : ""}`} onClick={() => setPestana(p.id)}>
              <i className={`bi ${p.icono} me-1`} />
              {p.texto}
            </button>
          </li>
        ))}
      </ul>

      {pestana === "categorias" && <PorCategoria filtros={{ desde, hasta, cuentaId, proyectoId }} />}
      {pestana === "proyectos" && <PorProyecto filtros={{ desde, hasta }} />}
      {pestana === "contrapartes" && <PorContraparte filtros={{ desde, hasta, cuentaId, proyectoId }} />}
    </div>
  );
}

type Filtros = Record<string, string>;

function PorCategoria({ filtros }: { filtros: Filtros }) {
  const empresa = useEmpresa();
  const { datos, error, cargando } = useCarga<ReporteCategorias>(`/empresas/${empresa.id}/reportes/categorias`, filtros);
  const [abierta, setAbierta] = useState<number | null>(null);

  if (!datos) return error ? <Alerta error={error} /> : <Cargando />;
  const gastos = datos.categorias.reduce((s, c) => s + c.cargos, 0);
  const ingresos = datos.categorias.reduce((s, c) => s + c.abonos, 0);
  const mayor = Math.max(1, ...datos.categorias.map((c) => c.cargos + c.abonos));
  const enlace = (categoriaId: number) => {
    const p = new URLSearchParams({ categoriaId: String(categoriaId) });
    for (const k of ["desde", "hasta", "proyectoId"]) if (filtros[k]) p.set(k, filtros[k]);
    return `/movimientos?${p}`;
  };

  return (
    <>
      <div className="row g-3 mb-3">
        <Cifra titulo="Gastos por categoría" valor={gastos} color="danger" icono="bi-tags" />
        <Cifra titulo="Pagado con factura" valor={datos.documentos.cargos} color="secondary" icono="bi-receipt" detalle={`${datos.documentos.movimientos} movimientos`} />
        <Cifra titulo="Por conciliar (cargos)" valor={datos.porConciliar.cargos} color="warning" icono="bi-hourglass-split" detalle={`${datos.porConciliar.movimientos} movimientos sin clasificar`} />
      </div>

      {datos.categorias.length === 0 ? (
        <Vacio icono="bi-tags" texto="Sin movimientos conciliados por categoría en este período." />
      ) : (
        <div className="card card-suave shadow-sm">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 tabla-clic">
              <thead className="table-light">
                <tr>
                  <th>Categoría</th>
                  <th className="text-end">Gastos</th>
                  <th className="text-end">Ingresos</th>
                  <th className="text-end d-none d-md-table-cell">Mov.</th>
                  <th className="d-none d-lg-table-cell" style={{ width: "25%" }} />
                </tr>
              </thead>
              <tbody>
                {datos.categorias.map((c) => (
                  <Fragment key={c.id}>
                    <tr onClick={() => setAbierta(abierta === c.id ? null : c.id)}>
                      <td>
                        <i className={`bi ${abierta === c.id ? "bi-chevron-down" : "bi-chevron-right"} small text-muted me-2`} />
                        {c.nombre}
                        <span className="badge bg-light text-secondary border ms-2">{TIPOS_CATEGORIA[c.tipo] ?? c.tipo}</span>
                      </td>
                      <td className="monto text-danger fw-semibold">{c.cargos ? pesos(c.cargos) : ""}</td>
                      <td className="monto text-success fw-semibold">{c.abonos ? pesos(c.abonos) : ""}</td>
                      <td className="monto d-none d-md-table-cell text-muted">{c.movimientos}</td>
                      <td className="d-none d-lg-table-cell">
                        <div className="progress" style={{ height: 6 }}>
                          <div className={`progress-bar ${c.cargos >= c.abonos ? "bg-danger" : "bg-success"}`} style={{ width: `${((c.cargos + c.abonos) / mayor) * 100}%` }} />
                        </div>
                      </td>
                    </tr>
                    {abierta === c.id && (
                      <tr className="table-light">
                        <td colSpan={5} style={{ cursor: "default" }}>
                          <div className="d-flex flex-wrap gap-2 mb-2">
                            {datos.meses
                              .filter((m) => c.meses[m])
                              .map((m) => (
                                <div key={m} className="border rounded px-2 py-1 bg-white small text-center">
                                  <div className="text-muted">{nombreMes(m)}</div>
                                  {c.meses[m].cargos > 0 && <div className="monto text-danger">{pesos(c.meses[m].cargos)}</div>}
                                  {c.meses[m].abonos > 0 && <div className="monto text-success">{pesos(c.meses[m].abonos)}</div>}
                                </div>
                              ))}
                          </div>
                          <Link to={enlace(c.id)} className="small">
                            Ver los {c.movimientos} movimientos <i className="bi bi-arrow-right" />
                          </Link>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
              <tfoot className="table-light fw-semibold">
                <tr>
                  <td>Total categorizado</td>
                  <td className="monto text-danger">{pesos(gastos)}</td>
                  <td className="monto text-success">{pesos(ingresos)}</td>
                  <td className="d-none d-md-table-cell" />
                  <td className="d-none d-lg-table-cell" />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
      {cargando && <small className="text-muted">Actualizando…</small>}
      <small className="text-muted d-block mt-2">
        Por fecha del movimiento bancario, con IVA incluido. Para que un gasto aparezca aquí (ej. peajes o AWS), concílielo con una categoría, a mano, con su boleta o con una regla.
      </small>
    </>
  );
}

function PorProyecto({ filtros }: { filtros: Filtros }) {
  const empresa = useEmpresa();
  const navegar = useNavigate();
  const { datos, error } = useCarga<Proyecto[]>(`/empresas/${empresa.id}/proyectos`, { ...filtros, incluirInactivos: "true" });

  if (!datos) return error ? <Alerta error={error} /> : <Cargando />;
  if (datos.length === 0) return <Vacio icono="bi-briefcase" texto="No hay proyectos creados." />;
  const suma = (f: (p: Proyecto) => number) => datos.reduce((s, p) => s + f(p), 0);

  return (
    <div className="card card-suave shadow-sm">
      <div className="table-responsive">
        <table className="table table-hover align-middle mb-0 tabla-clic">
          <thead className="table-light">
            <tr>
              <th>Proyecto</th>
              <th className="text-end">Ingresos netos</th>
              <th className="text-end">Gastos netos</th>
              <th className="text-end">Resultado</th>
              <th className="text-end d-none d-lg-table-cell">IVA débito</th>
              <th className="text-end d-none d-lg-table-cell">IVA crédito</th>
              <th className="text-end d-none d-xl-table-cell">IVA boletas</th>
              <th className="text-end">IVA a pagar</th>
            </tr>
          </thead>
          <tbody>
            {datos.map((p) => (
              <tr key={p.id} onClick={() => navegar(`/proyectos/${p.id}`)}>
                <td>
                  {p.nombre}
                  {p.codigo && <small className="text-muted ms-2">{p.codigo}</small>}
                  {!p.activo && <span className="badge text-bg-secondary ms-2">Cerrado</span>}
                </td>
                <td className="monto text-success">{pesos(p.balance.ingresos.neto)}</td>
                <td className="monto text-danger">{pesos(p.balance.gastos.neto)}</td>
                <td className={`monto fw-semibold ${p.balance.resultado < 0 ? "text-danger" : ""}`}>{pesos(p.balance.resultado)}</td>
                <td className="monto d-none d-lg-table-cell">{pesos(p.balance.iva.debito)}</td>
                <td className="monto d-none d-lg-table-cell">{pesos(p.balance.iva.credito)}</td>
                <td className="monto d-none d-xl-table-cell text-muted">{pesos(p.balance.gastos.ivaBoletas)}</td>
                <td className="monto">{pesos(p.balance.iva.saldo)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="table-light fw-semibold">
            <tr>
              <td>Total</td>
              <td className="monto">{pesos(suma((p) => p.balance.ingresos.neto))}</td>
              <td className="monto">{pesos(suma((p) => p.balance.gastos.neto))}</td>
              <td className="monto">{pesos(suma((p) => p.balance.resultado))}</td>
              <td className="monto d-none d-lg-table-cell">{pesos(suma((p) => p.balance.iva.debito))}</td>
              <td className="monto d-none d-lg-table-cell">{pesos(suma((p) => p.balance.iva.credito))}</td>
              <td className="monto d-none d-xl-table-cell">{pesos(suma((p) => p.balance.gastos.ivaBoletas))}</td>
              <td className="monto">{pesos(suma((p) => p.balance.iva.saldo))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function PorContraparte({ filtros }: { filtros: Filtros }) {
  const empresa = useEmpresa();
  const { datos, error } = useCarga<ReporteContraparte[]>(`/empresas/${empresa.id}/reportes/contrapartes`, filtros);
  if (!datos) return error ? <Alerta error={error} /> : <Cargando />;
  if (datos.length === 0) return <Vacio icono="bi-people" texto="Sin pagos ni cobros conciliados con facturas en este período." />;

  return (
    <>
      <div className="card card-suave shadow-sm">
        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>Razón social</th>
                <th className="d-none d-md-table-cell">RUT</th>
                <th className="text-end">Pagado</th>
                <th className="text-end">Cobrado</th>
                <th className="text-end d-none d-md-table-cell">Documentos</th>
              </tr>
            </thead>
            <tbody>
              {datos.map((c) => (
                <tr key={c.rut}>
                  <td>{c.razonSocial}</td>
                  <td className="d-none d-md-table-cell text-muted small">{c.rut}</td>
                  <td className="monto text-danger">{c.pagado ? pesos(c.pagado) : ""}</td>
                  <td className="monto text-success">{c.cobrado ? pesos(c.cobrado) : ""}</td>
                  <td className="monto d-none d-md-table-cell text-muted">{c.documentos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <small className="text-muted">Montos conciliados con facturas, por fecha del movimiento bancario.</small>
    </>
  );
}

function Cifra({ titulo, valor, color, icono, detalle }: { titulo: string; valor: number; color: string; icono: string; detalle?: string }) {
  return (
    <div className="col-md-4">
      <div className="card card-suave shadow-sm h-100">
        <div className="card-body">
          <div className="text-muted mb-1">
            <i className={`bi ${icono} text-${color} me-1`} /> {titulo}
          </div>
          <div className="fs-3 fw-bold">{pesos(valor)}</div>
          {detalle && <small className="text-muted">{detalle}</small>}
        </div>
      </div>
    </div>
  );
}
