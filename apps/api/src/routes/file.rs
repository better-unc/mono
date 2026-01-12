use axum::{
    body::Body,
    extract::{Path, State},
    http::{header, StatusCode},
    response::Response,
    routing::get,
    Extension, Router,
};
use sqlx::FromRow;

use crate::{
    auth::{require_auth, AuthUser},
    git::{handler::get_file, objects::R2GitStore},
    s3::S3Client,
    AppState,
};

#[derive(FromRow)]
struct RepoRow {
    owner_id: String,
    visibility: String,
}

#[derive(FromRow)]
struct UserIdRow {
    id: String,
}

async fn stream_file(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path((username, repo, branch, file_path)): Path<(String, String, String, String)>,
) -> Result<Response, (StatusCode, String)> {
    let user: UserIdRow = sqlx::query_as("SELECT id FROM users WHERE username = $1")
        .bind(&username)
        .fetch_optional(&state.db.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "User not found".to_string()))?;

    let repo_name = repo.trim_end_matches(".git");
    let repo_row: RepoRow = sqlx::query_as(
        "SELECT owner_id, visibility FROM repositories WHERE owner_id = $1 AND name = $2"
    )
    .bind(&user.id)
    .bind(repo_name)
    .fetch_optional(&state.db.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Repository not found".to_string()))?;

    if repo_row.visibility == "private" {
        let current_user = require_auth(&auth).map_err(|e| (e.0, e.1.to_string()))?;
        if current_user.id != repo_row.owner_id {
            return Err((StatusCode::NOT_FOUND, "Repository not found".to_string()));
        }
    }

    let repo_prefix = S3Client::get_repo_prefix(&user.id, repo_name);
    let store = R2GitStore::new(state.s3.clone(), repo_prefix);

    let (content, _oid) = get_file(&store, &branch, &file_path)
        .await
        .ok_or((StatusCode::NOT_FOUND, "File not found".to_string()))?;

    let blob = content.into_bytes();
    let total_size = blob.len();

    Ok(Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "application/octet-stream")
        .header(header::CONTENT_LENGTH, total_size.to_string())
        .header(header::ACCEPT_RANGES, "bytes")
        .header("X-Total-Size", total_size.to_string())
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .header(header::ACCESS_CONTROL_ALLOW_METHODS, "GET, HEAD, OPTIONS")
        .body(Body::from(blob))
        .unwrap())
}

async fn file_options() -> Response {
    Response::builder()
        .status(StatusCode::OK)
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .header(header::ACCESS_CONTROL_ALLOW_METHODS, "GET, HEAD, OPTIONS")
        .header(header::ACCESS_CONTROL_ALLOW_HEADERS, "Range")
        .body(Body::empty())
        .unwrap()
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/file/{username}/{repo}/{branch}/{*file_path}", get(stream_file))
        .route("/file/{username}/{repo}/{branch}/{*file_path}", axum::routing::options(file_options))
}
