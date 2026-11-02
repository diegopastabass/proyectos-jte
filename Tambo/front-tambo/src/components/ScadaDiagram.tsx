import React, { useLayoutEffect, useRef, useState } from "react";
import Tank from "./Tank";
import Pipe, { PipeTee, TEE_HALF } from "./Pipe";
import Pump from "./Pump";
import { FlowMeter } from "./Instruments";
import "./scada/scada.css";
import {
  ESTANQUES,
  POZOS,
  formatMinutes,
  todayInChile,
  type Datos,
  type Metric,
  type PozoId,
} from "../tambo";

interface ScadaDiagramProps {
  data: Datos;
  /** Serie diaria del horómetro (minutos) por pozo. */
  horometro: Partial<Record<PozoId, Metric[]>>;
}

/* El diagrama se dibuja en un lienzo fijo y se escala al ancho disponible. */
const STAGE_W = 1200;
const STAGE_H = 630;

/* Geometría (unidades del lienzo) */
const TOP_Y = 40; // colector superior que alimenta los estanques por el techo
const RISER_X = 660; // subida desde los ramales de los pozos al colector superior
const GROUND_Y = 385;
const WATER_Y = 404; // espejo de agua dibujado en los pozos (no es una medición)
const PUMP_TOP = 410;
const BOTTOM_Y = 625;

const TANK = { y: 90, w: 140, h: 190, inletX: 70 };
/* x de cada estanque, en el orden de ESTANQUES (superior, intermedio, bajo) */
const TANK_X = [70, 270, 470];

/* Eje de cada pozo, cota de su ramal hacia la subida y posición del caudalímetro */
const POZO_GEO: Record<PozoId, { x: number; ramalY: number; fitX: number }> = {
  pozo_1: { x: 800, ramalY: 350, fitX: 730 },
  pozo_3: { x: 1080, ramalY: 210, fitX: 1010 },
};
const POZO_PLATE = { top: 18, w: 132 };

// Velocidad visual del flujo proporcional al caudal
const flowSpeed = (caudal: number) => Math.min(90, 16 + caudal * 1.1);

const useStageScale = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setScale(Math.min(1, entry.contentRect.width / STAGE_W));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, scale };
};

const PlateRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="scada-plate__row">
    <span className="scada-plate__label">{label}</span>
    <span className="scada-plate__value">{value}</span>
  </div>
);

