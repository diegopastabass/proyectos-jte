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
        maxWidth: "350px",
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
  text1?: string;
  text2?: string;
  text3?: string;
  text4?: string;
  text5?: string;
  date?: string;
}

export function CardBody(props: CardBodyProps) {
  const { title, text1, text2, text3, text4, text5, date } = props;
  let timeDiffMinutes = null;
  let formattedDate = "Desconocida";

  if (date) {
    const timestamp = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    timeDiffMinutes = Math.floor(diffMs / 60000);

    const day = String(timestamp.getDate()).padStart(2, "0");
    const month = String(timestamp.getMonth() + 1).padStart(2, "0");
    const hours = String(timestamp.getHours()).padStart(2, "0");
    const minutes = String(timestamp.getMinutes()).padStart(2, "0");

    formattedDate = `${day}-${month} ${hours}:${minutes}`;
  }

  let freshnessClass = "";
  if (timeDiffMinutes !== null) {
    if (timeDiffMinutes <= 10) {
      freshnessClass = "bg-success text-white";
    } else if (timeDiffMinutes <= 20) {
      freshnessClass = "bg-warning text-dark";
    } else {
      freshnessClass = "bg-danger text-white";
    }
  }

  return (
    <>
      <div className="d-flex flex-column align-items-center text-lg-start flex-grow-1 order-2 order-lg-0">
        <span className={`badge rounded-pill ${freshnessClass}`}>
          {formattedDate}
        </span>
      </div>
      <br />
      <h5 className="card-title">{title + "  "}</h5>

      {text1 && <p className="card-text">{text1}</p>}
      {text2 && <p className="card-text">{text2}</p>}
      {text3 && <p className="card-text">{text3}</p>}
      {text4 && <p className="card-text">{text4}</p>}
      {text5 && <p className="card-text">{text5}</p>}
    </>
  );
}

export default Card;
