//! Tramas reales intercambiadas con `virtual_mt_3.exe` (simulador oficial de
//! Inventia) bajo Wine, el 2026-11-19, con `tools/mtproto_probe.py`.

use mt_proto::modbus::{function, read_request};
use mt_proto::{Address, Frame, Header, Kind};

/// Servidor → equipo: leer 4 registros desde 100 del esclavo 1.
const REQUEST: [u8; 24] = [
    0x97, 0x16, 0x28, 0x42, 0x7f, 0x00, 0x00, 0x01, 0x12, 0x34, 0x00, 0x00, 0x00, 0x08, 0x95, 0x02,
    0x01, 0x03, 0x00, 0x64, 0x00, 0x04, 0x05, 0xd6,
];
/// Equipo → servidor: confirmación del pedido.
const ACK: [u8; 16] = [
    0x7f, 0x00, 0x00, 0x01, 0x97, 0x16, 0x28, 0x42, 0x12, 0x34, 0x00, 0x00, 0x00, 0x00, 0xae, 0xf4,
];
/// Equipo → servidor: respuesta con los registros 100..=103 (`data_mode=1`).
const RESPONSE: [u8; 29] = [
    0x7f, 0x00, 0x00, 0x01, 0x97, 0x16, 0x28, 0x42, 0x41, 0xe0, 0x00, 0x00, 0x00, 0x0d, 0x5d, 0x18,
    0x01, 0x03, 0x08, 0x00, 0x64, 0x00, 0x65, 0x00, 0x66, 0x00, 0x67, 0x5d, 0xec,
];

#[test]
fn arma_el_pedido_byte_a_byte() {
    let rtu = read_request(1, function::READ_HOLDING_REGISTERS, 100, 4);
    let header = Header {
        receiver: "151.22.40.66".parse().unwrap(),
        sender: Address([127, 0, 0, 1]),
        frame_id: 0x1234,
        mode_a: 0,
        mode_b: 0,
        len: rtu.len() as u16,
    };
    let mut bytes = header.encode().to_vec();
    bytes.extend(rtu);
    assert_eq!(bytes, REQUEST);
}

#[test]
fn la_confirmacion_es_identica_a_la_del_simulador() {
    let frame = Frame::parse(&REQUEST).unwrap();
    assert_eq!(frame.ack(), Some(ACK));
}

#[test]
fn reconoce_la_confirmacion() {
    let frame = Frame::parse(&ACK).unwrap();
    assert_eq!(frame.kind(), Kind::Confirmation);
    assert_eq!(frame.header.sender.serial(), 1_109_923_479);
}

#[test]
fn decodifica_la_respuesta() {
    let frame = Frame::parse(&RESPONSE).unwrap();
    assert_eq!(frame.header.frame_id, 0x41e0);
    assert_eq!(frame.kind(), Kind::ReadResponse);
    let rtu = frame.rtu(true).unwrap();
    assert_eq!(rtu.slave, Some(1));
    assert_eq!(rtu.registers().unwrap(), [100, 101, 102, 103]);
}

#[test]
fn rechaza_datagrama_truncado() {
    assert!(Frame::parse(&RESPONSE[..RESPONSE.len() - 1]).is_err());
}
