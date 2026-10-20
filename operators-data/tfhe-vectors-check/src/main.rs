use std::fmt;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::ExitCode;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

// Every progress note and case result also goes to a log file, each line stamped with the time since
// the run started. An FHE run always writes one (see `main`), so a long run can be followed with
// `tail -f` and survives the terminal that started it.
static LOG: OnceLock<Mutex<fs::File>> = OnceLock::new();
static RUN_START: OnceLock<Instant> = OnceLock::new();

fn log_line(line: &str) {
    if let Some(file) = LOG.get() {
        if let Ok(mut file) = file.lock() {
            let elapsed = RUN_START.get_or_init(Instant::now).elapsed();
            let _ = writeln!(file, "[{}] {line}", fmt_duration(elapsed));
        }
    }
}

// Progress notes: stderr and the log.
macro_rules! note {
    ($($t:tt)*) => {{
        let line = format!($($t)*);
        eprintln!("{line}");
        log_line(&line);
    }};
}

// Case results and summaries: stdout and the log.
macro_rules! out {
    ($($t:tt)*) => {{
        let line = format!($($t)*);
        println!("{line}");
        log_line(&line);
    }};
}

// The case under FHE right now. One case can run for minutes (a 64-bit muldiv widens to 128-bit
// products, a 60-element 256-bit isin is 60 wide comparisons), and the progress line only moves when a
// case ends, so a heartbeat says which case is still running and for how long.
static CURRENT: Mutex<Option<(String, Instant)>> = Mutex::new(None);
const HEARTBEAT: Duration = Duration::from_secs(30);

fn start_heartbeat() {
    std::thread::spawn(|| loop {
        std::thread::sleep(HEARTBEAT);
        let current = CURRENT.lock().map(|c| c.clone()).unwrap_or(None);
        if let Some((id, since)) = current {
            if since.elapsed() >= HEARTBEAT {
                note!("      still on {id} ({})", fmt_duration(since.elapsed()));
            }
        }
    });
}

use serde::Deserialize;
use tfhe::integer::U256;
use tfhe::prelude::*;
use tfhe::{
    generate_keys, set_server_key, ClientKey, ConfigBuilder, FheBool, FheUint128, FheUint16,
    FheUint160, FheUint256, FheUint32, FheUint64, FheUint8,
};

#[derive(Deserialize)]
struct Vectors {
    op: String,
    #[serde(default = "two")]
    arity: u32,
    semantics: String,
    encoding: String,
    #[serde(default)]
    operands: Option<Vec<String>>,
    #[serde(default)]
    verified: Vec<Verified>,
    cases: Vec<Case>,
}

fn two() -> u32 {
    2
}

#[derive(Deserialize)]
struct Case {
    id: String,
    lhs: Option<Operand>,
    rhs: Option<Operand>,
    divisor: Option<Operand>,
    values: Option<Vec<Operand>>,
    result: Operand,
}

impl Case {
    // Unary and binary operators always carry `lhs`; `run_part` checks it before anything reads it.
    fn lhs(&self) -> &Operand {
        self.lhs.as_ref().expect("lhs presence is checked before use")
    }
}

#[derive(Deserialize)]
struct Operand {
    bits: u32,
    value: String,
}

// Up to 256 bits, as (low, high) u128 halves.
#[derive(Clone, Copy, PartialEq, Eq)]
struct Big {
    lo: u128,
    hi: u128,
}

impl Big {
    fn from_bool(b: bool) -> Self {
        Big { lo: b as u128, hi: 0 }
    }
}

impl fmt::Display for Big {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        if self.hi == 0 {
            write!(f, "{:#x}", self.lo)
        } else {
            write!(f, "{:#x}{:032x}", self.hi, self.lo)
        }
    }
}

impl Operand {
    fn parse(&self) -> Result<Big, String> {
        let hex = self
            .value
            .strip_prefix("0x")
            .ok_or_else(|| format!("{}: missing 0x prefix", self.value))?;
        if hex.len() > 64 {
            return Err(format!("{}: wider than 256 bits", self.value));
        }
        let (hi, lo) = if hex.len() > 32 { hex.split_at(hex.len() - 32) } else { ("0", hex) };
        let lo = u128::from_str_radix(lo, 16).map_err(|e| format!("{}: {e}", self.value))?;
        let hi = u128::from_str_radix(hi, 16).map_err(|e| format!("{}: {e}", self.value))?;
        let fits = match self.bits {
            256 => true,
            160 => hi >> 32 == 0,
            128 => hi == 0,
            b if b < 128 => hi == 0 && lo >> b == 0,
            b => return Err(format!("unsupported width {b}")),
        };
        if !fits {
            return Err(format!("{} does not fit in {} bits", self.value, self.bits));
        }
        Ok(Big { lo, hi })
    }
}

// tfhe-rs <= 1.6 reduces shift amounts mod the width; >= 1.7 returns 0 on amount >= width.
const SHIFT_SEMANTICS: &str = if cfg!(feature = "tfhe16") { "amount-mod-width" } else { "overshift-zero" };

