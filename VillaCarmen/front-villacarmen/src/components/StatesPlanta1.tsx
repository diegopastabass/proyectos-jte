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
        padding: "8px",
        ...style,
      }}
    >
      <div className="card-body p-1">{children}</div>
    </div>
  );
}

interface CardBodyProps {
  falla_vdf1_p1: string;
  falla_vdf2_p1: string;
  presion: string;
}

// Estilo para el LED pequeño
const ledBase: React.CSSProperties = {
  width: "12px",
  height: "12px",
  borderRadius: "50%",
  display: "inline-block",
};

// Función para obtener color del LED
const getLedColor = (valor: number, esFalla: boolean): string => {
  if (valor !== 1) return "gray";
  return esFalla ? "orange" : "green";
};

// Sub-componente para filas de indicadores
const StatusRow = ({
  label,
  metric,
  esFalla = false,
}: {
  label: string;
  metric: string;
  esFalla?: boolean;
}) => (
  <div className="d-flex justify-content-between align-items-center mb-1">
    <span style={{ fontSize: "1rem" }}>{label}</span>
    <div
      style={{
        ...ledBase,
        backgroundColor: getLedColor(Number(metric), esFalla),
      }}
    />
  </div>
);

export function StateBodyPlanta1(props: CardBodyProps) {
  return (
    <>
      <h6
        className="card-title mb-2"
        style={{ fontSize: "1rem", fontWeight: "bold" }}
      >
        Presurizadora
      </h6>

      <StatusRow label="Falla VF1" metric={props.falla_vdf1_p1} esFalla />
      <StatusRow label="Falla VF3" metric={props.falla_vdf2_p1} esFalla />

      <div className="d-flex justify-content-between align-items-center mt-2 pt-1 border-top">
        <span style={{ fontSize: "1rem" }}>Presión:</span>
        <span style={{ fontWeight: "bold" }}>{props.presion} bar</span>
      </div>
    </>
  );
}

export default State;
