import { PARCELA } from "../config";

// Todas las claves llevan el cliente y la parcela, para no chocar con otros
// dashboards servidos desde el mismo dominio (app.jteanalytics.cl).
export const STORAGE_PREFIX = `jte_cache_zagal${PARCELA}_`;

export function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown, onQuotaExceeded?: () => void) {
  const raw = JSON.stringify(value);
  try {
    localStorage.setItem(STORAGE_PREFIX + key, raw);
  } catch {
    // Sin espacio (o storage bloqueado): liberar y reintentar una vez; si no, seguir sin caché
    if (!onQuotaExceeded) return;
    onQuotaExceeded();
    try {
      localStorage.setItem(STORAGE_PREFIX + key, raw);
    } catch {
      /* el dashboard funciona igual, solo sin caché */
    }
  }
}

export function listKeys(subPrefix: string): string[] {
  const keys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(STORAGE_PREFIX + subPrefix)) {
        keys.push(k.slice(STORAGE_PREFIX.length));
      }
    }
  } catch {
    /* storage no disponible */
  }
  return keys;
}

export function removeKey(key: string) {
  try {
    localStorage.removeItem(STORAGE_PREFIX + key);
  } catch {
    /* storage no disponible */
  }
}
