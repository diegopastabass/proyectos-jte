//! Timestamp empaquetado de 6 bytes de los eventos (`FUN_0041ee00` y
//! `FUN_0041ed10` de `mt_opc.exe`).
//!
//! ```text
//! año      = (b4 >> 1) + 2000
//! mes      = ((b4 & 1) << 3 | b5 >> 5) + 1
//! día      = (b5 & 0x1F) + 1
//! hora     = b2 >> 3
//! minuto   = (b2 & 7) << 3 | b3 >> 5
//! segundo  = (b3 & 0x1F) * 2 + (b0 >> 7)
//! ms       = (((b0 & 0x7F) << 8 | b1) * 1000) >> 15
//! ```

use std::fmt;

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct PackedTime {
    pub year: u16,
    pub month: u8,
    pub day: u8,
    pub hour: u8,
    pub minute: u8,
    pub second: u8,
    pub millis: u16,
}

impl PackedTime {
    pub const LEN: usize = 6;

    pub fn decode(b: [u8; 6]) -> PackedTime {
        let fraction = u32::from(b[0] & 0x7F) << 8 | u32::from(b[1]);
        PackedTime {
            year: u16::from(b[4] >> 1) + 2000,
            month: ((b[4] & 1) << 3 | b[5] >> 5) + 1,
            day: (b[5] & 0x1F) + 1,
            hour: b[2] >> 3,
            minute: (b[2] & 7) << 3 | b[3] >> 5,
            second: (b[3] & 0x1F) * 2 + (b[0] >> 7),
            millis: ((fraction * 1000) >> 15) as u16,
        }
    }

    /// Inverso de [`decode`](Self::decode) para fechas válidas
    /// (2000–2127, milisegundos 0–999).
    pub fn encode(&self) -> [u8; 6] {
        // Fracción de 15 bits redondeada hacia arriba, para que decode devuelva
        // exactamente los mismos milisegundos.
        let fraction = (u32::from(self.millis) * 32768).div_ceil(1000);
        let month = self.month - 1;
        [
            ((self.second & 1) << 7) | ((fraction >> 8) as u8 & 0x7F),
            fraction as u8,
            (self.hour << 3) | (self.minute >> 3),
            ((self.minute & 7) << 5) | (self.second / 2),
            (((self.year - 2000) as u8) << 1) | (month >> 3),
            ((month & 7) << 5) | (self.day - 1),
        ]
    }

    /// `false` si los bits no forman una fecha y hora posible.
    pub fn is_valid(&self) -> bool {
        (1..=12).contains(&self.month)
            && (1..=31).contains(&self.day)
            && self.hour < 24
            && self.minute < 60
            && self.second < 60
            && self.millis < 1000
    }
}

impl fmt::Display for PackedTime {
    /// Formato que usa MTDP en la base: `YYYY-MM-DD HH:MM:SS.mmm`.
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "{:04}-{:02}-{:02} {:02}:{:02}:{:02}.{:03}",
            self.year, self.month, self.day, self.hour, self.minute, self.second, self.millis
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Bytes calculados a mano con la fórmula decompilada, no con encode().
    const BYTES: [u8; 6] = [0x40, 0x00, 0x76, 0x19, 0x35, 0x51];

    #[test]
    fn decodifica_vector_calculado_a_mano() {
        let t = PackedTime::decode(BYTES);
        assert_eq!(t.to_string(), "2026-11-18 14:48:50.500");
        assert!(t.is_valid());
    }

    #[test]
    fn encode_es_inverso_de_decode() {
        assert_eq!(PackedTime::decode(BYTES).encode(), BYTES);
        for millis in 0..1000 {
            let t = PackedTime { year: 2031, month: 2, day: 28, hour: 23, minute: 59, second: 59, millis };
            assert_eq!(PackedTime::decode(t.encode()), t);
        }
    }
}
