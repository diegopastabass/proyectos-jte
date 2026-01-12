import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

function Card(props: CardProps) {
  const { children, className } = props;
  return (
    <div
      className={`card ${className}`}
      style={{
        width: "100%",
        maxWidth: "1500px",
        minHeight: "50px",
        maxHeight: "430px",
      }}
    >
      <div className="card-body">{children}</div>
    </div>
  );
}

// Permitimos string o un arreglo [Label, Value]
type TextContent = string | [string, string | number];

interface CardBodyProps {
  title: string;
  text1?: TextContent;
  text2?: TextContent;
  text3?: TextContent;
  text4?: TextContent;
  text5?: TextContent;
  text6?: TextContent;
  text7?: TextContent;
  text8?: TextContent;
  date?: string;
}

export function CardBody(props: CardBodyProps) {
  const { title, text1, text2, text3, text4, text5, text6, text7, text8, date } = props;
  
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

  // Helper para renderizar texto o estructura Label: Value
  const renderRow = (content?: TextContent) => {
    if (!content) return null;
    if (Array.isArray(content)) {
      return (
        <p className="card-text">
          {content[0]}: <strong>{content[1]}</strong>
        </p>
      );
    }
    return <p className="card-text">{content}</p>;
  };

  return (
    <>
      <h6 className="card-title">{title}</h6>
      <div className="d-flex flex-column align-items-center text-lg-start flex-grow-1 order-2 order-lg-0 mb-2">
        <span className={`badge rounded-pill ${freshnessClass}`}>
          {formattedDate}
        </span>
      </div>
      {renderRow(text1)}
      {renderRow(text2)}
      {renderRow(text3)}
      {renderRow(text4)}
      {renderRow(text5)}
      {renderRow(text6)}
      {renderRow(text7)}
      {renderRow(text8)}
    </>
  );
}

export default Card;