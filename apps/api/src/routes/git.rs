use axum::{
    body::Body,
    extract::{Path, Query, State},
    http::{header, StatusCode},
    response::Response,
    routing::{get, post},
    Extension, Json, Router,
};
use chrono::NaiveDateTime;
use serde::Deserialize;
use sqlx::FromRow;
use std::collections::HashMap;
use uuid::Uuid;

use crate::{
    auth::{require_auth, AuthUser},
    git::{
        handler::{get_blob_by_oid, get_commits, get_file, get_tree, list_branches},
        objects::R2GitStore,
        pack::{handle_receive_pack, handle_upload_pack},
        refs::get_refs_advertisement,
    },
    s3::S3Client,
    AppState,
};

#[derive(Debug, Clone, FromRow)]
pub struct Repository {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub owner_id: String,
    pub visibility: String,
    pub default_branch: String,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(FromRow)]
struct RepoWithUserRow {
    id: Uuid,
    name: String,
    description: Option<String>,
    owner_id: String,
    visibility: String,
    default_branch: String,
    created_at: NaiveDateTime,
    updated_at: NaiveDateTime,
    username: String,
    user_name: String,
    avatar_url: Option<String>,
}

#[derive(Deserialize)]
pub struct TreeQuery {
    pub branch: Option<String>,
    pub path: Option<String>,
}

#[derive(Deserialize)]
pub struct FileQuery {
    pub branch: Option<String>,
    pub path: String,
}

#[derive(Deserialize)]
pub struct CommitsQuery {
    pub branch: Option<String>,
    pub limit: Option<i64>,
    pub skip: Option<i64>,
}

#[derive(Deserialize)]
pub struct ReadmeQuery {
    pub oid: String,
}

#[derive(Deserialize)]
pub struct ServiceQuery {
    pub service: Option<String>,
}

