//! Evento `'z'` armado a mano con la disposición decompilada de `mt_opc.exe`
//! (`FUN_00422d60`). Es sintético: reemplazarlo por tramas capturadas en
//! producción apenas existan.

use mt_proto::{Address, Format, Frame, Header, Kind, Rtu, Space, Value, WordOrder, ZEvent};

/// Contenido Modbus (sin CRC) de un evento de Ranguil:
/// AI17 (1 registro) y REG832..=835 (caudal y totalizador en float4 lo_hi).
const DATA: [u8; 29] = [
    0x00, 0x00, // subfunción
    0x01, // 2 bloques
    0x00, 0x00, 0x11, 0x00, 0x00, // AI 17, 1 registro
    0x01, 0x03, 0x40, 0x00, 0x03, // REG 832, 4 registros
    0x40, 0x00, 0x76, 0x19, 0x35, 0x51, // 2026-11-18 14:48:50.500
    0x00, 0x05, // AI17 = 5
    0xd6, 0xed, 0x40, 0x3c, // REG832-833 = 2.950618 (lo_hi)
    0xd7, 0x0f, 0x44, 0xfe, // REG834-835 = 2038.720581 (lo_hi)
];

fn datagram() -> Vec<u8> {
    let body = Rtu { slave: Some(1), function: b'z', data: &DATA }.encode();
    let header = Header {
        receiver: Address([52, 207, 191, 146]),
        sender: "151.22.40.66".parse().unwrap(),
        frame_id: 0x0102,
        mode_a: 0,
        mode_b: 0,
        len: body.len() as u16,
    };
    let mut out = header.encode().to_vec();
    out.extend(body);
    out
}

#[test]
fn clasifica_como_mensaje_espontaneo() {
    let bytes = datagram();
    let frame = Frame::parse(&bytes).unwrap();
    assert_eq!(frame.kind(), Kind::Unsolicited(b'z'));
    let ack = Header::parse(&frame.ack().unwrap()).unwrap();
    assert_eq!((ack.receiver, ack.sender, ack.frame_id, ack.len), (frame.header.sender, frame.header.receiver, 0x0102, 0));
}

#[test]
fn decodifica_bloques_hora_y_valores() {
    let bytes = datagram();
    let event = ZEvent::parse(&Frame::parse(&bytes).unwrap().rtu(true).unwrap()).unwrap();
    assert_eq!(event.slave, 1);
    assert_eq!(event.timestamp.to_string(), "2026-11-18 14:48:50.500");

    let tags: Vec<String> = event
        .readings()
        .map(|r| format!("{}{}={}", r.space.tag_prefix(), r.address, r.raw))
        .collect();
    assert_eq!(tags, ["AI17=5", "REG832=55021", "REG833=16444", "REG834=55055", "REG835=17662"]);

    let caudal = event.registers(Space::Registers, 832, 2).unwrap();
    let caudal = Value::decode(&caudal, Format::Float4, false, WordOrder::LoHi).unwrap();
    assert_eq!(caudal.to_mtdp_string(), "2.950618");
    let total = event.registers(Space::Registers, 834, 2).unwrap();
    let total = Value::decode(&total, Format::Float4, false, WordOrder::LoHi).unwrap();
    assert_eq!(total.to_mtdp_string(), "2038.720581");
    assert!(event.registers(Space::Registers, 835, 2).is_none());
}

#[test]
fn encode_reproduce_el_contenido() {
    let rtu = Rtu { slave: Some(1), function: b'z', data: &DATA };
    assert_eq!(ZEvent::parse(&rtu).unwrap().encode_data(), DATA);
}

#[test]
fn rechaza_valores_incompletos() {
    let rtu = Rtu { slave: Some(1), function: b'z', data: &DATA[..DATA.len() - 1] };
    assert!(ZEvent::parse(&rtu).is_err());
}
