//! Cabecera de 16 bytes y confirmaciones (ACK).
//!
//! | Offset | Campo                                                   |
//! |--------|---------------------------------------------------------|
//! | 0..4   | receptor                                                |
//! | 4..8   | emisor (en tramas de un equipo, su número de serie)     |
//! | 8..10  | id de trama, big-endian                                 |
//! | 10     | modo A                                                  |
//! | 11     | modo B (`0` = Modbus con esclavo)                       |
//! | 12..14 | largo del contenido que sigue, big-endian               |
//! | 14..16 | CRC16/Modbus de 0..14 con valor inicial = id de trama, BE |

use std::fmt;

use crate::crc::crc16_modbus;
use crate::error::{Error, Result, need};

pub const HEADER_LEN: usize = 16;

/// Dirección de 4 bytes de la cabecera: una IP o un número de serie.
///
/// Los números de serie se escriben como si fueran IP. `151.22.40.66` es el
/// serie `1109923479`, porque los bytes se leen como `u32` little-endian.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct Address(pub [u8; 4]);

impl Address {
    pub const ZERO: Address = Address([0; 4]);

    pub fn from_serial(serial: u32) -> Self {
        Address(serial.to_le_bytes())
    }

    pub fn serial(self) -> u32 {
        u32::from_le_bytes(self.0)
    }
}

impl fmt::Display for Address {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let [a, b, c, d] = self.0;
        write!(f, "{a}.{b}.{c}.{d}")
    }
}

impl std::str::FromStr for Address {
    type Err = Error;

    /// Acepta la forma con puntos (`151.22.40.66`) o el serie decimal (`1109923479`).
    fn from_str(s: &str) -> Result<Self> {
        if let Ok(serial) = s.parse::<u32>() {
            return Ok(Address::from_serial(serial));
        }
        let mut bytes = [0u8; 4];
        let mut parts = s.split('.');
        for b in &mut bytes {
            *b = parts
                .next()
                .and_then(|p| p.parse().ok())
                .ok_or(Error::Malformed("dirección MT inválida"))?;
        }
        if parts.next().is_some() {
            return Err(Error::Malformed("dirección MT inválida"));
        }
        Ok(Address(bytes))
    }
}

/// Valores conocidos de los bytes 10–11 leídos como `u16` big-endian.
pub mod mode {
    /// Modbus con byte de esclavo; se confirma.
    pub const MODBUS: u16 = 0x0000;
    /// Sin byte de esclavo; no se confirma.
    pub const NO_ACK: u16 = 0x0001;
    /// Modbus cifrado (opción `secure`, requiere llave USB). No soportado.
    pub const SECURE: u16 = 0x0008;
    /// Texto o login proxy (modo `dynamic_by_ip`).
    pub const TEXT: u16 = 0x00FF;
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Header {
    pub receiver: Address,
    pub sender: Address,
    pub frame_id: u16,
    pub mode_a: u8,
    pub mode_b: u8,
    /// Bytes de contenido que siguen a la cabecera (incluye el CRC Modbus).
    pub len: u16,
}

impl Header {
    /// Lee y valida (CRC incluido) los primeros 16 bytes de `buf`.
    pub fn parse(buf: &[u8]) -> Result<Header> {
        need(buf, HEADER_LEN)?;
        let header = Header {
            receiver: Address([buf[0], buf[1], buf[2], buf[3]]),
            sender: Address([buf[4], buf[5], buf[6], buf[7]]),
            frame_id: u16::from_be_bytes([buf[8], buf[9]]),
            mode_a: buf[10],
            mode_b: buf[11],
            len: u16::from_be_bytes([buf[12], buf[13]]),
        };
        let expected = crc16_modbus(&buf[..14], header.frame_id);
        let found = u16::from_be_bytes([buf[14], buf[15]]);
        if expected != found {
            return Err(Error::HeaderCrc { expected, found });
        }
        Ok(header)
    }

    pub fn encode(&self) -> [u8; HEADER_LEN] {
        let mut out = [0u8; HEADER_LEN];
        out[0..4].copy_from_slice(&self.receiver.0);
        out[4..8].copy_from_slice(&self.sender.0);
        out[8..10].copy_from_slice(&self.frame_id.to_be_bytes());
        out[10] = self.mode_a;
        out[11] = self.mode_b;
        out[12..14].copy_from_slice(&self.len.to_be_bytes());
        let crc = crc16_modbus(&out[..14], self.frame_id);
        out[14..16].copy_from_slice(&crc.to_be_bytes());
        out
    }

    pub fn mode(&self) -> u16 {
        u16::from_be_bytes([self.mode_a, self.mode_b])
    }

    /// `true` si el contenido trae el byte de esclavo Modbus antes de la función
    /// (modos 0 y 8, como en `FUN_0041ebb0` de `mt_opc.exe`).
    pub fn has_slave(&self) -> bool {
        matches!(self.mode(), mode::MODBUS | mode::SECURE)
    }

    /// `true` si esta trama se debe confirmar (todas menos el modo 1).
    pub fn needs_ack(&self) -> bool {
        self.mode() != mode::NO_ACK
    }

    /// Cabecera de la confirmación para esta trama: emisor y receptor
    /// intercambiados, mismo id y modo, largo 0.
    ///
    /// En el `net_mode` `ruter` de MTDP el emisor de la confirmación va en cero;
    /// en ese caso, reemplazar `sender` en el resultado.
    pub fn ack(&self) -> Header {
        Header {
            receiver: self.sender,
            sender: self.receiver,
            frame_id: self.frame_id,
            mode_a: self.mode_a,
            mode_b: self.mode_b,
            len: 0,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serie_equivale_a_ip_little_endian() {
        // Pares tomados de sample.xml y cloudmtdp.sql.
        let a: Address = "151.22.40.66".parse().unwrap();
        assert_eq!(a.serial(), 1_109_923_479);
        assert_eq!(Address::from_serial(17_634_437).to_string(), "133.20.13.1");
        assert_eq!("1109923479".parse::<Address>().unwrap(), a);
    }

    #[test]
    fn rechaza_crc_incorrecto() {
        let mut bytes = Header {
            receiver: Address([1, 2, 3, 4]),
            sender: Address([5, 6, 7, 8]),
            frame_id: 7,
            mode_a: 0,
            mode_b: 0,
            len: 0,
        }
        .encode();
        bytes[15] ^= 1;
        assert!(matches!(Header::parse(&bytes), Err(Error::HeaderCrc { .. })));
    }
}
