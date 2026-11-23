import { useEffect, useState } from "react";
import api, { mensajeError } from "../../api";
import { fecha, fechaHora } from "../../formato";
import { useEmpresa, useSesion } from "../../sesion";
import type { ConexionExterna, EnlaceConexion, EstadoConexiones, ResultadoLectura, SistemaExterno } from "../../types";
import { useCarga } from "../../useCarga";
import { Alerta, Cargando, Modal } from "../comunes";

const ICONOS: Record<SistemaExterno, string> = {
  sii: "bi-receipt",
  banco_estado: "bi-bank",
  bch_empresas: "bi-bank2",
};

const QUE_TRAE: Record<SistemaExterno, string> = {
  sii: "Registro de Compras y Ventas, con la clave tributaria de la empresa.",
  banco_estado: "Movimientos de la cuenta corriente. Sin historia anterior a la conexión.",
  bch_empresas: "Movimientos de la cuenta, con el RUT de quien paga en las transferencias.",
};

const ESTADOS: Record<ConexionExterna["estado"], { texto: string; color: string }> = {
  sin_conectar: { texto: "Sin conectar", color: "secondary" },
  pendiente: { texto: "Falta la clave", color: "warning" },
  activa: { texto: "Conectada", color: "success" },
  pausada: { texto: "Pausada", color: "secondary" },
};

const CREDENCIAL: Record<string, string> = {
  invalid: "La clave fue rechazada",
  revoked: "La clave fue revocada",
  ausente: "Sin clave",
};

const TRABAJO: Record<string, string> = {
  queued: "en cola",
  running: "trayendo datos",
  succeeded: "listo",
  partial: "incompleto",
  failed: "falló",
};

/**
 * Fuentes automáticas a través de Emisso: el SII y los bancos. La clave se escribe en la página de
 * Emisso (incrustada aquí cuando se puede) y nunca pasa por nuestro servidor.
 */
