import { useState } from "react";
import { Alert, Button, Form, Modal, Spinner } from "react-bootstrap";
import { API_BASE } from "../config";
import { getJson } from "../lib/api";

interface LoginModalProps {
  show: boolean;
  onClose: () => void;
  onLoginSuccess: (role: string, accessToken: string) => void;
}

/**
 * Ingreso y registro. Una cuenta nueva queda con rol 1000 (sin acceso) hasta que un
 * administrador cambia el rol en la base de datos; mientras tanto el login responde 403.
 */
export default function LoginModal({ show, onClose, onLoginSuccess }: LoginModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [registro, setRegistro] = useState(false);
  const [username, setUsername] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
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
    } catch (err) {
      const status = (err as { status?: number }).status;
      setError(status === 403 ? "Tu cuenta aún no está habilitada. Un administrador debe aprobarla." : "Correo o contraseña incorrectos.");
    } finally {
      setCargando(false);
    }
  };

  const registrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });
      if (!res.ok) {
        const m = (await res.json().catch(() => null))?.message;
        throw new Error(Array.isArray(m) ? m.join(", ") : (m ?? `Error ${res.status} al registrar`));
      }
      setPassword("");
      setRegistro(false);
      setAviso("Cuenta creada. Un administrador debe habilitarla antes de que puedas ingresar.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCargando(false);
    }
  };

  const cambiarModo = () => {
    setRegistro(!registro);
    setError(null);
    setAviso(null);
  };

  return (
    <Modal show={show} onHide={onClose} centered size="sm">
      <Form onSubmit={registro ? registrar : ingresar}>
        <Modal.Header closeButton>
          <Modal.Title as="h5">{registro ? "Crear cuenta" : "Ingresar"}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {aviso && <Alert variant="success" className="py-2">{aviso}</Alert>}
          {registro && (
            <Form.Group className="mb-3" controlId="loginUsername">
              <Form.Label>Nombre de usuario</Form.Label>
              <Form.Control autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
            </Form.Group>
          )}
          <Form.Group className="mb-3" controlId="loginEmail">
            <Form.Label>Correo</Form.Label>
            <Form.Control type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Form.Group>
          <Form.Group className="mb-2" controlId="loginPassword">
            <Form.Label>Contraseña</Form.Label>
            <Form.Control
              type="password"
              autoComplete={registro ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={registro ? 8 : undefined}
            />
            {registro && <Form.Text muted>Mínimo 8 caracteres, con letras, números y símbolos.</Form.Text>}
          </Form.Group>
          {error && <Alert variant="danger" className="py-2 mb-0 mt-3">{error}</Alert>}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="link" className="me-auto p-0" onClick={cambiarModo} disabled={cargando}>
            {registro ? "Ya tengo cuenta" : "Crear cuenta"}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={cargando}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={cargando}>
            {cargando ? <Spinner animation="border" size="sm" /> : registro ? "Registrarme" : "Ingresar"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
