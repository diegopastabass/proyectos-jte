import Navbar from "../components/Navbar";
import { CardDesc } from "../components/CardDescription";

function Home() {
  const projects = [
    {
      text: "Cooperativa de Agua Zúñiga",
      text2:
        "Sistema SCADA con visualización en tiempo real, estimación de vaciado de estanques y analítica operativa avanzada.",
      url: "https://jteanalytics.cl/zuniga/",
      images: [
        "/src/assets/zuniga/1.png",
        "/src/assets/zuniga/2.png",
        "/src/assets/zuniga/3.png",
      ],
    },
    {
      text: "Viveros El Tambo",
      text2:
        "Monitoreo continuo de cámaras de frío con alertas automáticas vía WhatsApp y panel de control inteligente.",
      url: "https://jteanalytics.cl/viveros/",
      images: [
        "/src/assets/viveros/1.svg",
        "/src/assets/viveros/2.png",
        "/src/assets/viveros/3.png",
      ],
    },
    {
      text: "Agrícola Zagal",
      text2:
        "Plataforma satelital para análisis de parcelas, historial de actividad y seguimiento de riego en tiempo real.",
      url: "https://jteanalytics.cl/viveros/",
      images: [
        "/src/assets/zagal/1.png",
        "/src/assets/zagal/2.png",
        "/src/assets/zagal/3.png",
      ],
    },
    {
      text: "Servicio Sanitario Rural Bucalemu",
      text2:
        "Plataforma de monitoreo en tiempo real de múltiples estanques, tiempos de vaciado y alertas personalizadas por WhatsApp.",
      url: "https://jteanalytics.cl/bucalemu/",
      images: [
        "/src/assets/bucalemu/1.png",
        "/src/assets/bucalemu/2.png",
        "/src/assets/bucalemu/3.png",
      ],
    },
  ];

  return (
    <>
      <Navbar />

      <div className="container my-5">
        <div className="mb-5 text-center">
          <h2 className="fw-bold mb-3">Sobre Nosotros</h2>
          <p className="text-muted mx-auto" style={{ maxWidth: "700px" }}>
            JTE Analytics desarrolla soluciones industriales y sistemas de
            automatización enfocados en optimizar procesos, mejorar la
            eficiencia operativa y ofrecer información clave en tiempo real a
            nuestros clientes.
          </p>
        </div>

        <div className="row g-4">
          {projects.map((project, index) => (
            <div
              key={index}
              className="col-12 col-md-6 col-lg-4 d-flex align-items-stretch"
            >
              <CardDesc
                text={project.text}
                text2={project.text2}
                url={project.url}
                images={project.images}
                interval={2500}
              />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export default Home;
