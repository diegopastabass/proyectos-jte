import { useState } from "react";
import { Alert, Button, ButtonGroup, Col, Form, Modal, Row, Spinner } from "react-bootstrap";
import { API_BASE } from "../config";
import { hoyChile, listarDias, sumarDias } from "../lib/fechas";

/** Lunes a domingo de la semana anterior (igual que el informe por defecto de la API). */
const semanaAnterior = (hoy: string): [string, string] => {
  const diaSemana = new Date(`${hoy}T12:00:00Z`).getUTCDay();
  const lunes = sumarDias(hoy, -((diaSemana + 6) % 7));
  return [sumarDias(lunes, -7), sumarDias(lunes, -1)];
};

const ATAJOS: { etiqueta: string; rango: (hoy: string) => [string, string] }[] = [
  { etiqueta: "Semana anterior", rango: semanaAnterior },
  { etiqueta: "Últimos 7 días", rango: (hoy) => [sumarDias(hoy, -6), hoy] },
  {
    etiqueta: "Mes anterior",
    rango: (hoy) => {
      const fin = sumarDias(`${hoy.slice(0, 7)}-01`, -1);
      return [`${fin.slice(0, 7)}-01`, fin];
    },
  },
];

interface InformeModalProps {
  show: boolean;
  onClose: () => void;
}

/** Descarga el informe de condiciones en PDF que genera la API. */
function InformeModal({ show, onClose }: InformeModalProps) {
  const hoy = hoyChile();
  const [[start, end], setRango] = useState<[string, string]>(() => semanaAnterior(hoy));
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const descargar = async () => {
    if (start > end) return setError("La fecha de inicio debe ser anterior o igual a la de fin.");
    if (listarDias(start, end).length > 31) return setError("El informe admite como máximo 31 días.");
    setError(null);
    setCargando(true);
    try {
      const res = await fetch(`${API_BASE}/reports/weekly?start=${start}&end=${end}`);
      if (!res.ok) throw new Error(`No se pudo generar el informe (error ${res.status}).`);
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `viveros_informe_${start}_${end}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar el informe.");
    } finally {
      setCargando(false);
    }
  };

  return (
    <Modal show={show} onHide={onClose} centered>
      <Modal.Header closeButton>
        <Modal.Title as="h5">Informe de condiciones (PDF)</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="small text-body-secondary">
          Tiempo en rango por cámara y por día, temperatura y humedad (mínimo, promedio y máximo), episodios fuera
          de rango y observaciones sobre los sensores.
        </p>
        <ButtonGroup size="sm" className="mb-3 flex-wrap" aria-label="Períodos rápidos">
          {ATAJOS.map(({ etiqueta, rango }) => (
            <Button key={etiqueta} variant="outline-secondary" onClick={() => setRango(rango(hoy))}>
              {etiqueta}
            </Button>
          ))}
        </ButtonGroup>
        <Row className="mb-3">
          <Col>
            <Form.Label htmlFor="informeInicio">Desde</Form.Label>
            <Form.Control id="informeInicio" type="date" value={start} max={hoy} onChange={(e) => setRango([e.target.value, end])} />
          </Col>
          <Col>
            <Form.Label htmlFor="informeFin">Hasta</Form.Label>
            <Form.Control id="informeFin" type="date" value={end} max={hoy} onChange={(e) => setRango([start, e.target.value])} />
          </Col>
        </Row>
        {error && <Alert variant="danger" className="py-2">{error}</Alert>}
        <div className="d-flex justify-content-end gap-2 mt-4">
          <Button variant="secondary" onClick={onClose} disabled={cargando}>
            Cancelar
          </Button>
          <Button variant="success" onClick={descargar} disabled={cargando}>
            {cargando ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Generando...
              </>
            ) : (
              "Descargar PDF"
            )}
          </Button>
        </div>
      </Modal.Body>
    </Modal>
  );
}

export default InformeModal;