const ScadaDiagram: React.FC<ScadaDiagramProps> = ({ data, horometro }) => {
  const { ref, scale } = useStageScale();
  const { snapshot, tiempo_vaciado } = data;
  const hoy = todayInChile();

  const pozos = POZOS.map((p) => {
    const metric = p.conDatos ? snapshot[p.id] : undefined;
    const caudal = (metric?.value ?? 0) / p.divisorCaudal;
    const horometroHoy =
      (horometro[p.id] ?? []).find((m) => m.time.slice(0, 10) === hoy)?.value ?? 0;
    return {
      ...p,
      ...POZO_GEO[p.id],
      sinDatos: !metric,
      encendida: !!metric && caudal > 0,
      caudal,
      horometroHoy,
    };
  });

  const algunaEncendida = pozos.some((p) => p.encendida);
  const caudalTotal = pozos.reduce((acc, p) => acc + p.caudal, 0);
  const enMarcha = pozos.filter((p) => p.encendida).length;

  const estanques = ESTANQUES.map((e, i) => {
    const vaciado = tiempo_vaciado[e.id];
    return {
      ...e,
      x: TANK_X[i],
      inlet: TANK_X[i] + TANK.inletX,
      nivel: (snapshot[e.id]?.value ?? 0) / e.divisor,
      vaciado: vaciado ? (vaciado.tiempo > 0 ? `Ø ${vaciado.formatted}` : vaciado.formatted) : "Sin datos",
      // Con cualquier bomba en marcha se llenan todos los estanques
      llenando: algunaEncendida,
    };
  });
  const [superior, ...otros] = estanques;

  // Ramales ordenados de abajo hacia arriba en la subida. El más bajo llega con un
  // codo; los demás entran por una T. Un tramo de la subida lleva agua si alguna
  // bomba de los ramales que entran por debajo está en marcha.
  const ramales = [...pozos].sort((a, b) => b.ramalY - a.ramalY);
  const [ramalBajo] = ramales;
  const tramosSubida = ramales.slice(1, -1).map((r, k) => ({
    desde: r.ramalY,
    hasta: ramales[k + 2].ramalY,
    flowing: ramales.slice(0, k + 2).some((p) => p.encendida),
    caudal: ramales.slice(0, k + 2).reduce((acc, p) => acc + p.caudal, 0),
  }));
  const ramalAlto = ramales[ramales.length - 1];

  return (
    <div ref={ref} className="scada scada-viewport" style={{ height: STAGE_H * scale }}>
      <div className="scada-stage" style={{ transform: `scale(${scale})` }}>
        {/* Bajadas del colector superior a los estanques intermedio y bajo */}
        {otros.map((e) => (
          <React.Fragment key={e.id}>
            <Pipe
              points={[
                [e.inlet, TOP_Y + TEE_HALF],
                [e.inlet, TANK.y + 16],
              ]}
              flowing={e.llenando}
              speed={flowSpeed(caudalTotal)}
            />
            <PipeTee x={e.inlet} y={TOP_Y} branch="down" />
          </React.Fragment>
        ))}

        {/* Subida entre las T de los ramales */}
        {tramosSubida.map((t) => (
          <Pipe
            key={t.desde}
            points={[
              [RISER_X, t.desde],
              [RISER_X, t.hasta],
            ]}
            flowing={t.flowing}
            speed={flowSpeed(t.caudal)}
          />
        ))}

        {/* Subida final y colector superior: termina en el estanque superior */}
        <Pipe
          points={[
            [RISER_X, ramalAlto.ramalY],
            [RISER_X, TOP_Y],
            [superior.inlet, TOP_Y],
            [superior.inlet, TANK.y + 16],
          ]}
          flowing={algunaEncendida}
          speed={flowSpeed(caudalTotal)}
        />

        {/* Pozos: ramal de impulsión, caudalímetro, bomba sumergible y placa */}
        {pozos.map((p) => (
          <React.Fragment key={p.id}>
            <Pipe
              points={
                p.id === ramalBajo.id
                  ? [
                      [p.x, PUMP_TOP],
                      [p.x, p.ramalY],
                      [RISER_X, p.ramalY],
                      [RISER_X, ramales[1].ramalY],
                    ]
                  : [
                      [p.x, PUMP_TOP],
                      [p.x, p.ramalY],
                      [RISER_X + TEE_HALF, p.ramalY],
                    ]
              }
              flowing={p.encendida}
              speed={flowSpeed(p.caudal)}
            />
            {p.id !== ramalBajo.id && <PipeTee x={RISER_X} y={p.ramalY} branch="right" />}
            <FlowMeter
              x={p.fitX}
              y={p.ramalY}
              value={p.sinDatos ? null : p.caudal}
              active={p.encendida}
              tag={p.tagCaudal}
            />
            <Pump
              x={p.x}
              groundY={GROUND_Y}
              waterY={WATER_Y}
              bottomY={BOTTOM_Y}
              pumpTop={PUMP_TOP}
              isActive={p.encendida}
              tag={p.tagBomba}
            />
            <div
              className={`scada-plate pozo-plate${p.sinDatos ? " pozo-plate--sin-datos" : ""}`}
              style={{ left: p.x - POZO_PLATE.w / 2, top: POZO_PLATE.top, width: POZO_PLATE.w }}
            >
              <div className="pozo-plate__title">
                {p.nombre}
                <span className={`pozo-plate__estado${p.encendida ? " is-on" : ""}`}>
                  {p.sinDatos ? "Sin datos" : p.encendida ? "En marcha" : "Detenida"}
                </span>
              </div>
              {p.sinDatos ? (
                <PlateRow label="Estado:" value="Pendiente" />
              ) : (
                <>
                  <PlateRow label="Caudal:" value={`${p.caudal.toFixed(1)} l/s`} />
                  <PlateRow label="Horómetro hoy:" value={formatMinutes(p.horometroHoy)} />
                </>
              )}
            </div>
          </React.Fragment>
        ))}

        {estanques.map((e) => (
          <Tank
            key={e.id}
            x={e.x}
            y={TANK.y}
            width={TANK.w}
            height={TANK.h}
            level={e.nivel}
            maxLevel={e.maximo}
            alarmLevel={e.alarma}
            unit={e.unidad}
            name={e.nombre}
            tag={e.tag}
            inletX={TANK.inletX}
            inflow={e.llenando}
            scaleStep={e.maximo / 20}
            labelStep={e.maximo / 4}
          >
            <div
              className="scada-plate scada-plate--info"
              style={{ position: "static", marginTop: 12, minWidth: 170 }}
            >
              <span className="scada-plate__label">Tiempo de Vaciado</span>
              <span className="scada-plate__value">{e.vaciado}</span>
            </div>
          </Tank>
        ))}

        {/* Resumen de impulsión */}
        <div className="scada-plate" style={{ left: 70, top: 470, width: 240 }}>
          <PlateRow label="Caudal total de impulsión:" value={`${caudalTotal.toFixed(1)} l/s`} />
          <PlateRow
            label="Bombas en marcha:"
            value={`${enMarcha} de ${pozos.filter((p) => !p.sinDatos).length} con datos`}
          />
        </div>
      </div>
    </div>
  );
};

export default ScadaDiagram;
