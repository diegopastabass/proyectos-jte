import { useState } from "react";
import api, { mensajeError } from "../api";
import { Alerta, BadgeScore, Cargando, Encabezado, Modal, Paginacion, Vacio } from "../components/comunes";
import ConciliarModal from "../components/ConciliarModal";
import ResultadoMotor from "../components/ResultadoMotor";
import { fecha, pesos, tipoDte } from "../formato";
import { useEmpresa, useSesion } from "../sesion";
import type { Opcion, PaginaSugerencias, ResumenMotor, Sugerencia } from "../types";
import { useCarga } from "../useCarga";

const FILTROS = [
  { texto: "Todas", min: undefined },
  { texto: "Probables (≥ 60%)", min: 0.6 },
  { texto: "Dudosas (< 60%)", max: 0.6 },
] as const;

const NIVELES: Record<string, string> = {
  regla: "Regla",
  rut: "RUT",
  alias: "Aprendido",
  nombre: "Nombre",
  monto: "Solo monto",
};

const POR_PAGINA = 50;

export default function Bandeja() {
  const empresa = useEmpresa();
  const { puede } = useSesion();
  const [filtro, setFiltro] = useState(0);
  const [pagina, setPagina] = useState(1);
  const f = FILTROS[filtro];
  const { datos, error, cargando, recargar } = useCarga<PaginaSugerencias>(`/empresas/${empresa.id}/sugerencias`, {
    pagina,
    porPagina: POR_PAGINA,
    scoreMin: "min" in f ? f.min : undefined,
    scoreMax: "max" in f ? f.max : undefined,
  });
  // Las resueltas se ocultan al tiro, sin esperar a recargar la lista.
  const [resueltas, setResueltas] = useState<Set<number>>(new Set());
  const [manual, setManual] = useState<number | null>(null);
  const [motor, setMotor] = useState<ResumenMotor | null>(null);
  const [ejecutando, setEjecutando] = useState(false);
  const [errorAccion, setErrorAccion] = useState("");
  const [masivo, setMasivo] = useState(false);

  const operador = puede("operador");
  const visibles = (datos?.items ?? []).filter((s) => !resueltas.has(s.id));

  const resolver = (id: number) => setResueltas((r) => new Set(r).add(id));

  const aceptar = async (s: Sugerencia, alternativa?: number) => {
    setErrorAccion("");
    try {
      await api.post(`/empresas/${empresa.id}/sugerencias/${s.id}/aceptar`, alternativa === undefined ? {} : { alternativa });
      resolver(s.id);
    } catch (e) {
      setErrorAccion(`${s.movimiento?.glosa ?? "Sugerencia"}: ${mensajeError(e)}`);
      recargar();
    }
  };

  const rechazar = async (s: Sugerencia) => {
    setErrorAccion("");
    try {
      await api.post(`/empresas/${empresa.id}/sugerencias/${s.id}/rechazar`);
      resolver(s.id);
    } catch (e) {
      setErrorAccion(mensajeError(e));
    }
  };

  const ejecutarMotor = async () => {
    setEjecutando(true);
    setErrorAccion("");
    try {
      const r = await api.post<ResumenMotor>(`/empresas/${empresa.id}/motor/ejecutar`, {});
      setMotor(r.data);
      setResueltas(new Set());
      setPagina(1);
      recargar();
    } catch (e) {
      setErrorAccion(mensajeError(e));
    } finally {
      setEjecutando(false);
    }
  };

  return (
    <div className="container py-4">
      <Encabezado
        titulo="Bandeja de sugerencias"
        subtitulo="Coincidencias que el motor no concilió solo: confirme, elija otra opción o rechace."
      >
        {operador && visibles.length > 0 && (
          <button className="btn btn-outline-success" onClick={() => setMasivo(true)}>
            <i className="bi bi-check2-all me-1" /> Aceptar las visibles
          </button>
        )}
        {operador && (
          <button className="btn btn-primary" onClick={ejecutarMotor} disabled={ejecutando}>
            {ejecutando ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-magic me-1" />}
            Buscar coincidencias
          </button>
        )}
      </Encabezado>

      {motor && <ResultadoMotor r={motor} onCerrar={() => setMotor(null)} />}
      <Alerta error={error || errorAccion} onCerrar={errorAccion ? () => setErrorAccion("") : undefined} />

      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <span className="text-muted small me-1">
          <i className="bi bi-funnel me-1" />
          Mostrar:
        </span>
        {FILTROS.map((x, i) => (
          <button
            key={x.texto}
            className={`btn btn-sm ${filtro === i ? "btn-primary" : "btn-outline-secondary"}`}
            onClick={() => {
              setFiltro(i);
              setPagina(1);
            }}
          >
            {x.texto}
          </button>
        ))}
        <span className="ms-auto text-muted small">
          {cargando && <span className="spinner-border spinner-border-sm me-2" />}
          {datos && `${Math.max(0, datos.total - resueltas.size)} pendientes`}
        </span>
      </div>

      {!datos && !error && <Cargando texto="Cargando sugerencias…" />}
      {datos && visibles.length === 0 && (
        <Vacio icono="bi-check2-circle" texto="No hay sugerencias pendientes.">
          {operador && <small>Importe nuevas cartolas o presione «Buscar coincidencias».</small>}
        </Vacio>
      )}

      {visibles.map((s) => (
        <TarjetaSugerencia
          key={s.id}
          s={s}
          datos={datos!}
          operador={operador}
          onAceptar={(alt) => aceptar(s, alt)}
          onRechazar={() => rechazar(s)}
          onManual={() => setManual(s.movimientoId)}
        />
      ))}

      {datos && (
        <Paginacion
          total={datos.total}
          pagina={pagina}
          porPagina={POR_PAGINA}
          onCambiar={(p) => {
            setPagina(p);
            setResueltas(new Set());
          }}
        />
      )}

      {manual !== null && (
        <ConciliarModal
          movimientoId={manual}
          onCerrar={() => {
            setManual(null);
            setResueltas(new Set());
            recargar();
          }}
          onCambio={() => undefined}
        />
      )}

      {masivo && (
        <AceptarMasivo
          sugerencias={visibles}
          onAceptar={aceptar}
          onCerrar={() => {
            setMasivo(false);
            recargar();
          }}
        />
      )}
    </div>
  );
}

function TarjetaSugerencia({
  s,
  datos,
  operador,
  onAceptar,
  onRechazar,
  onManual,
}: {
  s: Sugerencia;
  datos: PaginaSugerencias;
  operador: boolean;
  onAceptar: (alternativa?: number) => Promise<void>;
  onRechazar: () => Promise<void>;
  onManual: () => void;
}) {
  // -1 = la propuesta principal; 0..n = alternativas
  const [elegida, setElegida] = useState(-1);
  const [ocupado, setOcupado] = useState(false);
  const opciones: Opcion[] = [s, ...s.alternativas];
  const m = s.movimiento;

  const ejecutar = async (accion: () => Promise<void>) => {
    setOcupado(true);
    await accion();
    setOcupado(false);
  };

  return (
    <div className="card card-suave shadow-sm mb-3">
      <div className="card-body">
        <div className="row g-3">
          {/* Movimiento bancario */}
          <div className="col-lg-5">
            <div className="d-flex justify-content-between align-items-start gap-2">
              <div>
                <small className="text-muted">
                  <i className="bi bi-bank me-1" />
                  {m ? fecha(m.fecha) : ""}
                </small>
                <div className="glosa mt-1">{m?.glosa}</div>
              </div>
              <div className={`fs-5 fw-bold monto ${m && m.monto > 0 ? "text-success" : "text-danger"}`}>{pesos(m?.monto)}</div>
            </div>
            {m && m.montoConciliado > 0 && (
              <small className="text-muted">Ya conciliado: {pesos(m.montoConciliado)}</small>
            )}
          </div>

          {/* Propuestas */}
          <div className="col-lg-7 border-start-lg">
            {opciones.map((o, i) => {
              const idx = i - 1;
              return (
                <label
                  key={o.firma}
                  className={`d-flex gap-2 p-2 rounded mb-1 ${opciones.length === 1 ? "bg-light" : elegida === idx ? "bg-primary-subtle" : ""}`}
                  style={{ cursor: opciones.length > 1 ? "pointer" : "default" }}
                >
                  {opciones.length > 1 && (
                    <input type="radio" className="form-check-input mt-1" checked={elegida === idx} onChange={() => setElegida(idx)} />
                  )}
                  <div className="flex-grow-1">
                    {o.lineas.length === 0 && <div className="fw-semibold">Ignorar el movimiento</div>}
                    {o.lineas.map((l) => (
                      <div key={`${l.documentoId}-${l.categoriaId}`} className="d-flex justify-content-between gap-2">
                        <span>
                          {l.documentoId ? (
                            <DocumentoLinea doc={datos.documentos[l.documentoId]} />
                          ) : (
                            <>
                              <i className="bi bi-tag me-1 text-muted" />
                              <span className="fw-semibold">{datos.categorias[l.categoriaId!]?.nombre}</span>
                            </>
                          )}
                        </span>
                        {o.lineas.length > 1 && <span className="monto">{pesos(l.monto)}</span>}
                      </div>
                    ))}
                    <small className="text-muted d-block">{o.motivo}</small>
                  </div>
                  <div>
                    <BadgeScore score={o.score} />
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        <div className="d-flex flex-wrap align-items-center gap-2 mt-3 pt-3 border-top">
          <span className="badge bg-light text-secondary border">{NIVELES[s.nivel] ?? s.nivel}</span>
          {s.alternativas.length > 0 && <small className="text-muted">{s.alternativas.length + 1} opciones</small>}
          {operador && (
            <div className="ms-auto d-flex gap-2">
              <button className="btn btn-outline-secondary btn-sm" disabled={ocupado} onClick={onManual}>
                <i className="bi bi-pencil me-1" />
                Otra
              </button>
              <button className="btn btn-outline-danger btn-sm" disabled={ocupado} onClick={() => ejecutar(onRechazar)} title="No volverá a proponerse">
                <i className="bi bi-x-lg me-1" />
                Rechazar
              </button>
              <button className="btn btn-success btn-sm" disabled={ocupado} onClick={() => ejecutar(() => onAceptar(elegida === -1 ? undefined : elegida))}>
                {ocupado ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-check2 me-1" />}
                Aceptar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DocumentoLinea({ doc }: { doc: PaginaSugerencias["documentos"][number] | undefined }) {
  if (!doc) return <span className="text-muted">Documento no disponible</span>;
  return (
    <>
      <i className="bi bi-receipt me-1 text-muted" />
      <span className="fw-semibold">{doc.razonSocial}</span>
      <span className="text-muted">
        {" "}
        · {tipoDte(doc.tipoDte)} {doc.folio} · {fecha(doc.fechaEmision)} · saldo {pesos(doc.saldoPendiente)}
      </span>
    </>
  );
}

function AceptarMasivo({
  sugerencias,
  onAceptar,
  onCerrar,
}: {
  sugerencias: Sugerencia[];
  onAceptar: (s: Sugerencia) => Promise<void>;
  onCerrar: () => void;
}) {
  const [hechas, setHechas] = useState<number | null>(null);
  const dudosas = sugerencias.filter((s) => s.score < 0.6).length;

  const aceptarTodas = async () => {
    setHechas(0);
    for (const s of sugerencias) {
      await onAceptar(s);
      setHechas((h) => (h ?? 0) + 1);
    }
    onCerrar();
  };

  return (
    <Modal
      titulo="Aceptar sugerencias visibles"
      onCerrar={hechas === null ? onCerrar : () => undefined}
      tamano="sm"
      pie={
        hechas === null && (
          <>
            <button className="btn btn-outline-secondary" onClick={onCerrar}>
              Cancelar
            </button>
            <button className="btn btn-success" onClick={aceptarTodas}>
              Aceptar {sugerencias.length}
            </button>
          </>
        )
      }
    >
      {hechas === null ? (
        <>
          <p>
            Se aceptará la propuesta principal de las <strong>{sugerencias.length}</strong> sugerencias que está viendo.
          </p>
          {dudosas > 0 && (
            <div className="alert alert-warning small mb-0">
              {dudosas} tienen confianza menor al 60%. Conviene revisarlas una por una (filtro «Probables»).
            </div>
          )}
        </>
      ) : (
        <div className="text-center">
          <div className="spinner-border text-success mb-2" />
          <p className="mb-0">
            {hechas} de {sugerencias.length}…
          </p>
        </div>
      )}
    </Modal>
  );
}
