import { useRef, useState } from "react";
import api, { mensajeError } from "../api";
import { Alerta, Encabezado, Paginacion } from "../components/comunes";
import ResultadoMotor from "../components/ResultadoMotor";
import { fecha, fechaHora } from "../formato";
import { useEmpresa } from "../sesion";
import type { Importacion, ResultadoImportacion, ResumenMotor } from "../types";
import { useCarga } from "../useCarga";

const TIPOS: Record<Importacion["tipo"], { texto: string; icono: string }> = {
  cartola: { texto: "Cartola", icono: "bi-bank" },
  rcv_compra: { texto: "RCV compras", icono: "bi-cart" },
  rcv_venta: { texto: "RCV ventas", icono: "bi-receipt" },
};

interface Envio {
  nombre: string;
  estado: "esperando" | "subiendo" | "ok" | "error";
  resultado?: ResultadoImportacion;
  error?: string;
}

export default function Importar() {
  const empresa = useEmpresa();
  const [envios, setEnvios] = useState<Envio[]>([]);
  const [arrastrando, setArrastrando] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [motor, setMotor] = useState<ResumenMotor | null>(null);
  const [errorMotor, setErrorMotor] = useState("");
  const [pagina, setPagina] = useState(1);
  const input = useRef<HTMLInputElement>(null);
  const historial = useCarga<Importacion[]>(`/empresas/${empresa.id}/importaciones`);

  const actualizar = (i: number, cambio: Partial<Envio>) =>
    setEnvios((lista) => lista.map((e, j) => (j === i ? { ...e, ...cambio } : e)));

  /** Se suben de a uno, en orden: así la advertencia de "cartola faltante" es confiable. */
  const procesar = async (archivos: File[]) => {
    if (archivos.length === 0 || procesando) return;
    const ordenados = [...archivos].sort((a, b) => a.name.localeCompare(b.name));
    setEnvios(ordenados.map((f) => ({ nombre: f.name, estado: "esperando" })));
    setMotor(null);
    setErrorMotor("");
    setProcesando(true);

    let algunoNuevo = false;
    for (const [i, archivo] of ordenados.entries()) {
      actualizar(i, { estado: "subiendo" });
      try {
        const datos = new FormData();
        datos.append("archivo", archivo);
        const r = await api.post<ResultadoImportacion>(`/empresas/${empresa.id}/importaciones`, datos);
        actualizar(i, { estado: "ok", resultado: r.data });
        if (r.data.importacion.filasNuevas > 0) algunoNuevo = true;
      } catch (e) {
        actualizar(i, { estado: "error", error: mensajeError(e) });
      }
    }

    // Con datos nuevos, se buscan coincidencias de inmediato para dejar la bandeja lista.
    if (algunoNuevo) {
      try {
        const r = await api.post<ResumenMotor>(`/empresas/${empresa.id}/motor/ejecutar`, {});
        setMotor(r.data);
      } catch (e) {
        setErrorMotor(`Los archivos se importaron, pero falló la búsqueda de coincidencias: ${mensajeError(e)}`);
      }
    }
    setProcesando(false);
    historial.recargar();
  };

  const alSoltar = (e: React.DragEvent) => {
    e.preventDefault();
    setArrastrando(false);
    void procesar(Array.from(e.dataTransfer.files));
  };

  const filas = historial.datos ?? [];
  const POR_PAGINA = 15;

  return (
    <div className="container py-4">
      <Encabezado
        titulo="Importar"
        subtitulo="Cartolas de BancoEstado (Excel) y Registro de Compras y Ventas del SII (CSV)"
      />

      <div
        className={`zona-archivos p-5 text-center mb-4 ${arrastrando ? "activa" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={alSoltar}
      >
        <i className="bi bi-cloud-arrow-up fs-1 text-primary d-block mb-2" />
        <p className="mb-2">Arrastre aquí los archivos, o</p>
        <button className="btn btn-primary" disabled={procesando} onClick={() => input.current?.click()}>
          <i className="bi bi-folder2-open me-1" /> Elegir archivos
        </button>
        <input
          ref={input}
          type="file"
          multiple
          accept=".xlsx,.csv"
          className="d-none"
          onChange={(e) => {
            void procesar(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
        <p className="small text-muted mt-3 mb-0">
          Se pueden subir varios a la vez. Los movimientos y documentos repetidos se descartan solos.
        </p>
      </div>

      {envios.length > 0 && (
        <div className="card card-suave shadow-sm mb-4">
          <ul className="list-group list-group-flush">
            {envios.map((e, i) => (
              <li key={`${i}-${e.nombre}`} className="list-group-item">
                <ResultadoEnvio envio={e} />
              </li>
            ))}
          </ul>
        </div>
      )}
      {procesando && envios.every((e) => e.estado !== "esperando" && e.estado !== "subiendo") && (
        <p className="text-muted">
          <span className="spinner-border spinner-border-sm me-2" />
          Buscando coincidencias…
        </p>
      )}
      <Alerta error={errorMotor} />
      {motor && <ResultadoMotor r={motor} onCerrar={() => setMotor(null)} />}

      <h5 className="mt-4 mb-2">Historial</h5>
      <Alerta error={historial.error} />
      <div className="card card-suave shadow-sm">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Archivo</th>
                <th>Período</th>
                <th className="text-end">Nuevas</th>
                <th className="text-end">Repetidas</th>
              </tr>
            </thead>
            <tbody>
              {filas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA).map((i) => (
                <tr key={i.id}>
                  <td className="text-nowrap">{fechaHora(i.creadoEn)}</td>
                  <td className="text-nowrap">
                    <i className={`bi ${TIPOS[i.tipo].icono} me-1 text-muted`} />
                    {TIPOS[i.tipo].texto}
                    {i.nCartola !== null && <small className="text-muted"> N° {i.nCartola}</small>}
                  </td>
                  <td className="text-truncate" style={{ maxWidth: 200 }} title={i.archivoNombre}>
                    {i.archivoNombre}
                    {i.advertencias.length > 0 && (
                      <i className="bi bi-exclamation-triangle text-warning ms-2" title={i.advertencias.join("\n")} />
                    )}
                  </td>
                  <td className="text-nowrap">
                    {fecha(i.periodoDesde)} – {fecha(i.periodoHasta)}
                  </td>
                  <td className="monto">{i.filasNuevas}</td>
                  <td className="monto text-muted">{i.filasDuplicadas}</td>
                </tr>
              ))}
              {filas.length === 0 && !historial.cargando && (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-3">
                    Sin importaciones todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <Paginacion total={filas.length} pagina={pagina} porPagina={POR_PAGINA} onCambiar={setPagina} />
    </div>
  );
}

function ResultadoEnvio({ envio }: { envio: Envio }) {
  const { nombre, estado, resultado, error } = envio;
  const i = resultado?.importacion;
  return (
    <div className="d-flex align-items-start gap-3">
      <div className="pt-1">
        {estado === "esperando" && <i className="bi bi-clock text-muted" />}
        {estado === "subiendo" && <span className="spinner-border spinner-border-sm text-primary" />}
        {estado === "ok" && <i className="bi bi-check-circle-fill text-success" />}
        {estado === "error" && <i className="bi bi-x-circle-fill text-danger" />}
      </div>
      <div className="flex-grow-1">
        <div className="fw-semibold text-break">{nombre}</div>
        {error && <div className="text-danger small">{error}</div>}
        {i && (
          <div className="small text-muted">
            {TIPOS[i.tipo].texto}
            {i.nCartola !== null && ` N° ${i.nCartola}`} · {fecha(i.periodoDesde)} – {fecha(i.periodoHasta)} ·{" "}
            <strong className="text-dark">{i.filasNuevas} nuevas</strong>
            {i.filasDuplicadas > 0 && `, ${i.filasDuplicadas} ya estaban`}
            {!!resultado?.notasCreditoAplicadas && ` · ${resultado.notasCreditoAplicadas} notas de crédito aplicadas`}
          </div>
        )}
        {i?.advertencias.map((a) => (
          <div key={a} className="small text-warning-emphasis">
            <i className="bi bi-exclamation-triangle me-1" />
            {a}
          </div>
        ))}
      </div>
    </div>
  );
}
