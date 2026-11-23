//! Protocolo MT de Inventia sobre UDP (puerto 7110 por defecto).
//!
//! Cada datagrama es una trama: una [cabecera](header) de 16 bytes seguida de
//! una trama [Modbus RTU](modbus). Los equipos envían sus datos como mensajes
//! espontáneos con códigos de función propios de Inventia ([`event`]).
//!
//! La especificación y el nivel de evidencia de cada campo están en
//! `PROTOCOLO.md`, en la raíz del proyecto.
//!
//! Este crate no hace I/O: solo arma y desarma bytes.

#![forbid(unsafe_code)]

pub mod crc;
mod error;
pub mod event;
pub mod frame;
pub mod header;
pub mod modbus;
pub mod time;
pub mod value;

pub use error::{Error, Result};
pub use event::{Block, Reading, Space, ZEvent};
pub use frame::{Frame, Kind};
pub use header::{Address, HEADER_LEN, Header};
pub use modbus::Rtu;
pub use time::PackedTime;
pub use value::{Format, Value, WordOrder};