fn expected_semantics(op: &str) -> Option<&'static str> {
    Some(match op {
        "add" | "sub" | "neg" => "wrapping",
        "min" | "max" => "unsigned",
        "div" | "rem" => "unsigned-divisor-nonzero",
        "eq" | "ne" | "lt" | "le" | "gt" | "ge" => "boolean",
        "and" | "or" | "xor" => "bitwise",
        "not" => "bitwise-complement",
        "shl" | "shr" => SHIFT_SEMANTICS,
        "rotl" | "rotr" => "amount-mod-width",
        "sum" => "wrapping",
        "isin" => "membership",
        "muldiv" => "wide-product-divisor-nonzero",
        _ => return None,
    })
}

fn expected_result_bits(op: &str, case: &Case) -> u32 {
    match op {
        "eq" | "ne" | "lt" | "le" | "gt" | "ge" => 1,
        "not" | "neg" => case.lhs().bits,
        _ => case.lhs().bits.max(case.rhs.as_ref().map_or(0, |r| r.bits)),
    }
}

fn shift_amount(amount: u32, bits: u32) -> Option<u32> {
    if cfg!(feature = "tfhe16") {
        Some(amount % bits)
    } else if amount >= bits {
        None
    } else {
        Some(amount)
    }
}

// Clear reference for widths <= 128; wider rows are checked by FHE only.
fn clear_op(op: &str, a: u128, b: u128, bits: u32) -> u128 {
    let mask = if bits == 128 { u128::MAX } else { (1u128 << bits) - 1 };
    let amount = (b % 256) as u32;
    let r = match op {
        "add" => a.wrapping_add(b),
        "sub" => a.wrapping_sub(b),
        "min" => a.min(b),
        "max" => a.max(b),
        "div" => a / b,
        "rem" => a % b,
        "eq" => (a == b) as u128,
        "ne" => (a != b) as u128,
        "lt" => (a < b) as u128,
        "le" => (a <= b) as u128,
        "gt" => (a > b) as u128,
        "ge" => (a >= b) as u128,
        "and" => a & b,
        "or" => a | b,
        "xor" => a ^ b,
        "not" => !a,
        "neg" => a.wrapping_neg(),
        "shl" => shift_amount(amount, bits).map_or(0, |n| a << n),
        "shr" => shift_amount(amount, bits).map_or(0, |n| a >> n),
        "rotl" => {
            let n = amount % bits;
            if n == 0 { a } else { (a << n) | (a >> (bits - n)) }
        }
        "rotr" => {
            let n = amount % bits;
            if n == 0 { a } else { (a >> n) | (a << (bits - n)) }
        }
        _ => unreachable!(),
    };
    r & mask
}

trait Scalar: Copy {
    fn from_big(b: Big) -> Self;
}
macro_rules! scalar_from_lo {
    ($($t:ty),*) => { $(impl Scalar for $t { fn from_big(b: Big) -> Self { b.lo as $t } })* };
}
scalar_from_lo!(u8, u16, u32, u64, u128);
impl Scalar for U256 {
    fn from_big(b: Big) -> Self {
        U256::from((b.lo, b.hi))
    }
}

trait ToBig {
    fn to_big(self) -> Big;
}
impl ToBig for u128 {
    fn to_big(self) -> Big {
        Big { lo: self, hi: 0 }
    }
}
impl ToBig for U256 {
    fn to_big(self) -> Big {
        let (lo, hi) = self.to_low_high_u128();
        Big { lo, hi }
    }
}

enum Enc {
    Bool(FheBool),
    U8(FheUint8),
    U16(FheUint16),
    U32(FheUint32),
    U64(FheUint64),
    U128(FheUint128),
    U160(FheUint160),
    U256(FheUint256),
}

fn encrypt(bits: u32, v: Big, ck: &ClientKey) -> Enc {
    match bits {
        1 => Enc::Bool(FheBool::encrypt(v.lo != 0, ck)),
        8 => Enc::U8(FheUint8::encrypt(v.lo as u8, ck)),
        16 => Enc::U16(FheUint16::encrypt(v.lo as u16, ck)),
        32 => Enc::U32(FheUint32::encrypt(v.lo as u32, ck)),
        64 => Enc::U64(FheUint64::encrypt(v.lo as u64, ck)),
        128 => Enc::U128(FheUint128::encrypt(v.lo, ck)),
        160 => Enc::U160(FheUint160::encrypt(U256::from_big(v), ck)),
        256 => Enc::U256(FheUint256::encrypt(U256::from_big(v), ck)),
        _ => panic!("unsupported width {bits}"),
    }
}

impl Enc {
    fn cast_to<T>(self) -> T
    where
        T: CastFrom<FheBool>
            + CastFrom<FheUint8>
            + CastFrom<FheUint16>
            + CastFrom<FheUint32>
            + CastFrom<FheUint64>
            + CastFrom<FheUint128>
            + CastFrom<FheUint160>
            + CastFrom<FheUint256>,
    {
        match self {
            Enc::Bool(x) => T::cast_from(x),
            Enc::U8(x) => T::cast_from(x),
            Enc::U16(x) => T::cast_from(x),
            Enc::U32(x) => T::cast_from(x),
            Enc::U64(x) => T::cast_from(x),
            Enc::U128(x) => T::cast_from(x),
            Enc::U160(x) => T::cast_from(x),
            Enc::U256(x) => T::cast_from(x),
        }
    }
}

