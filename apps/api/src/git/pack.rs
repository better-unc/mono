use sha1::{Sha1, Digest};
use std::collections::HashSet;
use crate::git::objects::R2GitStore;

pub async fn handle_upload_pack(store: &R2GitStore, body: &[u8]) -> Vec<u8> {
    let lines = parse_pkt_lines(body);
    let mut wants: Vec<String> = Vec::new();
    let mut haves: Vec<String> = Vec::new();

    for line in lines {
        if line.starts_with("want ") {
            wants.push(line[5..45].to_string());
        } else if line.starts_with("have ") {
            haves.push(line[5..45].to_string());
        }
    }

    if wants.is_empty() {
        return b"0000".to_vec();
    }

    let all_oids = collect_reachable_objects(store, &wants).await;
    let have_set: HashSet<_> = haves.into_iter().collect();
    let needed_oids: Vec<_> = all_oids.into_iter().filter(|oid| !have_set.contains(oid)).collect();

    if needed_oids.is_empty() {
        return b"0008NAK\n0000".to_vec();
    }

    let mut response = b"0008NAK\n".to_vec();
    
    if let Some(packfile) = create_packfile(store, &needed_oids).await {
        response.extend(packfile);
    }

    response
}

pub async fn handle_receive_pack(store: &R2GitStore, body: &[u8]) -> (Vec<u8>, Vec<(String, String, String)>) {
    let pack_signature = [0x50, 0x41, 0x43, 0x4b]; // "PACK"
    let mut pack_start = None;

    for i in 0..body.len().saturating_sub(3) {
        if body[i..i+4] == pack_signature {
            pack_start = Some(i);
            break;
        }
    }

    let pack_start = match pack_start {
        Some(s) => s,
        None => return (b"000eunpack ok\n0000".to_vec(), Vec::new()),
    };

    let command_section = &body[..pack_start];
    let pack_data = &body[pack_start..];

    let lines = parse_pkt_lines(command_section);
    let mut updates: Vec<(String, String, String)> = Vec::new();

    for line in lines {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 3 && parts[0].len() == 40 && parts[1].len() == 40 {
            let ref_name = parts[2].split('\0').next().unwrap_or(parts[2]);
            updates.push((parts[0].to_string(), parts[1].to_string(), ref_name.to_string()));
        }
    }

    let pack_hash = {
        let mut hasher = Sha1::new();
        hasher.update(pack_data);
        hex::encode(hasher.finalize())
    };

    let pack_path = format!("{}/objects/pack/pack-{}.pack", store.prefix, pack_hash);
    if let Err(e) = store.s3.put_object(&pack_path, pack_data.to_vec()).await {
        tracing::error!("Failed to write pack file: {:?}", e);
        return (format!("0019ng unpack error {}\n0000", e).into_bytes(), updates);
    }

    if let Some(idx_data) = create_pack_index(pack_data) {
        let idx_path = format!("{}/objects/pack/pack-{}.idx", store.prefix, pack_hash);
        let _ = store.s3.put_object(&idx_path, idx_data).await;
    }

    for (old_oid, new_oid, ref_name) in &updates {
        let ref_path = if ref_name.starts_with("refs/") {
            ref_name.clone()
        } else {
            format!("refs/heads/{}", ref_name)
        };

        if new_oid == &"0".repeat(40) {
            let _ = store.s3.delete_object(&format!("{}/{}", store.prefix, ref_path)).await;
        } else {
            let _ = store.write_ref(&ref_path, new_oid).await;
        }

        tracing::debug!("Updated ref {} from {} to {}", ref_path, old_oid, new_oid);
    }

    let mut response = String::new();
    response.push_str(&format!("{:04x}unpack ok\n", "unpack ok\n".len() + 4));
    for (_, _, ref_name) in &updates {
        let line = format!("ok {}\n", ref_name);
        response.push_str(&format!("{:04x}{}", line.len() + 4, line));
    }
    response.push_str("0000");

    (response.into_bytes(), updates)
}

async fn collect_reachable_objects(store: &R2GitStore, oids: &[String]) -> Vec<String> {
    let mut visited = HashSet::new();
    let mut to_visit: Vec<String> = oids.to_vec();

    while let Some(oid) = to_visit.pop() {
        if visited.contains(&oid) {
            continue;
        }
        visited.insert(oid.clone());

        if let Some(data) = store.get_object(&oid).await {
            if let Some((obj_type, content)) = parse_git_object(&data) {
                match obj_type.as_str() {
                    "commit" => {
                        if let Some(tree_oid) = extract_tree_from_commit(&content) {
                            if !visited.contains(&tree_oid) {
                                to_visit.push(tree_oid);
                            }
                        }
                        for parent in extract_parents_from_commit(&content) {
                            if !visited.contains(&parent) {
                                to_visit.push(parent);
                            }
                        }
                    }
                    "tree" => {
                        for (_, oid, _) in parse_tree_entries(&content) {
                            if !visited.contains(&oid) {
                                to_visit.push(oid);
                            }
                        }
                    }
                    _ => {}
                }
            }
        }
    }

    visited.into_iter().collect()
}

