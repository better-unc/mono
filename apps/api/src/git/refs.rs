use crate::git::objects::S3GitStore;
use dashmap::DashMap;
use std::sync::OnceLock;
use std::time::{Duration, Instant};

static INFO_REFS_CACHE: OnceLock<DashMap<String, (Vec<u8>, Instant)>> = OnceLock::new();

fn info_refs_cache_ttl() -> Duration {
    let ttl_ms = std::env::var("GITBRUV_INFO_REFS_CACHE_TTL_MS")
        .ok()
        .and_then(|v| v.parse::<u64>().ok())
        .unwrap_or(2000);
    Duration::from_millis(ttl_ms)
}

fn info_refs_cache() -> &'static DashMap<String, (Vec<u8>, Instant)> {
    INFO_REFS_CACHE.get_or_init(DashMap::new)
}

pub async fn get_refs_advertisement(store: &S3GitStore, service: &str) -> Vec<u8> {
    let overall_start = Instant::now();
    let capabilities = if service == "git-upload-pack" {
        vec!["ofs-delta", "shallow", "no-progress", "include-tag", "symref=HEAD:refs/heads/main"]
    } else {
        vec!["report-status", "delete-refs", "ofs-delta"]
    };

    let ttl = info_refs_cache_ttl();
    let cache_key = format!("{}|{}", store.prefix, service);
    if ttl.as_millis() > 0 {
        let now = Instant::now();
        let cache = info_refs_cache();
        if let Some(entry) = cache.get(&cache_key) {
            if now.duration_since(entry.value().1) < ttl {
                tracing::info!("info_refs_cache_hit service={} elapsed_ms={}", service, overall_start.elapsed().as_millis());
                return entry.value().0.clone();
            }
            cache.remove(&cache_key);
        }
    }

    let mut refs: Vec<(String, String)> = Vec::new();

    let branches = store.list_refs("refs/heads").await;
    for (name, oid) in branches {
        refs.push((name, oid));
    }

    let tags = store.list_refs("refs/tags").await;
    for (name, oid) in tags {
        refs.push((name, oid));
    }

    let head = store.resolve_ref("HEAD").await;

    let mut lines: Vec<String> = Vec::new();

    if refs.is_empty() {
        let zero_id = "0".repeat(40);
        let caps_line = format!("{} capabilities^{}\0{}\n", zero_id, "{}", capabilities.join(" "));
        lines.push(caps_line);
    } else {
        let first_ref = if let Some(ref h) = head {
            ("HEAD".to_string(), h.clone())
        } else {
            refs[0].clone()
        };

        let caps_line = format!("{} {}\0{}\n", first_ref.1, first_ref.0, capabilities.join(" "));
        lines.push(caps_line);

        for (name, oid) in &refs {
            if *name != first_ref.0 || head.is_none() {
                lines.push(format!("{} {}\n", oid, name));
            }
        }
    }

    let mut packets: Vec<u8> = Vec::new();
    for line in lines {
        let len = line.len() + 4;
        let len_hex = format!("{:04x}", len);
        packets.extend(len_hex.as_bytes());
        packets.extend(line.as_bytes());
    }
    packets.extend(b"0000");

    if ttl.as_millis() > 0 {
        let cache = info_refs_cache();
        cache.insert(cache_key, (packets.clone(), Instant::now()));
        if cache.len() > 1024 {
            cache.clear();
        }
    }

    tracing::info!("info_refs_build service={} refs={} elapsed_ms={}", service, refs.len(), overall_start.elapsed().as_millis());
    packets
}