fn rhs_big(case: &Case) -> Result<Big, String> {
    case.rhs.as_ref().ok_or_else(|| "missing rhs".to_string())?.parse()
}

// Overload families mirror FHE.sol: (euint, euint), (euint, uint), (uint, euint) for binary ops;
// (euintN, euint8), (euintN, uint8) for shifts/rotates; unary for not.
macro_rules! fhe_check {
    ($T:ty, $S:ty, $D:ty, $op:expr, $case:expr, $a:expr, $expected:expr, $ck:expr) => {{
        let ea: $T = encrypt($case.lhs().bits, $a, $ck).cast_to();
        let dec = |r: $T| -> Big { <$D as ToBig>::to_big(r.decrypt($ck)) };
        let got: Vec<(&str, Big)> = match $op {
            "not" => vec![("enc", dec(!&ea))],
            "neg" => vec![("enc", dec(-&ea))],
            "div" | "rem" => {
                let sb = <$S>::from_big(rhs_big($case)?);
                if $op == "div" {
                    vec![("enc,clear", dec(&ea / sb))]
                } else {
                    vec![("enc,clear", dec(&ea % sb))]
                }
            }
            "shl" | "shr" | "rotl" | "rotr" => {
                let sb = rhs_big($case)?.lo as u8;
                let eb = FheUint8::encrypt(sb, $ck);
                match $op {
                    "shl" => vec![("enc,enc", dec(&ea << &eb)), ("enc,clear", dec(&ea << sb))],
                    "shr" => vec![("enc,enc", dec(&ea >> &eb)), ("enc,clear", dec(&ea >> sb))],
                    "rotl" => vec![("enc,enc", dec((&ea).rotate_left(&eb))), ("enc,clear", dec((&ea).rotate_left(sb)))],
                    _ => vec![("enc,enc", dec((&ea).rotate_right(&eb))), ("enc,clear", dec((&ea).rotate_right(sb)))],
                }
            }
            _ => {
                let b = rhs_big($case)?;
                let eb: $T = encrypt($case.rhs.as_ref().unwrap().bits, b, $ck).cast_to();
                let (sa, sb) = (<$S>::from_big($a), <$S>::from_big(b));
                let boolean = |r: FheBool| Big::from_bool(r.decrypt($ck));
                match $op {
                    "add" => vec![("enc,enc", dec(&ea + &eb)), ("enc,clear", dec(&ea + sb)), ("clear,enc", dec(sa + &eb))],
                    "sub" => vec![("enc,enc", dec(&ea - &eb)), ("enc,clear", dec(&ea - sb)), ("clear,enc", dec(sa - &eb))],
                    "and" => vec![("enc,enc", dec(&ea & &eb)), ("enc,clear", dec(&ea & sb)), ("clear,enc", dec(sa & &eb))],
                    "or" => vec![("enc,enc", dec(&ea | &eb)), ("enc,clear", dec(&ea | sb)), ("clear,enc", dec(sa | &eb))],
                    "xor" => vec![("enc,enc", dec(&ea ^ &eb)), ("enc,clear", dec(&ea ^ sb)), ("clear,enc", dec(sa ^ &eb))],
                    "min" => vec![
                        ("enc,enc", dec(FheMin::min(&ea, &eb))),
                        ("enc,clear", dec(FheMin::min(&ea, sb))),
                        ("clear,enc", dec(FheMin::min(&eb, sa))),
                    ],
                    "max" => vec![
                        ("enc,enc", dec(FheMax::max(&ea, &eb))),
                        ("enc,clear", dec(FheMax::max(&ea, sb))),
                        ("clear,enc", dec(FheMax::max(&eb, sa))),
                    ],
                    // Comparisons with the clear operand on the left are mirrored: a < b <=> b > a.
                    "eq" => vec![
                        ("enc,enc", boolean(FheEq::eq(&ea, &eb))),
                        ("enc,clear", boolean(FheEq::eq(&ea, sb))),
                        ("clear,enc", boolean(FheEq::eq(&eb, sa))),
                    ],
                    "ne" => vec![
                        ("enc,enc", boolean(FheEq::ne(&ea, &eb))),
                        ("enc,clear", boolean(FheEq::ne(&ea, sb))),
                        ("clear,enc", boolean(FheEq::ne(&eb, sa))),
                    ],
                    "lt" => vec![
                        ("enc,enc", boolean(FheOrd::lt(&ea, &eb))),
                        ("enc,clear", boolean(FheOrd::lt(&ea, sb))),
                        ("clear,enc", boolean(FheOrd::gt(&eb, sa))),
                    ],
                    "le" => vec![
                        ("enc,enc", boolean(FheOrd::le(&ea, &eb))),
                        ("enc,clear", boolean(FheOrd::le(&ea, sb))),
                        ("clear,enc", boolean(FheOrd::ge(&eb, sa))),
                    ],
                    "gt" => vec![
                        ("enc,enc", boolean(FheOrd::gt(&ea, &eb))),
                        ("enc,clear", boolean(FheOrd::gt(&ea, sb))),
                        ("clear,enc", boolean(FheOrd::lt(&eb, sa))),
                    ],
                    "ge" => vec![
                        ("enc,enc", boolean(FheOrd::ge(&ea, &eb))),
                        ("enc,clear", boolean(FheOrd::ge(&ea, sb))),
                        ("clear,enc", boolean(FheOrd::le(&eb, sa))),
                    ],
                    other => return Err(format!("unsupported op {other}")),
                }
            }
        };
        compare(got, $expected)
    }};
}

