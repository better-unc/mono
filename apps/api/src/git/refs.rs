use crate::git::objects::R2GitStore;

pub async fn get_refs_advertisement(store: &R2GitStore, service: &str) -> Vec<u8> {
    let capabilities = if service == "git-upload-pack" {
        vec!["ofs-delta", "shallow", "no-progress", "include-tag", "symref=HEAD:refs/heads/main"]
    } else {
        vec!["report-status", "delete-refs", "ofs-delta"]
    };

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

    packets
}
