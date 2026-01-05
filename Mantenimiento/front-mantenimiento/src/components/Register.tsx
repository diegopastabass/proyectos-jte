import { useState } from 'react';
import api from '../api';

interface Props {
  onGoToLogin: () => void;
}

export default function Register({ onGoToLogin }: Props) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/users/register', {
        email,
        password,
        fullName: `${firstName} ${lastName}`.trim()
      });
      alert('Registro exitoso. Por favor inicia sesión.');
      onGoToLogin();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al registrar');
    }
  };

  return (
    <div className="d-flex justify-content-center align-items-center vh-100 bg-light">
      <div className="card shadow p-4" style={{ maxWidth: '400px', width: '100%' }}>
        <h2 className="text-center mb-4">Registro</h2>
        {error && <div className="alert alert-danger">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label">Nombre</label>
            <input type="text" className="form-control" value={firstName} onChange={e => setFirstName(e.target.value)} required />
          </div>
          <div className="mb-3">
            <label className="form-label">Apellido</label>
            <input type="text" className="form-control" value={lastName} onChange={e => setLastName(e.target.value)} required />
          </div>
          <div className="mb-3">
            <label className="form-label">Email</label>
            <input type="email" className="form-control" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="mb-3">
            <label className="form-label">Contraseña</label>
            <input type="password" className="form-control" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
          </div>
          <div className="d-grid gap-2">
            <button type="submit" className="btn btn-success">Registrarse</button>
          </div>
        </form>
        <div className="text-center mt-3">
          <button className="btn btn-link" onClick={onGoToLogin}>
            Volver al Login
          </button>
        </div>
      </div>
    </div>
  );
}