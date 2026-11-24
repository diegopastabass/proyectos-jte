// Borrador del checklist en IndexedDB: sobrevive a recargas de la pestaña (comunes en celulares con poca RAM)
const DB_NAME = "checklist-drafts";
const STORE = "drafts";

const open = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const run = async <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> => {
  try {
    const db = await open();
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return undefined; // modo privado o sin soporte: la app funciona igual, sin borrador
  }
};

export const saveDraft = (vehicleId: string, data: unknown) => run("readwrite", (s) => s.put(data, vehicleId));
export const loadDraft = <T>(vehicleId: string) => run<T>("readonly", (s) => s.get(vehicleId));
export const clearDraft = (vehicleId: string) => run("readwrite", (s) => s.delete(vehicleId));
