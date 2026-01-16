use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{delete, get, patch, post},
    Extension, Json, Router,
};
use chrono::NaiveDateTime;
use crate::auth::naive_datetime_as_utc;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::{auth::{require_auth, AuthUser}, s3::S3Client, AppState};

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Repository {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub owner_id: String,
    pub visibility: String,
    pub default_branch: String,
    #[serde(with = "naive_datetime_as_utc")]
    pub created_at: NaiveDateTime,
    #[serde(with = "naive_datetime_as_utc")]
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct RepoWithOwnerRow {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub owner_id: String,
    pub visibility: String,
    pub default_branch: String,
    #[serde(with = "naive_datetime_as_utc")]
    pub created_at: NaiveDateTime,
    #[serde(with = "naive_datetime_as_utc")]
    pub updated_at: NaiveDateTime,
    pub username: String,
    pub user_name: String,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryOwner {
    pub id: String,
    pub username: String,
    pub name: String,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryWithOwner {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    #[serde(skip_serializing)]
    pub owner_id: String,
    pub visibility: String,
    pub default_branch: String,
    #[serde(with = "naive_datetime_as_utc")]
    pub created_at: NaiveDateTime,
    #[serde(with = "naive_datetime_as_utc")]
    pub updated_at: NaiveDateTime,
    pub owner: RepositoryOwner,
    pub star_count: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub starred: Option<bool>,
}

#[derive(Deserialize)]
pub struct CreateRepositoryRequest {
    pub name: String,
    pub description: Option<String>,
    pub visibility: String,
}

#[derive(Deserialize)]
pub struct UpdateRepositoryRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub visibility: Option<String>,
}

#[derive(Deserialize)]
pub struct PublicReposQuery {
    #[serde(rename = "sortBy")]
    pub sort_by: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

impl From<RepoWithOwnerRow> for RepositoryWithOwner {
    fn from(row: RepoWithOwnerRow) -> Self {
        Self {
            id: row.id,
            name: row.name,
            description: row.description,
            owner_id: row.owner_id.clone(),
            visibility: row.visibility,
            default_branch: row.default_branch,
            created_at: row.created_at,
            updated_at: row.updated_at,
            owner: RepositoryOwner {
                id: row.owner_id,
                username: row.username,
                name: row.user_name,
                avatar_url: row.avatar_url,
            },
            star_count: 0,
            starred: None,
        }
    }
}

async fn create_repository(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(body): Json<CreateRepositoryRequest>,
) -> Result<Json<Repository>, (StatusCode, String)> {
    let user = require_auth(&auth).map_err(|e| (e.0, e.1.to_string()))?;
    
    let normalized_name = body.name.to_lowercase().replace(' ', "-");
    
    if !normalized_name.chars().all(|c| c.is_alphanumeric() || c == '_' || c == '.' || c == '-') {
        return Err((StatusCode::BAD_REQUEST, "Invalid repository name".to_string()));
    }

    let existing: Option<Repository> = sqlx::query_as(
        "SELECT * FROM repositories WHERE owner_id = $1 AND name = $2"
    )
    .bind(&user.id)
    .bind(&normalized_name)
    .fetch_optional(&state.db.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if existing.is_some() {
        return Err((StatusCode::BAD_REQUEST, "Repository already exists".to_string()));
    }

    let repo: Repository = sqlx::query_as(
        r#"
        INSERT INTO repositories (name, description, visibility, owner_id)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        "#
    )
    .bind(&normalized_name)
    .bind(&body.description)
    .bind(&body.visibility)
    .bind(&user.id)
    .fetch_one(&state.db.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let repo_prefix = S3Client::get_repo_prefix(&user.id, &normalized_name);
    
    let _ = state.s3.put_object(
        &format!("{}/HEAD", repo_prefix),
        b"ref: refs/heads/main\n".to_vec()
    ).await;
    
    let _ = state.s3.put_object(
        &format!("{}/config", repo_prefix),
        b"[core]\n\trepositoryformatversion = 0\n\tfilemode = true\n\tbare = true\n".to_vec()
    ).await;
    
    let _ = state.s3.put_object(
        &format!("{}/description", repo_prefix),
        b"Unnamed repository; edit this file to name the repository.\n".to_vec()
    ).await;

    Ok(Json(repo))
}

async fn get_repository(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path((owner, name)): Path<(String, String)>,
) -> Result<Json<RepositoryWithOwner>, (StatusCode, String)> {
    let row: RepoWithOwnerRow = sqlx::query_as(
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
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut result: RepositoryWithOwner = row.into();
    result.star_count = star_count.0;

    Ok(Json(result))
}

async fn get_user_repositories(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(username): Path<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    #[derive(FromRow)]
    struct UserRow { id: String, username: String, name: String, avatar_url: Option<String> }

    let user: Option<UserRow> = sqlx::query_as(
        "SELECT id, username, name, avatar_url FROM users WHERE username = $1"
    )
    .bind(&username)
    .fetch_optional(&state.db.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let user = match user {
        Some(u) => u,
        None => return Ok(Json(serde_json::json!({ "repos": [] }))),
    };

    let is_owner = auth.0.as_ref().map(|u| u.id == user.id).unwrap_or(false);

    let repos: Vec<Repository> = if is_owner {
        sqlx::query_as("SELECT * FROM repositories WHERE owner_id = $1 ORDER BY updated_at DESC")
            .bind(&user.id)
            .fetch_all(&state.db.pool)
            .await
    } else {
        sqlx::query_as("SELECT * FROM repositories WHERE owner_id = $1 AND visibility = 'public' ORDER BY updated_at DESC")
            .bind(&user.id)
            .fetch_all(&state.db.pool)
            .await
    }
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut repos_with_stars = Vec::new();
    for repo in repos {
        let star_count: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM stars WHERE repository_id = $1"
        )
        .bind(repo.id)
        .fetch_one(&state.db.pool)
        .await
        .unwrap_or((0,));

        repos_with_stars.push(RepositoryWithOwner {
            id: repo.id,
            name: repo.name,
            description: repo.description,
            owner_id: repo.owner_id,
            visibility: repo.visibility,
            default_branch: repo.default_branch,
            created_at: repo.created_at,
            updated_at: repo.updated_at,
            owner: RepositoryOwner {
                id: user.id.clone(),
                username: user.username.clone(),
                name: user.name.clone(),
                avatar_url: user.avatar_url.clone(),
            },
            star_count: star_count.0,
            starred: None,
        });
    }

    Ok(Json(serde_json::json!({ "repos": repos_with_stars })))
}

async fn delete_repository(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let user = require_auth(&auth).map_err(|e| (e.0, e.1.to_string()))?;

    let repo: Repository = sqlx::query_as("SELECT * FROM repositories WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Repository not found".to_string()))?;

    if repo.owner_id != user.id {
        return Err((StatusCode::UNAUTHORIZED, "Unauthorized".to_string()));
    }

    let repo_prefix = S3Client::get_repo_prefix(&user.id, &repo.name);
    state.s3.delete_prefix(&repo_prefix).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to delete repository storage: {}", e)))?;

    sqlx::query("DELETE FROM repositories WHERE id = $1")
        .bind(id)
        .execute(&state.db.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(serde_json::json!({ "success": true })))
}

async fn update_repository(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateRepositoryRequest>,
) -> Result<Json<Repository>, (StatusCode, String)> {
    let user = require_auth(&auth).map_err(|e| (e.0, e.1.to_string()))?;

    let repo: Repository = sqlx::query_as("SELECT * FROM repositories WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Repository not found".to_string()))?;

    if repo.owner_id != user.id {
        return Err((StatusCode::UNAUTHORIZED, "Unauthorized".to_string()));
    }

    let new_name = body.name.as_ref().map(|n| n.to_lowercase().replace(' ', "-")).unwrap_or(repo.name.clone());
    
    if let Some(ref name) = body.name {
        if !name.chars().all(|c| c.is_alphanumeric() || c == '_' || c == '.' || c == '-') {
            return Err((StatusCode::BAD_REQUEST, "Invalid repository name".to_string()));
        }

        if new_name != repo.name {
            let existing: Option<Repository> = sqlx::query_as(
                "SELECT * FROM repositories WHERE owner_id = $1 AND name = $2"
            )
            .bind(&user.id)
            .bind(&new_name)
            .fetch_optional(&state.db.pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

            if existing.is_some() {
                return Err((StatusCode::BAD_REQUEST, "Repository with this name already exists".to_string()));
            }
        }
    }

    let updated: Repository = sqlx::query_as(
        r#"
        UPDATE repositories 
        SET name = $1, description = $2, visibility = $3, updated_at = NOW()
        WHERE id = $4
        RETURNING *
        "#
    )
    .bind(&new_name)
    .bind(body.description.as_ref().or(repo.description.as_ref()))
    .bind(body.visibility.as_ref().unwrap_or(&repo.visibility))
    .bind(id)
    .fetch_one(&state.db.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(updated))
}

#[derive(FromRow)]
struct PublicRepoRow {
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
    star_count: i64,
}

async fn get_public_repositories(
    State(state): State<AppState>,
    Query(query): Query<PublicReposQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let sort_by = query.sort_by.as_deref().unwrap_or("updated");
    let limit = query.limit.unwrap_or(20);
    let offset = query.offset.unwrap_or(0);

    let order_clause = match sort_by {
        "stars" => "star_count DESC",
        "created" => "r.created_at DESC",
        _ => "r.updated_at DESC",
    };

    let sql = format!(
        r#"
        SELECT r.id, r.name, r.description, r.owner_id, r.visibility, r.default_branch,
               r.created_at, r.updated_at, u.username, u.name as user_name, u.avatar_url,
               (SELECT COUNT(*) FROM stars WHERE repository_id = r.id) as star_count
        FROM repositories r
        JOIN users u ON u.id = r.owner_id
        WHERE r.visibility = 'public'
        ORDER BY {}
        LIMIT $1 OFFSET $2
        "#,
        order_clause
    );

    let rows: Vec<PublicRepoRow> = sqlx::query_as(&sql)
        .bind(limit + 1)
        .bind(offset)
        .fetch_all(&state.db.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let has_more = rows.len() as i64 > limit;
    let repos: Vec<_> = rows.into_iter().take(limit as usize).map(|row| {
        serde_json::json!({
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
            "starCount": row.star_count,
        })
    }).collect();

    Ok(Json(serde_json::json!({
        "repos": repos,
        "hasMore": has_more,
    })))
}

async fn star_repository(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let user = require_auth(&auth).map_err(|e| (e.0, e.1.to_string()))?;

    let existing: Option<(String,)> = sqlx::query_as(
        "SELECT user_id FROM stars WHERE user_id = $1 AND repository_id = $2"
    )
    .bind(&user.id)
    .bind(id)
    .fetch_optional(&state.db.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if existing.is_some() {
        sqlx::query("DELETE FROM stars WHERE user_id = $1 AND repository_id = $2")
            .bind(&user.id)
            .bind(id)
            .execute(&state.db.pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        
        Ok(Json(serde_json::json!({ "starred": false })))
    } else {
        sqlx::query("INSERT INTO stars (user_id, repository_id) VALUES ($1, $2)")
            .bind(&user.id)
            .bind(id)
            .execute(&state.db.pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        
        Ok(Json(serde_json::json!({ "starred": true })))
    }
}

async fn is_starred(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let starred = if let Some(user) = &auth.0 {
        let existing: Option<(String,)> = sqlx::query_as(
            "SELECT user_id FROM stars WHERE user_id = $1 AND repository_id = $2"
        )
        .bind(&user.id)
        .bind(id)
        .fetch_optional(&state.db.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        
        existing.is_some()
    } else {
        false
    };

    Ok(Json(serde_json::json!({ "starred": starred })))
}

async fn get_repository_with_stars(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path((owner, name)): Path<(String, String)>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let row: RepoWithOwnerRow = sqlx::query_as(
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

    Ok(Json(serde_json::json!({
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
    })))
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/repositories", post(create_repository))
        .route("/api/repositories/public", get(get_public_repositories))
        .route("/api/repositories/user/{username}", get(get_user_repositories))
        .route("/api/repositories/{owner}/{name}", get(get_repository))
        .route("/api/repositories/{owner}/{name}/with-stars", get(get_repository_with_stars))
        .route("/api/repositories/{id}", delete(delete_repository))
        .route("/api/repositories/{id}", patch(update_repository))
        .route("/api/repositories/{id}/star", post(star_repository))
        .route("/api/repositories/{id}/is-starred", get(is_starred))
}
