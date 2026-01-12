use std::collections::HashMap;
use std::io::Read;
use crate::s3::S3Client;

pub struct R2GitStore {
    pub s3: S3Client,
    pub prefix: String,
    object_cache: tokio::sync::RwLock<HashMap<String, Vec<u8>>>,
    pack_list_cache: tokio::sync::RwLock<Option<Vec<String>>>,
}

impl R2GitStore {
    pub fn new(s3: S3Client, prefix: String) -> Self {
        Self {
            s3,
            prefix,
            object_cache: tokio::sync::RwLock::new(HashMap::new()),
            pack_list_cache: tokio::sync::RwLock::new(None),
        }
    }

    fn object_path(&self, oid: &str) -> String {
        format!("{}/objects/{}/{}", self.prefix, &oid[..2], &oid[2..])
    }

    pub async fn get_object(&self, oid: &str) -> Option<Vec<u8>> {
        {
            let cache = self.object_cache.read().await;
            if let Some(data) = cache.get(oid) {
                tracing::debug!("Cache hit for object {}", oid);
                return Some(data.clone());
            }
        }

        let path = self.object_path(oid);
        tracing::debug!("Trying loose object at: {}", path);
        if let Some(data) = self.s3.get_object(&path).await {
            tracing::debug!("Found loose object {} ({} bytes)", oid, data.len());
            let mut cache = self.object_cache.write().await;
            cache.insert(oid.to_string(), data.clone());
            return Some(data);
        }

        tracing::debug!("Trying pack files for object {}", oid);
        if let Some(obj) = self.get_from_pack(oid).await {
            tracing::debug!("Found object {} in pack ({} bytes)", oid, obj.len());
            let mut cache = self.object_cache.write().await;
            cache.insert(oid.to_string(), obj.clone());
            return Some(obj);
        }

        tracing::warn!("Object {} not found", oid);
        None
    }

    pub async fn put_object(&self, oid: &str, data: Vec<u8>) -> Result<(), aws_sdk_s3::Error> {
        let path = self.object_path(oid);
        self.s3.put_object(&path, data.clone()).await?;
        
        let mut cache = self.object_cache.write().await;
        cache.insert(oid.to_string(), data);
        
        Ok(())
    }

    async fn get_pack_idx_files(&self) -> Vec<String> {
        {
            let cache = self.pack_list_cache.read().await;
            if let Some(ref list) = *cache {
                return list.clone();
            }
        }

        let pack_dir = format!("{}/objects/pack", self.prefix);
        let pack_files = self.s3.list_objects(&pack_dir).await;
        
        let idx_files: Vec<String> = pack_files
            .into_iter()
            .filter(|f| f.ends_with(".idx"))
            .collect();
        
        tracing::debug!("Found {} pack idx files", idx_files.len());
        
        let mut cache = self.pack_list_cache.write().await;
        *cache = Some(idx_files.clone());
        
        idx_files
    }

    async fn get_from_pack(&self, oid: &str) -> Option<Vec<u8>> {
        let target_bytes = hex::decode(oid).ok()?;
        let idx_files = self.get_pack_idx_files().await;
        
        for idx_path in &idx_files {
            let idx_data = match self.s3.get_object(idx_path).await {
                Some(data) => data,
                None => continue,
            };
            
            if let Some(offset) = find_object_in_index(&idx_data, &target_bytes) {
                tracing::info!("Found {} in index {} at offset {}", oid, idx_path, offset);
                let pack_path = idx_path.replace(".idx", ".pack");
                let pack_data = match self.s3.get_object(&pack_path).await {
                    Some(data) => {
                        tracing::info!("Loaded pack {} ({} bytes)", pack_path, data.len());
                        data
                    },
                    None => {
                        tracing::warn!("Failed to load pack {}", pack_path);
                        continue;
                    }
                };
                
                match read_pack_object_header(&pack_data, offset) {
                    Some((obj_type, _, header_end)) if obj_type == 7 => {
                        tracing::info!("Object {} is REF_DELTA, resolving cross-pack", oid);
                        if let Some(obj) = self.resolve_ref_delta(&pack_data, header_end).await {
                            tracing::info!("Extracted REF_DELTA object {} ({} bytes)", oid, obj.len());
                            return Some(obj);
                        }
                    }
                    _ => {
                        match extract_object_with_deltas(&pack_data, &idx_data, offset) {
                            Some(obj) => {
                                tracing::info!("Extracted object {} ({} bytes)", oid, obj.len());
                                return Some(obj);
                            }
                            None => {
                                tracing::warn!("Failed to extract object {} from pack at offset {}", oid, offset);
                            }
                        }
                    }
                }
            }
        }
        
        tracing::warn!("Object {} not found in any pack", oid);
        None
    }

