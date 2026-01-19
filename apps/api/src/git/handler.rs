use crate::git::objects::S3GitStore;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct TreeEntry {
    pub name: String,
    #[serde(rename = "type")]
    pub entry_type: String,
    pub oid: String,
    pub path: String,
}

#[derive(Debug, Serialize)]
pub struct CommitInfo {
    pub oid: String,
    pub message: String,
    pub author: CommitAuthor,
    pub timestamp: i64,
}

#[derive(Debug, Serialize)]
pub struct CommitAuthor {
    pub name: String,
    #[serde(skip_serializing)]
    pub email: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub username: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub userId: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub avatarUrl: Option<String>,
}

pub async fn list_branches(store: &S3GitStore) -> Vec<String> {
    let refs = store.list_refs("refs/heads").await;
    refs.into_iter()
        .map(|(name, _)| name.strip_prefix("refs/heads/").unwrap_or(&name).to_string())
        .collect()
}

pub async fn get_commits(
    store: &S3GitStore,
    branch: &str,
    limit: usize,
    skip: usize,
) -> (Vec<CommitInfo>, bool) {
    let ref_path = format!("refs/heads/{}", branch);
    let head_oid = match store.resolve_ref(&ref_path).await {
        Some(oid) => oid,
        None => return (Vec::new(), false),
    };

    let mut commits = Vec::new();
    let mut current_oid = Some(head_oid);
    let mut count = 0;

    while let Some(oid) = current_oid.take() {
        if count >= skip + limit + 1 {
            break;
        }

        if let Some(data) = store.get_object(&oid).await {
            if let Some(commit) = parse_commit(&data, &oid) {
                if count >= skip && count < skip + limit {
                    commits.push(commit.0);
                }
                current_oid = commit.1;
                count += 1;
            }
        }
    }

    let has_more = count > skip + limit;
    (commits, has_more)
}

pub async fn get_commit_by_oid(store: &S3GitStore, oid: &str) -> Option<(CommitInfo, Option<String>)> {
    let data = store.get_object(oid).await?;
    parse_commit(&data, oid)
}

pub async fn count_commits_until(
    store: &S3GitStore,
    start_oid: &str,
    stop_oid: Option<&str>,
    max_steps: usize,
) -> Option<usize> {
    let mut count = 0usize;
    let mut current = Some(start_oid.to_string());

    while let Some(oid) = current {
        if let Some(stop) = stop_oid {
            if oid == stop {
                return Some(count);
            }
        }
        if count >= max_steps {
            return None;
        }
        let next = match get_commit_by_oid(store, &oid).await {
            Some((_commit, parent)) => parent,
            None => return None,
        };
        count += 1;
        current = next;
    }

    if stop_oid.is_none() {
        Some(count)
    } else {
        None
    }
}

pub async fn get_tree(
    store: &S3GitStore,
    branch: &str,
    path: &str,
) -> Option<Vec<TreeEntry>> {
    let ref_path = format!("refs/heads/{}", branch);
    tracing::debug!("get_tree: resolving ref {}", ref_path);

    let head_oid = store.resolve_ref(&ref_path).await;
    if head_oid.is_none() {
        tracing::warn!("get_tree: failed to resolve ref {}", ref_path);
        return None;
    }
    let head_oid = head_oid.unwrap();
    tracing::debug!("get_tree: head_oid = {}", head_oid);

    let commit_data = store.get_object(&head_oid).await;
    if commit_data.is_none() {
        tracing::warn!("get_tree: failed to get commit object {}", head_oid);
        return None;
    }
    let commit_data = commit_data.unwrap();
    tracing::debug!("get_tree: got commit data ({} bytes)", commit_data.len());

    let tree_oid = extract_tree_oid(&commit_data);
    if tree_oid.is_none() {
        tracing::warn!("get_tree: failed to extract tree oid from commit");
        return None;
    }
    let tree_oid = tree_oid.unwrap();
    tracing::debug!("get_tree: tree_oid = {}", tree_oid);

    let target_tree_oid = if path.is_empty() {
        tree_oid
    } else {
        match navigate_to_path(store, &tree_oid, path).await {
            Some(oid) => oid,
            None => {
                tracing::warn!("get_tree: failed to navigate to path {}", path);
                return None;
            }
        }
    };

    let tree_data = store.get_object(&target_tree_oid).await;
    if tree_data.is_none() {
        tracing::warn!("get_tree: failed to get tree object {}", target_tree_oid);
        return None;
    }
    let tree_data = tree_data.unwrap();
    tracing::debug!("get_tree: got tree data ({} bytes)", tree_data.len());

    let entries = parse_tree(&tree_data, path);
    tracing::debug!("get_tree: parsed {} entries", entries.len());

    Some(entries)
}