async fn create_packfile(store: &R2GitStore, oids: &[String]) -> Option<Vec<u8>> {
    let mut objects: Vec<(u8, Vec<u8>)> = Vec::new();

    for oid in oids {
        if let Some(data) = store.get_object(oid).await {
            if let Some((obj_type, content)) = parse_git_object(&data) {
                let type_num = match obj_type.as_str() {
                    "commit" => 1,
                    "tree" => 2,
                    "blob" => 3,
                    "tag" => 4,
                    _ => continue,
                };
                objects.push((type_num, content));
            }
        }
    }

    if objects.is_empty() {
        return None;
    }

    let mut pack = Vec::new();
    
    pack.extend(b"PACK");
    pack.extend(&2u32.to_be_bytes());
    pack.extend(&(objects.len() as u32).to_be_bytes());

    for (obj_type, data) in objects {
        let size = data.len();
        let mut header: Vec<u8> = Vec::new();
        
        let mut c = ((obj_type << 4) | ((size & 0x0f) as u8)) as u8;
        let mut s = size >> 4;
        
        if s > 0 {
            c |= 0x80;
        }
        header.push(c);
        
        while s > 0 {
            let mut c = (s & 0x7f) as u8;
            s >>= 7;
            if s > 0 {
                c |= 0x80;
            }
            header.push(c);
        }
        
        pack.extend(header);
        
        let compressed = compress_zlib(&data);
        pack.extend(compressed);
    }

    let mut hasher = Sha1::new();
    hasher.update(&pack);
    let checksum = hasher.finalize();
    pack.extend(&checksum[..]);

    Some(pack)
}

fn parse_pkt_lines(data: &[u8]) -> Vec<String> {
    let mut lines = Vec::new();
    let mut offset = 0;

    while offset < data.len() {
        if offset + 4 > data.len() {
            break;
        }

        let len_hex = std::str::from_utf8(&data[offset..offset + 4]).unwrap_or("0000");
        let len = u16::from_str_radix(len_hex, 16).unwrap_or(0) as usize;

        if len == 0 {
            offset += 4;
            continue;
        }

        if len < 4 {
            break;
        }

        if offset + len > data.len() {
            break;
        }

        let line_data = &data[offset + 4..offset + len];
        if let Ok(line) = std::str::from_utf8(line_data) {
            lines.push(line.trim().to_string());
        }
        offset += len;
    }

    lines
}

fn parse_git_object(data: &[u8]) -> Option<(String, Vec<u8>)> {
    let decompressed = decompress_zlib(data)?;
    
    let null_pos = decompressed.iter().position(|&b| b == 0)?;
    let header = std::str::from_utf8(&decompressed[..null_pos]).ok()?;
    
    let parts: Vec<&str> = header.split(' ').collect();
    if parts.len() != 2 {
        return None;
    }
    
    let obj_type = parts[0].to_string();
    let content = decompressed[null_pos + 1..].to_vec();
    
    Some((obj_type, content))
}

fn extract_tree_from_commit(content: &[u8]) -> Option<String> {
    let text = std::str::from_utf8(content).ok()?;
    for line in text.lines() {
        if line.starts_with("tree ") {
            return Some(line[5..].to_string());
        }
    }
    None
}

fn extract_parents_from_commit(content: &[u8]) -> Vec<String> {
    let mut parents = Vec::new();
    if let Ok(text) = std::str::from_utf8(content) {
        for line in text.lines() {
            if line.starts_with("parent ") {
                parents.push(line[7..].to_string());
            }
        }
    }
    parents
}

fn parse_tree_entries(content: &[u8]) -> Vec<(String, String, String)> {
    let mut entries = Vec::new();
    let mut pos = 0;

    while pos < content.len() {
        let null_pos = content[pos..].iter().position(|&b| b == 0);
        let null_pos = match null_pos {
            Some(p) => pos + p,
            None => break,
        };

        let header = std::str::from_utf8(&content[pos..null_pos]).unwrap_or("");
        let parts: Vec<&str> = header.splitn(2, ' ').collect();
        
        if parts.len() != 2 {
            break;
        }

        let mode = parts[0].to_string();
        let name = parts[1].to_string();

        if null_pos + 21 > content.len() {
            break;
        }

        let oid = hex::encode(&content[null_pos + 1..null_pos + 21]);
        entries.push((mode, oid, name));
        pos = null_pos + 21;
    }

    entries
}

fn decompress_zlib(data: &[u8]) -> Option<Vec<u8>> {
    use std::io::Read;
    let mut decoder = flate2::read::ZlibDecoder::new(data);
    let mut result = Vec::new();
    decoder.read_to_end(&mut result).ok()?;
    Some(result)
}

fn compress_zlib(data: &[u8]) -> Vec<u8> {
    use std::io::Write;
    let mut encoder = flate2::write::ZlibEncoder::new(Vec::new(), flate2::Compression::default());
    encoder.write_all(data).unwrap();
    encoder.finish().unwrap()
}

fn create_pack_index(pack_data: &[u8]) -> Option<Vec<u8>> {
    if pack_data.len() < 12 {
        return None;
    }

    let mut idx = Vec::new();
    
    idx.extend(&[0xff, 0x74, 0x4f, 0x63]);
    idx.extend(&2u32.to_be_bytes());

    idx.extend(vec![0u8; 256 * 4]);

    let mut hasher = Sha1::new();
    hasher.update(pack_data);
    let pack_checksum = hasher.finalize();
    
    let mut idx_hasher = Sha1::new();
    idx_hasher.update(&idx);
    idx.extend(&pack_checksum[..]);
    idx_hasher.update(&pack_checksum[..]);
    let idx_checksum = idx_hasher.finalize();
    idx.extend(&idx_checksum[..]);

    Some(idx)
}
