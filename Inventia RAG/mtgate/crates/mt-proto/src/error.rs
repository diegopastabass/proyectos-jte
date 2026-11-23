use std::fmt;

pub type Result<T> = std::result::Result<T, Error>;

/// Motivos por los que una trama no se puede interpretar.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Error {
    /// Faltan bytes para la estructura que se estaba leyendo.
    TooShort { needed: usize, got: usize },
    /// El CRC de la cabecera no coincide.
    HeaderCrc { expected: u16, found: u16 },
    /// La cabecera declara más bytes de los que trae el datagrama.
    Truncated { declared: usize, available: usize },
    /// El CRC Modbus del contenido no coincide.
    ModbusCrc { expected: u16, found: u16 },
    /// El contenido no tiene la forma esperada para su tipo.
    Malformed(&'static str),
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Error::TooShort { needed, got } => {
                write!(f, "trama corta: se necesitan {needed} bytes y hay {got}")
            }
            Error::HeaderCrc { expected, found } => {
                write!(f, "CRC de cabecera inválido: esperado {expected:04x}, recibido {found:04x}")
            }
            Error::Truncated { declared, available } => {
                write!(f, "la cabecera declara {declared} bytes de contenido y llegaron {available}")
            }
            Error::ModbusCrc { expected, found } => {
                write!(f, "CRC Modbus inválido: esperado {expected:04x}, recibido {found:04x}")
            }
            Error::Malformed(what) => write!(f, "contenido mal formado: {what}"),
        }
    }
}

impl std::error::Error for Error {}

pub(crate) fn need(buf: &[u8], needed: usize) -> Result<()> {
    if buf.len() < needed {
        Err(Error::TooShort { needed, got: buf.len() })
    } else {
        Ok(())
    }
}
