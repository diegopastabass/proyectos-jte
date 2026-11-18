import { useEffect, useRef, useState } from "react";
import api, { mensajeError } from "../api";
import { fecha, pesos } from "../formato";
import { useEmpresa, useSesion } from "../sesion";
import type { Categoria, Comprobante, MovimientoDetalle, TipoComprobante } from "../types";
import { Alerta, Modal } from "./comunes";

const TIPOS: Record<TipoComprobante, string> = { boleta: "Boleta", factura: "Factura", otro: "Otro" };

/** IVA incluido en un total afecto (19 %), igual que lo calcula la API. */
const ivaIncluido = (total: number) => Math.round(total - total / 1.19);

/** Lado mayor con que se sube una foto: legible para una boleta y liviana para datos móviles. */
const LADO_MAXIMO = 2000;

/**
 * Achica la foto de la cámara antes de subirla (un celular saca fotos de 4–8 MB).
 * PDF, HEIC y fotos ya chicas se suben tal cual.
 */
async function prepararArchivo(archivo: File): Promise<File> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(archivo.type)) return archivo;
  try {
    const imagen = await createImageBitmap(archivo, { imageOrientation: "from-image" });
    const escala = Math.min(1, LADO_MAXIMO / Math.max(imagen.width, imagen.height));
    if (escala === 1 && archivo.size < 1_500_000) return archivo;
    const lienzo = document.createElement("canvas");
    lienzo.width = Math.round(imagen.width * escala);
    lienzo.height = Math.round(imagen.height * escala);
    lienzo.getContext("2d")!.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
    const blob = await new Promise<Blob | null>((r) => lienzo.toBlob(r, "image/jpeg", 0.85));
    if (!blob || blob.size >= archivo.size) return archivo;
    return new File([blob], archivo.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return archivo;
  }
}

