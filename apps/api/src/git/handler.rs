use crate::git::objects::S3GitStore;
use crate::redis::{RedisClient, CacheTtl};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

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
    if let Some(ref redis) = store.redis {
        let cache_key = RedisClient::tree_key(&store.prefix, branch, path);
        if let Some(cached) = redis.get_string(&cache_key).await {
            if let Ok(entries) = serde_json::from_str::<Vec<TreeEntry>>(&cached) {
                tracing::debug!("get_tree: redis cache hit for {}:{}", branch, path);
                return Some(entries);
            }
        }
    }

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

    if let Some(ref redis) = store.redis {
        let cache_key = RedisClient::tree_key(&store.prefix, branch, path);
        if let Ok(json) = serde_json::to_string(&entries) {
            redis.set_ex_string(&cache_key, &json, CacheTtl::TREE_LISTING).await;
        }
    }

    Some(entries)
}

pub async fn get_file(
    store: &S3GitStore,
    branch: &str,
    path: &str,
) -> Option<(String, String)> {
    if let Some(ref redis) = store.redis {
        let cache_key = RedisClient::file_key(&store.prefix, branch, path);
        if let Some(cached) = redis.get_string(&cache_key).await {
            if let Some((content, oid)) = cached.split_once('\x00') {
                tracing::debug!("get_file: redis cache hit for {}:{}", branch, path);
                return Some((content.to_string(), oid.to_string()));
            }
        }
    }

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

    if let Some(ref redis) = store.redis {
        let cache_key = RedisClient::file_key(&store.prefix, branch, path);
        let cache_value = format!("{}\x00{}", content, file_oid);
        redis.set_ex_string(&cache_key, &cache_value, CacheTtl::FILE_CONTENT).await;
    }

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

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DiffHunkLine {
    #[serde(rename = "type")]
    pub line_type: String,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub old_line_number: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub new_line_number: Option<usize>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DiffHunk {
    pub old_start: usize,
    pub old_lines: usize,
    pub new_start: usize,
    pub new_lines: usize,
    pub lines: Vec<DiffHunkLine>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileDiff {
    pub path: String,
    pub status: String,
    pub additions: usize,
    pub deletions: usize,
    pub hunks: Vec<DiffHunk>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub old_path: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffStats {
    pub additions: usize,
    pub deletions: usize,
    pub files_changed: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitDiffResponse {
    pub commit: CommitInfo,
    pub parent: Option<String>,
    pub files: Vec<FileDiff>,
    pub stats: DiffStats,
}

pub async fn get_commit_diff(store: &S3GitStore, oid: &str) -> Option<CommitDiffResponse> {
    let (commit, parent_oid) = get_commit_by_oid(store, oid).await?;

    let commit_data = store.get_object(oid).await?;
    let commit_tree_oid = extract_tree_oid(&commit_data)?;

    let parent_tree_oid = if let Some(ref parent) = parent_oid {
        let parent_data = store.get_object(parent).await?;
        extract_tree_oid(&parent_data)
    } else {
        None
    };

    let files = compare_trees(store, parent_tree_oid.as_deref(), &commit_tree_oid, "").await;

    let mut total_additions = 0;
    let mut total_deletions = 0;
    for file in &files {
        total_additions += file.additions;
        total_deletions += file.deletions;
    }

    Some(CommitDiffResponse {
        commit,
        parent: parent_oid,
        files: files.clone(),
        stats: DiffStats {
            additions: total_additions,
            deletions: total_deletions,
            files_changed: files.len(),
        },
    })
}

async fn compare_trees(
    store: &S3GitStore,
    old_tree_oid: Option<&str>,
    new_tree_oid: &str,
    base_path: &str,
) -> Vec<FileDiff> {
    let mut diffs = Vec::new();
    let mut stack: Vec<(Option<String>, String, String)> = vec![
        (old_tree_oid.map(|s| s.to_string()), new_tree_oid.to_string(), base_path.to_string())
    ];

    while let Some((old_oid_opt, new_oid, current_path)) = stack.pop() {
        let new_entries = if let Some(data) = store.get_object(&new_oid).await {
            parse_tree_entries(&data)
        } else {
            continue;
        };

        let old_entries = if let Some(ref old_oid) = old_oid_opt {
            if let Some(data) = store.get_object(old_oid).await {
                parse_tree_entries(&data)
            } else {
                std::collections::HashMap::new()
            }
        } else {
            std::collections::HashMap::new()
        };

        for (name, (new_entry_oid, new_type)) in &new_entries {
            let path = if current_path.is_empty() {
                name.clone()
            } else {
                format!("{}/{}", current_path, name)
            };

            if let Some((old_entry_oid, old_type)) = old_entries.get(name) {
                if new_entry_oid != old_entry_oid {
                    if new_type == "tree" && old_type == "tree" {
                        stack.push((Some(old_entry_oid.clone()), new_entry_oid.clone(), path));
                    } else if new_type == "blob" && old_type == "blob" {
                        if let Some(file_diff) = diff_blobs(store, Some(old_entry_oid), new_entry_oid, &path, "modified").await {
                            diffs.push(file_diff);
                        }
                    } else if new_type == "blob" && old_type == "tree" {
                        if let Some(file_diff) = diff_blobs(store, None, new_entry_oid, &path, "added").await {
                            diffs.push(file_diff);
                        }
                    } else if new_type == "tree" && old_type == "blob" {
                        stack.push((None, new_entry_oid.clone(), path));
                    }
                }
            } else {
                if new_type == "tree" {
                    stack.push((None, new_entry_oid.clone(), path));
                } else {
                    if let Some(file_diff) = diff_blobs(store, None, new_entry_oid, &path, "added").await {
                        diffs.push(file_diff);
                    }
                }
            }
        }

        for (name, (old_entry_oid, old_type)) in &old_entries {
            if !new_entries.contains_key(name) {
                let path = if current_path.is_empty() {
                    name.clone()
                } else {
                    format!("{}/{}", current_path, name)
                };

                if old_type == "tree" {
                    let deleted_files = collect_all_blobs_in_tree(store, old_entry_oid, &path).await;
                    for (blob_path, blob_oid) in deleted_files {
                        if let Some(file_diff) = diff_blobs(store, Some(&blob_oid), "", &blob_path, "deleted").await {
                            diffs.push(file_diff);
                        }
                    }
                } else {
                    if let Some(file_diff) = diff_blobs(store, Some(old_entry_oid), "", &path, "deleted").await {
                        diffs.push(file_diff);
                    }
                }
            }
        }
    }

    diffs.sort_by(|a, b| a.path.cmp(&b.path));
    diffs
}

async fn collect_all_blobs_in_tree(store: &S3GitStore, tree_oid: &str, base_path: &str) -> Vec<(String, String)> {
    let mut blobs = Vec::new();
    let mut stack: Vec<(String, String)> = vec![(tree_oid.to_string(), base_path.to_string())];

    while let Some((current_oid, current_path)) = stack.pop() {
        let entries = if let Some(data) = store.get_object(&current_oid).await {
            parse_tree_entries(&data)
        } else {
            continue;
        };

        for (name, (oid, entry_type)) in entries {
            let path = if current_path.is_empty() {
                name
            } else {
                format!("{}/{}", current_path, name)
            };

            if entry_type == "tree" {
                stack.push((oid, path));
            } else {
                blobs.push((path, oid));
            }
        }
    }

    blobs
}

fn parse_tree_entries(data: &[u8]) -> std::collections::HashMap<String, (String, String)> {
    let mut entries = std::collections::HashMap::new();

    let decompressed = match decompress_zlib(data) {
        Some(d) => d,
        None => return entries,
    };

    let null_pos = match decompressed.iter().position(|&b| b == 0) {
        Some(p) => p,
        None => return entries,
    };

    let content = &decompressed[null_pos + 1..];
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
        let entry_type = if mode == "40000" || mode == "040000" { "tree" } else { "blob" };

        entries.insert(name, (oid, entry_type.to_string()));
        pos = entry_null + 21;
    }

    entries
}

async fn diff_blobs(
    store: &S3GitStore,
    old_oid: Option<&str>,
    new_oid: &str,
    path: &str,
    status: &str,
) -> Option<FileDiff> {
    let old_content = if let Some(oid) = old_oid {
        if oid.is_empty() {
            String::new()
        } else {
            get_blob_by_oid(store, oid).await.unwrap_or_default()
        }
    } else {
        String::new()
    };

    let new_content = if new_oid.is_empty() {
        String::new()
    } else {
        get_blob_by_oid(store, new_oid).await.unwrap_or_default()
    };

    let hunks = compute_unified_diff(&old_content, &new_content);

    let mut additions = 0;
    let mut deletions = 0;
    for hunk in &hunks {
        for line in &hunk.lines {
            match line.line_type.as_str() {
                "addition" => additions += 1,
                "deletion" => deletions += 1,
                _ => {}
            }
        }
    }

    Some(FileDiff {
        path: path.to_string(),
        status: status.to_string(),
        additions,
        deletions,
        hunks,
        old_path: None,
    })
}

fn compute_unified_diff(old_content: &str, new_content: &str) -> Vec<DiffHunk> {
    use similar::{ChangeTag, TextDiff, DiffOp};

    let old_is_empty = old_content.is_empty();
    let new_is_empty = new_content.is_empty();

    let diff = TextDiff::from_lines(old_content, new_content);
    let mut hunks = Vec::new();
    let context_radius = 3;

    for group in diff.grouped_ops(context_radius) {
        let mut lines: Vec<DiffHunkLine> = Vec::new();
        let mut has_changes = false;

        let first_op = group.first();
        let (mut old_start, mut new_start) = match first_op {
            Some(DiffOp::Equal { old_index, new_index, .. }) => (*old_index + 1, *new_index + 1),
            Some(DiffOp::Delete { old_index, new_index, .. }) => (*old_index + 1, *new_index + 1),
            Some(DiffOp::Insert { old_index, new_index, .. }) => (*old_index + 1, *new_index + 1),
            Some(DiffOp::Replace { old_index, new_index, .. }) => (*old_index + 1, *new_index + 1),
            None => continue,
        };

        if old_is_empty {
            old_start = 0;
        }
        if new_is_empty {
            new_start = 0;
        }

        for op in group {
            for change in diff.iter_changes(&op) {
                let old_idx = change.old_index();
                let new_idx = change.new_index();

                let line_type = match change.tag() {
                    ChangeTag::Equal => "context",
                    ChangeTag::Delete => {
                        has_changes = true;
                        "deletion"
                    }
                    ChangeTag::Insert => {
                        has_changes = true;
                        "addition"
                    }
                };

                lines.push(DiffHunkLine {
                    line_type: line_type.to_string(),
                    content: change.value().trim_end_matches('\n').to_string(),
                    old_line_number: old_idx.map(|x| x + 1),
                    new_line_number: new_idx.map(|x| x + 1),
                });
            }
        }

        if lines.is_empty() || !has_changes {
            continue;
        }

        let old_lines = lines.iter().filter(|l| l.line_type != "addition").count();
        let new_lines = lines.iter().filter(|l| l.line_type != "deletion").count();

        hunks.push(DiffHunk {
            old_start,
            old_lines,
            new_start,
            new_lines,
            lines,
        });
    }

    hunks
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileLastCommit {
    pub path: String,
    pub commit_oid: String,
    pub message: String,
    pub author_name: String,
    pub timestamp: i64,
}

pub async fn get_file_last_commits(
    store: &S3GitStore,
    branch: &str,
    dir_path: &str,
    file_paths: Vec<String>,
) -> Vec<FileLastCommit> {
    use std::collections::HashSet;

    const MAX_COMMITS_TO_WALK: usize = 5000;

    let ref_path = format!("refs/heads/{}", branch);
    let head_oid = match store.resolve_ref(&ref_path).await {
        Some(oid) => oid,
        None => return Vec::new(),
    };

    let mut results: HashMap<String, FileLastCommit> = HashMap::new();
    let mut remaining: HashSet<String> = file_paths.into_iter().collect();
    let mut current_oid = Some(head_oid);
    let mut commits_walked = 0;

    while !remaining.is_empty() && current_oid.is_some() && commits_walked < MAX_COMMITS_TO_WALK {
        let oid = current_oid.take().unwrap();
        commits_walked += 1;

        let commit_data = match store.get_object(&oid).await {
            Some(data) => data,
            None => break,
        };

        let (commit_info, parent_oid) = match parse_commit(&commit_data, &oid) {
            Some(c) => c,
            None => break,
        };

        let commit_tree_oid = match extract_tree_oid(&commit_data) {
            Some(t) => t,
            None => break,
        };

        let parent_tree_oid = if let Some(ref parent) = parent_oid {
            if let Some(parent_data) = store.get_object(parent).await {
                extract_tree_oid(&parent_data)
            } else {
                None
            }
        } else {
            None
        };

        let current_dir_tree = get_dir_tree_oid(store, &commit_tree_oid, dir_path).await;
        let parent_dir_tree = if let Some(ref pt) = parent_tree_oid {
            get_dir_tree_oid(store, pt, dir_path).await
        } else {
            None
        };

        let current_entries = if let Some(ref tree_oid) = current_dir_tree {
            get_tree_entries_map(store, tree_oid).await
        } else {
            HashMap::new()
        };

        let parent_entries = if let Some(ref tree_oid) = parent_dir_tree {
            get_tree_entries_map(store, tree_oid).await
        } else {
            HashMap::new()
        };

        for path in remaining.clone() {
            let file_name = path.split('/').last().unwrap_or(&path);
            let current_file_oid = current_entries.get(file_name);
            let parent_file_oid = parent_entries.get(file_name);

            let changed = match (current_file_oid, parent_file_oid) {
                (Some(curr), Some(par)) => curr != par,
                (Some(_), None) => true,
                (None, Some(_)) => true,
                (None, None) => false,
            };

            if changed {
                results.insert(path.clone(), FileLastCommit {
                    path: path.clone(),
                    commit_oid: commit_info.oid.clone(),
                    message: get_commit_title(&commit_info.message),
                    author_name: commit_info.author.name.clone(),
                    timestamp: commit_info.timestamp,
                });
                remaining.remove(&path);
            }
        }

        current_oid = parent_oid;
    }

    results.into_values().collect()
}

async fn get_dir_tree_oid(store: &S3GitStore, root_tree_oid: &str, dir_path: &str) -> Option<String> {
    if dir_path.is_empty() {
        return Some(root_tree_oid.to_string());
    }
    navigate_to_path(store, root_tree_oid, dir_path).await
}

async fn get_tree_entries_map(store: &S3GitStore, tree_oid: &str) -> HashMap<String, String> {
    let data = match store.get_object(tree_oid).await {
        Some(d) => d,
        None => return HashMap::new(),
    };

    parse_tree_entries(&data)
        .into_iter()
        .map(|(name, (oid, _entry_type))| (name, oid))
        .collect()
}

fn get_commit_title(message: &str) -> String {
    message.lines().next().unwrap_or("").to_string()
}
