import { useState } from "react";
import { Link } from "react-router-dom";
import api, { mensajeError } from "../api";
import { Alerta, Cargando, Encabezado, Vacio } from "../components/comunes";
import ResultadoMotor from "../components/ResultadoMotor";
import { BANCOS, fecha, pesos } from "../formato";
import { useEmpresa, useSesion } from "../sesion";
import type { Resumen as TResumen, ResumenMotor } from "../types";
import { useCarga } from "../useCarga";

export default function Resumen() {
  const empresa = useEmpresa();
  const { puede } = useSesion();
  const { datos, error, cargando, recargar } = useCarga<TResumen>(`/empresas/${empresa.id}/resumen`);
  const [motor, setMotor] = useState<ResumenMotor | null>(null);
  const [ejecutando, setEjecutando] = useState(false);
  const [errorMotor, setErrorMotor] = useState("");

  const ejecutarMotor = async () => {
    setEjecutando(true);
    setErrorMotor("");
    try {
      const r = await api.post<ResumenMotor>(`/empresas/${empresa.id}/motor/ejecutar`, {});
      setMotor(r.data);
      recargar();
    } catch (e) {
      setErrorMotor(mensajeError(e));
    } finally {
      setEjecutando(false);
    }
  };

  if (!datos) return <div className="container py-4">{error ? <Alerta error={error} /> : <Cargando />}</div>;

  const mov = (estado: string) => datos.movimientos.find((m) => m.estado === estado);
  const totalMov = datos.movimientos.reduce((s, m) => s + m.cantidad, 0);
  const conciliados = mov("conciliado")?.cantidad ?? 0;
  const ignorados = mov("ignorado")?.cantidad ?? 0;
  const porConciliar = (mov("pendiente")?.cantidad ?? 0) + (mov("parcial")?.cantidad ?? 0);
  const montoPorConciliar = (mov("pendiente")?.porConciliar ?? 0) + (mov("parcial")?.porConciliar ?? 0);
  const avance = totalMov ? Math.round(((conciliados + ignorados) / totalMov) * 100) : 0;
  const doc = (d: string) => datos.documentos.find((x) => x.direccion === d);
  const rcv = (t: string) => datos.rcv.find((x) => x.tipo === t)?.hasta ?? null;

  if (totalMov === 0 && datos.documentos.length === 0) {
    return (
      <div className="container py-4">
        <Encabezado titulo="Resumen" subtitulo={empresa.razonSocial} />
        <Vacio icono="bi-cloud-upload" texto="Todavía no hay cartolas ni documentos importados.">
          {puede("operador") && (
            <Link to="/importar" className="btn btn-primary">
              <i className="bi bi-upload me-1" /> Importar archivos
            </Link>
          )}
        </Vacio>
      </div>
    );
  }

  return (
    <div className="container py-4">
      <Encabezado titulo="Resumen" subtitulo={empresa.razonSocial}>
        {cargando && <span className="spinner-border spinner-border-sm text-secondary align-self-center" />}
        {puede("operador") && (
          <button className="btn btn-primary" onClick={ejecutarMotor} disabled={ejecutando}>
            {ejecutando ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-magic me-1" />}
            Buscar coincidencias
          </button>
        )}
      </Encabezado>

      <Alerta error={errorMotor} onCerrar={() => setErrorMotor("")} />
      {motor && <ResultadoMotor r={motor} onCerrar={() => setMotor(null)} />}

      <div className="row g-3 mb-4">
        <Tarjeta icono="bi-check2-circle" color="success" titulo="Avance de conciliación" valor={`${avance}%`}>
          <div className="progress mt-2" style={{ height: 6 }}>
            <div className="progress-bar bg-success" style={{ width: `${avance}%` }} />
          </div>
          <small className="text-muted">
            {conciliados} conciliados, {ignorados} ignorados de {totalMov}
          </small>
        </Tarjeta>
        <Tarjeta icono="bi-hourglass-split" color="warning" titulo="Movimientos por conciliar" valor={String(porConciliar)} enlace="/movimientos">
          <small className="text-muted">{pesos(montoPorConciliar)} sin documento ni categoría</small>
        </Tarjeta>
        <Tarjeta icono="bi-inbox" color="primary" titulo="Sugerencias por revisar" valor={String(datos.sugerenciasPendientes)} enlace="/bandeja">
          <small className="text-muted">Propuestas del motor esperando confirmación</small>
        </Tarjeta>
      </div>

      <div className="row g-3 mb-4">
        <Tarjeta icono="bi-arrow-down-left-circle" color="success" titulo="Por cobrar (ventas)" valor={pesos(doc("emitido")?.saldo ?? 0)} enlace="/documentos" ancho="col-md-6">
          <small className="text-muted">{doc("emitido")?.cantidad ?? 0} documentos con saldo · RCV hasta {fecha(rcv("rcv_venta"))}</small>
        </Tarjeta>
        <Tarjeta icono="bi-arrow-up-right-circle" color="danger" titulo="Por pagar (compras)" valor={pesos(doc("recibido")?.saldo ?? 0)} enlace="/documentos" ancho="col-md-6">
          <small className="text-muted">{doc("recibido")?.cantidad ?? 0} documentos con saldo · RCV hasta {fecha(rcv("rcv_compra"))}</small>
        </Tarjeta>
      </div>

      <h5 className="mb-2">Cuentas bancarias</h5>
      <div className="card card-suave shadow-sm">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>Banco</th>
                <th>Cuenta</th>
                <th>Última cartola</th>
                <th className="text-end">Saldo según banco</th>
              </tr>
            </thead>
            <tbody>
              {datos.cuentas.map((c) => (
                <tr key={c.id}>
                  <td>{BANCOS[c.banco] ?? c.banco}</td>
                  <td>
                    {c.numero}
                    {c.alias && <small className="text-muted ms-2">{c.alias}</small>}
                  </td>
                  <td>{c.hasta ? `N° ${c.nCartola ?? "—"} hasta ${fecha(c.hasta)}` : <span className="text-muted">Sin cartolas</span>}</td>
                  <td className="monto fw-semibold">{pesos(c.saldo)}</td>
                </tr>
              ))}
              {datos.cuentas.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-muted py-3">
                    Se crean solas al importar la primera cartola.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Tarjeta({
  icono,
  color,
  titulo,
  valor,
  enlace,
  ancho = "col-md-4",
  children,
}: {
  icono: string;
  color: string;
  titulo: string;
  valor: string;
  enlace?: string;
  ancho?: string;
  children?: React.ReactNode;
}) {
  const cuerpo = (
    <div className="card card-suave shadow-sm h-100">
      <div className="card-body">
        <div className="d-flex align-items-center gap-2 text-muted mb-1">
          <i className={`bi ${icono} text-${color}`} />
          <span>{titulo}</span>
          {enlace && <i className="bi bi-chevron-right ms-auto small" />}
        </div>
        <div className="fs-3 fw-bold text-dark">{valor}</div>
        {children}
      </div>
    </div>
  );
  return <div className={ancho}>{enlace ? <Link to={enlace}>{cuerpo}</Link> : cuerpo}</div>;
}
