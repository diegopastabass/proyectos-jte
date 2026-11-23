//! Decodifica tramas MT escritas en hexadecimal, una por argumento o una por
//! línea en la entrada estándar.
//!
//! ```text
//! cargo run --example decode -- "97 16 28 42 7f 00 00 01 12 34 ..."
//! tshark -r mt.pcapng -T fields -e data | cargo run --example decode
//! ```

use std::io::{self, BufRead};

use mt_proto::{Frame, Kind, ZEvent};

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if args.is_empty() {
        for line in io::stdin().lock().lines() {
            describe(&line.expect("stdin"));
        }
    } else {
        args.iter().for_each(|a| describe(a));
    }
}

fn describe(hex: &str) {
    let bytes = match parse_hex(hex) {
        Some(b) if !b.is_empty() => b,
        _ => return eprintln!("hex inválido: {hex}"),
    };
    let frame = match Frame::parse(&bytes) {
        Ok(f) => f,
        Err(e) => return println!("ERROR {e} ({} bytes)", bytes.len()),
    };
    let h = frame.header;
    println!(
        "{} -> {}  id={:#06x} modo={:#06x} serie={} tipo={:?}",
        h.sender,
        h.receiver,
        h.frame_id,
        h.mode(),
        h.sender.serial(),
        frame.kind()
    );
    match frame.kind() {
        Kind::ReadResponse => match frame.rtu(true).and_then(|r| r.registers()) {
            Ok(regs) => println!("  registros {regs:?}"),
            Err(e) => println!("  ERROR {e}"),
        },
        Kind::Unsolicited(b'z') => match frame.rtu(true).and_then(|r| ZEvent::parse(&r)) {
            Ok(ev) => {
                println!("  evento esclavo={} hora={}", ev.slave, ev.timestamp);
                for r in ev.readings() {
                    println!("    {}{} = {}", r.space.tag_prefix(), r.address, r.raw);
                }
            }
            Err(e) => println!("  ERROR {e}"),
        },
        Kind::Unsolicited(code) => {
            println!("  función {code:#04x} ('{}') aún no decodificada: {:02x?}", code as char, frame.body)
        }
        _ => {}
    }
}

fn parse_hex(s: &str) -> Option<Vec<u8>> {
    let digits: String = s.chars().filter(|c| c.is_ascii_hexdigit()).collect();
    if !digits.len().is_multiple_of(2) {
        return None;
    }
    (0..digits.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&digits[i..i + 2], 16).ok())
        .collect()
}
