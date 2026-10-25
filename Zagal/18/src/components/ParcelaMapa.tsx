import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import type { Feature, Geometry } from "geojson";
import { useCallback, useEffect, useMemo, useRef } from "react";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { TOTALIZADOR_FACTOR } from "../config";
import { formatDuration, formatNumber } from "../lib/format";
import { geoData, type SectorProps } from "../lib/sectors";
import type { IrrigationInterval } from "../hooks/useLiveData";

// Con Vite, Leaflet no encuentra solo las imágenes del marcador por defecto
const casetaIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const bounds = L.geoJSON(geoData).getBounds().pad(0.05);

interface ParcelaMapaProps {
  intervals: IrrigationInterval[];
  selected: string;
  onSelect: (sectorId: string) => void;
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function ParcelaMapa({ intervals, selected, onSelect }: ParcelaMapaProps) {
  // onEachFeature solo corre al crear las capas: lo que cambia se lee desde refs
  const intervalsRef = useRef(intervals);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    intervalsRef.current = intervals;
    onSelectRef.current = onSelect;
  }, [intervals, onSelect]);

  const activeMap = useMemo(() => {
    const m: Record<string, boolean> = {};
    intervals.forEach((i) => (m[i.mt_name] = i.is_active === 1));
    return m;
  }, [intervals]);

  // Cambiar la identidad de style hace que react-leaflet repinte los polígonos
  const style = useCallback(
    (feature?: Feature<Geometry, SectorProps>) => {
      const id = feature?.properties?.identifier ?? "";
      const active = activeMap[id];
      const isSelected = id === selected;
      return {
        color: isSelected ? "#1c5cab" : active ? "#2e7d32" : "#6c757d",
        weight: isSelected ? 4 : 2,
        opacity: 1,
        fillColor: active ? "#4caf50" : "#adb5bd",
        fillOpacity: active ? 0.55 : 0.3,
      };
    },
    [activeMap, selected],
  );

  const onEachFeature = (feature: Feature<Geometry, SectorProps>, layer: L.Layer) => {
    const id = feature.properties?.identifier;
    const name = feature.properties?.name ?? "";

    if (feature.geometry.type === "Point") {
      layer.bindPopup(`<strong>${escapeHtml(name)}</strong>`);
      return;
    }
    if (!id) return;

    layer.bindTooltip(escapeHtml(name), { sticky: true, direction: "top" });
    layer.bindPopup(() => {
      const live = intervalsRef.current.find((i) => i.mt_name === id);
      const active = live?.is_active === 1;
      const volume = (live?.totalizador ?? 0) * TOTALIZADOR_FACTOR;
      return `
        <strong>${escapeHtml(name)}</strong><br/>
        Estado: <b>${active ? "Regando" : "Detenido"}</b><br/>
        ${
          active
            ? `En curso: ${formatDuration(live!.tiempo_riego_segundos)}<br/>Volumen: ${formatNumber(volume, 1)} m³`
            : ""
        }`;
    });
    layer.on("click", () => onSelectRef.current(id));
  };

  return (
    <>
      <div className="map-frame">
        <MapContainer
          bounds={bounds}
          zoomSnap={0.25}
          scrollWheelZoom={false}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <GeoJSON
            data={geoData}
            style={style}
            onEachFeature={onEachFeature}
            pointToLayer={(_, latlng) => L.marker(latlng, { icon: casetaIcon })}
          />
        </MapContainer>
      </div>
      <div className="map-legend" aria-label="Leyenda del mapa">
        <span style={{ "--swatch": "#4caf50", "--swatch-border": "#2e7d32" } as React.CSSProperties}>
          Regando
        </span>
        <span style={{ "--swatch": "#dee2e6", "--swatch-border": "#6c757d" } as React.CSSProperties}>
          Detenido
        </span>
        <span style={{ "--swatch": "transparent", "--swatch-border": "#1c5cab" } as React.CSSProperties}>
          Seleccionado
        </span>
      </div>
    </>
  );
}

export default ParcelaMapa;
