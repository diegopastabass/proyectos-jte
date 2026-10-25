import type { ElectricConfig } from "../types";

// Valores de referencia para la demo; se pueden editar desde la UI (⚙)
export const DEFAULT_CONFIG: ElectricConfig = {
  tarifaClpKwh: 130,
  kwhFactor: 10,
  vNominal: 220,
  iNominal: 15,
};

const STORAGE_KEY = "jte_electrico_ranguil_config";

export const loadConfig = (): ElectricConfig => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CONFIG;
  }
};

export const saveConfig = (config: ElectricConfig) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
};
