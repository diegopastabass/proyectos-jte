//! Conversión de registros a valores según los formatos de MTDP
//! (`int2`, `long4`, `long8`, `float4`, `float8`, `bool`), `signed` y
//! `dreg_order`.

use crate::error::{Error, Result};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Format {
    Int2,
    Long4,
    Long8,
    Float4,
    Float8,
    /// 16 bits de un registro; los tags son `AIB<n>:<bit>` o `REGB<n>:<bit>`.
    Bool,
}

impl Format {
    /// Registros de 16 bits que ocupa un valor.
    pub fn words(self) -> usize {
        match self {
            Format::Int2 | Format::Bool => 1,
            Format::Long4 | Format::Float4 => 2,
            Format::Long8 | Format::Float8 => 4,
        }
    }

    /// Letra que MTDP agrega al prefijo del tag: `REGF832`, `REGL4`, `AIB17:1`.
    ///
    /// `L`, `F` y `B` se ven en nuestra configuración. `W` y `R` existen en
    /// `mt_opc.exe` y, por cómo se agrupan, serían `long8` y `float8` (inferido).
    pub fn tag_suffix(self) -> &'static str {
        match self {
            Format::Int2 => "",
            Format::Long4 => "L",
            Format::Long8 => "W",
            Format::Float4 => "F",
            Format::Float8 => "R",
            Format::Bool => "B",
        }
    }
}

impl std::str::FromStr for Format {
    type Err = Error;

    fn from_str(s: &str) -> Result<Self> {
        Ok(match s {
            "int2" => Format::Int2,
            "long4" => Format::Long4,
            "long8" => Format::Long8,
            "float4" => Format::Float4,
            "float8" => Format::Float8,
            "bool" => Format::Bool,
            _ => return Err(Error::Malformed("formato desconocido")),
        })
    }
}

/// Orden de los registros en valores de 32 y 64 bits (`dreg_order`).
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Hash)]
pub enum WordOrder {
    /// El primer registro es el más significativo. Valor por defecto en MTDP.
    #[default]
    HiLo,
    LoHi,
}

impl std::str::FromStr for WordOrder {
    type Err = Error;

    fn from_str(s: &str) -> Result<Self> {
        match s {
            "hi_lo" => Ok(WordOrder::HiLo),
            "lo_hi" => Ok(WordOrder::LoHi),
            _ => Err(Error::Malformed("dreg_order desconocido")),
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Value {
    Unsigned(u64),
    Signed(i64),
    Float(f64),
    /// Registro completo en formato `bool`; ver [`Value::bit`].
    Bits(u16),
}

impl Value {
    /// Convierte `words` (exactamente `format.words()` registros, en el orden en
    /// que llegaron) al valor que corresponde.
    pub fn decode(words: &[u16], format: Format, signed: bool, order: WordOrder) -> Result<Value> {
        if words.len() != format.words() {
            return Err(Error::Malformed("cantidad de registros para el formato"));
        }
        let combined = |words: &[u16]| -> u64 {
            let fold = |acc: u64, &w: &u16| acc << 16 | u64::from(w);
            match order {
                WordOrder::HiLo => words.iter().fold(0, fold),
                WordOrder::LoHi => words.iter().rev().fold(0, fold),
            }
        };
        Ok(match format {
            Format::Bool => Value::Bits(words[0]),
            Format::Int2 if signed => Value::Signed(i64::from(words[0] as i16)),
            Format::Int2 => Value::Unsigned(u64::from(words[0])),
            Format::Long4 if signed => Value::Signed(i64::from(combined(words) as u32 as i32)),
            Format::Long4 => Value::Unsigned(combined(words)),
            Format::Long8 if signed => Value::Signed(combined(words) as i64),
            Format::Long8 => Value::Unsigned(combined(words)),
            Format::Float4 => Value::Float(f64::from(f32::from_bits(combined(words) as u32))),
            Format::Float8 => Value::Float(f64::from_bits(combined(words))),
        })
    }

    /// Bit `n` (0 = menos significativo) de un valor `bool`.
    ///
    /// Inferido: `AIB17:0` = automático, `:1` = bomba, `:2` = falla en Ranguil.
    /// Confirmar el orden de bits con tráfico real.
    pub fn bit(&self, n: u8) -> Option<bool> {
        match *self {
            Value::Bits(w) if n < 16 => Some(w >> n & 1 == 1),
            _ => None,
        }
    }

    /// Texto que MTDP guarda en `mt_value`: enteros sin decimales y flotantes
    /// como `printf("%f")` (6 decimales). Pendiente de confirmar con `mt-tools diff`.
    pub fn to_mtdp_string(&self) -> String {
        match *self {
            Value::Unsigned(v) => v.to_string(),
            Value::Signed(v) => v.to_string(),
            Value::Float(v) => format!("{v:.6}"),
            Value::Bits(v) => v.to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn enteros_con_y_sin_signo() {
        let v = Value::decode(&[0xFFFE], Format::Int2, true, WordOrder::HiLo).unwrap();
        assert_eq!(v, Value::Signed(-2));
        let v = Value::decode(&[0xFFFE], Format::Int2, false, WordOrder::HiLo).unwrap();
        assert_eq!(v, Value::Unsigned(65534));
    }

    #[test]
    fn long4_respeta_dreg_order() {
        // Horómetro de Ranguil (REGL4, lo_hi): 71030 = 0x0001_1576.
        let lo_hi = Value::decode(&[0x1576, 0x0001], Format::Long4, false, WordOrder::LoHi).unwrap();
        let hi_lo = Value::decode(&[0x0001, 0x1576], Format::Long4, false, WordOrder::HiLo).unwrap();
        assert_eq!(lo_hi, Value::Unsigned(71030));
        assert_eq!(hi_lo, lo_hi);
    }

    #[test]
    fn float4_se_formatea_como_mtdp() {
        // Caudal de Ranguil en odbc_lost.log: '2.950618'.
        let bits = 2.950618_f32.to_bits();
        let words = [bits as u16, (bits >> 16) as u16];
        let v = Value::decode(&words, Format::Float4, false, WordOrder::LoHi).unwrap();
        assert_eq!(v.to_mtdp_string(), "2.950618");
    }

    #[test]
    fn bits_de_un_registro_bool() {
        let v = Value::decode(&[0b101], Format::Bool, false, WordOrder::HiLo).unwrap();
        assert_eq!((v.bit(0), v.bit(1), v.bit(2), v.bit(16)), (Some(true), Some(false), Some(true), None));
    }
}
