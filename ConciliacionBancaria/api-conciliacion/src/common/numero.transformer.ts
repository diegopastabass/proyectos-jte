import { ValueTransformer } from 'typeorm';

/**
 * pg devuelve bigint y numeric como string. Los montos en CLP caben de sobra en un Number
 * (enteros exactos hasta ~9.000 billones), así que se convierten para operar sin BigInt.
 */
export const numeroDesdePg: ValueTransformer = {
  to: (valor: number | null | undefined) => valor,
  from: (valor: string | null) => (valor === null ? null : Number(valor)),
};
