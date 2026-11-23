"""Sonda del protocolo MT (Inventia) contra virtual_mt_3.exe.

Hipótesis (desde la decompilación de virtual_mt_3.exe):
  cabecera 16 bytes: [0:4] receptor, [4:8] emisor, [8:10] id trama (BE),
  [10] modo A, [11] modo B (0 = Modbus), [12:14] largo de lo que sigue (BE),
  [14:16] CRC16/Modbus de [0:14] con valor inicial = id de trama, guardado BE.
  contenido: trama Modbus RTU (esclavo, función, datos, CRC16/Modbus LE).
"""
import socket
import struct
import sys


def crc16_modbus(data: bytes, init: int = 0xFFFF) -> int:
    crc = init
    for b in data:
        crc ^= b
        for _ in range(8):
            crc = (crc >> 1) ^ 0xA001 if crc & 1 else crc >> 1
    return crc


def build(receiver: bytes, sender: bytes, frame_id: int, pdu: bytes, mode_a=0, mode_b=0) -> bytes:
    rtu = pdu + struct.pack("<H", crc16_modbus(pdu))
    hdr = receiver + sender + struct.pack(">HBBH", frame_id, mode_a, mode_b, len(rtu))
    hdr += struct.pack(">H", crc16_modbus(hdr, init=frame_id))
    return hdr + rtu


def check_header(frame: bytes) -> bool:
    fid = struct.unpack(">H", frame[8:10])[0]
    return crc16_modbus(frame[:14], init=fid) == struct.unpack(">H", frame[14:16])[0]


def main(port: int) -> None:
    device = bytes([151, 22, 40, 66])  # número de serie "151.22.40.66"
    server = bytes([127, 0, 0, 1])
    pdu = bytes([1, 3]) + struct.pack(">HH", 100, 4)  # esclavo 1, leer 4 registros desde 100
    req = build(device, server, 0x1234, pdu)
    print("TX", req.hex(" "))
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.settimeout(3)
    s.sendto(req, ("127.0.0.1", port))
    try:
        while True:
            data, _ = s.recvfrom(2048)
            kind = "ACK" if len(data) == 16 else "DATA"
            print(f"RX {kind} ({len(data)} bytes)", data.hex(" "))
            print("   CRC cabecera OK:", check_header(data))
            if len(data) > 16:
                rtu = data[16:]
                ok = crc16_modbus(rtu[:-2]) == struct.unpack("<H", rtu[-2:])[0]
                n = rtu[2]
                regs = struct.unpack(f">{n // 2}H", rtu[3:3 + n])
                print(f"   CRC Modbus OK: {ok}  esclavo={rtu[0]} func={rtu[1]} registros={regs}")
    except socket.timeout:
        print("(fin, sin más respuestas)")


if __name__ == "__main__":
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 17110)