    async fn resolve_ref_delta(&self, pack_data: &[u8], header_end: usize) -> Option<Vec<u8>> {
        if header_end + 20 > pack_data.len() {
            tracing::warn!("REF_DELTA: not enough data for base OID");
            return None;
        }
        
        let base_oid_bytes = &pack_data[header_end..header_end + 20];
        let base_oid = hex::encode(base_oid_bytes);
        let delta_start = header_end + 20;
        let compressed = &pack_data[delta_start..];
        let delta = decompress_zlib(compressed)?;
        
        tracing::info!("REF_DELTA: need base {}, delta {} bytes", base_oid, delta.len());
        
        let (base_type, base_content) = self.resolve_object_iterative(&base_oid).await?;
        tracing::info!("REF_DELTA: got base type={}, size={}", base_type, base_content.len());
        
        let result = apply_delta(&base_content, &delta)?;
        
        let type_str = match base_type.as_str() {
            "commit" => "commit",
            "tree" => "tree",
            "blob" => "blob",
            "tag" => "tag",
            _ => return None,
        };
        
        let header = format!("{} {}\0", type_str, result.len());
        let mut final_obj = header.into_bytes();
        final_obj.extend(result);
        
        compress_zlib(&final_obj)
    }

    async fn resolve_object_iterative(&self, start_oid: &str) -> Option<(String, Vec<u8>)> {
        let mut delta_chain: Vec<(String, Vec<u8>)> = Vec::new();
        let mut current_oid = start_oid.to_string();
        
        for depth in 0..100 {
            tracing::info!("resolve_object_iterative: depth={}, oid={}", depth, current_oid);
            
            if let Some(cached) = self.object_cache.read().await.get(&current_oid) {
                if let Some((obj_type, content)) = parse_git_object(cached) {
                    tracing::info!("Found cached base at depth {}: type={}", depth, obj_type);
                    return Some(self.apply_delta_chain((obj_type, content), &delta_chain));
                }
            }
            
            let target_bytes = match hex::decode(&current_oid) {
                Ok(b) => b,
                Err(_) => return None,
            };
            
            let idx_files = self.get_pack_idx_files().await;
            let mut found = false;
            
            for idx_path in &idx_files {
                let idx_data = match self.s3.get_object(idx_path).await {
                    Some(data) => data,
                    None => continue,
                };
                
                if let Some(offset) = find_object_in_index(&idx_data, &target_bytes) {
                    let pack_path = idx_path.replace(".idx", ".pack");
                    let pack_data = match self.s3.get_object(&pack_path).await {
                        Some(data) => data,
                        None => continue,
                    };
                    
                    if let Some((obj_type, size, header_end)) = read_pack_object_header(&pack_data, offset) {
                        if obj_type == 7 {
                            if header_end + 20 > pack_data.len() {
                                continue;
                            }
                            let base_oid_bytes = &pack_data[header_end..header_end + 20];
                            let base_oid = hex::encode(base_oid_bytes);
                            let delta_start = header_end + 20;
                            let compressed = &pack_data[delta_start..];
                            
                            if let Some(delta) = decompress_zlib(compressed) {
                                tracing::info!("Depth {}: REF_DELTA -> base {}", depth, base_oid);
                                delta_chain.push((current_oid.clone(), delta));
                                current_oid = base_oid;
                                found = true;
                                break;
                            }
                        } else if obj_type >= 1 && obj_type <= 4 {
                            if let Some(obj) = extract_object_with_deltas(&pack_data, &idx_data, offset) {
                                if let Some((obj_type_str, content)) = parse_git_object(&obj) {
                                    tracing::info!("Found base at depth {}: type={}, size={}", depth, obj_type_str, content.len());
                                    return Some(self.apply_delta_chain((obj_type_str, content), &delta_chain));
                                }
                            }
                        } else if obj_type == 6 {
                            if let Some(obj) = extract_object_with_deltas(&pack_data, &idx_data, offset) {
                                if let Some((obj_type_str, content)) = parse_git_object(&obj) {
                                    tracing::info!("Found OFS_DELTA base at depth {}: type={}", depth, obj_type_str);
                                    return Some(self.apply_delta_chain((obj_type_str, content), &delta_chain));
                                }
                            }
                        }
                    }
                }
            }
            
            if !found {
                let path = format!("{}/objects/{}/{}", self.prefix, &current_oid[..2], &current_oid[2..]);
                if let Some(data) = self.s3.get_object(&path).await {
                    if let Some((obj_type, content)) = parse_git_object(&data) {
                        tracing::info!("Found loose object base at depth {}: type={}", depth, obj_type);
                        return Some(self.apply_delta_chain((obj_type, content), &delta_chain));
                    }
                }
                tracing::warn!("Could not find object {} at depth {}", current_oid, depth);
                return None;
            }
        }
        
        tracing::warn!("Delta chain too deep (>100)");
        None
    }
    