fn compare(got: Vec<(&str, Big)>, expected: Big) -> Result<(), String> {
    for (name, g) in got {
        if g != expected {
            return Err(format!("{name}: tfhe-rs got {g}, json says {expected}"));
        }
    }
    Ok(())
}

// ebool operands: not, eq/ne and the bitwise ops are defined on ebool in FHE.sol.
fn bool_check(op: &str, case: &Case, a: Big, expected: Big, ck: &ClientKey) -> Result<(), String> {
    let ea = FheBool::encrypt(a.lo != 0, ck);
    let dec = |r: FheBool| Big::from_bool(r.decrypt(ck));
    if op == "not" {
        return compare(vec![("enc", dec(!&ea))], expected);
    }
    let b = rhs_big(case)?;
    let eb = FheBool::encrypt(b.lo != 0, ck);
    let (sa, sb) = (a.lo != 0, b.lo != 0);
    let got = match op {
        "eq" => vec![
            ("enc,enc", dec(FheEq::eq(&ea, &eb))),
            ("enc,clear", dec(FheEq::eq(&ea, sb))),
            ("clear,enc", dec(FheEq::eq(&eb, sa))),
        ],
        "ne" => vec![
            ("enc,enc", dec(FheEq::ne(&ea, &eb))),
            ("enc,clear", dec(FheEq::ne(&ea, sb))),
            ("clear,enc", dec(FheEq::ne(&eb, sa))),
        ],
        "and" => vec![("enc,enc", dec(&ea & &eb)), ("enc,clear", dec(&ea & sb)), ("clear,enc", dec(sa & &eb))],
        "or" => vec![("enc,enc", dec(&ea | &eb)), ("enc,clear", dec(&ea | sb)), ("clear,enc", dec(sa | &eb))],
        "xor" => vec![("enc,enc", dec(&ea ^ &eb)), ("enc,clear", dec(&ea ^ sb)), ("clear,enc", dec(sa ^ &eb))],
        other => return Err(format!("{other} not defined on ebool")),
    };
    compare(got, expected)
}

fn fhe_check(op: &str, case: &Case, a: Big, expected: Big, ck: &ClientKey) -> Result<(), String> {
    // Operands are cast to the widest operand width, as FHE.sol does before dispatching.
    let width = case.lhs().bits.max(case.rhs.as_ref().map_or(0, |r| r.bits));
    match width {
        1 => bool_check(op, case, a, expected, ck),
        8 => fhe_check!(FheUint8, u8, u128, op, case, a, expected, ck),
        16 => fhe_check!(FheUint16, u16, u128, op, case, a, expected, ck),
        32 => fhe_check!(FheUint32, u32, u128, op, case, a, expected, ck),
        64 => fhe_check!(FheUint64, u64, u128, op, case, a, expected, ck),
        128 => fhe_check!(FheUint128, u128, u128, op, case, a, expected, ck),
        160 => fhe_check!(FheUint160, U256, U256, op, case, a, expected, ck),
        256 => fhe_check!(FheUint256, U256, U256, op, case, a, expected, ck),
        w => Err(format!("unsupported operand width {w}")),
    }
}

// sum, isin, muldiv: a collection operand, or three operands. The header's "operands" names the
// fields every case carries, and all of a case's operands share one width (the executor rejects
// mixed types for all three).
fn nary_operands(op: &str) -> Option<&'static [&'static str]> {
    Some(match op {
        "sum" => &["values"],
        "isin" => &["lhs", "values"],
        "muldiv" => &["lhs", "rhs", "divisor"],
        _ => return None,
    })
}

// FHEVMExecutor's FHE_COLLECTION_NARROW_MAX_SIZE (8..32 bits) and FHE_COLLECTION_WIDE_MAX_SIZE.
fn collection_max(bits: u32) -> usize {
    if bits <= 32 { 100 } else { 60 }
}

fn nary_widths(op: &str) -> &'static [u32] {
    match op {
        "sum" => &[8, 16, 32, 64, 128],
        "isin" => &[8, 16, 32, 64, 128, 160, 256],
        _ => &[8, 16, 32, 64],
    }
}

struct Nary {
    width: u32,
    lhs: Option<Big>,
    rhs: Option<Big>,
    divisor: Option<Big>,
    values: Vec<Big>,
}

