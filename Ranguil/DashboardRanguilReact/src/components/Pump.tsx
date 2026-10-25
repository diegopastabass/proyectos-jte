import React, { type CSSProperties } from "react";

interface PumpProps {
  /** Eje vertical del pozo y de la bomba. */
  x: number;
  /** Cota del terreno. */
  groundY: number;
  /** Cota (en el dibujo) del espejo de agua en el pozo. */
  waterY: number;
  /** Fondo dibujado del pozo. */
  bottomY: number;
  /** Cota de la descarga de la bomba. */
  pumpTop: number;
  isActive: boolean;
  fault?: boolean;
  /** Nivel freático en metros, sólo para el rótulo. */
  freatico?: number;
  tag?: string;
}

const WELL_W = 80;
const INTAKE_Y = 12 + 70 + 12; // cabeza + cuerpo hidráulico + media rejilla

const PARTICLES = [
  { side: -1, dy: -10, delay: 0 },
  { side: 1, dy: 8, delay: 0.4 },
  { side: -1, dy: 9, delay: 0.8 },
  { side: 1, dy: -8, delay: 1.2 },
];

const Pump: React.FC<PumpProps> = ({
  x,
  groundY,
  waterY,
  bottomY,
  pumpTop,
  isActive,
  fault = false,
  freatico,
  tag = "B-01",
}) => {
  const wellLeft = x - WELL_W / 2;
  const intakeInWater = pumpTop + INTAKE_Y - waterY;

  return (
    <>
      <div
        className="ground"
        style={{ left: x - 110, top: groundY, width: 220, height: bottomY - groundY }}
      />

      <div
        className="well"
        style={{ left: wellLeft, top: groundY, width: WELL_W, height: bottomY - groundY }}
      >
        <div className="well__water" style={{ top: waterY - groundY }}>
          {isActive &&
            PARTICLES.map((p, k) => (
              <div
                key={k}
                className="well__particle"
                style={
                  {
                    top: intakeInWater,
                    left: p.side < 0 ? 2 : undefined,
                    right: p.side > 0 ? 2 : undefined,
                    "--dx": `${-p.side * 14}px`,
                    "--dy": `${p.dy}px`,
                    "--delay": `${p.delay}s`,
                  } as CSSProperties
                }
              />
            ))}
        </div>
      </div>

      <div
        className="wellhead"
        style={{ left: wellLeft - 8, top: groundY - 8, width: WELL_W + 16 }}
      />

      {freatico !== undefined && (
        <div className="nf-mark" style={{ left: wellLeft - 20, top: waterY - 14, transform: "translateX(-100%)" }}>
          NF
          <br />
          {freatico.toFixed(2)} m
          <span className="nf-mark__symbol" />
        </div>
      )}

      <div
        className="pump__cable"
        style={{ left: x + 20, top: groundY, height: pumpTop + 12 + 70 + 24 + 8 - groundY }}
      />

      <div
        className={`pump${isActive ? " is-on" : ""}${fault ? " is-fault" : ""}`}
        style={{ left: x - 24, top: pumpTop }}
        title={fault ? "Bomba con falla" : isActive ? "Bomba encendida" : "Bomba apagada"}
      >
        <div className="pump__head" />
        <div className="pump__hydraulic" />
        <div className="pump__intake">
          <div className="pump__shaft" />
        </div>
        <div className="pump__motor">
          <div className="pump__led" />
          <div className="pump__plate">
            <span>{tag}</span>
          </div>
        </div>
        <div className="pump__cap" />
      </div>
    </>
  );
};

export default Pump;
