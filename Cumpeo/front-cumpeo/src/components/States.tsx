interface StateProps {
  title: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

function State(props: StateProps) {
  const { title, children, style } = props;
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
      <div className="card-body">
        <h6 className="card-title">{title}</h6>
        {children}
      </div>
    </div>
  );
}

interface CardBodyProps {
  automatico?: string; // "1" o "0"
  bomba?: string;
  falla?: string;
  falla_asimetria?: string; // "1" = activa, "0" = inactiva
  presion?: number;
  horometro_diario?: number;
  horometro_total?: number;
  caudal?: number;
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

type TipoEstado = "automatico" | "bomba" | "falla" | "falla_asimetria";

const getEstadoStyle = (
  valor: string,
  tipo: TipoEstado,
): React.CSSProperties => {
  const activo = valor === "1";

  if (tipo === "falla" || tipo === "falla_asimetria") {
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

const getLabel = (valor: string, tipo: TipoEstado): string => {
  const activo = valor === "1";

  switch (tipo) {
    case "automatico":
      return activo ? "Automático" : "Manual";
    case "bomba":
      return activo ? "Encendida" : "Apagada";
    case "falla":
      return activo ? "Con falla" : "Sin falla";
    case "falla_asimetria":
      return activo ? "Activa" : "Inactiva";
  }
};

export function StateBody(props: CardBodyProps) {
  const {
    automatico,
    bomba,
    falla,
    falla_asimetria,
    presion,
    horometro_diario,
    horometro_total,
    caudal,
  } = props;

  return (
    <>
      {automatico !== undefined && (
        <div className="d-flex justify-content-between align-items-center mb-2">
          <span>Modo:</span>
          <span style={getEstadoStyle(automatico, "automatico")}>
            {getLabel(automatico, "automatico")}
          </span>
        </div>
      )}

      {bomba !== undefined && (
        <div className="d-flex justify-content-between align-items-center mb-2">
          <span>Bomba:</span>
          <span style={getEstadoStyle(bomba, "bomba")}>
            {getLabel(bomba, "bomba")}
          </span>
        </div>
      )}

      {falla !== undefined && (
        <div className="d-flex justify-content-between align-items-center mb-2">
          <span>Estado:</span>
          <span style={getEstadoStyle(falla, "falla")}>
            {getLabel(falla, "falla")}
          </span>
        </div>
      )}

      {falla_asimetria !== undefined && (
        <div className="d-flex justify-content-between align-items-center mb-2">
          <span>Falla Asimetría:</span>
          <span style={getEstadoStyle(falla_asimetria, "falla_asimetria")}>
            {getLabel(falla_asimetria, "falla_asimetria")}
          </span>
        </div>
      )}

      {(presion !== undefined ||
        horometro_diario !== undefined ||
        horometro_total !== undefined) && <hr className="my-2" />}

      {presion !== undefined && (
        <div className="d-flex justify-content-between align-items-center mb-2">
          <span>Presión:</span>
          <span className="fw-bold">{(presion / 10).toFixed(2)} bar</span>
        </div>
      )}

      {horometro_diario !== undefined && (
        <div className="d-flex justify-content-between align-items-center mb-2">
          <span>Horómetro Diario:</span>
          <span className="fw-bold">
            {Math.floor(horometro_diario / 60)} h {horometro_diario % 60} m
          </span>
        </div>
      )}

      {horometro_total !== undefined && (
        <div className="d-flex justify-content-between align-items-center mb-2">
          <span>Horómetro Total:</span>
          <span className="fw-bold">
            {Math.floor(horometro_total / 60)} h {horometro_total % 60} m
          </span>
        </div>
      )}

      {caudal !== undefined && (
        <div className="d-flex justify-content-between align-items-center mb-2">
          <span>Caudal:</span>
          <span className="fw-bold">{caudal} l/s</span>
        </div>
      )}
    </>
  );
}

export default State;
