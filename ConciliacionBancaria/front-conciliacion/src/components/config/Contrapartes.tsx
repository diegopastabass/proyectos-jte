import { useState } from "react";
import api, { mensajeError } from "../../api";
import { TIPO_CONTRAPARTE } from "../../formato";
import { useEmpresa, useSesion } from "../../sesion";
import type { Categoria, Contraparte, TipoContraparte } from "../../types";
import { useCarga } from "../../useCarga";
import { Alerta, Cargando, Modal, Paginacion } from "../comunes";

const POR_PAGINA = 30;

export default function Contrapartes() {
  const empresa = useEmpresa();
  const { puede } = useSesion();
  const base = `/empresas/${empresa.id}`;
  const lista = useCarga<Contraparte[]>(`${base}/contrapartes`);
  const categorias = useCarga<Categoria[]>(`${base}/categorias`);
  const [busqueda, setBusqueda] = useState("");
  const [tipo, setTipo] = useState<TipoContraparte | "" | "con_categoria">("");
  const [pagina, setPagina] = useState(1);
  const [error, setError] = useState("");
  const [nueva, setNueva] = useState(false);
  const admin = puede("admin");

  const texto = busqueda.trim().toUpperCase();
  const filtradas = (lista.datos ?? []).filter(
    (c) =>
      (!texto || c.nombre.toUpperCase().includes(texto) || c.rut?.includes(texto)) &&
      (tipo === "" || (tipo === "con_categoria" ? c.categoriaId !== null : c.tipo === tipo)),
  );

  const asignarCategoria = async (c: Contraparte, categoriaId: number | null) => {
    setError("");
    try {
      await api.patch(`${base}/contrapartes/${c.id}`, { categoriaId });
      lista.recargar();
    } catch (e) {
      setError(mensajeError(e));
    }
  };

  if (!lista.datos) return lista.error ? <Alerta error={lista.error} /> : <Cargando />;

  return (
    <>
      <div className="alert alert-light border small">
        <i className="bi bi-info-circle me-1" />
        Una contraparte <strong>con categoría</strong> se concilia contra esa categoría y no factura por factura: por ejemplo COPEC →
        «Combustible y peajes», o el dueño → «Retiro del dueño». Sus facturas dejan de aparecer como deuda. Registre como{" "}
        <strong>persona</strong> a quienes se les transfiere seguido (sueldos, honorarios) para que el motor las reconozca.
      </div>
      <Alerta error={error} onCerrar={() => setError("")} />

      <div className="d-flex flex-wrap gap-2 mb-3">
        <div className="input-group" style={{ maxWidth: 360 }}>
          <span className="input-group-text bg-white border-end-0">
            <i className="bi bi-search text-muted" />
          </span>
          <input
            className="form-control border-start-0 ps-0"
            placeholder="Nombre o RUT"
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setPagina(1);
            }}
          />
        </div>
        <select
          className="form-select"
          style={{ maxWidth: 220 }}
          value={tipo}
          onChange={(e) => {
            setTipo(e.target.value as typeof tipo);
            setPagina(1);
          }}
        >
          <option value="">Todos los tipos</option>
          <option value="con_categoria">Con categoría</option>
          {Object.entries(TIPO_CONTRAPARTE).map(([v, t]) => (
            <option key={v} value={v}>
              {t}
            </option>
          ))}
        </select>
        {puede("operador") && (
          <button className="btn btn-primary ms-auto" onClick={() => setNueva(true)}>
            <i className="bi bi-person-plus me-1" />
            Nueva persona o contraparte
          </button>
        )}
      </div>

      <div className="card card-suave shadow-sm">
        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>Nombre</th>
                <th>RUT</th>
                <th>Tipo</th>
                <th style={{ width: 280 }}>Se concilia como</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA).map((c) => (
                <tr key={c.id}>
                  <td className="fw-semibold">{c.nombre}</td>
                  <td className="text-muted text-nowrap">{c.rut ?? "—"}</td>
                  <td>{TIPO_CONTRAPARTE[c.tipo]}</td>
                  <td>
                    <select
                      className={`form-select form-select-sm ${c.categoriaId ? "border-primary" : ""}`}
                      value={c.categoriaId ?? ""}
                      disabled={!admin}
                      title={admin ? "" : "Solo un administrador puede cambiarlo"}
                      onChange={(e) => asignarCategoria(c, e.target.value === "" ? null : Number(e.target.value))}
                    >
                      <option value="">Documento a documento</option>
                      {categorias.datos
                        ?.filter((x) => x.activa || x.id === c.categoriaId)
                        .map((x) => (
                          <option key={x.id} value={x.id}>
                            Categoría: {x.nombre}
                          </option>
                        ))}
                    </select>
                  </td>
                </tr>
              ))}
              {filtradas.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-muted py-3">
                    Sin contrapartes. Se crean solas al importar el RCV.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <Paginacion total={filtradas.length} pagina={pagina} porPagina={POR_PAGINA} onCambiar={setPagina} />

      {nueva && (
        <NuevaContraparte
          categorias={categorias.datos ?? []}
          onCerrar={() => setNueva(false)}
          onCreada={() => {
            setNueva(false);
            lista.recargar();
          }}
        />
      )}
    </>
  );
}