    fn apply_delta_chain(&self, base: (String, Vec<u8>), delta_chain: &[(String, Vec<u8>)]) -> (String, Vec<u8>) {
        let (obj_type, mut content) = base;
        
        for (oid, delta) in delta_chain.iter().rev() {
            match apply_delta(&content, delta) {
                Some(new_content) => {
                    tracing::info!("Applied delta for {}: {} -> {} bytes", oid, content.len(), new_content.len());
                    content = new_content;
                }
                None => {
                    tracing::warn!("Failed to apply delta for {}", oid);
                }
            }
        }
        
        (obj_type, content)
    }

    pub async fn read_ref(&self, ref_name: &str) -> Option<String> {
        let path = format!("{}/{}", self.prefix, ref_name);
        tracing::debug!("Reading ref from: {}", path);
        let data = self.s3.get_object(&path).await?;
        let content = String::from_utf8(data).ok().map(|s| s.trim().to_string());
        tracing::debug!("Ref {} = {:?}", ref_name, content);
        content
    }

    pub async fn write_ref(&self, ref_name: &str, oid: &str) -> Result<(), aws_sdk_s3::Error> {
        let path = format!("{}/{}", self.prefix, ref_name);
        self.s3.put_object(&path, format!("{}\n", oid).into_bytes()).await
    }

    pub async fn list_refs(&self, prefix: &str) -> Vec<(String, String)> {
        tracing::debug!("Listing refs with prefix: {} (repo prefix: {})", prefix, self.prefix);
        let mut refs = Vec::new();
        
        if let Some(packed) = self.read_packed_refs().await {
            tracing::debug!("Found {} packed refs", packed.len());
            for (ref_name, oid) in packed {
                if ref_name.starts_with(prefix) {
                    refs.push((ref_name, oid));
                }
            }
        }
        
        let path = format!("{}/{}", self.prefix, prefix);
        tracing::debug!("Looking for loose refs at: {}", path);
        let keys = self.s3.list_objects(&path).await;
        tracing::debug!("Found {} loose ref files", keys.len());
        
        for key in keys {
            let ref_name = key.strip_prefix(&format!("{}/", self.prefix)).unwrap_or(&key);
            if let Some(data) = self.s3.get_object(&key).await {
                if let Ok(oid) = String::from_utf8(data) {
                    let oid = oid.trim().to_string();
                    if !refs.iter().any(|(n, _)| n == ref_name) {
                        refs.push((ref_name.to_string(), oid));
                    }
                }
            }
        }
        
        tracing::debug!("Total refs found: {}", refs.len());
        refs
    }
    
