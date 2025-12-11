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
  automatico: string; // "1" o "0"
  bomba: string;
  falla: string;
}

const indicadorBase: React.CSSProperties = {
  display: "inline-block",
  marginLeft: "10px",
  padding: "5px 10px",
  color: "white",
  borderRadius: "12px", // más redondeado
  fontSize: "0.8rem", // texto más pequeño
  minWidth: "110px", // mismo ancho para todos
  textAlign: "center",
};

const getEstadoStyle = (
  valor: string,
  tipo: "automatico" | "bomba" | "falla"
): React.CSSProperties => {
  const activo = valor === "1";

  if (tipo === "falla") {
    return {
      ...indicadorBase,
      backgroundColor: activo ? "orange" : "gray",
    };
  }

  return {
    ...indicadorBase,
    backgroundColor: activo ? "green" : "gray",
  };
};

const getLabel = (
  valor: string,
  tipo: "automatico" | "bomba" | "falla"
): string => {
  const activo = valor === "1";

  switch (tipo) {
    case "automatico":
      return activo ? "Automático" : "Manual";
    case "bomba":
      return activo ? "Encendida" : "Apagada";
    case "falla":
      return activo ? "Con falla termica" : "Sin falla termica";
  }
};

export function StateBody(props: CardBodyProps) {
  const { automatico, bomba, falla } = props;

  return (
    <>
      <h6 className="card-title">Estado Tablero</h6>

      <div className="d-flex justify-content-between align-items-center mb-2">
        <span>Modo:</span>
        <span style={getEstadoStyle(automatico, "automatico")}>
          {getLabel(automatico, "automatico")}
        </span>
      </div>

      <div className="d-flex justify-content-between align-items-center mb-2">
        <span>Bomba:</span>
        <span style={getEstadoStyle(bomba, "bomba")}>
          {getLabel(bomba, "bomba")}
        </span>
      </div>

      <div className="d-flex justify-content-between align-items-center mb-2">
        <span>Estado:</span>
        <span style={getEstadoStyle(falla, "falla")}>
          {getLabel(falla, "falla")}
        </span>
      </div>
    </>
  );
}

export default State;
