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
  asimetria: string; // "1" o "0"
  bomba: string;
  falla: string;
  pozo_seco: string;
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
  tipo: "asimetria" | "bomba" | "falla" | "pozo_seco",
): React.CSSProperties => {
  const activo = valor === "1";

  if (tipo === "falla" || tipo === "pozo_seco" || tipo === "asimetria") {
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
  tipo: "asimetria" | "bomba" | "falla" | "pozo_seco",
): string => {
  const activo = valor === "1";

  switch (tipo) {
    case "asimetria":
      return activo ? "Con asimetria" : "Sin asimetria";
    case "bomba":
      return activo ? "Encendida" : "Apagada";
    case "falla":
      return activo ? "Con falla" : "Sin falla";
    case "pozo_seco":
      return activo ? "Pozo seco" : "Pozo con agua";
  }
};

export function StateBody(props: CardBodyProps) {
  const { asimetria, bomba, falla, pozo_seco } = props;

  return (
    <>
      <h6 className="card-title">Estado Tablero</h6>

      <div className="d-flex justify-content-between align-items-center mb-2">
        <span>Modo:</span>
        <span style={getEstadoStyle(asimetria, "asimetria")}>
          {getLabel(asimetria, "asimetria")}
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
      <div className="d-flex justify-content-between align-items-center mb-2">
        <span>Pozo seco:</span>
        <span style={getEstadoStyle(pozo_seco, "pozo_seco")}>
          {getLabel(pozo_seco, "pozo_seco")}
        </span>
      </div>
    </>
  );
}

export default State;
