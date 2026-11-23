//! Trama Modbus RTU que viaja después de la cabecera.
//!
//! `[esclavo] función datos... CRC16(LE)`. El byte de esclavo depende del modo
//! de la cabecera y el CRC final depende de `add_crc` en la configuración
//! (activo en todos nuestros equipos).

use crate::crc::{MODBUS_INIT, crc16_modbus};
use crate::error::{Error, Result, need};

pub mod function {
    pub const READ_COILS: u8 = 0x01;
    pub const READ_DISCRETE_INPUTS: u8 = 0x02;
    pub const READ_HOLDING_REGISTERS: u8 = 0x03;
    pub const READ_INPUT_REGISTERS: u8 = 0x04;
    pub const WRITE_SINGLE_COIL: u8 = 0x05;
    pub const WRITE_SINGLE_REGISTER: u8 = 0x06;
    pub const WRITE_MULTIPLE_REGISTERS: u8 = 0x10;
    /// Evento espontáneo con registros actuales.
    pub const MT_EVENT: u8 = b'z';
    /// Logger del equipo (subfunción 0/0) o evento (0/2).
    pub const MT_LOGGER: u8 = b'y';
    pub const MT_EVENT_C: u8 = b'C';
    pub const MT_P: u8 = b'P';
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Rtu<'a> {
    pub slave: Option<u8>,
    pub function: u8,
    /// Datos entre la función y el CRC.
    pub data: &'a [u8],
}

impl<'a> Rtu<'a> {
    pub fn parse(body: &'a [u8], with_slave: bool, with_crc: bool) -> Result<Rtu<'a>> {
        let head = usize::from(with_slave) + 1;
        let tail = if with_crc { 2 } else { 0 };
        need(body, head + tail)?;
        let end = body.len() - tail;
        if with_crc {
            let expected = crc16_modbus(&body[..end], MODBUS_INIT);
            let found = u16::from_le_bytes([body[end], body[end + 1]]);
            if expected != found {
                return Err(Error::ModbusCrc { expected, found });
            }
        }
        Ok(Rtu {
            slave: with_slave.then(|| body[0]),
            function: body[head - 1],
            data: &body[head..end],
        })
    }

    /// Bytes de la trama, con CRC.
    pub fn encode(&self) -> Vec<u8> {
        let mut out = Vec::with_capacity(self.data.len() + 4);
        out.extend(self.slave);
        out.push(self.function);
        out.extend_from_slice(self.data);
        let crc = crc16_modbus(&out, MODBUS_INIT);
        out.extend_from_slice(&crc.to_le_bytes());
        out
    }

    /// Registros de una respuesta a las funciones 3 o 4:
    /// `cantidad de bytes, valores BE`.
    pub fn registers(&self) -> Result<Vec<u16>> {
        let (&count, words) = self.data.split_first().ok_or(Error::Malformed("respuesta vacía"))?;
        let count = usize::from(count);
        if !count.is_multiple_of(2) || words.len() < count {
            return Err(Error::Malformed("cantidad de bytes de la respuesta"));
        }
        Ok(words[..count].as_chunks::<2>().0.iter().map(|&w| u16::from_be_bytes(w)).collect())
    }
}

/// Pedido de lectura (funciones 1 a 4): `dirección, cantidad`, ambos BE.
pub fn read_request(slave: u8, function: u8, address: u16, count: u16) -> Vec<u8> {
    let mut data = [0u8; 4];
    data[..2].copy_from_slice(&address.to_be_bytes());
    data[2..].copy_from_slice(&count.to_be_bytes());
    Rtu { slave: Some(slave), function, data: &data }.encode()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lectura_de_registros_round_trip() {
        let req = read_request(1, function::READ_HOLDING_REGISTERS, 100, 4);
        assert_eq!(req, [0x01, 0x03, 0x00, 0x64, 0x00, 0x04, 0x05, 0xd6]);
        let rtu = Rtu::parse(&req, true, true).unwrap();
        assert_eq!((rtu.slave, rtu.function, rtu.data), (Some(1), 3, &req[2..6]));
    }

    #[test]
    fn detecta_crc_modbus_incorrecto() {
        let mut req = read_request(1, 3, 100, 4);
        *req.last_mut().unwrap() ^= 0xFF;
        assert!(matches!(Rtu::parse(&req, true, true), Err(Error::ModbusCrc { .. })));
    }
}
