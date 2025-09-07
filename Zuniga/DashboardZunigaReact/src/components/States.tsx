interface StateProps {
  children: React.ReactNode;
}

function State(props: StateProps) {
  const { children } = props;
  return (
    <div
      className="card h-100 w-100 w-lg-50"
      style={{
        width: "100%",
        maxWidth: "350px",
        marginBottom: "5px",
        minHeight: "50px",
      }}
    >
      <div className="card-body">{children}</div>
    </div>
  );
}

interface CardBodyProps {
  automatico: string;
  bomba: string;
  falla: string;
}

const getEstadoStyle = (
  valor: string,
  tipo: "automatico" | "bomba" | "falla"
): React.CSSProperties => {
  switch (tipo) {
    case "falla":
      return {
        display: "inline-block",
        marginLeft: "10px",
        padding: "5px 10px",
        borderRadius: "5px",
        color: "white",
        backgroundColor: valor === "1" ? "orange" : "gray", // 1 = hay falla, 0 = todo OK
      };
    default: {
      const isActivo = valor === "1";
      return {
        display: "inline-block",
        marginLeft: "10px",
        padding: "5px 10px",
        borderRadius: "5px",
        color: "white",
        backgroundColor: isActivo ? "green" : "gray",
      };
    }
  }
};

export function StateBody(props: CardBodyProps) {
  const { automatico, bomba, falla } = props;

  return (
    <>
      <h6 className="card-title">Estado Tablero</h6>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <span>Automático: </span>
        <a style={getEstadoStyle(automatico, "automatico")}></a>
      </div>

      <div className="d-flex justify-content-between align-items-center mb-2">
        <span>Bomba: </span>
        <a style={getEstadoStyle(bomba, "bomba")}></a>
      </div>

      <div className="d-flex justify-content-between align-items-center mb-2">
        <span>Falla:</span>
        <a style={getEstadoStyle(falla, "falla")}></a>
      </div>
    </>
  );
}

export default State;
