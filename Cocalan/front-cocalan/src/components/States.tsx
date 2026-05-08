import React from "react";

interface StatesProps {
  title?: string;
  style?: React.CSSProperties;

  //Estados
  automatico?: string;
  manual?: string;
  bomba?: string;
  falla?: string;

  //Mediciones bomba
  presion?: string;
  temp?: string;
  petroleo?: string;
  rpm?: string;
  pf?: string;

  //Eléctrico
  l1l2?: string;
  l2l3?: string;
  l3l1?: string;
  l1n?: string;
  l2n?: string;
  l3n?: string;
  i1?: string;
  i2?: string;
  i3?: string;
  kw1?: string;
  kw2?: string;
  kw3?: string;
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
  tipo: "automatico" | "bomba" | "falla" | "manual" | "info",
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
  tipo: "automatico" | "bomba" | "falla" | "manual" | "info",
): string => {
  if (tipo === "info") return valor ? `${valor}` : "-";

  const activo = valor === "1";
  switch (tipo) {
    case "automatico":
      return activo ? "Automático" : "Apagado";
    case "bomba":
      return activo ? "Encendida" : "Apagada";
    case "falla":
      return activo ? "Con falla" : "Sin falla";
    case "manual":
      return activo ? "Manual" : "Apagado";
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
  type: "automatico" | "bomba" | "falla" | "manual" | "info";
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
        <StateRow label="Falla" value={props.falla} type="falla" />
        <StateRow label="Manual" value={props.manual} type="manual" />

        {/* Props Planta 1 */}
        <StateRow
          label="Presión"
          value={props.presion ? `${props.presion} bar` : undefined}
          type="info"
        />
        <StateRow
          label="Temperatura"
          value={props.temp ? `${props.temp} °C` : undefined}
          type="info"
        />
        <StateRow
          label="Nivel Petróleo"
          value={props.petroleo ? `${props.petroleo} %` : undefined}
          type="info"
        />
        <StateRow
          label="RPM"
          value={props.rpm ? `${props.rpm} RPM` : undefined}
          type="info"
        />
        <StateRow label="Factor de Potencia" value={props.pf} type="info" />

        {/* Eléctrico */}
        <StateRow
          label="Voltaje L1-L2"
          value={props.l1l2 ? `${props.l1l2} V` : undefined}
          type="info"
        />
        <StateRow
          label="Voltaje L2-L3"
          value={props.l2l3 ? `${props.l2l3} V` : undefined}
          type="info"
        />
        <StateRow
          label="Voltaje L3-L1"
          value={props.l3l1 ? `${props.l3l1} V` : undefined}
          type="info"
        />
        <StateRow
          label="Voltaje L1-N"
          value={props.l1n ? `${props.l1n} V` : undefined}
          type="info"
        />
        <StateRow
          label="Voltaje L2-N"
          value={props.l2n ? `${props.l2n} V` : undefined}
          type="info"
        />
        <StateRow
          label="Voltaje L3-N"
          value={props.l3n ? `${props.l3n} V` : undefined}
          type="info"
        />
        <StateRow
          label="Corriente I1"
          value={props.i1 ? `${props.i1} A` : undefined}
          type="info"
        />
        <StateRow
          label="Corriente I2"
          value={props.i2 ? `${props.i2} A` : undefined}
          type="info"
        />
        <StateRow
          label="Corriente I3"
          value={props.i3 ? `${props.i3} A` : undefined}
          type="info"
        />
        <StateRow
          label="Potencia L1"
          value={props.kw1 ? `${props.kw1} kW` : undefined}
          type="info"
        />
        <StateRow
          label="Potencia L2"
          value={props.kw2 ? `${props.kw2} kW` : undefined}
          type="info"
        />
        <StateRow
          label="Potencia L3"
          value={props.kw3 ? `${props.kw3} kW` : undefined}
          type="info"
        />
      </div>
    </div>
  );
}
