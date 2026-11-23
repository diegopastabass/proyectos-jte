//! Evento espontáneo `'z'` (función 0x7A, subfunción 0/0): bloques de
//! registros con su timestamp.
//!
//! Disposición dentro de `Rtu::data`, según `FUN_00422d60` de `mt_opc.exe`:
//!
//! ```text
//! 0-1    subfunción 00 00
//! 2      N-1, con N la cantidad de bloques
//! 3..    N descriptores de 5 bytes:
//!          [0]   espacio: 0 = analog_inputs ("AI"), otro = registers ("REG")
//!          [1-2] dirección inicial (BE)
//!          [3-4] cantidad de registros menos uno (BE)
//! +0     timestamp empaquetado (6 bytes)
//! +6     valores, 2 bytes BE por registro, en el orden de los bloques
//! ```
//!
//! Pendiente de confirmar con tráfico real: ver §9 de `PROTOCOLO.md`.

use crate::error::{Error, Result, need};
use crate::modbus::{Rtu, function};
use crate::time::PackedTime;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub enum Space {
    /// `analog_inputs` en la configuración; tags `AI<n>`.
    AnalogInputs,
    /// `registers` en la configuración; tags `REG<n>`.
    Registers,
}

impl Space {
    pub fn tag_prefix(self) -> &'static str {
        match self {
            Space::AnalogInputs => "AI",
            Space::Registers => "REG",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Block {
    pub space: Space,
    pub address: u16,
    /// Cantidad real de registros (el campo de la trama más uno).
    pub count: u32,
}

/// Valor crudo de un registro del evento.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Reading {
    pub space: Space,
    pub address: u32,
    pub raw: u16,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ZEvent {
    pub slave: u8,
    pub timestamp: PackedTime,
    pub blocks: Vec<Block>,
    /// Valores de todos los bloques, concatenados.
    pub values: Vec<u16>,
}

impl ZEvent {
    pub fn parse(rtu: &Rtu<'_>) -> Result<ZEvent> {
        if rtu.function != function::MT_EVENT {
            return Err(Error::Malformed("no es un evento 'z'"));
        }
        let slave = rtu.slave.ok_or(Error::Malformed("evento 'z' sin byte de esclavo"))?;
        let data = rtu.data;
        need(data, 3)?;
        if data[..2] != [0, 0] {
            return Err(Error::Malformed("subfunción de 'z' no soportada"));
        }
        let n = usize::from(data[2]) + 1;
        let mut pos = 3;
        need(data, pos + n * 5 + PackedTime::LEN)?;

        let blocks: Vec<Block> = data[pos..pos + n * 5]
            .as_chunks::<5>()
            .0
            .iter()
            .map(|d| Block {
                space: if d[0] == 0 { Space::AnalogInputs } else { Space::Registers },
                address: u16::from_be_bytes([d[1], d[2]]),
                count: u32::from(u16::from_be_bytes([d[3], d[4]])) + 1,
            })
            .collect();
        pos += n * 5;

        let mut ts = [0u8; 6];
        ts.copy_from_slice(&data[pos..pos + PackedTime::LEN]);
        pos += PackedTime::LEN;

        let total: usize = blocks.iter().map(|b| b.count as usize).sum();
        need(data, pos + total * 2)?;
        let values = data[pos..pos + total * 2]
            .as_chunks::<2>()
            .0
            .iter()
            .map(|&w| u16::from_be_bytes(w))
            .collect();

        Ok(ZEvent { slave, timestamp: PackedTime::decode(ts), blocks, values })
    }

    /// `Rtu::data` de este evento (inverso de [`parse`](Self::parse)).
    pub fn encode_data(&self) -> Vec<u8> {
        let mut out = vec![0, 0, (self.blocks.len() - 1) as u8];
        for b in &self.blocks {
            out.push(match b.space {
                Space::AnalogInputs => 0,
                Space::Registers => 1,
            });
            out.extend_from_slice(&b.address.to_be_bytes());
            out.extend_from_slice(&((b.count - 1) as u16).to_be_bytes());
        }
        out.extend_from_slice(&self.timestamp.encode());
        for v in &self.values {
            out.extend_from_slice(&v.to_be_bytes());
        }
        out
    }

    /// Todos los registros del evento, en orden.
    pub fn readings(&self) -> impl Iterator<Item = Reading> + '_ {
        self.blocks
            .iter()
            .flat_map(|b| (0..b.count).map(move |i| (b.space, u32::from(b.address) + i)))
            .zip(&self.values)
            .map(|((space, address), &raw)| Reading { space, address, raw })
    }

    /// `n` registros consecutivos desde `address`, si el evento los trae todos.
    /// Sirve para formatos de varios registros (`long4`, `float4`, ...).
    pub fn registers(&self, space: Space, address: u32, n: usize) -> Option<Vec<u16>> {
        let found: Vec<u16> = (0..n as u32)
            .filter_map(|i| {
                self.readings()
                    .find(|r| r.space == space && r.address == address + i)
                    .map(|r| r.raw)
            })
            .collect();
        (found.len() == n).then_some(found)
    }
}
