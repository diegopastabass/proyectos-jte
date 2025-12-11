import { MapContainer, TileLayer, GeoJSON, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useState } from "react";
import StatusLed from "./StatusLed";

import type {
  Feature,
  FeatureCollection,
  Geometry,
  Point,
  Polygon,
} from "geojson";
import type { Layer } from "leaflet";
import InfoModal from "./InfoModal";

interface IrrigationInterval {
  mt_name: string;
  is_active: number;
  tiempo_riego_segundos: number;
  totalizador: number;
}

interface ParcelaMapaProps {
  geoData: FeatureCollection<Polygon | Point, { name: string }>;
  irrigationIntervals: IrrigationInterval[];
}

const ParcelaMapa: React.FC<ParcelaMapaProps> = ({
  geoData,
  irrigationIntervals,
}) => {
  const [modalData, setModalData] = useState<{
    show: boolean;
    title: string;
    text1: string;
    text2: string;
    text3: string;
  }>({
    show: false,
    title: "",
    text1: "",
    text2: "",
    text3: "",
  });

  const closeModal = () => {
    setModalData({ ...modalData, show: false });
  };

  const activeMap: { [key: string]: boolean } = {};
  irrigationIntervals.forEach((interval) => {
    activeMap[interval.mt_name] = interval.is_active === 1;
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const style = (feature: Feature<Geometry, any> | undefined) => {
    const isActive =
      feature?.properties?.identifier &&
      activeMap[feature.properties.identifier]
        ? activeMap[feature.properties.identifier]
        : false;
    return {
      color: isActive ? "#2e7d32" : "#d32f2f",
      weight: 2,
      opacity: 1,
      fillColor: isActive ? "#81c784" : "#f44336",
      fillOpacity: 0.5,
    };
  };

  const formatIrrigationTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = (seconds % 60).toFixed(1);

    const parts = [];
    if (h > 0) parts.push(`${h.toString().padStart(2, "0")} h`);
    if (m > 0 || h > 0) parts.push(`${m.toString().padStart(2, "0")} m`);
    parts.push(`${s.toString().padStart(2, "0")} s`);

    return parts.join(" ");
  };

  const onEachFeature = (
    feature: Feature<Geometry, { name: string }>,
    layer: Layer
  ) => {
    if (feature.geometry.type === "Polygon") {
      layer.on("click", () => {
        const isActive = activeMap[feature.properties?.name || ""] ?? false;
        const interval = irrigationIntervals.find(
          (i) => i.mt_name === feature.properties?.name
        );

        const totalizador = ((interval?.totalizador ?? 0) / 10).toFixed(1);
        const tiempoRiego = interval?.tiempo_riego_segundos ?? 0;

        setModalData({
          show: true,
          title: `${feature.properties?.name}`,
          text1: `Estado de riego: ${isActive ? "Activo" : "Inactivo"}`,
          text2: `Totalizador: ${totalizador} m³`,
          text3: `Tiempo de riego: ${formatIrrigationTime(tiempoRiego)}`,
        });
      });
    }
  };

  return (
    <div className="container mt-3">
      <div className="border rounded" style={{ height: "500px" }}>
        <MapContainer
          center={[-34.47372770344382, -70.98724441314738]}
          zoom={15}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Polígonos */}
          <GeoJSON data={geoData} style={style} onEachFeature={onEachFeature} />

          <Marker position={[-34.47372770344382, -70.98724441314738]}>
            <Popup>
              <span>CASETA DE RIEGO</span>
            </Popup>
          </Marker>
        </MapContainer>
      </div>

      <InfoModal
        show={modalData.show}
        onClose={closeModal}
        title={modalData.title}
        text2={modalData.text2}
        text3={modalData.text3}
      >
        <StatusLed
          status={modalData.text1.includes("Activo") ? 1 : 0}
          label="Estado de Riego"
        ></StatusLed>
      </InfoModal>
    </div>
  );
};

export default ParcelaMapa;