    async fn read_packed_refs(&self) -> Option<Vec<(String, String)>> {
        let path = format!("{}/packed-refs", self.prefix);
        let data = self.s3.get_object(&path).await?;
        let content = String::from_utf8(data).ok()?;
        
        let mut refs = Vec::new();
        for line in content.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') || line.starts_with('^') {
                continue;
            }
            let parts: Vec<&str> = line.splitn(2, ' ').collect();
            if parts.len() == 2 {
                let oid = parts[0].to_string();
                let ref_name = parts[1].to_string();
                refs.push((ref_name, oid));
            }
        }
        
        Some(refs)
    }

    pub async fn resolve_ref(&self, ref_name: &str) -> Option<String> {
        self.resolve_ref_inner(ref_name, 0).await
    }

    fn resolve_ref_inner<'a>(&'a self, ref_name: &'a str, depth: u8) -> std::pin::Pin<Box<dyn std::future::Future<Output = Option<String>> + Send + 'a>> {
        Box::pin(async move {
            if depth > 10 {
                return None;
            }

            if let Some(content) = self.read_ref(ref_name).await {
                if content.starts_with("ref: ") {
                    let target = content.strip_prefix("ref: ")?;
                    return self.resolve_ref_inner(target, depth + 1).await;
                }
                
                if content.len() == 40 && content.chars().all(|c| c.is_ascii_hexdigit()) {
                    return Some(content);
                }
            }
            
            if let Some(packed) = self.read_packed_refs().await {
                for (name, oid) in packed {
                    if name == ref_name {
                        return Some(oid);
                    }
                }
            }
            
            None
        })
    }
}

pub fn find_object_in_index_pub(idx_data: &[u8], target_oid: &[u8]) -> Option<u64> {
    find_object_in_index(idx_data, target_oid)
}

fn find_object_in_index(idx_data: &[u8], target_oid: &[u8]) -> Option<u64> {
    if idx_data.len() < 8 || target_oid.len() != 20 {
        return None;
    }

    let magic = &idx_data[0..4];
    if magic != [0xff, 0x74, 0x4f, 0x63] {
        return None;
    }

    let version = u32::from_be_bytes([idx_data[4], idx_data[5], idx_data[6], idx_data[7]]);
    if version != 2 {
        return None;
    }

    let fanout_start = 8;
    let fanout_end = fanout_start + 256 * 4;
    
    if idx_data.len() < fanout_end {
        return None;
    }

    let total_objects = u32::from_be_bytes([
        idx_data[fanout_end - 4],
        idx_data[fanout_end - 3],
        idx_data[fanout_end - 2],
        idx_data[fanout_end - 1],
    ]) as usize;

    let first_byte = target_oid[0] as usize;
    
    let start_idx = if first_byte == 0 {
        0
    } else {
        let prev_offset = fanout_start + (first_byte - 1) * 4;
        u32::from_be_bytes([
            idx_data[prev_offset],
            idx_data[prev_offset + 1],
            idx_data[prev_offset + 2],
            idx_data[prev_offset + 3],
        ]) as usize
    };
    
    let end_idx = {
        let offset = fanout_start + first_byte * 4;
        u32::from_be_bytes([
            idx_data[offset],
            idx_data[offset + 1],
            idx_data[offset + 2],
            idx_data[offset + 3],
        ]) as usize
    };

    let sha_table_start = fanout_end;
    
    for i in start_idx..end_idx {
        let sha_offset = sha_table_start + i * 20;
        if sha_offset + 20 > idx_data.len() {
            break;
        }
        
        if &idx_data[sha_offset..sha_offset + 20] == target_oid {
            let crc_table_start = sha_table_start + total_objects * 20;
            let offset_table_start = crc_table_start + total_objects * 4;
            let offset_pos = offset_table_start + i * 4;
            
            if offset_pos + 4 > idx_data.len() {
                return None;
            }
            
            let offset = u32::from_be_bytes([
                idx_data[offset_pos],
                idx_data[offset_pos + 1],
                idx_data[offset_pos + 2],
                idx_data[offset_pos + 3],
            ]);
            
            if offset & 0x80000000 != 0 {
                let large_offset_idx = (offset & 0x7fffffff) as usize;
                let large_offset_table_start = offset_table_start + total_objects * 4;
                let large_offset_pos = large_offset_table_start + large_offset_idx * 8;
                
                if large_offset_pos + 8 > idx_data.len() {
                    return None;
                }
                
                return Some(u64::from_be_bytes([
                    idx_data[large_offset_pos],
                    idx_data[large_offset_pos + 1],
                    idx_data[large_offset_pos + 2],
                    idx_data[large_offset_pos + 3],
                    idx_data[large_offset_pos + 4],
                    idx_data[large_offset_pos + 5],
                    idx_data[large_offset_pos + 6],
                    idx_data[large_offset_pos + 7],
                ]));
            }
            
            return Some(offset as u64);
        }
    }
    
    None
}

