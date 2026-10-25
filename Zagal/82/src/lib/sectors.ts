import type { FeatureCollection, Point, Polygon } from "geojson";
import rawGeoData from "../assets/zagal.json";
import { SECTOR_IDS } from "../config";

export interface SectorProps {
  name: string;
  /** Debe coincidir con el mt_name que entrega el backend */
  identifier?: string;
}

export const geoData = rawGeoData as unknown as FeatureCollection<Polygon | Point, SectorProps>;

// Nombre legible de cada sector, tomado del polígono del mapa (ej. "S1 Parron")
const labels: Record<string, string> = {};
geoData.features.forEach((f) => {
  const id = f.properties?.identifier;
  if (f.geometry.type === "Polygon" && id) labels[id] = f.properties.name?.trim() || id;
});

export interface Sector {
  id: string;
  label: string;
}

export const SECTORS: Sector[] = SECTOR_IDS.map((id) => ({ id, label: labels[id] ?? id }));

export const sectorLabel = (id: string): string => labels[id] ?? id;