// Structural checks first: which fields are present, one shared width, the executor's size cap and
// supported widths, and a non-zero divisor.
fn nary_shape(op: &str, case: &Case) -> Result<Nary, String> {
    let fields = nary_operands(op).unwrap();
    let present = |name: &str| match name {
        "lhs" => case.lhs.is_some(),
        "rhs" => case.rhs.is_some(),
        "divisor" => case.divisor.is_some(),
        _ => case.values.is_some(),
    };
    for name in ["lhs", "rhs", "divisor", "values"] {
        if present(name) != fields.contains(&name) {
            return Err(format!("{op}: field {name} must {}be present", if present(name) { "not " } else { "" }));
        }
    }
    // An empty collection carries no operand width, so a sum's width comes from its result.
    let width = match op {
        "sum" => case.result.bits,
        _ => case.lhs().bits,
    };
    if !nary_widths(op).contains(&width) {
        return Err(format!("{op}: unsupported width {width}"));
    }
    let singles = [&case.lhs, &case.rhs, &case.divisor];
    let all = singles.iter().filter_map(|o| o.as_ref()).chain(case.values.iter().flatten());
    if let Some(o) = all.clone().find(|o| o.bits != width) {
        return Err(format!("{op}: operand of {} bits in a {width}-bit case", o.bits));
    }
    let values: Vec<Big> = case.values.iter().flatten().map(Operand::parse).collect::<Result<_, _>>()?;
    if values.len() > collection_max(width) {
        return Err(format!("{op}: {} elements, the {width}-bit maximum is {}", values.len(), collection_max(width)));
    }
    let want_bits = if op == "isin" { 1 } else { width };
    if case.result.bits != want_bits {
        return Err(format!("result.bits {} != {want_bits}", case.result.bits));
    }
    let parse = |o: &Option<Operand>| o.as_ref().map(Operand::parse).transpose();
    let shape = Nary { width, lhs: parse(&case.lhs)?, rhs: parse(&case.rhs)?, divisor: parse(&case.divisor)?, values };
    if shape.divisor == Some(Big { lo: 0, hi: 0 }) {
        return Err("zero divisor".into());
    }
    Ok(shape)
}

// Clear reference. isin compares at any width; sum and muldiv stay at or under 128 bits, and a
// muldiv product of two 64-bit factors fits in a u128.
fn nary_clear(op: &str, s: &Nary) -> Big {
    // Only sum and muldiv use the mask, and both stop at 128 bits; isin reaches 256 and ignores it.
    let mask = if s.width >= 128 { u128::MAX } else { (1u128 << s.width) - 1 };
    match op {
        "sum" => s.values.iter().fold(0u128, |acc, v| acc.wrapping_add(v.lo)).to_big_masked(mask),
        "isin" => Big::from_bool(s.values.contains(&s.lhs.unwrap())),
        _ => ((s.lhs.unwrap().lo * s.rhs.unwrap().lo) / s.divisor.unwrap().lo).to_big_masked(mask),
    }
}

trait Masked {
    fn to_big_masked(self, mask: u128) -> Big;
}
impl Masked for u128 {
    fn to_big_masked(self, mask: u128) -> Big {
        Big { lo: self & mask, hi: 0 }
    }
}

// The same tfhe-rs calls the coprocessor makes (fhevm-engine-common/src/tfhe_ops.rs):
// sum = Iterator::sum, isin = FheUint::contains, muldiv = fused_mul_scalar_div for an encrypted
// second factor and fused_scalar_mul_scalar_div for a clear one. Empty collections go through tfhe-rs
// too: it returns a trivial zero for an empty sum and a trivial false for an empty contains.
macro_rules! nary_fhe {
    ($T:ty, $S:ty, $D:ty, $op:expr, $s:expr, $ck:expr) => {{
        let enc = |v: Big| -> $T { encrypt($s.width, v, $ck).cast_to() };
        let dec = |r: $T| -> Big { <$D as ToBig>::to_big(r.decrypt($ck)) };
        let vals: Vec<$T> = $s.values.iter().map(|v| enc(*v)).collect();
        match $op {
            "sum" => vec![("enc[]", dec(vals.iter().sum::<$T>()))],
            "isin" => {
                let r = <$T>::contains(&vals, &enc($s.lhs.unwrap()));
                vec![("enc,enc[]", Big::from_bool(r.decrypt($ck)))]
            }
            _ => {
                let (a, b, d) = ($s.lhs.unwrap(), $s.rhs.unwrap(), $s.divisor.unwrap());
                let (ea, eb) = (enc(a), enc(b));
                let (sb, sd) = (<$S>::from_big(b), <$S>::from_big(d));
                vec![
                    ("enc,enc,clear", dec((&ea).fused_mul_scalar_div(&eb, sd))),
                    ("enc,clear,clear", dec((&ea).fused_scalar_mul_scalar_div(sb, sd))),
                ]
            }
        }
    }};
}

