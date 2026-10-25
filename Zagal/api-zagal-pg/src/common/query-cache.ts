// Caché en memoria con TTL y "single-flight": si llegan N requests iguales
// mientras la consulta está en curso, todos esperan la misma promesa y a la
// base llega una sola consulta. Los errores no se guardan en caché.
export class QueryCache {
  private readonly values = new Map<string, { expires: number; value: unknown }>();
  private readonly inFlight = new Map<string, Promise<unknown>>();

  constructor(private readonly maxEntries = 200) {}

  async get<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
    const hit = this.values.get(key);
    if (hit && hit.expires > Date.now()) return hit.value as T;

    const pending = this.inFlight.get(key);
    if (pending) return pending as Promise<T>;

    const promise = load()
      .then((value) => {
        this.set(key, value, ttlMs);
        return value;
      })
      .finally(() => this.inFlight.delete(key));

    this.inFlight.set(key, promise);
    return promise;
  }

  private set(key: string, value: unknown, ttlMs: number) {
    this.values.delete(key);
    if (this.values.size >= this.maxEntries) {
      // Map conserva el orden de inserción: el primero es el más antiguo
      const oldest = this.values.keys().next().value;
      if (oldest !== undefined) this.values.delete(oldest);
    }
    this.values.set(key, { expires: Date.now() + ttlMs, value });
  }
}
