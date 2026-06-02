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
      <div className="card-body">{children}</div>
    </div>
  );
}

interface CardBodyProps {
  automatico: number;
  bomba: number;
  falla: number;
  manual: number;
}

const indicadorBase: React.CSSProperties = {
  display: "inline-block",
  marginLeft: "10px",
  padding: "5px 10px",
  color: "white",
  borderRadius: "12px",
  fontSize: "0.8rem",
  minWidth: "110px",
  textAlign: "center",
};

const getEstadoStyle = (
  valor: number,
  tipo: "automatico" | "bomba" | "falla" | "manual"
): React.CSSProperties => {
  const activo = valor === 1;

  if (tipo === "falla") {
    return {
      ...indicadorBase,
      backgroundColor: activo ? "#e53e3e" : "#718096",
    };
  }

  if (tipo === "manual") {
    return {
      ...indicadorBase,
      backgroundColor: activo ? "#ed8936" : "#718096",
    };
  }

  return {
    ...indicadorBase,
    backgroundColor: activo ? "#38a169" : "#718096",
  };
};

const getLabel = (
  valor: number,
  tipo: "automatico" | "bomba" | "falla" | "manual"
): string => {
  const activo = valor === 1;

  switch (tipo) {
    case "automatico":
      return activo ? "Automático" : "Manual";
    case "bomba":
      return activo ? "Encendida" : "Apagada";
    case "falla":
      return activo ? "Con Falla" : "Sin Falla";
    case "manual":
      return activo ? "Manual" : "Automático";
  }
};

export function StateBody(props: CardBodyProps) {
  const { automatico, bomba, falla, manual } = props;

  return (
    <>
      <h6 className="card-title mb-3" style={{ fontWeight: 700 }}>
        Estado — Bucalemu Bajo Nuevo
      </h6>

      <div className="d-flex justify-content-between align-items-center mb-2">
        <span className="text-muted" style={{ fontSize: "0.85rem" }}>
          Modo:
        </span>
        <span style={getEstadoStyle(automatico, "automatico")}>
          {getLabel(automatico, "automatico")}
        </span>
      </div>

      <div className="d-flex justify-content-between align-items-center mb-2">
        <span className="text-muted" style={{ fontSize: "0.85rem" }}>
          Bomba:
        </span>
        <span style={getEstadoStyle(bomba, "bomba")}>
          {getLabel(bomba, "bomba")}
        </span>
      </div>

      <div className="d-flex justify-content-between align-items-center mb-2">
        <span className="text-muted" style={{ fontSize: "0.85rem" }}>
          Falla:
        </span>
        <span style={getEstadoStyle(falla, "falla")}>
          {getLabel(falla, "falla")}
        </span>
      </div>

      <div className="d-flex justify-content-between align-items-center mb-2">
        <span className="text-muted" style={{ fontSize: "0.85rem" }}>
          Control:
        </span>
        <span style={getEstadoStyle(manual, "manual")}>
          {getLabel(manual, "manual")}
        </span>
      </div>
    </>
  );
}

export default State;