fn read_pack_object_header(pack_data: &[u8], offset: u64) -> Option<(u8, usize, usize)> {
    let offset = offset as usize;
    if offset >= pack_data.len() {
        return None;
    }

    let mut pos = offset;
    let first_byte = pack_data[pos];
    pos += 1;

    let obj_type = (first_byte >> 4) & 0x07;
    let mut size = (first_byte & 0x0f) as usize;
    let mut shift = 4;

    let mut continuation_byte = first_byte;
    while continuation_byte & 0x80 != 0 && pos < pack_data.len() {
        continuation_byte = pack_data[pos];
        pos += 1;
        size |= ((continuation_byte & 0x7f) as usize) << shift;
        shift += 7;
    }

    Some((obj_type, size, pos))
}

fn parse_git_object(data: &[u8]) -> Option<(String, Vec<u8>)> {
    let decompressed = decompress_zlib(data)?;
    let null_pos = decompressed.iter().position(|&b| b == 0)?;
    let header = std::str::from_utf8(&decompressed[..null_pos]).ok()?;
    let parts: Vec<&str> = header.splitn(2, ' ').collect();
    if parts.len() != 2 {
        return None;
    }
    let obj_type = parts[0].to_string();
    let content = decompressed[null_pos + 1..].to_vec();
    Some((obj_type, content))
}

fn extract_object_with_deltas(pack_data: &[u8], idx_data: &[u8], offset: u64) -> Option<Vec<u8>> {
    let result = read_pack_object(pack_data, idx_data, offset);
    if result.is_none() {
        tracing::warn!("read_pack_object returned None for offset {}", offset);
        return None;
    }
    let (obj_type, content) = result.unwrap();
    
    let type_str = match obj_type {
        1 => "commit",
        2 => "tree",
        3 => "blob",
        4 => "tag",
        _ => {
            tracing::warn!("Unknown object type {} at offset {}", obj_type, offset);
            return None;
        }
    };

    let header = format!("{} {}\0", type_str, content.len());
    let mut result = header.into_bytes();
    result.extend(content);
    
    compress_zlib(&result)
}