function NuevaContraparte({
  categorias,
  onCerrar,
  onCreada,
}: {
  categorias: Categoria[];
  onCerrar: () => void;
  onCreada: () => void;
}) {
  const empresa = useEmpresa();
  const [nombre, setNombre] = useState("");
  const [rut, setRut] = useState("");
  const [tipo, setTipo] = useState<TipoContraparte>("persona");
  const [categoriaId, setCategoriaId] = useState<number | "">("");
  const [error, setError] = useState("");

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`/empresas/${empresa.id}/contrapartes`, {
        nombre,
        tipo,
        rut: rut.trim() || undefined,
        categoriaId: categoriaId === "" ? undefined : categoriaId,
      });
      onCreada();
    } catch (err) {
      setError(mensajeError(err));
    }
  };

  return (
    <Modal titulo="Nueva contraparte" onCerrar={onCerrar}>
      <form onSubmit={guardar}>
        <Alerta error={error} />
        <div className="mb-3">
          <label className="form-label">Nombre</label>
          <input className="form-control" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          <small className="text-muted">
            Como aparece en la cartola, completo: «MARTINEZ ESPINA EDUARDO NICOLAS» para «TEF A MARTINEZ ESPINA EDUARDO NICOL».
          </small>
        </div>
        <div className="row g-3 mb-3">
          <div className="col-md-6">
            <label className="form-label">RUT (opcional)</label>
            <input className="form-control" value={rut} onChange={(e) => setRut(e.target.value)} placeholder="12.345.678-9" />
          </div>
          <div className="col-md-6">
            <label className="form-label">Tipo</label>
            <select className="form-select" value={tipo} onChange={(e) => setTipo(e.target.value as TipoContraparte)}>
              {Object.entries(TIPO_CONTRAPARTE)
                .filter(([v]) => v !== "propia")
                .map(([v, t]) => (
                  <option key={v} value={v}>
                    {t}
                  </option>
                ))}
            </select>
          </div>
        </div>
        <div className="mb-3">
          <label className="form-label">Se concilia como</label>
          <select className="form-select" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value === "" ? "" : Number(e.target.value))}>
            <option value="">Documento a documento</option>
            {categorias
              .filter((c) => c.activa)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  Categoría: {c.nombre}
                </option>
              ))}
          </select>
        </div>
        <div className="d-flex justify-content-end gap-2">
          <button type="button" className="btn btn-outline-secondary" onClick={onCerrar}>
            Cancelar
          </button>
          <button className="btn btn-primary">Guardar</button>
        </div>
      </form>
    </Modal>
  );
}
