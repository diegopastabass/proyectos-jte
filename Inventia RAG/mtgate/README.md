# mtgate

Receptor propio para los equipos MT de Inventia, pensado para reemplazar a MT Data Provider (Windows). El diseño está en [../ARQUITECTURA.md](../ARQUITECTURA.md) y el protocolo en [../PROTOCOLO.md](../PROTOCOLO.md).

## Estado

| Crate | Estado |
|---|---|
| `mt-proto` | Cabecera, CRC, confirmaciones, Modbus RTU, evento `'z'`, timestamp empaquetado y formatos de valor. Sin dependencias y sin `unsafe` |
| `mt-config`, `mtgate`, `mt-tools` | Pendientes (etapas 2 a 6) |

`mt-proto` está verificado contra `virtual_mt_3.exe`, el simulador oficial, bajo Wine. El evento `'z'` sale del pseudocódigo y queda por confirmar con capturas reales.

## Uso

```bash
cargo test
```

```bash
cargo run --example decode -- "7f 00 00 01 97 16 28 42 12 34 00 00 00 00 ae f4"
```

```bash
cargo run --example probe -- 127.0.0.1:17110 151.22.40.66 100 4
```

`decode` también lee hex por la entrada estándar, una trama por línea. Sirve con capturas:

```bash
tshark -r mt.pcapng -Y udp.port==7110 -T fields -e data | cargo run --example decode
```
