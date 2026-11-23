//! Lee registros de un equipo MT (o de `virtual_mt_3.exe`) por UDP.
//!
//! ```text
//! cargo run --example probe -- 127.0.0.1:17110 151.22.40.66 100 4
//! ```

use std::net::UdpSocket;
use std::time::Duration;

use mt_proto::modbus::{function, read_request};
use mt_proto::{Address, Frame, Header, Kind};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let target = args.first().map_or("127.0.0.1:17110", String::as_str);
    let device: Address = args.get(1).map_or("151.22.40.66", String::as_str).parse()?;
    let address: u16 = args.get(2).map_or(Ok(100), |s| s.parse())?;
    let count: u16 = args.get(3).map_or(Ok(4), |s| s.parse())?;

    let socket = UdpSocket::bind("0.0.0.0:0")?;
    socket.set_read_timeout(Some(Duration::from_secs(3)))?;

    let rtu = read_request(1, function::READ_HOLDING_REGISTERS, address, count);
    let header = Header {
        receiver: device,
        sender: Address([127, 0, 0, 1]),
        frame_id: 0x2001,
        mode_a: 0,
        mode_b: 0,
        len: rtu.len() as u16,
    };
    let mut request = header.encode().to_vec();
    request.extend(rtu);
    socket.send_to(&request, target)?;
    println!("TX {:02x?}", request);

    let mut buf = [0u8; 1500];
    let (mut acked, mut answered) = (false, false);
    while let Ok((n, from)) = socket.recv_from(&mut buf) {
        let frame = Frame::parse(&buf[..n])?;
        match frame.kind() {
            Kind::Confirmation => {
                acked = frame.header.frame_id == header.frame_id;
                println!("RX confirmación de {from} (id {:#06x})", frame.header.frame_id);
            }
            Kind::ReadResponse => {
                let regs = frame.rtu(true)?.registers()?;
                println!("RX registros {regs:?} (id {:#06x})", frame.header.frame_id);
                if let Some(ack) = frame.ack() {
                    socket.send_to(&ack, from)?;
                    println!("TX confirmación {:02x?}", ack);
                }
                answered = true;
            }
            other => println!("RX {other:?}"),
        }
        if acked && answered {
            break;
        }
    }
    if !(acked && answered) {
        return Err("no llegaron la confirmación y la respuesta".into());
    }
    Ok(())
}