async fn get_repo_and_store(
    state: &AppState,
    owner: &str,
    name: &str,
) -> Result<(Repository, R2GitStore, String), (StatusCode, String)> {
    #[derive(FromRow)]
    struct RepoUserRow {
        id: Uuid,
        name: String,
        description: Option<String>,
        owner_id: String,
        visibility: String,
        default_branch: String,
        created_at: NaiveDateTime,
        updated_at: NaiveDateTime,
        user_id: String,
    }

    let row: RepoUserRow = sqlx::query_as(
        r#"
        SELECT r.id, r.name, r.description, r.owner_id, r.visibility, r.default_branch,
               r.created_at, r.updated_at, u.id as user_id
        FROM repositories r
        JOIN users u ON u.id = r.owner_id
        WHERE u.username = $1 AND r.name = $2
        "#
    )
    .bind(owner)
    .bind(name.trim_end_matches(".git"))
    .fetch_optional(&state.db.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Repository not found".to_string()))?;

    let repo = Repository {
        id: row.id,
        name: row.name,
        description: row.description,
        owner_id: row.owner_id,
        visibility: row.visibility,
        default_branch: row.default_branch,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };

    let repo_prefix = S3Client::get_repo_prefix(&row.user_id, &repo.name);
    let store = R2GitStore::new(state.s3.clone(), repo_prefix);

    Ok((repo, store, row.user_id))
}

async fn get_branches(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path((owner, name)): Path<(String, String)>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let (repo, store, _) = get_repo_and_store(&state, &owner, &name).await?;

    if repo.visibility == "private" {
        if auth.0.as_ref().map(|u| u.id != repo.owner_id).unwrap_or(true) {
            return Err((StatusCode::NOT_FOUND, "Repository not found".to_string()));
        }
    }

    let branches = list_branches(&store).await;
    Ok(Json(serde_json::json!({ "branches": branches })))
}

async fn debug_refs(
    State(state): State<AppState>,
    Path((owner, name)): Path<(String, String)>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let (repo, store, user_id) = get_repo_and_store(&state, &owner, &name).await?;

    let prefix = &store.prefix;
    let main_resolved = store.resolve_ref("refs/heads/main").await;

    let debug_info = if let Some(ref commit_oid) = main_resolved {
        let commit_obj = store.get_object(commit_oid).await;

        let (_commit_content, tree_oid) = if let Some(ref data) = commit_obj {
            use std::io::Read;
            let mut decoder = flate2::read::ZlibDecoder::new(data.as_slice());
            let mut result = Vec::new();
            if decoder.read_to_end(&mut result).is_ok() {
                let null_pos = result.iter().position(|&b| b == 0);
                let content = null_pos.and_then(|p| std::str::from_utf8(&result[p + 1..]).ok());
                let tree_oid = content.and_then(|c| {
                    c.lines().find(|l| l.starts_with("tree ")).map(|l| l[5..].to_string())
                });
                (Some(String::from_utf8_lossy(&result).to_string()), tree_oid)
            } else {
                (Some("decompress failed".to_string()), None)
            }
        } else {
            (None, None)
        };

        let pack_dir = format!("{}/objects/pack", prefix);
        let pack_files = state.s3.list_objects(&pack_dir).await;
        let idx_files: Vec<_> = pack_files.iter().filter(|f| f.ends_with(".idx")).cloned().collect();

        let commit_bytes = hex::decode(commit_oid).unwrap_or_default();
        let tree_bytes = tree_oid.as_ref().and_then(|t| hex::decode(t).ok()).unwrap_or_default();

        let mut commit_found_in: Option<String> = None;
        let mut tree_found_in: Option<String> = None;

        for idx_path in &idx_files {
            if let Some(idx_data) = state.s3.get_object(idx_path).await {
                if commit_found_in.is_none() {
                    if crate::git::objects::find_object_in_index_pub(&idx_data, &commit_bytes).is_some() {
                        commit_found_in = Some(idx_path.split('/').last().unwrap_or("").to_string());
                    }
                }
                if tree_found_in.is_none() && !tree_bytes.is_empty() {
                    if crate::git::objects::find_object_in_index_pub(&idx_data, &tree_bytes).is_some() {
                        tree_found_in = Some(idx_path.split('/').last().unwrap_or("").to_string());
                    }
                }
                if commit_found_in.is_some() && tree_found_in.is_some() {
                    break;
                }
            }
        }

        let tree_via_get_object = if let Some(ref t_oid) = tree_oid {
            store.get_object(t_oid).await
        } else {
            None
        };

        serde_json::json!({
            "commit_oid": commit_oid,
            "commit_exists": commit_obj.is_some(),
            "tree_oid": tree_oid,
            "total_packs": idx_files.len(),
            "commit_found_in_pack": commit_found_in,
            "tree_found_in_pack": tree_found_in,
            "tree_via_get_object_len": tree_via_get_object.as_ref().map(|d| d.len()),
        })
    } else {
        serde_json::json!({ "error": "could not resolve main ref" })
    };

    Ok(Json(serde_json::json!({
        "prefix": prefix,
        "user_id": user_id,
        "repo_name": repo.name,
        "debug_info": debug_info,
    })))
}

#[derive(FromRow)]
struct UserEmailRow {
    email: String,
    id: String,
    username: String,
    avatar_url: Option<String>,
}

async fn get_users_by_emails(
    db: &crate::db::Database,
    emails: &[String],
) -> Result<HashMap<String, UserEmailRow>, sqlx::Error> {
    if emails.is_empty() {
        return Ok(HashMap::new());
    }

    let placeholders: Vec<String> = (1..=emails.len()).map(|i| format!("${}", i)).collect();
    let query = format!("SELECT email, id, username, avatar_url FROM users WHERE email IN ({})", placeholders.join(", "));
    
    let mut query_builder = sqlx::query_as::<_, UserEmailRow>(&query);
    for email in emails {
        query_builder = query_builder.bind(email);
    }
    
    let users = query_builder.fetch_all(&db.pool).await?;
    Ok(users.into_iter().map(|u| (u.email.clone(), u)).collect())
}

async fn get_commits_route(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path((owner, name)): Path<(String, String)>,
    Query(query): Query<CommitsQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let (repo, store, _) = get_repo_and_store(&state, &owner, &name).await?;

    if repo.visibility == "private" {
        if auth.0.as_ref().map(|u| u.id != repo.owner_id).unwrap_or(true) {
            return Err((StatusCode::NOT_FOUND, "Repository not found".to_string()));
        }
    }

    let branch = query.branch.as_deref().unwrap_or("main");
    let limit = query.limit.unwrap_or(30) as usize;
    let skip = query.skip.unwrap_or(0) as usize;

    let (mut commits, has_more) = get_commits(&store, branch, limit, skip).await;

    let emails: Vec<String> = commits.iter().map(|c| c.author.email.clone()).collect();
    let user_map = get_users_by_emails(&state.db, &emails).await.unwrap_or_default();

    for commit in &mut commits {
        if let Some(user) = user_map.get(&commit.author.email) {
            commit.author.username = Some(user.username.clone());
            commit.author.userId = Some(user.id.clone());
            commit.author.avatarUrl = user.avatar_url.clone();
        }
    }

    Ok(Json(serde_json::json!({
        "commits": commits,
        "hasMore": has_more,
    })))
}

async fn get_commit_count(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path((owner, name)): Path<(String, String)>,
    Query(query): Query<CommitsQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let (repo, store, _) = get_repo_and_store(&state, &owner, &name).await?;

    if repo.visibility == "private" {
        if auth.0.as_ref().map(|u| u.id != repo.owner_id).unwrap_or(true) {
            return Err((StatusCode::NOT_FOUND, "Repository not found".to_string()));
        }
    }

    let branch = query.branch.as_deref().unwrap_or("main");
    let (commits, _) = get_commits(&store, branch, 10000, 0).await;

    Ok(Json(serde_json::json!({ "count": commits.len() })))
}

async fn get_tree_route(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path((owner, name)): Path<(String, String)>,
    Query(query): Query<TreeQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let (repo, store, _) = get_repo_and_store(&state, &owner, &name).await?;

    if repo.visibility == "private" {
        if auth.0.as_ref().map(|u| u.id != repo.owner_id).unwrap_or(true) {
            return Err((StatusCode::NOT_FOUND, "Repository not found".to_string()));
        }
    }

    let branch = query.branch.as_deref().unwrap_or("main");
    let path = query.path.as_deref().unwrap_or("");

    let files = get_tree(&store, branch, path).await;

    match files {
        Some(entries) => {
            Ok(Json(serde_json::json!({
                "files": entries,
                "isEmpty": false,
            })))
        },
        None => Ok(Json(serde_json::json!({
            "files": [],
            "isEmpty": true,
        }))),
    }
}

async fn get_readme_oid(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path((owner, name)): Path<(String, String)>,
    Query(query): Query<TreeQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let (repo, store, _) = get_repo_and_store(&state, &owner, &name).await?;

    if repo.visibility == "private" {
        if auth.0.as_ref().map(|u| u.id != repo.owner_id).unwrap_or(true) {
            return Err((StatusCode::NOT_FOUND, "Repository not found".to_string()));
        }
    }

    let branch = query.branch.as_deref().unwrap_or("main");
    let files = get_tree(&store, branch, "").await;

    let readme_oid = files.and_then(|entries| {
        entries.iter()
            .find(|f| f.name.to_lowercase() == "readme.md" && f.entry_type == "blob")
            .map(|f| f.oid.clone())
    });

    Ok(Json(serde_json::json!({ "readmeOid": readme_oid })))
}

async fn get_file_route(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path((owner, name)): Path<(String, String)>,
    Query(query): Query<FileQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let (repo, store, _) = get_repo_and_store(&state, &owner, &name).await?;

    if repo.visibility == "private" {
        if auth.0.as_ref().map(|u| u.id != repo.owner_id).unwrap_or(true) {
            return Err((StatusCode::NOT_FOUND, "Repository not found".to_string()));
        }
    }

    let branch = query.branch.as_deref().unwrap_or("main");

    match get_file(&store, branch, &query.path).await {
        Some((content, oid)) => Ok(Json(serde_json::json!({
            "content": content,
            "oid": oid,
            "path": query.path,
        }))),
        None => Err((StatusCode::NOT_FOUND, "File not found".to_string())),
    }
}

async fn get_readme(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path((owner, name)): Path<(String, String)>,
    Query(query): Query<ReadmeQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let (repo, store, _) = get_repo_and_store(&state, &owner, &name).await?;

    if repo.visibility == "private" {
        if auth.0.as_ref().map(|u| u.id != repo.owner_id).unwrap_or(true) {
            return Err((StatusCode::NOT_FOUND, "Repository not found".to_string()));
        }
    }

    match get_blob_by_oid(&store, &query.oid).await {
        Some(content) => Ok(Json(serde_json::json!({ "content": content }))),
        None => Err((StatusCode::NOT_FOUND, "Readme not found".to_string())),
    }
}

async fn get_repo_info(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path((owner, name)): Path<(String, String)>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let row: RepoWithUserRow = sqlx::query_as(
        r#"
        SELECT r.id, r.name, r.description, r.owner_id, r.visibility, r.default_branch,
               r.created_at, r.updated_at, u.username, u.name as user_name, u.avatar_url
        FROM repositories r
        JOIN users u ON u.id = r.owner_id
        WHERE u.username = $1 AND r.name = $2
        "#
    )
    .bind(&owner)
    .bind(&name)
    .fetch_optional(&state.db.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Repository not found".to_string()))?;

    if row.visibility == "private" {
        if auth.0.as_ref().map(|u| u.id != row.owner_id).unwrap_or(true) {
            return Err((StatusCode::NOT_FOUND, "Repository not found".to_string()));
        }
    }

    let star_count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM stars WHERE repository_id = $1"
    )
    .bind(row.id)
    .fetch_one(&state.db.pool)
    .await
    .unwrap_or((0,));

    let starred = if let Some(user) = &auth.0 {
        let existing: Option<(String,)> = sqlx::query_as(
            "SELECT user_id FROM stars WHERE user_id = $1 AND repository_id = $2"
        )
        .bind(&user.id)
        .bind(row.id)
        .fetch_optional(&state.db.pool)
        .await
        .ok()
        .flatten();
        existing.is_some()
    } else {
        false
    };

    let is_owner = auth.0.as_ref().map(|u| u.id == row.owner_id).unwrap_or(false);

    Ok(Json(serde_json::json!({
        "repo": {
            "id": row.id,
            "name": row.name,
            "description": row.description,
            "visibility": row.visibility,
            "defaultBranch": row.default_branch,
            "createdAt": format!("{}Z", row.created_at.format("%Y-%m-%dT%H:%M:%S%.3f")),
            "updatedAt": format!("{}Z", row.updated_at.format("%Y-%m-%dT%H:%M:%S%.3f")),
            "owner": {
                "id": row.owner_id,
                "username": row.username,
                "name": row.user_name,
                "avatarUrl": row.avatar_url,
            },
            "starCount": star_count.0,
            "starred": starred,
        },
        "isOwner": is_owner,
    })))
}

async fn get_page_data(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path((owner, name)): Path<(String, String)>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let row: RepoWithUserRow = sqlx::query_as(
        r#"
        SELECT r.id, r.name, r.description, r.owner_id, r.visibility, r.default_branch,
               r.created_at, r.updated_at, u.username, u.name as user_name, u.avatar_url
        FROM repositories r
        JOIN users u ON u.id = r.owner_id
        WHERE u.username = $1 AND r.name = $2
        "#
    )
    .bind(&owner)
    .bind(&name)
    .fetch_optional(&state.db.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Repository not found".to_string()))?;

    if row.visibility == "private" {
        if auth.0.as_ref().map(|u| u.id != row.owner_id).unwrap_or(true) {
            return Err((StatusCode::NOT_FOUND, "Repository not found".to_string()));
        }
    }

    let repo_prefix = S3Client::get_repo_prefix(&row.owner_id, &row.name);
    tracing::info!("page-data: repo_prefix = {}", repo_prefix);
    let store = R2GitStore::new(state.s3.clone(), repo_prefix);

    let branches = list_branches(&store).await;
    tracing::info!("page-data: found {} branches", branches.len());

    let star_count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM stars WHERE repository_id = $1"
    )
    .bind(row.id)
    .fetch_one(&state.db.pool)
    .await
    .unwrap_or((0,));

    let starred = if let Some(user) = &auth.0 {
        let existing: Option<(String,)> = sqlx::query_as(
            "SELECT user_id FROM stars WHERE user_id = $1 AND repository_id = $2"
        )
        .bind(&user.id)
        .bind(row.id)
        .fetch_optional(&state.db.pool)
        .await
        .ok()
        .flatten();
        existing.is_some()
    } else {
        false
    };

    let is_owner = auth.0.as_ref().map(|u| u.id == row.owner_id).unwrap_or(false);

    Ok(Json(serde_json::json!({
        "repo": {
            "id": row.id,
            "name": row.name,
            "description": row.description,
            "visibility": row.visibility,
            "defaultBranch": row.default_branch,
            "createdAt": format!("{}Z", row.created_at.format("%Y-%m-%dT%H:%M:%S%.3f")),
            "updatedAt": format!("{}Z", row.updated_at.format("%Y-%m-%dT%H:%M:%S%.3f")),
            "owner": {
                "id": row.owner_id,
                "username": row.username,
                "name": row.user_name,
                "avatarUrl": row.avatar_url,
            },
            "starCount": star_count.0,
            "starred": starred,
        },
        "branches": branches,
        "isOwner": is_owner,
    })))
}

async fn info_refs(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path((owner, name)): Path<(String, String)>,
    Query(query): Query<ServiceQuery>,
) -> Result<Response, (StatusCode, String)> {
    let service = query.service.ok_or((StatusCode::NOT_FOUND, "Service not specified".to_string()))?;

    if service != "git-upload-pack" && service != "git-receive-pack" {
        return Err((StatusCode::NOT_FOUND, "Invalid service".to_string()));
    }

    let (repo, store, _) = get_repo_and_store(&state, &owner, &name).await?;

    if service == "git-receive-pack" {
        let user = require_auth(&auth).map_err(|e| (e.0, e.1.to_string()))?;
        if user.id != repo.owner_id {
            return Err((StatusCode::UNAUTHORIZED, "Unauthorized".to_string()));
        }
    } else if repo.visibility == "private" {
        let user = require_auth(&auth).map_err(|e| (e.0, e.1.to_string()))?;
        if user.id != repo.owner_id {
            return Err((StatusCode::NOT_FOUND, "Repository not found".to_string()));
        }
    }

    let refs = get_refs_advertisement(&store, &service).await;

    let packet = format!("# service={}\n", service);
    let packet_len = format!("{:04x}", packet.len() + 4);

    let mut response = Vec::new();
    response.extend(packet_len.as_bytes());
    response.extend(packet.as_bytes());
    response.extend(b"0000");
    response.extend(&refs);

    Ok(Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, format!("application/x-{}-advertisement", service))
        .header(header::CACHE_CONTROL, "no-cache")
        .body(Body::from(response))
        .unwrap())
}

