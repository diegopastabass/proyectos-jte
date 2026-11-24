import { ConfigService } from '@nestjs/config';
import { EmissoClient, ErrorEmisso, origenesPermitidos } from './emisso.client';

type Respuesta = {
  status: number;
  cuerpo: unknown;
  headers?: Record<string, string>;
};

function cliente(respuestas: Respuesta[]) {
  const llamadas: { url: string; init: RequestInit }[] = [];
  jest.spyOn(global, 'fetch').mockImplementation((url, init) => {
    llamadas.push({ url: url as string, init: init ?? {} });
    const r = respuestas.shift();
    if (!r) throw new Error('Sin más respuestas simuladas');
    return Promise.resolve(
      new Response(JSON.stringify(r.cuerpo), {
        status: r.status,
        headers: r.headers,
      }),
    );
  });
  const c = new EmissoClient(
    new ConfigService({
      EMISSO_API_KEY: 'connect_sk_test',
      EMISSO_BASE_URL: 'https://emisso.test/api/v1/',
    }),
  );
  c.esperaBaseMs = 0;
  return { c, llamadas };
}

afterEach(() => jest.restoreAllMocks());

describe('EmissoClient', () => {
  it('ejecuta una tool con la API key, la conexión y el input envuelto', async () => {
    const { c, llamadas } = cliente([
      { status: 200, cuerpo: { data: { ok: 1 } } },
    ]);
    await expect(
      c.ejecutar('sii.rcv.consultar', { periodo: '2026-11' }, 'conn_1'),
    ).resolves.toEqual({ ok: 1 });
    const [{ url, init }] = llamadas;
    expect(url).toBe(
      'https://emisso.test/api/v1/tools/sii.rcv.consultar/execute',
    );
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer connect_sk_test',
      'X-Connect-Connection': 'conn_1',
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(init.body as string)).toEqual({
      input: { periodo: '2026-11' },
    });
  });

  it('pagina con el cursor tal cual hasta que llega null', async () => {
    const { c, llamadas } = cliente([
      { status: 200, cuerpo: { data: { documentos: [1, 2], cursor: 'abc' } } },
      {
        status: 200,
        cuerpo: {
          data: {
            documentos: [3],
            cursor: null,
            sincronizacion: { completo: true },
          },
        },
      },
    ]);
    const r = await c.paginar(
      'sii.rcv.consultar',
      { periodo: '2026-11' },
      'documentos',
      'conn_1',
    );
    expect(r.filas).toEqual([1, 2, 3]);
    expect(r.ultima.sincronizacion).toEqual({ completo: true });
    const cuerpo = JSON.parse(llamadas[1].init.body as string) as {
      input: unknown;
    };
    expect(cuerpo.input).toEqual({
      periodo: '2026-11',
      limit: 500,
      cursor: 'abc',
    });
  });

  it('reintenta los errores pasajeros', async () => {
    const { c, llamadas } = cliente([
      {
        status: 409,
        cuerpo: { error: { code: 'connection_busy', message: 'ocupada' } },
      },
      { status: 200, cuerpo: { data: [] } },
    ]);
    await expect(c.listarConexiones()).resolves.toEqual([]);
    expect(llamadas).toHaveLength(2);
  });

  it('no reintenta un error definitivo y lo entrega con su código', async () => {
    const { c, llamadas } = cliente([
      {
        status: 428,
        cuerpo: {
          error: {
            code: 'connection_credential_required',
            message: 'Clave vencida',
          },
        },
      },
    ]);
    const error = await c.ejecutar('x', {}, 'conn_1').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorEmisso);
    expect(error).toMatchObject({
      status: 428,
      code: 'connection_credential_required',
      pideReconectar: true,
    });
    expect(llamadas).toHaveLength(1);
  });

  it('el cupo agotado (429 quota_exceeded) no se reintenta', async () => {
    const { c, llamadas } = cliente([
      {
        status: 429,
        cuerpo: { error: { code: 'quota_exceeded', message: 'Sin cupo' } },
        headers: { 'retry-after': '60' },
      },
    ]);
    await expect(c.listarSesiones()).rejects.toMatchObject({
      code: 'quota_exceeded',
      reintentarEn: 60,
    });
    expect(llamadas).toHaveLength(1);
  });

  it('sin API key no llama a nadie', async () => {
    const espia = jest.spyOn(global, 'fetch');
    const c = new EmissoClient(new ConfigService({}));
    expect(c.configurado).toBe(false);
    await expect(c.listarConexiones()).rejects.toMatchObject({
      code: 'no_configurado',
    });
    expect(espia).not.toHaveBeenCalled();
  });
});

describe('origenesPermitidos', () => {
  it('quita barra final y ruta, y no repite', () => {
    expect(
      origenesPermitidos(
        'https://app.jteanalytics.cl/, https://app.jteanalytics.cl/conciliacion',
      ),
    ).toEqual({ origenes: ['https://app.jteanalytics.cl'], descartados: [] });
  });

  it('descarta http, comodines y texto que no es URL', () => {
    expect(
      origenesPermitidos('http://localhost:5173,https://*.jte.cl,app.cl'),
    ).toEqual({
      origenes: [],
      descartados: ['http://localhost:5173', 'https://*.jte.cl', 'app.cl'],
    });
  });

  it('acepta comillas y espacios, y corta en 5', () => {
    const r = origenesPermitidos(
      '"https://a.cl" https://b.cl,https://c.cl,https://d.cl,https://e.cl,https://f.cl',
    );
    expect(r.origenes).toHaveLength(5);
    expect(r.origenes[0]).toBe('https://a.cl');
    expect(r.descartados).toEqual(['https://f.cl']);
  });
});
