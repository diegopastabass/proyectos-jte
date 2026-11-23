import { useState } from "react";
import { Alert, Button, Form, Modal, Spinner } from "react-bootstrap";
import { getJson } from "../lib/api";

interface LoginModalProps {
  show: boolean;
  onClose: () => void;
  onLoginSuccess: (role: string, accessToken: string) => void;
}

/** Ingreso de administradores. Los usuarios nuevos los crea un administrador (POST /auth/register). */
export default function LoginModal({ show, onClose, onLoginSuccess }: LoginModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const ingresar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      const r = await getJson<{ access_token: string; user_role: string }>("auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      onLoginSuccess(r.user_role, r.access_token);
      setPassword("");
      onClose();
    } catch {
      setError("Correo o contraseña incorrectos.");
    } finally {
      setCargando(false);
    }
  };

  return (
    <Modal show={show} onHide={onClose} centered size="sm">
      <Form onSubmit={ingresar}>
        <Modal.Header closeButton>
          <Modal.Title as="h5">Ingresar</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3" controlId="loginEmail">
            <Form.Label>Correo</Form.Label>
            <Form.Control type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Form.Group>
          <Form.Group className="mb-2" controlId="loginPassword">
            <Form.Label>Contraseña</Form.Label>
            <Form.Control
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Form.Group>
          {error && <Alert variant="danger" className="py-2 mb-0 mt-3">{error}</Alert>}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onClose} disabled={cargando}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={cargando}>
            {cargando ? <Spinner animation="border" size="sm" /> : "Ingresar"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