fn read_pack_object(pack_data: &[u8], idx_data: &[u8], offset: u64) -> Option<(u8, Vec<u8>)> {
    let offset = offset as usize;
    if offset >= pack_data.len() {
        tracing::warn!("Offset {} >= pack_data.len() {}", offset, pack_data.len());
        return None;
    }

    let mut pos = offset;
    let first_byte = pack_data[pos];
    pos += 1;

    let obj_type = (first_byte >> 4) & 0x07;
    let mut size = (first_byte & 0x0f) as usize;
    let mut shift = 4;

    let mut continuation_byte = first_byte;
    while continuation_byte & 0x80 != 0 && pos < pack_data.len() {
        continuation_byte = pack_data[pos];
        pos += 1;
        size |= ((continuation_byte & 0x7f) as usize) << shift;
        shift += 7;
    }

    tracing::info!("read_pack_object: offset={}, first_byte=0x{:02x}, obj_type={}, size={}, data_pos={}", offset, first_byte, obj_type, size, pos);

    match obj_type {
        1 | 2 | 3 | 4 => {
            let compressed = &pack_data[pos..];
            let content = decompress_zlib(compressed);
            if content.is_none() {
                tracing::warn!("Failed to decompress object type {} at offset {}", obj_type, offset);
                return None;
            }
            Some((obj_type, content.unwrap()))
        }
        6 => {
            tracing::info!("OFS_DELTA at offset {}", offset);
            let delta_result = read_ofs_delta_offset(&pack_data[pos..]);
            if delta_result.is_none() {
                tracing::warn!("Failed to read OFS_DELTA offset at pos {}", pos);
                return None;
            }
            let (base_offset, bytes_read) = delta_result.unwrap();
            pos += bytes_read;
            
            let base_abs_offset = offset as u64 - base_offset;
            tracing::info!("OFS_DELTA: base_offset={}, base_abs_offset={}", base_offset, base_abs_offset);
            let base_result = read_pack_object(pack_data, idx_data, base_abs_offset);
            if base_result.is_none() {
                tracing::warn!("Failed to read base object at offset {}", base_abs_offset);
                return None;
            }
            let (base_type, base_content) = base_result.unwrap();
            tracing::info!("OFS_DELTA: got base type={}, base_content_len={}", base_type, base_content.len());
            
            let compressed = &pack_data[pos..];
            let delta = decompress_zlib(compressed);
            if delta.is_none() {
                tracing::warn!("Failed to decompress delta at pos {}", pos);
                return None;
            }
            let delta_data = delta.unwrap();
            tracing::info!("OFS_DELTA: delta decompressed to {} bytes", delta_data.len());
            
            let result = apply_delta(&base_content, &delta_data);
            if result.is_none() {
                tracing::warn!("Failed to apply delta");
                return None;
            }
            Some((base_type, result.unwrap()))
        }
        7 => {
            tracing::info!("REF_DELTA at offset {}", offset);
            if pos + 20 > pack_data.len() {
                tracing::warn!("REF_DELTA: not enough data for base OID at pos {}", pos);
                return None;
            }
            let base_oid = &pack_data[pos..pos + 20];
            let base_oid_hex = hex::encode(base_oid);
            pos += 20;
            tracing::info!("REF_DELTA: base_oid={}", base_oid_hex);
            
            let base_offset = match find_object_in_index(idx_data, base_oid) {
                Some(o) => o,
                None => {
                    tracing::warn!("REF_DELTA: base object {} not found in index", base_oid_hex);
                    return None;
                }
            };
            let (base_type, base_content) = match read_pack_object(pack_data, idx_data, base_offset) {
                Some(r) => r,
                None => {
                    tracing::warn!("REF_DELTA: failed to read base object at offset {}", base_offset);
                    return None;
                }
            };
            tracing::info!("REF_DELTA: got base type={}, base_content_len={}", base_type, base_content.len());
            
            let compressed = &pack_data[pos..];
            let delta = match decompress_zlib(compressed) {
                Some(d) => d,
                None => {
                    tracing::warn!("REF_DELTA: failed to decompress delta");
                    return None;
                }
            };
            tracing::info!("REF_DELTA: delta decompressed to {} bytes", delta.len());
            
            let result = match apply_delta(&base_content, &delta) {
                Some(r) => r,
                None => {
                    tracing::warn!("REF_DELTA: failed to apply delta");
                    return None;
                }
            };
            Some((base_type, result))
        }
        _ => {
            tracing::warn!("Unknown/unsupported object type {} at offset {}", obj_type, offset);
            None
        }
    }
}