pub async fn get_file(
    store: &S3GitStore,
    branch: &str,
    path: &str,
) -> Option<(String, String)> {
    let ref_path = format!("refs/heads/{}", branch);
    let head_oid = store.resolve_ref(&ref_path).await?;

    let commit_data = store.get_object(&head_oid).await?;
    let tree_oid = extract_tree_oid(&commit_data)?;

    let parts: Vec<&str> = path.split('/').filter(|s| !s.is_empty()).collect();
    if parts.is_empty() {
        return None;
    }

    let file_name = parts.last()?;
    let dir_path = if parts.len() > 1 {
        parts[..parts.len() - 1].join("/")
    } else {
        String::new()
    };

    let dir_tree_oid = if dir_path.is_empty() {
        tree_oid
    } else {
        navigate_to_path(store, &tree_oid, &dir_path).await?
    };

    let dir_tree_data = store.get_object(&dir_tree_oid).await?;
    let file_oid = find_entry_in_tree(&dir_tree_data, file_name)?;

    let blob_data = store.get_object(&file_oid).await?;
    let content = parse_blob(&blob_data)?;

    Some((content, file_oid))
}

pub async fn get_blob_by_oid(store: &S3GitStore, oid: &str) -> Option<String> {
    let blob_data = store.get_object(oid).await?;
    parse_blob(&blob_data)
}

async fn navigate_to_path(store: &S3GitStore, tree_oid: &str, path: &str) -> Option<String> {
    let parts: Vec<&str> = path.split('/').filter(|s| !s.is_empty()).collect();
    let mut current_oid = tree_oid.to_string();

    for part in parts {
        let tree_data = store.get_object(&current_oid).await?;
        current_oid = find_entry_in_tree(&tree_data, part)?;
    }

    Some(current_oid)
}

fn find_entry_in_tree(data: &[u8], name: &str) -> Option<String> {
    let decompressed = decompress_zlib(data)?;

    let null_pos = decompressed.iter().position(|&b| b == 0)?;
    let content = &decompressed[null_pos + 1..];

    let mut pos = 0;
    while pos < content.len() {
        let entry_null = content[pos..].iter().position(|&b| b == 0)?;
        let entry_null = pos + entry_null;

        let header = std::str::from_utf8(&content[pos..entry_null]).ok()?;
        let parts: Vec<&str> = header.splitn(2, ' ').collect();

        if parts.len() != 2 {
            break;
        }

        let entry_name = parts[1];

        if entry_null + 21 > content.len() {
            break;
        }

        let oid = hex::encode(&content[entry_null + 1..entry_null + 21]);

        if entry_name == name {
            return Some(oid);
        }

        pos = entry_null + 21;
    }

    None
}

