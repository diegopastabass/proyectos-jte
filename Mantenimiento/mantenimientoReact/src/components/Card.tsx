interface CardProps {
  children: React.ReactNode;
}

function Card(props: CardProps) {
  const { children } = props;
  return (
    <div
      className="card h-lg-100 h-sm-50 w-100 w-lg-50"
      style={{
        width: "100%",
        maxWidth: "1200px",
        marginBottom: "5px",
        minHeight: "50px",
        maxHeight: "430px",
      }}
    >
      <div className="card-body">{children}</div>
    </div>
  );
}

interface CardBodyProps {
  title: string;
  tipo: string;
  fecha_programada: string;
  completado: boolean;
  mantenedor: string;
}

export function CardBody(props: CardBodyProps) {
  const { title, tipo, fecha_programada, completado, mantenedor } = props;

  return (
    <>
      <h6 className="card-title">{title}</h6>
      {tipo && (
        <p className="card-text">
          <strong>Tipo: </strong>
          {tipo}
        </p>
      )}
      {fecha_programada && (
        <p className="card-text">
          <strong>Fecha Programada: </strong>
          {new Date(fecha_programada).toLocaleDateString()}
        </p>
      )}
      {completado && (
        <p className="card-text">
          <strong>Completado: </strong> {completado ? "Si" : "No"}
        </p>
      )}
      {mantenedor && (
        <p className="card-text">
          <strong>Mantenedor: </strong>
          {mantenedor}
        </p>
      )}
    </>
  );
}

export default Card;
