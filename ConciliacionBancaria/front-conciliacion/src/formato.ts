import type { EstadoDocumento, EstadoMovimiento, TipoContraparte } from "./types";

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

/** 1234567 → "$1.234.567"; −10000 → "-$10.000" (signo delante, como se escribe en Chile). */
export function pesos(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n < 0 ? `-${clp.format(-n)}` : clp.format(n);
}

/** "2026-10-07" → "07-10-2026" (las fechas de la API vienen sin hora, no se pasan por Date). */
export function fecha(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}-${m}-${a}`;
}

export function fechaHora(iso: string): string {
  return new Date(iso).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });
}

export const NOMBRES_DTE: Record<number, string> = {
  33: "Factura",
  34: "Factura exenta",
  39: "Boleta",
  41: "Boleta exenta",
  43: "Liquidación factura",
  46: "Factura de compra",
  52: "Guía de despacho",
  56: "Nota de débito",
  61: "Nota de crédito",
  110: "Factura de exportación",
};

export function tipoDte(t: number | null): string {
  return t === null ? "" : (NOMBRES_DTE[t] ?? `DTE ${t}`);
}

export const BANCOS: Record<string, string> = {
  bancoestado: "BancoEstado",
  banco_chile: "Banco de Chile",
};

export const ESTADO_MOVIMIENTO: Record<EstadoMovimiento, { texto: string; color: string }> = {
  pendiente: { texto: "Pendiente", color: "warning" },
  parcial: { texto: "Parcial", color: "info" },
  conciliado: { texto: "Conciliado", color: "success" },
  ignorado: { texto: "Ignorado", color: "secondary" },
};

export const ESTADO_DOCUMENTO: Record<EstadoDocumento, { texto: string; color: string }> = {
  pendiente: { texto: "Pendiente", color: "warning" },
  parcial: { texto: "Parcial", color: "info" },
  pagado: { texto: "Pagado", color: "success" },
  anulado: { texto: "Anulado", color: "dark" },
  excluido: { texto: "Por categoría", color: "secondary" },
};

export const TIPO_CONTRAPARTE: Record<TipoContraparte, string> = {
  cliente: "Cliente",
  proveedor: "Proveedor",
  cliente_proveedor: "Cliente y proveedor",
  propia: "Propia empresa",
  persona: "Persona",
  otro: "Otro",
};

export const ROLES = { admin: "Administrador", operador: "Operador", lector: "Lector" } as const;

/** Color del score del motor: verde = casi seguro, amarillo = revisar, gris = dudoso. */
export function colorScore(score: number): string {
  if (score >= 0.9) return "success";
  if (score >= 0.6) return "primary";
  if (score >= 0.5) return "warning";
  return "secondary";
}

export function porcentaje(score: number): string {
  return `${Math.round(score * 100)}%`;
}
