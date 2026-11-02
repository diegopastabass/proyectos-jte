import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import api from "./api";
import type { Empresa, LoginRespuesta, Rol, Usuario } from "./types";

interface Sesion {
  usuario: Usuario | null;
  empresas: Empresa[];
  empresa: Empresa | null;
  /** Rol del usuario en la empresa seleccionada. */
  rol: Rol | null;
  /** true mientras se validan la sesión guardada y las empresas. */
  iniciando: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  elegirEmpresa: (id: number) => void;
  recargarEmpresas: () => Promise<void>;
  puede: (rolMinimo: Rol) => boolean;
}

const NIVEL: Record<Rol, number> = { lector: 1, operador: 2, admin: 3 };

const SesionContext = createContext<Sesion | null>(null);

function leerUsuario(): Usuario | null {
  try {
    const u = localStorage.getItem("usuario");
    return u && localStorage.getItem("token") ? (JSON.parse(u) as Usuario) : null;
  } catch {
    return null;
  }
}

export function SesionProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(leerUsuario);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaId, setEmpresaId] = useState<number | null>(() => Number(localStorage.getItem("empresaId")) || null);
  const [iniciando, setIniciando] = useState(() => leerUsuario() !== null);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    setUsuario(null);
    setEmpresas([]);
  }, []);

  const recargarEmpresas = useCallback(async () => {
    const r = await api.get<Empresa[]>("/empresas");
    setEmpresas(r.data);
  }, []);

  // Al abrir con una sesión guardada, se valida el token pidiendo las empresas.
  useEffect(() => {
    if (!usuario) return;
    let vigente = true;
    api
      .get<Empresa[]>("/empresas")
      .then((r) => vigente && setEmpresas(r.data))
      .catch(() => vigente && logout())
      .finally(() => vigente && setIniciando(false));
    return () => {
      vigente = false;
    };
  }, [usuario, logout]);

  useEffect(() => {
    window.addEventListener("sesion-expirada", logout);
    return () => window.removeEventListener("sesion-expirada", logout);
  }, [logout]);

  const login = useCallback(async (email: string, password: string) => {
    const r = await api.post<LoginRespuesta>("/auth/login", { email, password });
    localStorage.setItem("token", r.data.access_token);
    localStorage.setItem("usuario", JSON.stringify(r.data.usuario));
    setIniciando(true);
    setUsuario(r.data.usuario);
  }, []);

  const elegirEmpresa = useCallback((id: number) => {
    localStorage.setItem("empresaId", String(id));
    setEmpresaId(id);
  }, []);

  // Si la empresa guardada ya no está disponible, se usa la primera.
  const empresa = empresas.find((e) => e.id === empresaId) ?? empresas[0] ?? null;
  const rol = empresa?.rol ?? null;
  const puede = useCallback((rolMinimo: Rol) => rol !== null && NIVEL[rol] >= NIVEL[rolMinimo], [rol]);

  return (
    <SesionContext.Provider
      value={{ usuario, empresas, empresa, rol, iniciando, login, logout, elegirEmpresa, recargarEmpresas, puede }}
    >
      {children}
    </SesionContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSesion(): Sesion {
  const s = useContext(SesionContext);
  if (!s) throw new Error("useSesion fuera de SesionProvider");
  return s;
}

/** Empresa seleccionada; solo para pantallas que ya están dentro de la sesión. */
// eslint-disable-next-line react-refresh/only-export-components
export function useEmpresa(): Empresa {
  const { empresa } = useSesion();
  if (!empresa) throw new Error("Sin empresa seleccionada");
  return empresa;
}