fn read_ofs_delta_offset(data: &[u8]) -> Option<(u64, usize)> {
    if data.is_empty() {
        return None;
    }
    
    let mut offset = (data[0] & 0x7f) as u64;
    let mut pos = 1;
    
    while data.get(pos - 1).map(|b| b & 0x80 != 0).unwrap_or(false) {
        if pos >= data.len() {
            return None;
        }
        offset += 1;
        offset = (offset << 7) | ((data[pos] & 0x7f) as u64);
        pos += 1;
    }
    
    Some((offset, pos))
}

fn apply_delta(base: &[u8], delta: &[u8]) -> Option<Vec<u8>> {
    let mut pos = 0;
    
    let (_src_size, bytes_read) = read_varint(&delta[pos..])?;
    pos += bytes_read;
    
    let (dst_size, bytes_read) = read_varint(&delta[pos..])?;
    pos += bytes_read;
    
    let mut result = Vec::with_capacity(dst_size);
    
    while pos < delta.len() {
        let cmd = delta[pos];
        pos += 1;
        
        if cmd & 0x80 != 0 {
            let mut copy_offset = 0usize;
            let mut copy_size = 0usize;
            
            if cmd & 0x01 != 0 {
                copy_offset |= delta.get(pos).copied().unwrap_or(0) as usize;
                pos += 1;
            }
            if cmd & 0x02 != 0 {
                copy_offset |= (delta.get(pos).copied().unwrap_or(0) as usize) << 8;
                pos += 1;
            }
            if cmd & 0x04 != 0 {
                copy_offset |= (delta.get(pos).copied().unwrap_or(0) as usize) << 16;
                pos += 1;
            }
            if cmd & 0x08 != 0 {
                copy_offset |= (delta.get(pos).copied().unwrap_or(0) as usize) << 24;
                pos += 1;
            }
            
            if cmd & 0x10 != 0 {
                copy_size |= delta.get(pos).copied().unwrap_or(0) as usize;
                pos += 1;
            }
            if cmd & 0x20 != 0 {
                copy_size |= (delta.get(pos).copied().unwrap_or(0) as usize) << 8;
                pos += 1;
            }
            if cmd & 0x40 != 0 {
                copy_size |= (delta.get(pos).copied().unwrap_or(0) as usize) << 16;
                pos += 1;
            }
            
            if copy_size == 0 {
                copy_size = 0x10000;
            }
            
            if copy_offset + copy_size > base.len() {
                return None;
            }
            
            result.extend_from_slice(&base[copy_offset..copy_offset + copy_size]);
        } else if cmd != 0 {
            let insert_size = cmd as usize;
            if pos + insert_size > delta.len() {
                return None;
            }
            result.extend_from_slice(&delta[pos..pos + insert_size]);
            pos += insert_size;
        } else {
            return None;
        }
    }
    
    if result.len() != dst_size {
        return None;
    }
    
    Some(result)
}

fn read_varint(data: &[u8]) -> Option<(usize, usize)> {
    if data.is_empty() {
        return None;
    }
    
    let mut value = 0usize;
    let mut shift = 0;
    let mut pos = 0;
    
    loop {
        if pos >= data.len() {
            return None;
        }
        
        let byte = data[pos];
        pos += 1;
        
        value |= ((byte & 0x7f) as usize) << shift;
        
        if byte & 0x80 == 0 {
            break;
        }
        
        shift += 7;
    }
    
    Some((value, pos))
}

fn decompress_zlib(data: &[u8]) -> Option<Vec<u8>> {
    let mut decoder = flate2::read::ZlibDecoder::new(data);
    let mut result = Vec::new();
    decoder.read_to_end(&mut result).ok()?;
    Some(result)
}

fn compress_zlib(data: &[u8]) -> Option<Vec<u8>> {
    use std::io::Write;
    let mut encoder = flate2::write::ZlibEncoder::new(Vec::new(), flate2::Compression::default());
    encoder.write_all(data).ok()?;
    encoder.finish().ok()
}