export default function Conexiones() {
  const empresa = useEmpresa();
  const { puede } = useSesion();
  const base = `/empresas/${empresa.id}/conexiones`;
  const estado = useCarga<EstadoConexiones>(base);
  const [enlace, setEnlace] = useState<{ sistema: SistemaExterno; nombre: string; datos: EnlaceConexion } | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  const accion = async (clave: string, fn: () => Promise<void>) => {
    setOcupado(clave);
    setError("");
    setAviso("");
    try {
      await fn();
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setOcupado(null);
    }
  };

  const conectar = (c: ConexionExterna) =>
    accion(`enlace-${c.sistema}`, async () => {
      const r = await api.post<EnlaceConexion>(`${base}/${c.sistema}/enlace`);
      setEnlace({ sistema: c.sistema, nombre: c.nombre, datos: r.data });
    });

  const confirmar = (sistema: SistemaExterno) =>
    accion(`confirmar-${sistema}`, async () => {
      await api.post(`${base}/${sistema}/confirmar`);
      setEnlace(null);
      setAviso("Conexión lista. Emisso está trayendo los primeros datos; se leerán solos en las próximas horas, o con «Leer ahora».");
      estado.recargar();
    });

  const leer = (sistema: SistemaExterno | "todas") =>
    accion(`leer-${sistema}`, async () => {
      const r = await api.post<ResultadoLectura>(`${base}/${sistema}/leer`);
      const errores = r.data.resultados.filter((x) => x.error).map((x) => x.error);
      if (errores.length) setError(errores.join(". "));
      setAviso(
        r.data.nuevas > 0
          ? `Se importaron ${r.data.nuevas} filas nuevas y se buscaron coincidencias.`
          : "Lectura terminada: no había nada nuevo.",
      );
      estado.recargar();
    });

  const sincronizar = (c: ConexionExterna) =>
    accion(`sinc-${c.sistema}`, async () => {
      await api.post(`${base}/${c.sistema}/sincronizar`);
      setAviso(`Se pidió a Emisso actualizar ${c.nombre}. En unos minutos use «Leer ahora».`);
      estado.recargar();
    });

  const pausar = (c: ConexionExterna) =>
    accion(`pausa-${c.sistema}`, async () => {
      await api.patch(`${base}/${c.sistema}`, { activa: c.estado !== "activa" });
      estado.recargar();
    });

  const d = estado.datos;
  if (!d) return estado.error ? <Alerta error={estado.error} /> : <Cargando />;

  const hayActivas = d.conexiones.some((c) => c.estado === "activa");

  return (
    <>
      {!d.configurado && (
        <div className="alert alert-warning">
          <i className="bi bi-exclamation-triangle me-1" />
          La API no tiene configurada la clave de Emisso (<code>EMISSO_API_KEY</code>). Mientras tanto, los archivos se siguen subiendo en <em>Importar</em>.
        </div>
      )}
      {d.errorEmisso && (
        <div className="alert alert-warning small">
          <i className="bi bi-cloud-slash me-1" />
          No se pudo consultar el estado en Emisso: {d.errorEmisso}
        </div>
      )}
      <Alerta error={error} onCerrar={() => setError("")} />
      {aviso && (
        <div className="alert alert-success d-flex justify-content-between align-items-start">
          <span>
            <i className="bi bi-check2-circle me-1" />
            {aviso}
          </span>
          <button type="button" className="btn-close" aria-label="Cerrar" onClick={() => setAviso("")} />
        </div>
      )}

      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <small className="text-muted">
          Emisso sincroniza cada 4 horas y esta app lee lo nuevo media hora después. La subida manual en <em>Importar</em> sigue disponible.
        </small>
        {puede("operador") && hayActivas && (
          <button className="btn btn-outline-primary btn-sm" disabled={!!ocupado} onClick={() => leer("todas")}>
            {ocupado === "leer-todas" ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-arrow-repeat me-1" />}
            Leer todo ahora
          </button>
        )}
      </div>

      <div className="row g-3">
        {d.conexiones.map((c) => (
          <div className="col-lg-4" key={c.sistema}>
            <Tarjeta
              c={c}
              configurado={d.configurado}
              admin={puede("admin")}
              operador={puede("operador")}
              ocupado={ocupado}
              onConectar={() => conectar(c)}
              onConfirmar={() => confirmar(c.sistema)}
              onLeer={() => leer(c.sistema)}
              onSincronizar={() => sincronizar(c)}
              onPausar={() => pausar(c)}
            />
          </div>
        ))}
      </div>

      {enlace && (
        <EnlaceModal
          nombre={enlace.nombre}
          enlace={enlace.datos}
          confirmando={ocupado === `confirmar-${enlace.sistema}`}
          onConfirmar={() => confirmar(enlace.sistema)}
          onCerrar={() => {
            setEnlace(null);
            estado.recargar();
          }}
        />
      )}
    </>
  );
}

function Tarjeta({
  c,
  configurado,
  admin,
  operador,
  ocupado,
  onConectar,
  onConfirmar,
  onLeer,
  onSincronizar,
  onPausar,
}: {
  c: ConexionExterna;
  configurado: boolean;
  admin: boolean;
  operador: boolean;
  ocupado: string | null;
  onConectar: () => void;
  onConfirmar: () => void;
  onLeer: () => void;
  onSincronizar: () => void;
  onPausar: () => void;
}) {
  const e = ESTADOS[c.estado];
  const conectada = !!c.connectionId;
  const trabajo = c.emisso?.trabajos[0];
  const spinner = (clave: string, icono: string) =>
    ocupado === clave ? <span className="spinner-border spinner-border-sm me-1" /> : <i className={`bi ${icono} me-1`} />;

  return (
    <div className="card card-suave shadow-sm h-100">
      <div className="card-body d-flex flex-column">
        <div className="d-flex justify-content-between align-items-start mb-2">
          <h6 className="mb-0">
            <i className={`bi ${ICONOS[c.sistema]} me-2 text-muted`} />
            {c.nombre}
          </h6>
          <span className={`badge text-bg-${e.color}`}>{e.texto}</span>
        </div>
        <p className="small text-muted mb-2">{QUE_TRAE[c.sistema]}</p>

        {c.emisso && c.emisso.credencial !== "linked" && (
          <div className="alert alert-danger small py-2 mb-2">
            <i className="bi bi-key me-1" />
            {CREDENCIAL[c.emisso.credencial] ?? c.emisso.credencial}: use «Reconectar».
          </div>
        )}
        {c.emisso?.atenciones.map((a) => (
          <div key={a.codigo} className="alert alert-warning small py-2 mb-2">
            <div>{a.que}</div>
            <div className="text-muted">{a.hacer}</div>
          </div>
        ))}
        {c.ultimoError && <div className="small text-danger mb-2">{c.ultimoError}</div>}

        <dl className="small mb-3 row g-0">
          {c.empresaRut && (
            <>
              <dt className="col-5 text-muted fw-normal">RUT</dt>
              <dd className="col-7 mb-1">{c.empresaRut}</dd>
            </>
          )}
          {conectada && (
            <>
              <dt className="col-5 text-muted fw-normal">Última lectura</dt>
              <dd className="col-7 mb-1">{c.ultimaLecturaEn ? fechaHora(c.ultimaLecturaEn) : "todavía no"}</dd>
            </>
          )}
          {trabajo && (
            <>
              <dt className="col-5 text-muted fw-normal">Emisso</dt>
              <dd className="col-7 mb-1">
                {trabajo.periodo}: {TRABAJO[trabajo.estado] ?? trabajo.estado}
                <span className="text-muted"> · {fechaHora(trabajo.actualizadoEn)}</span>
              </dd>
            </>
          )}
          {c.emisso?.uso && (
            <>
              <dt className="col-5 text-muted fw-normal">Llamadas</dt>
              <dd className="col-7 mb-1">
                {c.emisso.uso.llamadas} de {c.emisso.uso.limite}
                <span className="text-muted"> · renueva {fecha(c.emisso.uso.seRenueva)}</span>
              </dd>
            </>
          )}
        </dl>

        {c.sistema === "banco_estado" && conectada && (
          <p className="small text-muted">
            <i className="bi bi-info-circle me-1" />
            BancoEstado admite una sola sesión: mientras Emisso sincroniza no se puede entrar al portal, y si alguien está dentro la sincronización falla.
          </p>
        )}

        <div className="mt-auto d-flex flex-wrap gap-2">
          {admin && configurado && (
            <button className={`btn btn-sm ${conectada ? "btn-outline-secondary" : "btn-primary"}`} disabled={!!ocupado} onClick={onConectar}>
              {spinner(`enlace-${c.sistema}`, "bi-plug")}
              {conectada ? "Reconectar" : "Conectar"}
            </button>
          )}
          {admin && c.estado === "pendiente" && (
            <button className="btn btn-sm btn-outline-primary" disabled={!!ocupado} onClick={onConfirmar} title="Si ya escribió la clave en la página de Emisso">
              {spinner(`confirmar-${c.sistema}`, "bi-check2")}
              Ya entregué la clave
            </button>
          )}
          {operador && c.estado === "activa" && (
            <>
              <button className="btn btn-sm btn-outline-primary" disabled={!!ocupado} onClick={onLeer} title="Importa lo que Emisso ya trajo">
                {spinner(`leer-${c.sistema}`, "bi-download")}
                Leer ahora
              </button>
              <button className="btn btn-sm btn-outline-secondary" disabled={!!ocupado} onClick={onSincronizar} title="Pide a Emisso consultar el banco o el SII ahora">
                {spinner(`sinc-${c.sistema}`, "bi-arrow-clockwise")}
                Sincronizar
              </button>
            </>
          )}
          {admin && conectada && (
            <button className="btn btn-sm btn-outline-secondary ms-auto" disabled={!!ocupado} onClick={onPausar} title={c.estado === "activa" ? "Dejar de leer esta fuente" : "Volver a leerla"}>
              <i className={`bi ${c.estado === "activa" ? "bi-pause" : "bi-play"}`} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Página de Emisso donde se escribe la clave. Incrustada si el front tiene un origen https
 * registrado; si no, como enlace que se abre en otra pestaña. El resultado llega por postMessage
 * (solo se acepta del origen de Emisso) y el servidor lo comprueba con Emisso antes de guardarlo.
 */
function EnlaceModal({
  nombre,
  enlace,
  confirmando,
  onConfirmar,
  onCerrar,
}: {
  nombre: string;
  enlace: EnlaceConexion;
  confirmando: boolean;
  onConfirmar: () => void;
  onCerrar: () => void;
}) {
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    if (!enlace.embebible) return;
    const alRecibir = (e: MessageEvent) => {
      if (e.origin !== enlace.origen) return;
      const msg = e.data as { type?: string; status?: string };
      if (msg?.type !== "emisso:connect") return;
      if (msg.status === "connected") onConfirmar();
      else setFallo(true);
    };
    window.addEventListener("message", alRecibir);
    return () => window.removeEventListener("message", alRecibir);
  }, [enlace, onConfirmar]);

  const dominio = new URL(enlace.url).host;

  return (
    <Modal
      titulo={`${enlace.reconectar ? "Reconectar" : "Conectar"} ${nombre}`}
      onCerrar={onCerrar}
      tamano="lg"
      pie={
        <div className="d-flex flex-wrap align-items-center gap-2 w-100">
          <small className="text-muted me-auto">Vence el {fechaHora(enlace.expiraEn)}</small>
          <button className="btn btn-outline-secondary" onClick={onCerrar}>
            Cerrar
          </button>
          <button className="btn btn-primary" disabled={confirmando} onClick={onConfirmar}>
            {confirmando ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-check2 me-1" />}
            Ya entregué la clave
          </button>
        </div>
      }
    >
      <p className="small text-muted">
        La clave se escribe en la página de <strong>{dominio}</strong> (Emisso), el servicio que usa esta aplicación para leer {nombre}. No
        pasa por nuestro servidor y queda cifrada en Emisso. No es un aviso del banco ni del SII.
      </p>
      {fallo && <div className="alert alert-warning small">Emisso no pudo completar la conexión. Revise los datos e intente de nuevo.</div>}
      {enlace.embebible ? (
        <iframe src={enlace.url} title={`Conectar ${nombre}`} style={{ width: "100%", height: 640, border: 0 }} />
      ) : (
        <div className="border rounded p-3 text-center">
          <a className="btn btn-primary" href={enlace.url} target="_blank" rel="noopener noreferrer">
            <i className="bi bi-box-arrow-up-right me-1" />
            Abrir {dominio}
          </a>
          <p className="small text-muted mt-2 mb-0">Escriba la clave en la pestaña nueva y vuelva aquí para confirmar.</p>
        </div>
      )}
    </Modal>
  );
}
