import { detectarTipoArchivo, tipoPorExtension } from './tipo-archivo';

const bytes = (...partes: (string | number[])[]) =>
  Buffer.concat(
    partes.map((p) =>
      typeof p === 'string' ? Buffer.from(p, 'latin1') : Buffer.from(p),
    ),
  );

describe('detectarTipoArchivo', () => {
  it('reconoce JPEG, PNG, WebP, HEIC y PDF por su contenido', () => {
    expect(detectarTipoArchivo(bytes([0xff, 0xd8, 0xff, 0xe0], 'JFIF'))).toBe(
      'image/jpeg',
    );
    expect(detectarTipoArchivo(bytes('\x89PNG\r\n\x1a\n', [0, 0]))).toBe(
      'image/png',
    );
    expect(detectarTipoArchivo(bytes('RIFF', [1, 2, 3, 4], 'WEBPVP8 '))).toBe(
      'image/webp',
    );
    expect(detectarTipoArchivo(bytes([0, 0, 0, 24], 'ftypheic', [0]))).toBe(
      'image/heic',
    );
    expect(detectarTipoArchivo(bytes('%PDF-1.7\n'))).toBe('application/pdf');
  });

  it('rechaza lo que no es foto ni PDF aunque traiga la extensión', () => {
    expect(detectarTipoArchivo(bytes('<html><script>'))).toBeNull();
    expect(detectarTipoArchivo(bytes('GIF89a'))).toBeNull();
    expect(detectarTipoArchivo(bytes([0, 0, 0, 24], 'ftypisom'))).toBeNull();
    expect(detectarTipoArchivo(Buffer.alloc(0))).toBeNull();
  });
});

describe('tipoPorExtension', () => {
  it('devuelve el MIME según la extensión con que se guardó', () => {
    expect(tipoPorExtension('C:\\fotos\\abc.jpg')).toBe('image/jpeg');
    expect(tipoPorExtension('/datos/abc.PDF')).toBe('application/pdf');
    expect(tipoPorExtension('/datos/abc.html')).toBeNull();
  });
});