/** Imagen protegida por JWT: se pide con axios y se muestra como object URL. */
function useArchivoComprobante(id: number | null) {
  const empresa = useEmpresa();
  const [archivo, setArchivo] = useState<{ id: number; url: string; tipo: string } | null>(null);
  useEffect(() => {
    if (id === null) return;
    let url = "";
    let vigente = true;
    api
      .get<Blob>(`/empresas/${empresa.id}/comprobantes/${id}/archivo`, { responseType: "blob" })
      .then((r) => {
        if (!vigente) return;
        url = URL.createObjectURL(r.data);
        setArchivo({ id, url, tipo: r.data.type });
      })
      .catch(() => undefined);
    return () => {
      vigente = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [empresa.id, id]);
  return archivo?.id === id ? archivo : null;
}

function Miniatura({ c, onAbrir }: { c: Comprobante; onAbrir: () => void }) {
  const archivo = useArchivoComprobante(c.id);
  return (
    <button type="button" className="miniatura-comprobante" onClick={onAbrir} title="Ver comprobante">
      {!archivo ? (
        <span className="spinner-border spinner-border-sm text-secondary" />
      ) : archivo.tipo.startsWith("image/") && archivo.tipo !== "image/heic" ? (
        <img src={archivo.url} alt={`${TIPOS[c.tipo]} ${c.folio ?? ""}`} />
      ) : (
        <i className={`bi ${archivo.tipo === "application/pdf" ? "bi-file-earmark-pdf" : "bi-file-earmark-image"} fs-2 text-muted`} />
      )}
    </button>
  );
}

function VerComprobante({ c, onCerrar }: { c: Comprobante; onCerrar: () => void }) {
  const archivo = useArchivoComprobante(c.id);
  return (
    <Modal
      titulo={`${TIPOS[c.tipo]}${c.folio ? ` N° ${c.folio}` : ""} · ${pesos(c.montoTotal)}`}
      onCerrar={onCerrar}
      pie={
        archivo && (
          <a className="btn btn-outline-secondary" href={archivo.url} target="_blank" rel="noreferrer">
            <i className="bi bi-box-arrow-up-right me-1" /> Abrir en otra pestaña
          </a>
        )
      }
    >
      {!archivo ? (
        <div className="text-center py-5">
          <span className="spinner-border text-primary" />
        </div>
      ) : archivo.tipo === "application/pdf" ? (
        <iframe src={archivo.url} title="Comprobante" className="w-100 border rounded" style={{ height: "70vh" }} />
      ) : archivo.tipo === "image/heic" ? (
        <p className="text-muted">Este navegador no muestra fotos HEIC: ábrala en otra pestaña o descárguela.</p>
      ) : (
        <img src={archivo.url} alt="Comprobante" className="img-fluid rounded d-block mx-auto" style={{ maxHeight: "70vh" }} />
      )}
      <dl className="row small mt-3 mb-0">
        {c.razonSocial && (
          <>
            <dt className="col-4 text-muted fw-normal">Emisor</dt>
            <dd className="col-8">
              {c.razonSocial} {c.rutEmisor && <span className="text-muted">({c.rutEmisor})</span>}
            </dd>
          </>
        )}
        <dt className="col-4 text-muted fw-normal">Fecha</dt>
        <dd className="col-8">{fecha(c.fecha)}</dd>
        <dt className="col-4 text-muted fw-normal">IVA</dt>
        <dd className="col-8">
          {pesos(c.montoIva)} {c.tipo === "boleta" && c.montoIva > 0 && <span className="text-muted">(no recuperable)</span>}
        </dd>
        {c.descripcion && (
          <>
            <dt className="col-4 text-muted fw-normal">Descripción</dt>
            <dd className="col-8">{c.descripcion}</dd>
          </>
        )}
      </dl>
    </Modal>
  );
}

/**
 * Respaldos de un movimiento: fotos de boletas (desde la cámara o del dispositivo) o PDF.
 * Al subir uno se puede consolidar el gasto: concilia el movimiento contra una categoría.
 */
export default function Comprobantes({
  m,
  categorias,
  onCambio,
}: {
  m: MovimientoDetalle;
  categorias: Categoria[];
  onCambio: () => void;
}) {
  const empresa = useEmpresa();
  const { puede } = useSesion();
  const operador = puede("operador");
  const disponible = m.ignorado ? 0 : Math.abs(m.monto) - m.montoConciliado;

  const camara = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [vistaPrevia, setVistaPrevia] = useState("");
  const [tipo, setTipo] = useState<TipoComprobante>("boleta");
  const [total, setTotal] = useState(0);
  const [iva, setIva] = useState<number | null>(null); // null = calculado
  const [fechaDoc, setFechaDoc] = useState("");
  const [folio, setFolio] = useState("");
  const [rutEmisor, setRutEmisor] = useState("");
  const [razonSocial, setRazonSocial] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoriaId, setCategoriaId] = useState<number | "">("");
  const [abierto, setAbierto] = useState<Comprobante | null>(null);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  // La vista previa se libera al cambiar de archivo y al cerrar.
  useEffect(() => () => URL.revokeObjectURL(vistaPrevia), [vistaPrevia]);

  const ivaCalculado = tipo === "otro" ? 0 : ivaIncluido(total);
  const ivaFinal = iva ?? ivaCalculado;

  const elegir = async (lista: FileList | null) => {
    const f = lista?.[0];
    if (!f) return;
    setError("");
    const listo = await prepararArchivo(f);
    setArchivo(listo);
    setVistaPrevia(listo.type.startsWith("image/") ? URL.createObjectURL(listo) : "");
    setTotal(disponible > 0 ? disponible : Math.abs(m.monto));
    setIva(null);
    setFechaDoc(m.fecha);
  };

  const cancelar = () => {
    setArchivo(null);
    setVistaPrevia("");
    setFolio("");
    setRutEmisor("");
    setRazonSocial("");
    setDescripcion("");
    setCategoriaId("");
    if (camara.current) camara.current.value = "";
    if (galeria.current) galeria.current.value = "";
  };

  const guardar = async () => {
    if (!archivo) return;
    const datos = new FormData();
    datos.append("archivo", archivo);
    datos.append("tipo", tipo);
    datos.append("montoTotal", String(total));
    datos.append("montoIva", String(ivaFinal));
    const opcionales: [string, string | number][] = [
      ["fecha", fechaDoc],
      ["folio", folio.trim()],
      ["rutEmisor", rutEmisor.trim()],
      ["razonSocial", razonSocial.trim()],
      ["descripcion", descripcion.trim()],
      ["categoriaId", categoriaId],
    ];
    for (const [k, v] of opcionales) if (v !== "") datos.append(k, String(v));
    setEnviando(true);
    setError("");
    try {
      await api.post(`/empresas/${empresa.id}/movimientos/${m.id}/comprobantes`, datos);
      cancelar();
      onCambio();
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setEnviando(false);
    }
  };

  const eliminar = async (c: Comprobante) => {
    const aviso = c.conciliacionId ? "\nLa conciliación que se hizo al subirlo se mantiene: si corresponde, deshágala aparte." : "";
    if (!confirm(`¿Quitar este comprobante del movimiento?${aviso}`)) return;
    try {
      await api.delete(`/empresas/${empresa.id}/comprobantes/${c.id}`);
      onCambio();
    } catch (e) {
      setError(mensajeError(e));
    }
  };

  if (!operador && m.comprobantes.length === 0) return null;

  return (
    <div className="mb-3">
      <h6 className="text-muted">
        <i className="bi bi-paperclip me-1" />
        Boletas y respaldos
      </h6>
      <Alerta error={error} onCerrar={() => setError("")} />

      {m.comprobantes.length > 0 && (
        <div className="d-flex flex-wrap gap-3 mb-2">
          {m.comprobantes.map((c) => (
            <div key={c.id} className="d-flex gap-2 align-items-start border rounded p-2 bg-white">
              <Miniatura c={c} onAbrir={() => setAbierto(c)} />
              <div className="small">
                <div className="fw-semibold">
                  {TIPOS[c.tipo]} {c.folio && `N° ${c.folio}`}
                </div>
                <div className="monto text-start">{pesos(c.montoTotal)}</div>
                <div className="text-muted">IVA {pesos(c.montoIva)}</div>
                {c.razonSocial && <div className="text-muted text-truncate" style={{ maxWidth: 160 }}>{c.razonSocial}</div>}
                {operador && (
                  <button className="btn btn-link btn-sm text-danger p-0" onClick={() => eliminar(c)}>
                    Quitar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {operador && !archivo && (
        <div className="d-flex flex-wrap gap-2">
          <button className="btn btn-outline-primary" onClick={() => camara.current?.click()}>
            <i className="bi bi-camera me-1" /> Tomar foto
          </button>
          <button className="btn btn-outline-secondary" onClick={() => galeria.current?.click()}>
            <i className="bi bi-image me-1" /> Elegir del dispositivo
          </button>
          {/* capture abre directo la cámara trasera en el celular; en el computador elige un archivo */}
          <input ref={camara} type="file" accept="image/*" capture="environment" hidden onChange={(e) => elegir(e.target.files)} />
          <input ref={galeria} type="file" accept="image/*,application/pdf" hidden onChange={(e) => elegir(e.target.files)} />
        </div>
      )}

      {operador && archivo && (
        <div className="border rounded p-3 bg-light">
          <div className="row g-3">
            <div className="col-md-3 text-center">
              {vistaPrevia ? (
                <img src={vistaPrevia} alt="Vista previa" className="img-fluid rounded border" style={{ maxHeight: 220 }} />
              ) : (
                <i className="bi bi-file-earmark-pdf fs-1 text-muted" />
              )}
              <small className="d-block text-muted mt-1 text-truncate">
                {archivo.name} · {Math.round(archivo.size / 1024)} KB
              </small>
            </div>
            <div className="col-md-9">
              <div className="row g-2">
                <div className="col-6 col-lg-3">
                  <label className="form-label small text-muted mb-1">Tipo</label>
                  <select className="form-select" value={tipo} onChange={(e) => {
                      setTipo(e.target.value as TipoComprobante);
                      setIva(null);
                    }}>
                    {Object.entries(TIPOS).map(([v, t]) => (
                      <option key={v} value={v}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-6 col-lg-3">
                  <label className="form-label small text-muted mb-1">Total</label>
                  <input
                    type="number"
                    className="form-control text-end"
                    min={1}
                    value={total}
                    onChange={(e) => {
                      setTotal(Math.max(0, Math.round(Number(e.target.value))));
                      setIva(null);
                    }}
                  />
                </div>
                <div className="col-6 col-lg-3">
                  <label className="form-label small text-muted mb-1" title={tipo === "boleta" ? "En boletas el IVA va incluido y no da crédito fiscal" : undefined}>
                    IVA {tipo === "boleta" && "(incluido)"}
                  </label>
                  <input
                    type="number"
                    className="form-control text-end"
                    min={0}
                    value={ivaFinal}
                    onChange={(e) => setIva(Math.max(0, Math.round(Number(e.target.value))))}
                  />
                </div>
                <div className="col-6 col-lg-3">
                  <label className="form-label small text-muted mb-1">Fecha</label>
                  <input type="date" className="form-control" value={fechaDoc} onChange={(e) => setFechaDoc(e.target.value)} />
                </div>
                <div className="col-6 col-lg-3">
                  <input className="form-control" placeholder="Folio (opcional)" maxLength={40} value={folio} onChange={(e) => setFolio(e.target.value)} />
                </div>
                <div className="col-6 col-lg-3">
                  <input className="form-control" placeholder="RUT emisor" maxLength={20} value={rutEmisor} onChange={(e) => setRutEmisor(e.target.value)} />
                </div>
                <div className="col-12 col-lg-6">
                  <input className="form-control" placeholder="Comercio (ej. Restaurante El Puerto)" maxLength={200} value={razonSocial} onChange={(e) => setRazonSocial(e.target.value)} />
                </div>
                <div className="col-12">
                  <input className="form-control" placeholder="Descripción (ej. almuerzo con cliente)" maxLength={500} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
                </div>
                {disponible > 0 && (
                  <div className="col-12">
                    <label className="form-label small text-muted mb-1">Consolidar el gasto en la categoría (concilia el movimiento)</label>
                    <select className="form-select" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value === "" ? "" : Number(e.target.value))}>
                      <option value="">— Solo guardar el respaldo —</option>
                      {categorias
                        .filter((c) => c.activa)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nombre}
                          </option>
                        ))}
                    </select>
                    {categoriaId !== "" && (
                      <small className="text-muted">
                        Se conciliarán {pesos(Math.min(total, disponible))} de los {pesos(disponible)} que le quedan al movimiento.
                      </small>
                    )}
                  </div>
                )}
              </div>
              <div className="d-flex gap-2 justify-content-end mt-3">
                <button className="btn btn-outline-secondary" onClick={cancelar} disabled={enviando}>
                  Cancelar
                </button>
                <button className="btn btn-success" onClick={guardar} disabled={enviando || total <= 0 || ivaFinal > total}>
                  {enviando ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-check2 me-1" />}
                  {categoriaId !== "" ? "Consolidar" : "Guardar respaldo"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {abierto && <VerComprobante c={abierto} onCerrar={() => setAbierto(null)} />}
    </div>
  );
}
