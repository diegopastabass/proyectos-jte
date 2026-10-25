// Igual al statement_timeout del backend: pasado esto no tiene sentido seguir esperando
export const REQUEST_TIMEOUT_MS = 5 * 60_000;

// Combina la señal del llamador (cancelar al desmontar / cambiar de mes) con el timeout
function withTimeout(signal: AbortSignal | undefined, ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new DOMException("Tiempo de espera agotado", "TimeoutError")),
    ms,
  );
  const onAbort = () => controller.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
  }
  return {
    signal: controller.signal,
    done: () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    },
  };
}

export async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const t = withTimeout(signal, REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: t.signal });
    if (!res.ok) throw new Error(`Error ${res.status} en ${url}`);
    return (await res.json()) as T;
  } finally {
    t.done();
  }
}

export const isAbortError = (error: unknown) =>
  error instanceof DOMException && error.name === "AbortError";
