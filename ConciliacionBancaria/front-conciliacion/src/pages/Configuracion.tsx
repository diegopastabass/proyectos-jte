import { useState } from "react";
import { Encabezado } from "../components/comunes";
import Categorias from "../components/config/Categorias";
import Contrapartes from "../components/config/Contrapartes";
import Cuentas from "../components/config/Cuentas";
import Reglas from "../components/config/Reglas";
import Usuarios from "../components/config/Usuarios";
import { useSesion } from "../sesion";

const PESTANAS = [
  { id: "contrapartes", texto: "Contrapartes", icono: "bi-people" },
  { id: "reglas", texto: "Reglas", icono: "bi-signpost-split" },
  { id: "categorias", texto: "Categorías", icono: "bi-tags" },
  { id: "cuentas", texto: "Cuentas", icono: "bi-bank" },
  { id: "usuarios", texto: "Usuarios", icono: "bi-person-gear", admin: true },
] as const;

export default function Configuracion() {
  const { puede } = useSesion();
  const [pestana, setPestana] = useState<(typeof PESTANAS)[number]["id"]>("contrapartes");

  return (
    <div className="container py-4">
      <Encabezado titulo="Configuración" subtitulo="Cómo concilia el motor: contrapartes con categoría, reglas y categorías." />
      <ul className="nav nav-tabs mb-3">
        {PESTANAS.filter((p) => !("admin" in p) || puede("admin")).map((p) => (
          <li className="nav-item" key={p.id}>
            <button className={`nav-link ${pestana === p.id ? "active" : ""}`} onClick={() => setPestana(p.id)}>
              <i className={`bi ${p.icono} me-1`} />
              {p.texto}
            </button>
          </li>
        ))}
      </ul>
      {pestana === "contrapartes" && <Contrapartes />}
      {pestana === "reglas" && <Reglas />}
      {pestana === "categorias" && <Categorias />}
      {pestana === "cuentas" && <Cuentas />}
      {pestana === "usuarios" && <Usuarios />}
    </div>
  );
}
