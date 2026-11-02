/**
 * Crea el primer usuario administrador (los demás se crean desde la API con POST /usuarios).
 *
 *   npm run crear-admin -- correo@empresa.cl "Nombre Apellido"
 *
 * La contraseña se pide por consola para que no quede en el historial del shell.
 */
import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { Client } from 'pg';
import { createInterface } from 'readline';

async function preguntarOculto(pregunta: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });
  const salida = rl as unknown as {
    _writeToOutput: (s: string) => void;
    output: NodeJS.WriteStream;
  };
  salida._writeToOutput = (s: string) => {
    if (s.includes(pregunta)) salida.output.write(s);
  };
  const respuesta = await new Promise<string>((r) => rl.question(pregunta, r));
  rl.close();
  process.stdout.write('\n');
  return respuesta;
}

async function main() {
  const [email, nombre] = process.argv.slice(2);
  if (!email || !nombre) {
    console.error('Uso: npm run crear-admin -- <email> "<nombre>"');
    process.exit(1);
  }
  const password = await preguntarOculto('Contraseña (mín. 10 caracteres): ');
  if (password.length < 10) {
    console.error('La contraseña debe tener al menos 10 caracteres');
    process.exit(1);
  }

  const db = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
  });
  await db.connect();
  try {
    const { rows } = await db.query<{ id: number }>(
      `INSERT INTO usuario (email, hash_password, nombre, es_admin) VALUES ($1, $2, $3, true) RETURNING id`,
      [email.trim(), await bcrypt.hash(password, 12), nombre.trim()],
    );
    console.log(`Administrador creado (id ${rows[0].id})`);
  } finally {
    await db.end();
  }
}

main().catch((e: Error) => {
  console.error(e.message);
  process.exit(1);
});
