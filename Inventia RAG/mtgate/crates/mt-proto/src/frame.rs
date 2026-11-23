//! Un datagrama completo: cabecera + contenido, y su clasificación.

use crate::error::{Error, Result};
use crate::header::{HEADER_LEN, Header, mode};
use crate::modbus::{Rtu, function};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Frame<'a> {
    pub header: Header,
    /// Contenido según el largo declarado (incluye el CRC Modbus).
    pub body: &'a [u8],
}

/// Qué es una trama, con el mismo criterio que `mt_opc.exe`.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Kind {
    /// Solo cabecera: confirma una trama que enviamos.
    Confirmation,
    /// Respuesta a una lectura nuestra (funciones 1 a 4).
    ReadResponse,
    /// Respuesta a una escritura nuestra (5, 6, 0x10; 0x50 en tramas de 20 bytes).
    WriteResponse,
    /// Mensaje que el equipo envía por su cuenta, con su código de función.
    Unsolicited(u8),
    /// Trama de 18 bytes que empieza con `F1 11`. MTDP la confirma sin validar
    /// CRC Modbus ni guardar nada. Significado por confirmar.
    Special,
    /// Modo 0xFF: texto o login proxy.
    Text,
    /// Modo 8: cifrado (`secure`). No soportado.
    Secure,
    /// Contenido demasiado corto para leer la función.
    Unknown,
}

impl<'a> Frame<'a> {
    /// Valida la cabecera y recorta el contenido al largo declarado.
    ///
    /// Si el datagrama trae bytes de más, se ignoran. Si trae de menos, es un error.
    pub fn parse(datagram: &'a [u8]) -> Result<Frame<'a>> {
        let header = Header::parse(datagram)?;
        let declared = usize::from(header.len);
        let available = datagram.len() - HEADER_LEN;
        if declared > available {
            return Err(Error::Truncated { declared, available });
        }
        Ok(Frame { header, body: &datagram[HEADER_LEN..HEADER_LEN + declared] })
    }

    pub fn kind(&self) -> Kind {
        if self.body.is_empty() {
            return Kind::Confirmation;
        }
        match self.header.mode() {
            mode::TEXT => return Kind::Text,
            mode::SECURE => return Kind::Secure,
            _ => {}
        }
        if self.body.len() == 2 && self.body == [0xF1, 0x11] {
            return Kind::Special;
        }
        let index = usize::from(self.header.has_slave());
        let Some(&code) = self.body.get(index) else {
            return Kind::Unknown;
        };
        match code {
            function::READ_COILS..=function::READ_INPUT_REGISTERS => Kind::ReadResponse,
            function::WRITE_SINGLE_COIL
            | function::WRITE_SINGLE_REGISTER
            | function::WRITE_MULTIPLE_REGISTERS => Kind::WriteResponse,
            function::MT_P if self.body.len() == 4 => Kind::WriteResponse,
            other => Kind::Unsolicited(other),
        }
    }

    /// Interpreta el contenido como Modbus RTU según el modo de la cabecera.
    pub fn rtu(&self, with_crc: bool) -> Result<Rtu<'a>> {
        Rtu::parse(self.body, self.header.has_slave(), with_crc)
    }

    /// Confirmación lista para enviar, o `None` si esta trama no se confirma.
    pub fn ack(&self) -> Option<[u8; HEADER_LEN]> {
        self.header.needs_ack().then(|| self.header.ack().encode())
    }
}
