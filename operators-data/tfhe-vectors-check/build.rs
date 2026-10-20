use std::fs;
use std::path::Path;

// Expose the resolved tfhe-rs version so verification records name the exact release.
fn main() {
    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap();
    let lock = fs::read_to_string(Path::new(&manifest_dir).join("Cargo.lock")).unwrap_or_default();
    let mut lines = lock.lines();
    let mut version = "unknown".to_string();
    while let Some(line) = lines.next() {
        if line.trim() == "name = \"tfhe\"" {
            if let Some(v) = lines.next().and_then(|l| l.trim().strip_prefix("version = ")) {
                version = v.trim_matches('"').to_string();
            }
            break;
        }
    }
    println!("cargo:rustc-env=TFHE_VERSION={version}");
    println!("cargo:rerun-if-changed=Cargo.lock");
}
