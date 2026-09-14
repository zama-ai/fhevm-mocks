use std::fmt;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::ExitCode;
use std::time::{Duration, Instant};

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
    verified: Vec<Verified>,
    cases: Vec<Case>,
}

fn two() -> u32 {
    2
}

#[derive(Deserialize)]
struct Case {
    id: String,
    lhs: Operand,
    rhs: Option<Operand>,
    result: Operand,
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
        _ => return None,
    })
}

fn expected_result_bits(op: &str, case: &Case) -> u32 {
    match op {
        "eq" | "ne" | "lt" | "le" | "gt" | "ge" => 1,
        "not" | "neg" => case.lhs.bits,
        _ => case.lhs.bits.max(case.rhs.as_ref().map_or(0, |r| r.bits)),
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
        let ea: $T = encrypt($case.lhs.bits, $a, $ck).cast_to();
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
    let width = case.lhs.bits.max(case.rhs.as_ref().map_or(0, |r| r.bits));
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
        eprintln!(
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
        if v.op != index.op || v.semantics != index.semantics || v.arity != index.arity {
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
        let outcome = (|| -> Result<(), String> {
            let a = case.lhs.parse()?;
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
            let width = case.lhs.bits.max(case.rhs.as_ref().map_or(0, |r| r.bits));
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
        match outcome {
            Ok(()) => println!("ok    {}", case.id),
            Err(e) => {
                failures += 1;
                println!("FAIL  {}: {e}", case.id);
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
    let expected_arity = if matches!(op.as_str(), "not" | "neg") { 1 } else { 2 };
    if arity != expected_arity {
        return Err(format!("{op}: arity {arity} declared, {expected_arity} expected"));
    }
    Ok((op, arity))
}

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let no_fhe = args.iter().any(|a| a == "--no-fhe");
    let no_record = args.iter().any(|a| a == "--no-record");
    let force = args.iter().any(|a| a == "--force");
    let Some(path) = args.iter().find(|a| !a.starts_with("--")) else {
        eprintln!("usage: tfhe-vectors-check [--no-fhe] [--no-record] [--force] <data-root | op-dir | part.json>");
        return ExitCode::from(2);
    };
    eprintln!("tfhe-rs {} (shl/shr: {SHIFT_SEMANTICS})", env!("TFHE_VERSION"));

    let sets = match load_sets(Path::new(path)) {
        Ok(v) => v,
        Err(e) => {
            eprintln!("{path}: {e}");
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
                eprintln!("skipping: {e}");
            }
        }
    }
    if runnable.is_empty() {
        eprintln!("nothing to run");
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
        eprintln!("generating keys...");
        let (ck, sk) = generate_keys(ConfigBuilder::default().build());
        set_server_key(sk);
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
                println!("skip  {} already verified with tfhe-rs {}", part.path.display(), env!("TFHE_VERSION"));
                continue;
            }
            op_checked += part.vectors.cases.len();
            let part_failures = run_part(op, *arity, &part.vectors, ck.as_ref(), &mut progress);
            op_failures += part_failures;
            if ck.is_some() && part_failures == 0 && !no_record {
                match record_verified(part) {
                    Ok(()) => eprintln!("recorded tfhe-rs {} in {}", env!("TFHE_VERSION"), part.path.display()),
                    Err(e) => eprintln!("could not record verification: {e}"),
                }
            }
        }
        println!("{op}: {op_checked} cases checked, {op_failures} failed");
        failures += op_failures;
    }

    if runnable.len() > 1 || skipped > 0 || reused > 0 {
        println!(
            "total: {} sets, {total} cases checked, {failures} failed, {skipped} sets skipped, {reused} parts already verified",
            runnable.len()
        );
    }
    if failures == 0 { ExitCode::SUCCESS } else { ExitCode::FAILURE }
}