// Per-type dispatch. Each arm names only the operators tfhe-rs and the executor support at that width.
fn nary_fhe(op: &str, s: &Nary, ck: &ClientKey) -> Result<Vec<(&'static str, Big)>, String> {
    Ok(match (s.width, op) {
        (8, _) => nary_fhe!(FheUint8, u8, u128, op, s, ck),
        (16, _) => nary_fhe!(FheUint16, u16, u128, op, s, ck),
        (32, _) => nary_fhe!(FheUint32, u32, u128, op, s, ck),
        (64, _) => nary_fhe!(FheUint64, u64, u128, op, s, ck),
        (128, "sum" | "isin") => nary_fhe!(FheUint128, u128, u128, op, s, ck),
        (160, "isin") => nary_fhe!(FheUint160, U256, U256, op, s, ck),
        (256, "isin") => nary_fhe!(FheUint256, U256, U256, op, s, ck),
        (w, _) => return Err(format!("{op}: no tfhe-rs dispatch for width {w}")),
    })
}

fn nary_case(op: &str, case: &Case, ck: Option<&ClientKey>) -> Result<(), String> {
    let shape = nary_shape(op, case)?;
    let expected = case.result.parse()?;
    // isin checks at every width; sum and muldiv never exceed 128 bits (nary_widths).
    let clear = nary_clear(op, &shape);
    if clear != expected {
        return Err(format!("clear: got {clear}, json says {expected}"));
    }
    match ck {
        Some(ck) => compare(nary_fhe(op, &shape, ck)?, expected),
        None => Ok(()),
    }
}

fn fmt_duration(d: Duration) -> String {
    let s = d.as_secs();
    format!("{}m{:02}s", s / 60, s % 60)
}

struct Progress {
    total: usize,
    done: usize,
    start: Instant,
    last: Instant,
}

impl Progress {
    fn new(total: usize) -> Self {
        let now = Instant::now();
        Progress { total, done: 0, start: now, last: now }
    }

    fn tick(&mut self) {
        self.done += 1;
        let done = self.done;
        let now = Instant::now();
        if done != self.total && now.duration_since(self.last) < Duration::from_secs(5) {
            return;
        }
        self.last = now;
        let elapsed = now.duration_since(self.start);
        let eta = elapsed.mul_f64((self.total - done) as f64 / done as f64);
        note!(
            "[{:5.1}%] {}/{}  elapsed {}  eta {}",
            100.0 * done as f64 / self.total as f64,
            done,
            self.total,
            fmt_duration(elapsed),
            fmt_duration(eta)
        );
    }
}

#[derive(Deserialize)]
struct Index {
    op: String,
    #[serde(default = "two")]
    arity: u32,
    semantics: String,
    #[serde(default)]
    operands: Option<Vec<String>>,
    parts: Vec<Part>,
}

#[derive(Deserialize)]
struct Part {
    file: String,
}

#[derive(Deserialize, Clone, PartialEq)]
struct Verified {
    #[serde(rename = "tfhe-rs")]
    tfhe_rs: String,
    date: String,
}

struct LoadedPart {
    path: PathBuf,
    index: Option<PathBuf>,
    vectors: Vectors,
}

fn parse_file(path: &Path) -> Result<Vectors, String> {
    let text = fs::read_to_string(path).map_err(|e| format!("{}: {e}", path.display()))?;
    serde_json::from_str(&text).map_err(|e| format!("{}: {e}", path.display()))
}

// A single part file, an operator directory (index.json + parts), or a root directory
// holding operator directories. Each returned set shares one op and one semantics.
fn load_sets(path: &Path) -> Result<Vec<Vec<LoadedPart>>, String> {
    if path.is_file() || path.join("index.json").is_file() {
        return Ok(vec![load(path)?]);
    }
    let mut dirs: Vec<PathBuf> = fs::read_dir(path)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok().map(|e| e.path()))
        .filter(|p| p.join("index.json").is_file())
        .collect();
    dirs.sort();
    if dirs.is_empty() {
        return Err("no index.json here and no operator directories below".into());
    }
    dirs.iter().map(|d| load(d)).collect()
}

fn load(path: &Path) -> Result<Vec<LoadedPart>, String> {
    if path.is_file() {
        // A lone part still updates its entry in a sibling index.json when there is one.
        let index = path.parent().map(|d| d.join("index.json")).filter(|i| i.is_file());
        return Ok(vec![LoadedPart { path: path.to_path_buf(), index, vectors: parse_file(path)? }]);
    }
    let index_path = path.join("index.json");
    let text = fs::read_to_string(&index_path).map_err(|e| format!("index.json: {e}"))?;
    let index: Index = serde_json::from_str(&text).map_err(|e| format!("index.json: {e}"))?;
    let mut parts = Vec::new();
    for part in &index.parts {
        let part_path = path.join(&part.file);
        let v = parse_file(&part_path)?;
        if v.op != index.op || v.semantics != index.semantics || v.arity != index.arity || v.operands != index.operands {
            return Err(format!("{}: header differs from index.json", part.file));
        }
        parts.push(LoadedPart { path: part_path, index: Some(index_path.clone()), vectors: v });
    }
    Ok(parts)
}

