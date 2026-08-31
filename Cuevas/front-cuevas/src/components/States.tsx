import React from "react";

interface StateProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
}

function State(props: StateProps) {
  const { children, style } = props;
  return (
    <div
      className="card h-100 w-100"
      style={{
        width: "100%",
        marginBottom: "5px",
        padding: "10px",
        ...style,
      }}
    >
      <div className="card-body p-1">{children}</div>
    </div>
  );
}

interface CardBodyProps {
  automatico?: string; // "1" o "0"
  bomba?: string;
  falla?: string;
  asimetria?: string;
  corriente1?: string;
  corriente2?: string;
  corriente3?: string;
  voltaje1?: string;
  voltaje2?: string;
  voltaje3?: string;
  title?: string;
}

// Estilos Base
const indicadorBase: React.CSSProperties = {
  display: "inline-block",
  marginLeft: "10px",
  padding: "2px 10px", // Grosor vertical reducido
  color: "white",
  borderRadius: "12px",
  fontSize: "0.8rem",
  minWidth: "100px",
  textAlign: "center",
};

// Helper de Estilos
const getBadgeStyle = (
  valor: string | undefined,
  tipo: "automatico" | "bomba" | "falla" | "info" | "corriente" | "voltaje",
): React.CSSProperties => {
  if (tipo === "info" || tipo === "corriente" || tipo === "voltaje") {
    return { ...indicadorBase, backgroundColor: "#17a2b8" }; // Color informativo (ej. azul)
  }

  const activo = valor === "1";
  let color = "gray";

  if (tipo === "falla") {
    color = activo ? "orange" : "gray"; // Falla activa = Naranja
  } else {
    color = activo ? "green" : "gray"; // Estado activo = Verde
  }

  return { ...indicadorBase, backgroundColor: color };
};

// Helper de Textos
const getLabel = (
  valor: string | undefined,
  tipo: "automatico" | "bomba" | "falla" | "info" | "corriente" | "voltaje",
): string => {
  if (tipo === "info") return valor ? `${valor} bar` : "-";
  if (tipo === "corriente") return valor ? `${valor} A` : "-";
  if (tipo === "voltaje") return valor ? `${valor} V` : "-";

  const activo = valor === "1";
  switch (tipo) {
    case "automatico":
      return activo ? "Automático" : "Manual";
    case "bomba":
      return activo ? "Encendida" : "Apagada";
    case "falla":
      return activo ? "Con falla" : "Sin falla";
    default:
      return "-";
  }
};

// Componente de Fila
const StateRow = ({
  label,
  value,
  type,
}: {
  label: string;
  value?: string;
  type: "automatico" | "bomba" | "falla" | "info" | "corriente" | "voltaje";
}) => {
  if (value === undefined) return null;
  return (
    <div className="d-flex justify-content-between align-items-center mb-2">
      <span>{label}:</span>
      <span style={getBadgeStyle(value, type)}>{getLabel(value, type)}</span>
    </div>
  );
};

export function StateBody(props: CardBodyProps) {
  const {
    automatico,
    bomba,
    falla,
    asimetria,
    corriente1,
    corriente2,
    corriente3,
    voltaje1,
    voltaje2,
    voltaje3,
    title = "Estado Tablero",
  } = props;

  return (
    <>
      <h6 className="card-title mb-3" style={{ fontSize: "1rem", fontWeight: "bold" }}>{title}</h6>

      <StateRow label="Modo" value={automatico} type="automatico" />
      <StateRow label="Bomba" value={bomba} type="bomba" />
      <StateRow label="Falla Asimetría" value={asimetria} type="falla" />
      <StateRow label="Falla Térmica" value={falla} type="falla" />
      <StateRow label="Corriente L1" value={corriente1} type="corriente" />
      <StateRow label="Corriente L2" value={corriente2} type="corriente" />
      <StateRow label="Corriente L3" value={corriente3} type="corriente" />
      <StateRow label="Voltaje L1" value={voltaje1} type="voltaje" />
      <StateRow label="Voltaje L2" value={voltaje2} type="voltaje" />
      <StateRow label="Voltaje L3" value={voltaje3} type="voltaje" />
    </>
  );
}

export default State;