fn parse_commit(data: &[u8], oid: &str) -> Option<(CommitInfo, Option<String>)> {
    let decompressed = decompress_zlib(data)?;

    let null_pos = decompressed.iter().position(|&b| b == 0)?;
    let content = std::str::from_utf8(&decompressed[null_pos + 1..]).ok()?;

    let mut author_name = String::new();
    let mut author_email = String::new();
    let mut timestamp = 0i64;
    let mut parent = None;
    let mut in_headers = true;
    let mut message_lines = Vec::new();

    for line in content.lines() {
        if in_headers {
            if line.is_empty() {
                in_headers = false;
                continue;
            }

            if line.starts_with("parent ") {
                if parent.is_none() {
                    parent = Some(line[7..].to_string());
                }
            } else if line.starts_with("author ") {
                let author_part = &line[7..];
                if let Some((name_email, time_tz)) = author_part.rsplit_once('>') {
                    let name_email = format!("{}>", name_email);
                    if let Some((name, email)) = name_email.split_once('<') {
                        author_name = name.trim().to_string();
                        author_email = email.trim_end_matches('>').to_string();
                    }
                    let time_parts: Vec<&str> = time_tz.trim().split_whitespace().collect();
                    if !time_parts.is_empty() {
                        timestamp = time_parts[0].parse().unwrap_or(0) * 1000;
                    }
                }
            }
        } else {
            message_lines.push(line);
        }
    }

    Some((
        CommitInfo {
            oid: oid.to_string(),
            message: message_lines.join("\n"),
            author: CommitAuthor {
                name: author_name,
                email: author_email,
                username: None,
                userId: None,
                avatarUrl: None,
            },
            timestamp,
        },
        parent,
    ))
}

fn extract_tree_oid(data: &[u8]) -> Option<String> {
    let decompressed = decompress_zlib(data)?;
    let null_pos = decompressed.iter().position(|&b| b == 0)?;
    let content = std::str::from_utf8(&decompressed[null_pos + 1..]).ok()?;

    for line in content.lines() {
        if line.starts_with("tree ") {
            return Some(line[5..].to_string());
        }
    }
    None
}

fn parse_tree(data: &[u8], base_path: &str) -> Vec<TreeEntry> {
    let decompressed = match decompress_zlib(data) {
        Some(d) => d,
        None => return Vec::new(),
    };

    let null_pos = match decompressed.iter().position(|&b| b == 0) {
        Some(p) => p,
        None => return Vec::new(),
    };

    let content = &decompressed[null_pos + 1..];
    let mut entries = Vec::new();
    let mut pos = 0;

    while pos < content.len() {
        let entry_null = match content[pos..].iter().position(|&b| b == 0) {
            Some(p) => pos + p,
            None => break,
        };

        let header = match std::str::from_utf8(&content[pos..entry_null]) {
            Ok(h) => h,
            Err(_) => break,
        };

        let parts: Vec<&str> = header.splitn(2, ' ').collect();
        if parts.len() != 2 {
            break;
        }

        let mode = parts[0];
        let name = parts[1].to_string();

        if entry_null + 21 > content.len() {
            break;
        }

        let oid = hex::encode(&content[entry_null + 1..entry_null + 21]);

        let entry_type = if mode == "40000" || mode == "040000" {
            "tree"
        } else {
            "blob"
        };

        let path = if base_path.is_empty() {
            name.clone()
        } else {
            format!("{}/{}", base_path, name)
        };

        entries.push(TreeEntry {
            name,
            entry_type: entry_type.to_string(),
            oid,
            path,
        });

        pos = entry_null + 21;
    }

    entries.sort_by(|a, b| {
        if a.entry_type == "tree" && b.entry_type != "tree" {
            std::cmp::Ordering::Less
        } else if a.entry_type != "tree" && b.entry_type == "tree" {
            std::cmp::Ordering::Greater
        } else {
            a.name.cmp(&b.name)
        }
    });

    entries
}

fn parse_blob(data: &[u8]) -> Option<String> {
    let decompressed = decompress_zlib(data)?;
    let null_pos = decompressed.iter().position(|&b| b == 0)?;
    String::from_utf8(decompressed[null_pos + 1..].to_vec()).ok()
}

fn decompress_zlib(data: &[u8]) -> Option<Vec<u8>> {
    use std::io::Read;
    let mut decoder = flate2::read::ZlibDecoder::new(data);
    let mut result = Vec::new();
    decoder.read_to_end(&mut result).ok()?;
    Some(result)
}