fn today() -> String {
    // Days since epoch to civil date (Howard Hinnant's algorithm).
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let z = (secs / 86_400) as i64 + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = yoe + era * 400 + i64::from(m <= 2);
    format!("{y:04}-{m:02}-{d:02}")
}

fn render_verified(list: &[Verified]) -> String {
    let items: Vec<String> = list
        .iter()
        .map(|v| format!("{{\"tfhe-rs\": \"{}\", \"date\": \"{}\"}}", v.tfhe_rs, v.date))
        .collect();
    format!("[{}]", items.join(", "))
}

// Header lines are one key per line, so the record is swapped in textually and the
// generator's formatting is preserved byte for byte elsewhere.
fn record_verified(part: &LoadedPart) -> Result<(), String> {
    let mut list = part.vectors.verified.clone();
    let entry = Verified { tfhe_rs: env!("TFHE_VERSION").to_string(), date: today() };
    match list.iter_mut().find(|v| v.tfhe_rs == entry.tfhe_rs) {
        Some(v) => *v = entry,
        None => list.push(entry),
    }
    let rendered = render_verified(&list);

    let text = fs::read_to_string(&part.path).map_err(|e| e.to_string())?;
    let mut replaced = false;
    let updated: Vec<String> = text
        .lines()
        .map(|l| {
            if l.starts_with("  \"verified\": ") {
                replaced = true;
                format!("  \"verified\": {rendered},")
            } else {
                l.to_string()
            }
        })
        .collect();
    if !replaced {
        return Err(format!("{}: no \"verified\" header line", part.path.display()));
    }
    fs::write(&part.path, updated.join("\n") + "\n").map_err(|e| e.to_string())?;

    if let Some(index) = &part.index {
        let file = part.path.file_name().unwrap().to_string_lossy().to_string();
        let needle = format!("\"file\": \"{file}\"");
        let text = fs::read_to_string(index).map_err(|e| e.to_string())?;
        let updated: Vec<String> = text
            .lines()
            .map(|l| match (l.contains(&needle), l.find("\"verified\": "), l.rfind(" }")) {
                (true, Some(from), Some(to)) if from < to => {
                    format!("{}\"verified\": {rendered}{}", &l[..from], &l[to..])
                }
                _ => l.to_string(),
            })
            .collect();
        fs::write(index, updated.join("\n") + "\n").map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn run_part(op: &str, arity: u32, vectors: &Vectors, ck: Option<&ClientKey>, progress: &mut Progress) -> usize {
    let mut failures = 0;
    for case in &vectors.cases {
        let started = Instant::now();
        if ck.is_some() {
            *CURRENT.lock().unwrap() = Some((case.id.clone(), started));
        }
        let outcome = (|| -> Result<(), String> {
            if nary_operands(op).is_some() {
                return nary_case(op, case, ck);
            }
            if case.divisor.is_some() || case.values.is_some() {
                return Err(format!("{op} takes no divisor or values"));
            }
            let a = case.lhs.as_ref().ok_or("missing lhs")?.parse()?;
            let expected = case.result.parse()?;
            let b = match (&case.rhs, arity) {
                (Some(r), 2) => Some(r.parse()?),
                (None, 1) => None,
                _ => return Err("rhs presence does not match arity".into()),
            };
            if matches!(op, "div" | "rem") && b == Some(Big { lo: 0, hi: 0 }) {
                return Err("zero divisor".into());
            }
            let want_bits = expected_result_bits(op, case);
            if case.result.bits != want_bits {
                return Err(format!("result.bits {} != {want_bits}", case.result.bits));
            }
            let width = case.lhs().bits.max(case.rhs.as_ref().map_or(0, |r| r.bits));
            if width <= 128 {
                let clear = clear_op(op, a.lo, b.map_or(0, |b| b.lo), width).to_big();
                if clear != expected {
                    return Err(format!("clear: got {clear}, json says {expected}"));
                }
            }
            match ck {
                Some(ck) => fhe_check(op, case, a, expected, ck),
                None => Ok(()),
            }
        })();
        let took = if ck.is_some() {
            *CURRENT.lock().unwrap() = None;
            format!("  ({:.1}s)", started.elapsed().as_secs_f64())
        } else {
            String::new()
        };
        match outcome {
            Ok(()) => out!("ok    {}{took}", case.id),
            Err(e) => {
                failures += 1;
                out!("FAIL  {}: {e}{took}", case.id);
            }
        }
        if ck.is_some() {
            progress.tick();
        }
    }
    failures
}

fn validate(set: &[LoadedPart]) -> Result<(String, u32), String> {
    let first = set.first().ok_or("empty set")?;
    let (op, arity) = (first.vectors.op.clone(), first.vectors.arity);
    for p in set {
        if p.vectors.encoding != "hex-string" {
            return Err(format!("{}: unsupported encoding {:?}", p.path.display(), p.vectors.encoding));
        }
    }
    let semantics = expected_semantics(&op).ok_or_else(|| format!("unsupported op {op}"))?;
    if first.vectors.semantics != semantics {
        return Err(format!(
            "{op}: file declares semantics {:?}, this build of tfhe-rs implements {:?}",
            first.vectors.semantics, semantics
        ));
    }
    let expected_operands = nary_operands(&op);
    let expected_arity = match expected_operands {
        Some(fields) => fields.len() as u32,
        None if matches!(op.as_str(), "not" | "neg") => 1,
        None => 2,
    };
    if arity != expected_arity {
        return Err(format!("{op}: arity {arity} declared, {expected_arity} expected"));
    }
    let declared: Option<Vec<&str>> = first.vectors.operands.as_ref().map(|v| v.iter().map(String::as_str).collect());
    if declared.as_deref() != expected_operands {
        return Err(format!("{op}: operands {declared:?} declared, {expected_operands:?} expected"));
    }
    Ok((op, arity))
}

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let no_fhe = args.iter().any(|a| a == "--no-fhe");
    let no_record = args.iter().any(|a| a == "--no-record");
    let force = args.iter().any(|a| a == "--force");
    let log_arg = args.iter().find_map(|a| a.strip_prefix("--log="));
    let Some(path) = args.iter().find(|a| !a.starts_with("--")) else {
        eprintln!(
            "usage: tfhe-vectors-check [--no-fhe] [--no-record] [--force] [--log=FILE] <data-root | op-dir | part.json>"
        );
        return ExitCode::from(2);
    };
    RUN_START.get_or_init(Instant::now);
    // An FHE run always logs, to ./tfhe-vectors-check.log unless --log=FILE says otherwise. A --no-fhe
    // run takes under a second and logs only when asked.
    if let Some(log_path) = log_arg.or((!no_fhe).then_some("tfhe-vectors-check.log")) {
        match fs::OpenOptions::new().create(true).append(true).open(log_path) {
            Ok(file) => {
                let _ = LOG.set(Mutex::new(file));
                log_line(&format!("==== {} tfhe-vectors-check {}", today(), args.join(" ")));
                eprintln!("progress log: {log_path}  (follow with: tail -f {log_path})");
            }
            Err(e) => eprintln!("could not open progress log {log_path}: {e}"),
        }
    }
    note!("tfhe-rs {} (shl/shr: {SHIFT_SEMANTICS})", env!("TFHE_VERSION"));

    let sets = match load_sets(Path::new(path)) {
        Ok(v) => v,
        Err(e) => {
            note!("{path}: {e}");
            return ExitCode::from(2);
        }
    };

    // Validate everything up front so a mismatched set is reported before key generation.
    let mut runnable = Vec::new();
    let mut skipped = 0;
    for set in &sets {
        match validate(set) {
            Ok((op, arity)) => runnable.push((op, arity, set)),
            Err(e) => {
                skipped += 1;
                note!("skipping: {e}");
            }
        }
    }
    if runnable.is_empty() {
        note!("nothing to run");
        return ExitCode::from(2);
    }

    // Under FHE, a part already confirmed by this exact tfhe-rs release is skipped unless --force.
    // The generator clears the record whenever a part's cases change, so the record is trustworthy.
    let already_verified = |p: &LoadedPart| {
        !no_fhe && !force && p.vectors.verified.iter().any(|v| v.tfhe_rs == env!("TFHE_VERSION"))
    };
    let total: usize = runnable
        .iter()
        .flat_map(|(_, _, set)| set.iter())
        .filter(|p| !already_verified(p))
        .map(|p| p.vectors.cases.len())
        .sum();

    let ck = if no_fhe || total == 0 {
        None
    } else {
        note!("generating keys... ({total} cases to check)");
        let (ck, sk) = generate_keys(ConfigBuilder::default().build());
        set_server_key(sk);
        start_heartbeat();
        Some(ck)
    };

    let mut progress = Progress::new(total);
    let mut failures = 0;
    let mut reused = 0;
    for (op, arity, set) in &runnable {
        let mut op_failures = 0;
        let mut op_checked = 0;
        for part in set.iter() {
            if already_verified(part) {
                reused += 1;
                out!("skip  {} already verified with tfhe-rs {}", part.path.display(), env!("TFHE_VERSION"));
                continue;
            }
            op_checked += part.vectors.cases.len();
            if ck.is_some() {
                note!("part  {}  ({} cases)", part.path.display(), part.vectors.cases.len());
            }
            let part_failures = run_part(op, *arity, &part.vectors, ck.as_ref(), &mut progress);
            op_failures += part_failures;
            if ck.is_some() && part_failures == 0 && !no_record {
                match record_verified(part) {
                    Ok(()) => note!("recorded tfhe-rs {} in {}", env!("TFHE_VERSION"), part.path.display()),
                    Err(e) => note!("could not record verification: {e}"),
                }
            }
        }
        out!("{op}: {op_checked} cases checked, {op_failures} failed");
        failures += op_failures;
    }

    if runnable.len() > 1 || skipped > 0 || reused > 0 {
        out!(
            "total: {} sets, {total} cases checked, {failures} failed, {skipped} sets skipped, {reused} parts already verified",
            runnable.len()
        );
    }
    if failures == 0 { ExitCode::SUCCESS } else { ExitCode::FAILURE }
}
