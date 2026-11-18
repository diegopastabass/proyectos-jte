import { useEffect, type ReactNode } from "react";
import { ESTADO_DOCUMENTO, ESTADO_MOVIMIENTO, MARGEN_MONTO_CLP, colorScore, montoDeBusqueda, pesos, porcentaje } from "../formato";
import type { EstadoDocumento, EstadoMovimiento } from "../types";

export function Cargando({ texto = "Cargando…" }: { texto?: string }) {
  return (
    <div className="text-center py-5">
      <div className="spinner-border text-primary" role="status" />
      <p className="text-muted mt-2 mb-0">{texto}</p>
    </div>
  );
}

export function Vacio({ icono = "bi-inbox", texto, children }: { icono?: string; texto: string; children?: ReactNode }) {
  return (
    <div className="text-center py-5 text-muted">
      <i className={`bi ${icono} fs-1 d-block mb-2`} />
      <p className="mb-2">{texto}</p>
      {children}
    </div>
  );
}

export function Alerta({ error, onCerrar }: { error?: string | null; onCerrar?: () => void }) {
  if (!error) return null;
  return (
    <div className="alert alert-danger d-flex align-items-start gap-2" role="alert">
      <i className="bi bi-exclamation-triangle-fill mt-1" />
      <div className="flex-grow-1">{error}</div>
      {onCerrar && <button type="button" className="btn-close" aria-label="Cerrar" onClick={onCerrar} />}
    </div>
  );
}

/** Aviso bajo el buscador cuando lo escrito es un monto: se listan los cercanos, del más parecido al menos. */
export function AvisoBusquedaMonto({ q }: { q: string }) {
  const monto = montoDeBusqueda(q);
  if (monto === null) return null;
  return (
    <small className="text-muted d-block mt-1">
      <i className="bi bi-bullseye me-1" />
      Montos entre {pesos(Math.max(0, monto - MARGEN_MONTO_CLP))} y {pesos(monto + MARGEN_MONTO_CLP)}, del más cercano a {pesos(monto)} al más lejano.
    </small>
  );
}

/** Botón del buscador: con él activo, un número suelto ("5000", "5.000") se busca como monto. */
export function BotonMonto({ activo, onCambiar }: { activo: boolean; onCambiar: (v: boolean) => void }) {
  return (
    <button
      type="button"
      className={`btn ${activo ? "btn-primary" : "btn-outline-secondary"}`}
      aria-pressed={activo}
      title="Buscar por monto: 5000 o 5.000 se busca como 5000CLP"
      onClick={() => onCambiar(!activo)}
    >
      <i className="bi bi-currency-dollar" />
      CLP
    </button>
  );
}

export function BadgeMovimiento({ estado }: { estado: EstadoMovimiento }) {
  const e = ESTADO_MOVIMIENTO[estado];
  return <span className={`badge text-bg-${e.color}`}>{e.texto}</span>;
}

export function BadgeDocumento({ estado }: { estado: EstadoDocumento }) {
  const e = ESTADO_DOCUMENTO[estado];
  return <span className={`badge text-bg-${e.color}`}>{e.texto}</span>;
}

export function BadgeScore({ score }: { score: number }) {
  return (
    <span className={`badge text-bg-${colorScore(score)}`} title="Confianza del motor">
      {porcentaje(score)}
    </span>
  );
}

/** Modal controlado por React (sin el JS de Bootstrap), como en front-mantenimiento. */
export function Modal({
  titulo,
  onCerrar,
  children,
  pie,
  tamano = "lg",
}: {
  titulo: ReactNode;
  onCerrar: () => void;
  children: ReactNode;
  pie?: ReactNode;
  tamano?: "sm" | "lg" | "xl";
}) {
  useEffect(() => {
    const alPresionar = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    document.body.classList.add("modal-open");
    window.addEventListener("keydown", alPresionar);
    return () => {
      document.body.classList.remove("modal-open");
      window.removeEventListener("keydown", alPresionar);
    };
  }, [onCerrar]);

  return (
    <div className="modal d-block modal-fondo" tabIndex={-1} role="dialog" onClick={onCerrar}>
      <div className={`modal-dialog modal-${tamano} modal-dialog-scrollable modal-dialog-centered`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-content border-0 shadow-lg">
          <div className="modal-header">
            <h5 className="modal-title">{titulo}</h5>
            <button type="button" className="btn-close" aria-label="Cerrar" onClick={onCerrar} />
          </div>
          <div className="modal-body">{children}</div>
          {pie && <div className="modal-footer">{pie}</div>}
        </div>
      </div>
    </div>
  );
}

export function Paginacion({
  total,
  pagina,
  porPagina,
  onCambiar,
}: {
  total: number;
  pagina: number;
  porPagina: number;
  onCambiar: (p: number) => void;
}) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  if (paginas <= 1) return null;
  return (
    <div className="d-flex justify-content-between align-items-center mt-3">
      <small className="text-muted">
        {(pagina - 1) * porPagina + 1}–{Math.min(total, pagina * porPagina)} de {total}
      </small>
      <div className="btn-group btn-group-sm">
        <button className="btn btn-outline-secondary" disabled={pagina <= 1} onClick={() => onCambiar(pagina - 1)}>
          <i className="bi bi-chevron-left" />
        </button>
        <span className="btn btn-outline-secondary disabled">
          {pagina} / {paginas}
        </span>
        <button className="btn btn-outline-secondary" disabled={pagina >= paginas} onClick={() => onCambiar(pagina + 1)}>
          <i className="bi bi-chevron-right" />
        </button>
      </div>
    </div>
  );
}

/** Encabezado de página: título a la izquierda, acciones a la derecha. */
export function Encabezado({ titulo, subtitulo, children }: { titulo: string; subtitulo?: ReactNode; children?: ReactNode }) {
  return (
    <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <div>
        <h2 className="mb-0">{titulo}</h2>
        {subtitulo && <small className="text-muted">{subtitulo}</small>}
      </div>
      {children && <div className="d-flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}
