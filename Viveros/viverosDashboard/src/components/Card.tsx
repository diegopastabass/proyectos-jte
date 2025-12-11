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
        maxHeight: "700px",
      }}
    >
      <div className="card-body">{children}</div>
    </div>
  );
}

interface CardBodyProps {
  title?: string;
  text1?: string;
  text2?: string;
  text3?: string;
  text4?: string;
  text5?: string;
  text6?: string;
  date?: string;
}

export function CardBody(props: CardBodyProps) {
  const { title, text1, text2, text3, text4, text5, text6 } = props;

  const actual = text1 || text2;
  const min = text4 || text6;
  const max = text3 || text5;

  return (
    <div className="card-body p-3">
      {title && <h6 className="card-title mb-3">{title}</h6>}
      <div className="container text-center">
        <div className="row mb-1">
          <div className="col fw-normal text-secondary">Actual</div>
          <div className="col fw-normal text-secondary">Mín</div>
          <div className="col fw-normal text-secondary">Máx</div>
        </div>
        <div className="row">
          <div className="col fw-bold">{actual?.split(": ")[1] || "--"}</div>
          <div className="col fw-bold">{min?.split(": ")[1] || "--"}</div>
          <div className="col fw-bold">{max?.split(": ")[1] || "--"}</div>
        </div>
      </div>
    </div>
  );
}

export default Card;
