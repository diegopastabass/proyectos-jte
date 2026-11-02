import { useEffect, useState } from "react";
import { Alerta, BadgeMovimiento, Cargando, Encabezado, Paginacion, Vacio } from "../components/comunes";
import ConciliarModal from "../components/ConciliarModal";
import { BANCOS, fecha, pesos } from "../formato";
import { useEmpresa } from "../sesion";
import type { CuentaBancaria, EstadoMovimiento, Movimiento, Pagina } from "../types";
import { useCarga } from "../useCarga";

const ESTADOS: { valor: EstadoMovimiento | "por_conciliar" | ""; texto: string }[] = [
  { valor: "por_conciliar", texto: "Por conciliar" },
  { valor: "conciliado", texto: "Conciliados" },
  { valor: "ignorado", texto: "Ignorados" },
  { valor: "", texto: "Todos" },
];

const POR_PAGINA = 50;

export default function Movimientos() {
  const empresa = useEmpresa();
  const base = `/empresas/${empresa.id}`;
  const [estado, setEstado] = useState<(typeof ESTADOS)[number]["valor"]>("por_conciliar");
  const [signo, setSigno] = useState<"" | "abono" | "cargo">("");
  const [cuentaId, setCuentaId] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [q, setQ] = useState("");
  const [pagina, setPagina] = useState(1);
  const [abierto, setAbierto] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(busqueda.trim());
      setPagina(1);
    }, 350);
    return () => clearTimeout(t);
  }, [busqueda]);

  const cuentas = useCarga<CuentaBancaria[]>(`${base}/cuentas`);
  const { datos, error, cargando, recargar } = useCarga<Pagina<Movimiento>>(`${base}/movimientos`, {
    estado: estado === "por_conciliar" ? "" : estado,
    porConciliar: estado === "por_conciliar" ? "true" : "",
    signo,
    cuentaId,
    desde,
    hasta,
    q,
    pagina,
    porPagina: POR_PAGINA,
  });
  const filas = datos?.items ?? [];

  const cambiar = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPagina(1);
  };
  const nombreCuenta = (id: number) => {
    const c = cuentas.datos?.find((x) => x.id === id);
    return c ? `${BANCOS[c.banco] ?? c.banco} ${c.numero.slice(-4)}` : "";
  };

  return (
    <div className="container-fluid py-4 px-lg-5">
      <Encabezado titulo="Movimientos bancarios" subtitulo="Haga clic en un movimiento para conciliarlo o ver con qué se concilió." />

      <div className="card card-suave shadow-sm mb-3">
        <div className="card-body p-3">
          <div className="row g-2 align-items-end">
            <div className="col-12 col-xl-4">
              <div className="input-group">
                <span className="input-group-text bg-white border-end-0">
                  <i className="bi bi-search text-muted" />
                </span>
                <input className="form-control border-start-0 ps-0" placeholder="Buscar en la glosa" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
                {busqueda && (
                  <button className="btn btn-outline-secondary" onClick={() => setBusqueda("")}>
                    <i className="bi bi-x" />
                  </button>
                )}
              </div>
            </div>
            <div className="col-6 col-md-3 col-xl-2">
              <select className="form-select" value={signo} onChange={(e) => cambiar(setSigno)(e.target.value as typeof signo)}>
                <option value="">Abonos y cargos</option>
                <option value="abono">Solo abonos</option>
                <option value="cargo">Solo cargos</option>
              </select>
            </div>
            <div className="col-6 col-md-3 col-xl-2">
              <select className="form-select" value={cuentaId} onChange={(e) => cambiar(setCuentaId)(e.target.value)}>
                <option value="">Todas las cuentas</option>
                {cuentas.datos?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {BANCOS[c.banco] ?? c.banco} {c.numero}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-6 col-md-3 col-xl-2">
              <input type="date" className="form-control" value={desde} onChange={(e) => cambiar(setDesde)(e.target.value)} title="Desde" />
            </div>
            <div className="col-6 col-md-3 col-xl-2">
              <input type="date" className="form-control" value={hasta} onChange={(e) => cambiar(setHasta)(e.target.value)} title="Hasta" />
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
              {datos?.total ?? 0} movimientos
            </span>
          </div>
        </div>
      </div>

      <Alerta error={error} />
      {!datos && !error ? (
        <Cargando />
      ) : filas.length === 0 ? (
        <Vacio icono="bi-bank" texto={estado === "por_conciliar" ? "No quedan movimientos por conciliar." : "Sin movimientos para estos filtros."} />
      ) : (
        <div className="card card-suave shadow-sm">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 tabla-clic">
              <thead className="table-light">
                <tr>
                  <th>Fecha</th>
                  <th>Glosa</th>
                  <th className="d-none d-lg-table-cell">Cuenta</th>
                  <th className="text-end">Monto</th>
                  <th className="text-end d-none d-md-table-cell">Por conciliar</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((m) => (
                  <tr key={m.id} onClick={() => setAbierto(m.id)}>
                    <td className="text-nowrap">{fecha(m.fecha)}</td>
                    <td>
                      <span className="glosa">{m.glosa}</span>
                      {m.nota && <i className="bi bi-chat-left-text text-muted ms-2" title={m.nota} />}
                    </td>
                    <td className="d-none d-lg-table-cell text-muted small text-nowrap">{nombreCuenta(m.cuentaId)}</td>
                    <td className={`monto fw-semibold ${m.monto > 0 ? "text-success" : "text-danger"}`}>{pesos(m.monto)}</td>
                    <td className="monto d-none d-md-table-cell text-muted">
                      {m.estado === "conciliado" || m.estado === "ignorado" ? "" : pesos(Math.abs(m.monto) - m.montoConciliado)}
                    </td>
                    <td>
                      <BadgeMovimiento estado={m.estado} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {datos && (
        <Paginacion total={datos.total} pagina={pagina} porPagina={POR_PAGINA} onCambiar={setPagina} />
      )}

      {abierto !== null && <ConciliarModal movimientoId={abierto} onCerrar={() => setAbierto(null)} onCambio={recargar} />}
    </div>
  );
}