async fn upload_pack(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path((owner, name)): Path<(String, String)>,
    body: axum::body::Bytes,
) -> Result<Response, (StatusCode, String)> {
    let (repo, store, _) = get_repo_and_store(&state, &owner, &name).await?;

    if repo.visibility == "private" {
        let user = require_auth(&auth).map_err(|e| (e.0, e.1.to_string()))?;
        if user.id != repo.owner_id {
            return Err((StatusCode::NOT_FOUND, "Repository not found".to_string()));
        }
    }

    let response = handle_upload_pack(&store, &body).await;

    Ok(Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "application/x-git-upload-pack-result")
        .header(header::CACHE_CONTROL, "no-cache")
        .body(Body::from(response))
        .unwrap())
}

async fn receive_pack(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path((owner, name)): Path<(String, String)>,
    body: axum::body::Bytes,
) -> Result<Response, (StatusCode, String)> {
    let (repo, store, _) = get_repo_and_store(&state, &owner, &name).await?;

    let user = require_auth(&auth).map_err(|e| (e.0, e.1.to_string()))?;
    if user.id != repo.owner_id {
        return Err((StatusCode::UNAUTHORIZED, "Unauthorized".to_string()));
    }

    let response = handle_receive_pack(&store, &body).await;

    Ok(Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "application/x-git-receive-pack-result")
        .header(header::CACHE_CONTROL, "no-cache")
        .body(Body::from(response))
        .unwrap())
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/repositories/{owner}/{name}/branches", get(get_branches))
        .route("/api/repositories/{owner}/{name}/commits", get(get_commits_route))
        .route("/api/repositories/{owner}/{name}/commits/count", get(get_commit_count))
        .route("/api/repositories/{owner}/{name}/tree", get(get_tree_route))
        .route("/api/repositories/{owner}/{name}/file", get(get_file_route))
        .route("/api/repositories/{owner}/{name}/readme-oid", get(get_readme_oid))
        .route("/api/repositories/{owner}/{name}/readme", get(get_readme))
        .route("/api/repositories/{owner}/{name}/info", get(get_repo_info))
        .route("/api/repositories/{owner}/{name}/page-data", get(get_page_data))
        .route("/api/repositories/{owner}/{name}/debug-refs", get(debug_refs))
        .route("/{owner}/{name}/info/refs", get(info_refs))
        .route("/{owner}/{name}/git-upload-pack", post(upload_pack))
        .route("/{owner}/{name}/git-receive-pack", post(receive_pack))
}
