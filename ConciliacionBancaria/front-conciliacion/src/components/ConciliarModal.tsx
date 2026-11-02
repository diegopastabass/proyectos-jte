import { useEffect, useState } from "react";
import api, { mensajeError } from "../api";
import { fecha, pesos, porcentaje, tipoDte } from "../formato";
import { useEmpresa, useSesion } from "../sesion";
import type { Candidato, Categoria, MovimientoDetalle } from "../types";
import { useCarga } from "../useCarga";
import { Alerta, BadgeDocumento, BadgeMovimiento, Cargando, Modal } from "./comunes";

/**
 * Conciliación manual de un movimiento: uno o varios documentos (con monto editable para pagos
 * parciales) y/o una categoría para lo que no tiene documento (comisión, retiro, traspaso).
 */
export default function ConciliarModal({
  movimientoId,
  onCerrar,
  onCambio,
}: {
  movimientoId: number;
  onCerrar: () => void;
  /** Se llama después de conciliar, deshacer o ignorar, para refrescar la pantalla de fondo. */
  onCambio: () => void;
}) {
  const empresa = useEmpresa();
  const { puede } = useSesion();
  const base = `/empresas/${empresa.id}`;
  const mov = useCarga<MovimientoDetalle>(`${base}/movimientos/${movimientoId}`);
  const categorias = useCarga<Categoria[]>(`${base}/categorias`);

  const [busqueda, setBusqueda] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQ(busqueda.trim()), 350);
    return () => clearTimeout(t);
  }, [busqueda]);
  const candidatos = useCarga<Candidato[]>(`${base}/movimientos/${movimientoId}/candidatos`, { q });

  // Documentos elegidos (id → monto a aplicar) y la línea opcional por categoría.
  const [elegidos, setElegidos] = useState<Map<number, number>>(new Map());
  const [elegidosInfo, setElegidosInfo] = useState<Map<number, Candidato>>(new Map());
  const [categoriaId, setCategoriaId] = useState<number | "">("");
  const [montoCategoria, setMontoCategoria] = useState(0);
  const [nota, setNota] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const m = mov.datos;
  const disponible = m ? Math.abs(m.monto) - m.montoConciliado : 0;
  const totalDocs = [...elegidos.values()].reduce((s, v) => s + v, 0);
  const total = totalDocs + (categoriaId !== "" ? montoCategoria : 0);
  const restante = disponible - totalDocs;
  const operador = puede("operador");

  const recargarTodo = () => {
    mov.recargar();
    candidatos.recargar();
    onCambio();
  };

  const alternar = (c: Candidato) => {
    setElegidos((actual) => {
      const nuevo = new Map(actual);
      if (nuevo.has(c.id)) nuevo.delete(c.id);
      else nuevo.set(c.id, Math.max(0, Math.min(c.saldoPendiente, disponible - totalDocs)));
      return nuevo;
    });
    setElegidosInfo((actual) => new Map(actual).set(c.id, c));
  };

  const conciliar = async () => {
    if (!m) return;
    const lineas = [
      ...[...elegidos].filter(([, monto]) => monto > 0).map(([documentoId, monto]) => ({ movimientoId: m.id, documentoId, monto })),
      ...(categoriaId !== "" && montoCategoria > 0 ? [{ movimientoId: m.id, categoriaId, monto: montoCategoria }] : []),
    ];
    setEnviando(true);
    setError("");
    try {
      await api.post(`${base}/conciliaciones`, { lineas, nota: nota.trim() || undefined });
      setElegidos(new Map());
      setCategoriaId("");
      setNota("");
      recargarTodo();
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setEnviando(false);
    }
  };

  const deshacer = async (conciliacionId: number) => {
    if (!confirm("¿Deshacer esta conciliación? Los saldos vuelven a como estaban.")) return;
    try {
      await api.delete(`${base}/conciliaciones/${conciliacionId}`);
      recargarTodo();
    } catch (e) {
      setError(mensajeError(e));
    }
  };

  const ignorar = async (ignorado: boolean) => {
    try {
      await api.patch(`${base}/movimientos/${movimientoId}`, { ignorado, nota: nota.trim() || undefined });
      recargarTodo();
    } catch (e) {
      setError(mensajeError(e));
    }
  };

  // Las conciliaciones vigentes agrupadas (una conciliación puede tener varias líneas).
  const grupos = new Map<number, MovimientoDetalle["lineas"]>();
  for (const l of m?.lineas ?? []) grupos.set(l.conciliacionId, [...(grupos.get(l.conciliacionId) ?? []), l]);

  const puedeConciliar = operador && m && !m.ignorado && disponible > 0;

  return (
    <Modal
      titulo="Conciliar movimiento"
      onCerrar={onCerrar}
      tamano="xl"
      pie={
        puedeConciliar ? (
          <div className="d-flex flex-wrap align-items-center gap-3 w-100">
            <div className="me-auto">
              Aplicando <strong className={total > disponible ? "text-danger" : ""}>{pesos(total)}</strong> de {pesos(disponible)}
              {total > 0 && total < disponible && <span className="text-muted"> · quedará parcial</span>}
            </div>
            <button className="btn btn-outline-secondary" onClick={onCerrar}>
              Cerrar
            </button>
            <button className="btn btn-success" disabled={enviando || total <= 0 || total > disponible} onClick={conciliar}>
              {enviando ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-check2 me-1" />}
              Conciliar
            </button>
          </div>
        ) : (
          <button className="btn btn-outline-secondary" onClick={onCerrar}>
            Cerrar
          </button>
        )
      }
    >
      {!m ? (
        mov.error ? <Alerta error={mov.error} /> : <Cargando />
      ) : (
        <>
          <Alerta error={error} onCerrar={() => setError("")} />

          {/* Movimiento */}
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3 p-3 bg-light rounded">
            <div>
              <div className="glosa">{m.glosa}</div>
              <small className="text-muted">
                {fecha(m.fecha)}
                {m.nOperacion && ` · Op. ${m.nOperacion}`}
                {m.nota && ` · ${m.nota}`}
              </small>
            </div>
            <div className="text-end">
              <div className={`fs-4 fw-bold monto ${m.monto > 0 ? "text-success" : "text-danger"}`}>{pesos(m.monto)}</div>
              <BadgeMovimiento estado={m.estado} />
              {m.montoConciliado > 0 && disponible > 0 && <small className="text-muted ms-2">quedan {pesos(disponible)}</small>}
            </div>
          </div>

          {/* Lo ya conciliado */}
          {grupos.size > 0 && (
            <div className="mb-3">
              <h6 className="text-muted">Conciliado con</h6>
              <ul className="list-group">
                {[...grupos].map(([id, lineas]) => (
                  <li key={id} className="list-group-item d-flex justify-content-between align-items-center gap-2">
                    <div>
                      {lineas.map((l) => (
                        <div key={l.id}>
                          {l.documentoId ? (
                            <>
                              <i className="bi bi-receipt me-1 text-muted" />
                              {tipoDte(l.tipoDte)} {l.folio} · {l.razonSocial}
                            </>
                          ) : (
                            <>
                              <i className="bi bi-tag me-1 text-muted" />
                              {l.categoria}
                            </>
                          )}
                          <span className="monto ms-2 fw-semibold">{pesos(l.montoAplicado)}</span>
                        </div>
                      ))}
                      <small className="text-muted">
                        {lineas[0].origen === "manual" ? "Manual" : lineas[0].origen === "regla" ? "Por regla" : "Automática"}
                      </small>
                    </div>
                    {operador && (
                      <button className="btn btn-outline-danger btn-sm" onClick={() => deshacer(id)}>
                        <i className="bi bi-arrow-counterclockwise me-1" />
                        Deshacer
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {m.ignorado && (
            <div className="alert alert-secondary d-flex justify-content-between align-items-center">
              <span>
                <i className="bi bi-eye-slash me-1" /> Este movimiento está marcado como ignorado.
              </span>
              {operador && (
                <button className="btn btn-sm btn-outline-secondary" onClick={() => ignorar(false)}>
                  Dejar de ignorar
                </button>
              )}
            </div>
          )}

          {puedeConciliar && (
            <>
              {/* Documentos candidatos */}
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                <h6 className="text-muted mb-0">{m.monto > 0 ? "Ventas por cobrar" : "Compras por pagar"}</h6>
                <div className="input-group input-group-sm" style={{ maxWidth: 360 }}>
                  <span className="input-group-text bg-white border-end-0">
                    <i className="bi bi-search text-muted" />
                  </span>
                  <input
                    className="form-control border-start-0 ps-0"
                    placeholder="Buscar por razón social, RUT o folio"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                  />
                </div>
              </div>
              <div className="border rounded mb-3" style={{ maxHeight: 320, overflowY: "auto" }}>
                <table className="table table-sm table-hover align-middle mb-0">
                  <thead className="table-light position-sticky top-0">
                    <tr>
                      <th style={{ width: 32 }} />
                      <th>Documento</th>
                      <th>Emisión</th>
                      <th className="text-end">Saldo</th>
                      <th style={{ width: 150 }} className="text-end">
                        Aplicar
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Los elegidos se mantienen visibles aunque cambie la búsqueda */}
                    {[
                      ...[...elegidosInfo.values()].filter((c) => elegidos.has(c.id) && !candidatos.datos?.some((x) => x.id === c.id)),
                      ...(candidatos.datos ?? []),
                    ].map((c) => (
                      <tr key={c.id} className={elegidos.has(c.id) ? "table-primary" : ""} onClick={() => alternar(c)} style={{ cursor: "pointer" }}>
                        <td>
                          <input type="checkbox" className="form-check-input" checked={elegidos.has(c.id)} readOnly />
                        </td>
                        <td>
                          <div>
                            {tipoDte(c.tipoDte)} {c.folio} · <span className="fw-semibold">{c.razonSocial}</span>
                          </div>
                          <small className="text-muted">
                            {c.rut}
                            {c.montoCalza && <span className="badge text-bg-success ms-2">Monto exacto</span>}
                            {c.similitud >= 0.5 && <span className="badge text-bg-light border ms-2">Nombre {porcentaje(c.similitud)}</span>}
                            {c.estado === "excluido" && <span className="ms-2"><BadgeDocumento estado={c.estado} /></span>}
                          </small>
                        </td>
                        <td className="text-nowrap">{fecha(c.fechaEmision)}</td>
                        <td className="monto">{pesos(c.saldoPendiente)}</td>
                        <td onClick={(e) => e.stopPropagation()}>
                          {elegidos.has(c.id) && (
                            <input
                              type="number"
                              className="form-control form-control-sm text-end"
                              min={1}
                              max={c.saldoPendiente}
                              value={elegidos.get(c.id)}
                              onChange={(e) => setElegidos((a) => new Map(a).set(c.id, Math.max(0, Math.round(Number(e.target.value)))))}
                            />
                          )}
                        </td>
                      </tr>
                    ))}
                    {candidatos.datos?.length === 0 && elegidos.size === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center text-muted py-3">
                          {q ? "Sin resultados para la búsqueda." : "No hay documentos con saldo. Pruebe buscando, o use una categoría."}
                        </td>
                      </tr>
                    )}
                    {candidatos.cargando && !candidatos.datos && (
                      <tr>
                        <td colSpan={5} className="text-center py-3">
                          <span className="spinner-border spinner-border-sm text-primary" />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Categoría para lo que no tiene documento */}
              <div className="row g-2 align-items-end">
                <div className="col-md-6">
                  <label className="form-label small text-muted mb-1">
                    Sin documento: categoría {elegidos.size > 0 && "(por la diferencia)"}
                  </label>
                  <select
                    className="form-select"
                    value={categoriaId}
                    onChange={(e) => {
                      setCategoriaId(e.target.value === "" ? "" : Number(e.target.value));
                      setMontoCategoria(Math.max(0, restante));
                    }}
                  >
                    <option value="">— Ninguna —</option>
                    {categorias.datos
                      ?.filter((c) => c.activa)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="col-md-3">
                  {categoriaId !== "" && (
                    <>
                      <label className="form-label small text-muted mb-1">Monto</label>
                      <input
                        type="number"
                        className="form-control text-end"
                        min={1}
                        value={montoCategoria}
                        onChange={(e) => setMontoCategoria(Math.max(0, Math.round(Number(e.target.value))))}
                      />
                    </>
                  )}
                </div>
                <div className="col-md-3 text-md-end">
                  {m.montoConciliado === 0 && (
                    <button className="btn btn-outline-secondary" onClick={() => ignorar(true)} title="No se concilia (ej. movimiento duplicado o de prueba)">
                      <i className="bi bi-eye-slash me-1" />
                      Ignorar
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-3">
                <input className="form-control form-control-sm" placeholder="Nota (opcional)" maxLength={500} value={nota} onChange={(e) => setNota(e.target.value)} />
              </div>
            </>
          )}
        </>
      )}
    </Modal>
  );
}
