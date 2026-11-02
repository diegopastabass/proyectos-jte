/**
 * Lee archivos con los lectores, sin tocar la BD, e imprime un resumen.
 * Sirve para verificar una cartola o RCV nuevo antes de importarlo.
 *
 *   npm run probar-lectores -- ../Excel_Cartola_Historica_Chequera_Electronica.xlsx ../RCV_VENTA_*.csv
 */
import { readFileSync } from 'fs';
import { basename } from 'path';
import { leerArchivo } from '../src/importacion/lectores';

async function main() {
  const rutas = process.argv.slice(2);
  if (rutas.length === 0) {
    console.error('Uso: npm run probar-lectores -- <archivo> [archivo...]');
    process.exit(1);
  }
  for (const ruta of rutas) {
    console.log(`\n=== ${basename(ruta)}`);
    try {
      const r = await leerArchivo(basename(ruta), readFileSync(ruta));
      if (r.clase === 'cartola') {
        const c = r.cartola;
        const abonos = c.movimientos
          .filter((m) => m.monto > 0)
          .reduce((s, m) => s + m.monto, 0);
        const cargos = c.movimientos
          .filter((m) => m.monto < 0)
          .reduce((s, m) => s - m.monto, 0);
        console.log(
          `${c.lector} cuenta ${c.numeroCuenta} cartola N°${c.nCartola} ${c.desde}…${c.hasta} ` +
            `rut ${c.rutEmpresa}\n  ${c.movimientos.length} movimientos, abonos ${abonos}, cargos ${cargos}, ` +
            `saldo ${c.saldoInicial} → ${c.saldoFinal}`,
        );
        const conRut = c.movimientos.filter((m) => m.rutContraparte).length;
        const conNombre = c.movimientos.filter(
          (m) => m.contraparteTexto,
        ).length;
        console.log(
          `  contraparte: ${conNombre} con nombre, ${conRut} con RUT`,
        );
      } else {
        const v = r.rcv;
        const porTipo: Record<number, number> = {};
        for (const d of v.documentos)
          porTipo[d.tipoDte] = (porTipo[d.tipoDte] ?? 0) + 1;
        console.log(
          `${v.tipo} rut ${v.rutEmpresa} período ${v.periodo} ${v.desde}…${v.hasta}\n` +
            `  ${v.documentos.length} documentos por tipo ${JSON.stringify(porTipo)}, ` +
            `con referencia: ${v.documentos.filter((d) => d.refFolio).length}`,
        );
      }
      const adv =
        r.clase === 'cartola' ? r.cartola.advertencias : r.rcv.advertencias;
      for (const a of adv) console.log(`  ⚠ ${a}`);
    } catch (e) {
      console.log(`  ✗ ${(e as Error).message}`);
    }
  }
}

void main();
