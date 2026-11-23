//! CRC16/Modbus (polinomio reflejado 0xA001).
//!
//! El protocolo MT lo usa dos veces: en la cabecera, con valor inicial igual al
//! id de trama, y al final del contenido Modbus, con el valor inicial estándar
//! 0xFFFF.

/// Valor inicial estándar de Modbus RTU.
pub const MODBUS_INIT: u16 = 0xFFFF;

const TABLE: [u16; 256] = build_table();

const fn build_table() -> [u16; 256] {
    let mut table = [0u16; 256];
    let mut i = 0;
    while i < 256 {
        let mut crc = i as u16;
        let mut bit = 0;
        while bit < 8 {
            crc = if crc & 1 != 0 { (crc >> 1) ^ 0xA001 } else { crc >> 1 };
            bit += 1;
        }
        table[i] = crc;
        i += 1;
    }
    table
}

/// CRC16/Modbus de `data` partiendo de `init`.
pub fn crc16_modbus(data: &[u8], init: u16) -> u16 {
    data.iter()
        .fold(init, |crc, &b| (crc >> 8) ^ TABLE[((crc ^ b as u16) & 0xFF) as usize])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn vector_estandar_modbus() {
        // Valor de verificación publicado para CRC-16/MODBUS sobre "123456789".
        assert_eq!(crc16_modbus(b"123456789", MODBUS_INIT), 0x4B37);
    }
}
