import React from "react";

interface StatesProps {
  title?: string;
  style?: React.CSSProperties;
  // Originales
  automatico?: string;
  bomba?: string;
  falla?: string;
  // Planta 1
  falla_vdf1_p1?: string;
  falla_vdf2_p1?: string;
  presion?: string;
  // Planta 2
  automatico_p1?: string;
  asimetria_p1?: string;
  bomba_p1?: string;
  falla_p1?: string;
}

// Estilos Base
const indicadorBase: React.CSSProperties = {
  display: "inline-block",
  marginLeft: "10px",
  padding: "2px 10px", // Grosor vertical reducido
  color: "white",
  borderRadius: "12px",
  fontSize: "0.8rem",
  minWidth: "110px",
  textAlign: "center",
};

// Helper de Estilos
const getBadgeStyle = (
  valor: string | undefined,
  tipo: "automatico" | "bomba" | "falla" | "info",
): React.CSSProperties => {
  if (tipo === "info") {
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
  tipo: "automatico" | "bomba" | "falla" | "info",
): string => {
  if (tipo === "info") return valor ? `${valor} bar` : "-";

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
  type: "automatico" | "bomba" | "falla" | "info";
}) => {
  if (value === undefined) return null;
  return (
    <div className="d-flex justify-content-between align-items-center mb-2">
      <span>{label}:</span>
      <span style={getBadgeStyle(value, type)}>{getLabel(value, type)}</span>
    </div>
  );
};

export default function States(props: StatesProps) {
  const { title, style } = props;

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
      <div className="card-body p-1">
        {title && (
          <h6
            className="card-title mb-3"
            style={{ fontSize: "1rem", fontWeight: "bold" }}
          >
            {title}
          </h6>
        )}

        {/* Props Originales */}
        <StateRow label="Modo" value={props.automatico} type="automatico" />
        <StateRow label="Bomba" value={props.bomba} type="bomba" />
        <StateRow label="Falla Asimetría" value={"0"} type="falla" />
        <StateRow label="Falla Térmica" value={props.falla} type="falla" />

        {/* Props Planta 1 */}
        <StateRow label="Falla VDF1" value={props.falla_vdf1_p1} type="falla" />
        <StateRow label="Falla VDF3" value={props.falla_vdf2_p1} type="falla" />
        <StateRow label="Presión" value={props.presion} type="info" />

        {/* Props Planta 2 */}
        <StateRow label="Modo" value={props.automatico_p1} type="automatico" />
        <StateRow label="Bomba" value={props.bomba_p1} type="bomba" />
        <StateRow
          label="Falla Asimetría"
          value={props.asimetria_p1}
          type="falla"
        />
        <StateRow label="Falla Térmica" value={props.falla_p1} type="falla" />
      </div>
    </div>
  );
}
