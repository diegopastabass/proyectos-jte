import {
  BadRequestException,
  GatewayTimeoutException,
  InternalServerErrorException,
} from '@nestjs/common';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 800;

// Valida startDate/endDate (YYYY-MM-DD) antes de que lleguen a la base:
// una fecha inválida antes terminaba en un 500 desde Postgres.
export function assertDateRange(startDate: string, endDate: string) {
  if (!DATE_RE.test(startDate ?? '') || !DATE_RE.test(endDate ?? '')) {
    throw new BadRequestException('startDate y endDate deben tener formato YYYY-MM-DD');
  }
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) {
    throw new BadRequestException('Fecha inválida');
  }
  if (end < start) {
    throw new BadRequestException('endDate no puede ser anterior a startDate');
  }
  if ((end - start) / 86_400_000 > MAX_RANGE_DAYS) {
    throw new BadRequestException(`El rango no puede superar ${MAX_RANGE_DAYS} días`);
  }
}

// 57014 = query_canceled (statement_timeout). "Query read timeout" lo lanza
// node-postgres cuando se cumple query_timeout del lado del cliente.
export function rethrowDbError(error: unknown, message: string): never {
  console.error(`${message}:`, error);
  const err = error as { code?: string; message?: string };
  if (err?.code === '57014' || err?.message?.includes('Query read timeout')) {
    throw new GatewayTimeoutException(`${message}: la consulta superó el tiempo máximo`);
  }
  throw new InternalServerErrorException(message);
}

// Fecha de hoy en Chile (YYYY-MM-DD), para decidir el TTL de los rangos con datos en curso
export function todayInChile(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(d);
}
