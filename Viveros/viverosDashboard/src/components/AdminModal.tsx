import { useState } from "react";
import { Alert, Button, Form, Modal, Spinner, Table } from "react-bootstrap";
import { NOMBRE_VARIABLE, UNIDAD, type Variable, type ZonaId } from "../config";
import { conToken, getJson } from "../lib/api";
import type { Config } from "../lib/tipos";

interface Fila {
  zona: ZonaId;
  variable: Variable;
  min: string;
  max: string;
  alerta: boolean;
}

interface AdminModalProps {
  show: boolean;
  token: string;
  config: Config;
  onClose: () => void;
  onGuardado: (config: Config) => void;
}

const VARIABLES: Variable[] = ["t", "hr", "vpd"];

const aFilas = (config: Config): Fila[] =>
  config.zonas.flatMap((z) =>
    VARIABLES.map((v) => ({
      zona: z.id,
      variable: v,
      min: z.variables[v].min === null ? "" : String(z.variables[v].min),
      max: z.variables[v].max === null ? "" : String(z.variables[v].max),
      alerta: z.variables[v].alerta,
    })),
  );

const aNumero = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")));

/**
 * Rangos permitidos y alertas por WhatsApp. Es la misma configuración que usan las
 * tarjetas, los gráficos, el informe y el monitor de alarmas.
 */
export default function AdminModal({ show, token, config, onClose, onGuardado }: AdminModalProps) {
  const [filas, setFilas] = useState<Fila[]>(() => aFilas(config));
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "success" | "danger"; texto: string } | null>(null);

  const cambiar = (i: number, cambio: Partial<Fila>) =>
    setFilas((f) => f.map((x, j) => (j === i ? { ...x, ...cambio } : x)));

  const guardar = async () => {
    const umbrales = filas.map((f) => ({ zona: f.zona, variable: f.variable, min: aNumero(f.min), max: aNumero(f.max), alerta: f.alerta }));
    const invalida = umbrales.find(
      (u) => Number.isNaN(u.min) || Number.isNaN(u.max) || (u.min !== null && u.max !== null && u.min >= u.max),
    );
    if (invalida) {
      const nombre = config.zonas.find((z) => z.id === invalida.zona)?.nombre;
      setMensaje({ tipo: "danger", texto: `${nombre} · ${NOMBRE_VARIABLE[invalida.variable]}: revisa los valores (el mínimo debe ser menor que el máximo).` });
      return;
    }
    setGuardando(true);
    setMensaje(null);
    try {
      const nueva = await getJson<Config>("config", conToken(token, { method: "PATCH", body: JSON.stringify({ umbrales }) }));
      onGuardado(nueva);
      setMensaje({ tipo: "success", texto: "Rangos guardados. El monitor de alarmas los usa desde su próximo ciclo." });
    } catch (e) {
      const status = (e as { status?: number }).status;
      const texto =
        status === 401 ? "La sesión expiró: vuelve a ingresar." : e instanceof Error ? e.message : "No se pudo guardar.";
      setMensaje({ tipo: "danger", texto });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal show={show} onHide={onClose} centered size="lg" onShow={() => { setFilas(aFilas(config)); setMensaje(null); }}>
      <Modal.Header closeButton>
        <Modal.Title as="h5">Rangos permitidos y alertas</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="small text-body-secondary">
          Deja un campo vacío para no tener límite por ese lado. "Alerta" envía un WhatsApp cuando la variable sale del
          rango (y otro cuando vuelve).
        </p>
        <Table size="sm" responsive className="align-middle small">
          <thead>
            <tr>
              <th>Zona</th>
              <th>Variable</th>
              <th style={{ width: 110 }}>Mínimo</th>
              <th style={{ width: 110 }}>Máximo</th>
              <th className="text-center">Alerta</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={`${f.zona}-${f.variable}`}>
                <td>{f.variable === "t" ? config.zonas.find((z) => z.id === f.zona)?.nombre : ""}</td>
                <td>
                  {NOMBRE_VARIABLE[f.variable]} <span className="text-body-secondary">({UNIDAD[f.variable]})</span>
                </td>
                <td>
                  <Form.Control size="sm" inputMode="decimal" value={f.min} onChange={(e) => cambiar(i, { min: e.target.value })} aria-label="Mínimo" />
                </td>
                <td>
                  <Form.Control size="sm" inputMode="decimal" value={f.max} onChange={(e) => cambiar(i, { max: e.target.value })} aria-label="Máximo" />
                </td>
                <td className="text-center">
                  <Form.Check
                    type="switch"
                    className="d-inline-block"
                    checked={f.alerta}
                    onChange={(e) => cambiar(i, { alerta: e.target.checked })}
                    aria-label="Alerta por WhatsApp"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
        {mensaje && <Alert variant={mensaje.tipo} className="py-2">{mensaje.texto}</Alert>}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={guardando}>
          Cerrar
        </Button>
        <Button variant="primary" onClick={guardar} disabled={guardando}>
          {guardando ? <Spinner animation="border" size="sm" /> : "Guardar"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
