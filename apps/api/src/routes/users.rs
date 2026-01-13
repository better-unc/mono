use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::get,
    Extension, Json, Router,
};
use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use crate::{auth::{naive_datetime_as_utc, AuthUser, User}, AppState};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicUser {
    pub id: String,
    pub username: String,
    pub name: String,
    pub bio: Option<String>,
    pub location: Option<String>,
    pub website: Option<String>,
    pub pronouns: Option<String>,
    pub avatar_url: Option<String>,
    #[serde(with = "naive_datetime_as_utc")]
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicUserWithRepoCount {
    pub id: String,
    pub username: String,
    pub name: String,
    pub bio: Option<String>,
    pub avatar_url: Option<String>,
    #[serde(with = "naive_datetime_as_utc")]
    pub created_at: NaiveDateTime,
    pub repo_count: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserProfile {
    pub id: String,
    pub username: String,
    pub name: String,
    pub bio: Option<String>,
    pub location: Option<String>,
    pub website: Option<String>,
    pub pronouns: Option<String>,
    pub avatar_url: Option<String>,
    pub company: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_active_at: Option<NaiveDateTime>,
    pub git_email: Option<String>,
    pub default_repository_visibility: String,
    pub preferences: Option<serde_json::Value>,
    pub social_links: Option<serde_json::Value>,
    #[serde(with = "naive_datetime_as_utc")]
    pub created_at: NaiveDateTime,
    #[serde(with = "naive_datetime_as_utc")]
    pub updated_at: NaiveDateTime,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub email_verified: Option<bool>,
}

#[derive(Deserialize)]
pub struct PublicUsersQuery {
    #[serde(rename = "sortBy")]
    pub sort_by: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(FromRow)]
struct UserWithRepoCountRow {
    id: String,
    name: String,
    username: String,
    avatar_url: Option<String>,
    bio: Option<String>,
    created_at: NaiveDateTime,
    repo_count: i64,
}

#[derive(FromRow)]
struct UserProfileRow {
    id: String,
    name: String,
    username: String,
    bio: Option<String>,
    location: Option<String>,
    website: Option<String>,
    pronouns: Option<String>,
    avatar_url: Option<String>,
    company: Option<String>,
    last_active_at: Option<NaiveDateTime>,
    git_email: Option<String>,
    default_repository_visibility: String,
    preferences: Option<serde_json::Value>,
    social_links: Option<serde_json::Value>,
    email: String,
    email_verified: bool,
    created_at: NaiveDateTime,
    updated_at: NaiveDateTime,
}

async fn get_user(
    State(state): State<AppState>,
    Path(username): Path<String>,
) -> Result<Json<PublicUser>, (StatusCode, String)> {
    let user: User = sqlx::query_as(
        "SELECT id, name, email, username, bio, location, website, pronouns, avatar_url, created_at, updated_at FROM users WHERE username = $1"
    )
    .bind(&username)
    .fetch_optional(&state.db.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "User not found".to_string()))?;

    Ok(Json(PublicUser {
        id: user.id,
        username: user.username,
        name: user.name,
        bio: user.bio,
        location: user.location,
        website: user.website,
        pronouns: user.pronouns,
        avatar_url: user.avatar_url,
        created_at: user.created_at,
    }))
}

async fn get_current_user(
    Extension(auth): Extension<AuthUser>,
) -> Result<Json<User>, (StatusCode, &'static str)> {
    match auth.0 {
        Some(user) => Ok(Json(user)),
        None => Err((StatusCode::UNAUTHORIZED, "Unauthorized")),
    }
}

async fn get_public_users(
    State(state): State<AppState>,
    Query(query): Query<PublicUsersQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let sort_by = query.sort_by.as_deref().unwrap_or("newest");
    let limit = query.limit.unwrap_or(20);
    let offset = query.offset.unwrap_or(0);

    let order_clause = if sort_by == "oldest" {
        "u.created_at ASC"
    } else {
        "u.created_at DESC"
    };

    let sql = format!(
        r#"
        SELECT u.id, u.name, u.username, u.avatar_url, u.bio, u.created_at,
               (SELECT COUNT(*) FROM repositories WHERE owner_id = u.id AND visibility = 'public') as repo_count
        FROM users u
        ORDER BY {}
        LIMIT $1 OFFSET $2
        "#,
        order_clause
    );

    let rows: Vec<UserWithRepoCountRow> = sqlx::query_as(&sql)
        .bind(limit + 1)
        .bind(offset)
        .fetch_all(&state.db.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let has_more = rows.len() as i64 > limit;
    let users: Vec<_> = rows.into_iter().take(limit as usize).map(|row| {
        serde_json::json!({
            "id": row.id,
            "name": row.name,
            "username": row.username,
            "avatarUrl": row.avatar_url,
            "bio": row.bio,
            "createdAt": format!("{}Z", row.created_at.format("%Y-%m-%dT%H:%M:%S%.3f")),
            "repoCount": row.repo_count,
        })
    }).collect();

    Ok(Json(serde_json::json!({
        "users": users,
        "hasMore": has_more,
    })))
}

async fn get_user_profile(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(username): Path<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let row: UserProfileRow = sqlx::query_as(
        r#"
        SELECT id, name, username, bio, location, website, pronouns, avatar_url, 
               company, last_active_at, git_email, default_repository_visibility, preferences,
               social_links, email, email_verified, created_at, updated_at
        FROM users WHERE username = $1
        "#
    )
    .bind(&username)
    .fetch_optional(&state.db.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "User not found".to_string()))?;

    let is_own_profile = auth.0.as_ref().map(|u| u.id == row.id).unwrap_or(false);

    let mut response = serde_json::json!({
        "id": row.id,
        "name": row.name,
        "username": row.username,
        "avatarUrl": row.avatar_url,
        "bio": row.bio,
        "location": row.location,
        "website": row.website,
        "pronouns": row.pronouns,
        "company": row.company,
        "gitEmail": row.git_email,
        "defaultRepositoryVisibility": row.default_repository_visibility,
        "preferences": row.preferences,
        "socialLinks": row.social_links,
        "createdAt": format!("{}Z", row.created_at.format("%Y-%m-%dT%H:%M:%S%.3f")),
        "updatedAt": format!("{}Z", row.updated_at.format("%Y-%m-%dT%H:%M:%S%.3f")),
    });

    if row.last_active_at.is_some() {
        response["lastActiveAt"] = serde_json::json!(format!("{}Z", row.last_active_at.unwrap().format("%Y-%m-%dT%H:%M:%S%.3f")));
    }

    if is_own_profile {
        response["email"] = serde_json::json!(row.email);
        response["emailVerified"] = serde_json::json!(row.email_verified);
    }

    Ok(Json(response))
}

async fn get_user_starred(
    State(state): State<AppState>,
    Path(username): Path<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    #[derive(FromRow)]
    struct UserIdRow { id: String }

    let user: Option<UserIdRow> = sqlx::query_as("SELECT id FROM users WHERE username = $1")
        .bind(&username)
        .fetch_optional(&state.db.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let user = match user {
        Some(u) => u,
        None => return Ok(Json(serde_json::json!({ "repos": [] }))),
    };

    #[derive(FromRow)]
    struct StarredRepoRow {
        id: uuid::Uuid,
        name: String,
        description: Option<String>,
        visibility: String,
        default_branch: String,
        created_at: NaiveDateTime,
        updated_at: NaiveDateTime,
        owner_id: String,
        owner_username: String,
        owner_name: String,
        owner_avatar_url: Option<String>,
        starred_at: NaiveDateTime,
        star_count: i64,
    }

    let repos: Vec<StarredRepoRow> = sqlx::query_as(
        r#"
        SELECT r.id, r.name, r.description, r.visibility, r.default_branch,
               r.created_at, r.updated_at, r.owner_id, u.username as owner_username,
               u.name as owner_name, u.avatar_url as owner_avatar_url,
               s.created_at as starred_at,
               (SELECT COUNT(*) FROM stars WHERE repository_id = r.id) as star_count
        FROM stars s
        INNER JOIN repositories r ON s.repository_id = r.id
        INNER JOIN users u ON r.owner_id = u.id
        WHERE s.user_id = $1 AND r.visibility = 'public'
        ORDER BY s.created_at DESC
        "#
    )
    .bind(&user.id)
    .fetch_all(&state.db.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let repos: Vec<_> = repos.into_iter().map(|r| {
        serde_json::json!({
            "id": r.id,
            "name": r.name,
            "description": r.description,
            "visibility": r.visibility,
            "defaultBranch": r.default_branch,
            "createdAt": format!("{}Z", r.created_at.format("%Y-%m-%dT%H:%M:%S%.3f")),
            "updatedAt": format!("{}Z", r.updated_at.format("%Y-%m-%dT%H:%M:%S%.3f")),
            "starCount": r.star_count,
            "starredAt": format!("{}Z", r.starred_at.format("%Y-%m-%dT%H:%M:%S%.3f")),
            "owner": {
                "id": r.owner_id,
                "username": r.owner_username,
                "name": r.owner_name,
                "avatarUrl": r.owner_avatar_url,
            },
        })
    }).collect();

    Ok(Json(serde_json::json!({ "repos": repos })))
}

async fn get_avatar_by_username(
    State(state): State<AppState>,
    Path(username): Path<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    #[derive(FromRow)]
    struct AvatarRow {
        avatar_url: Option<String>,
    }

    let row: Option<AvatarRow> = sqlx::query_as("SELECT avatar_url FROM users WHERE username = $1")
        .bind(&username)
        .fetch_optional(&state.db.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(serde_json::json!({
        "avatarUrl": row.and_then(|r| r.avatar_url)
    })))
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/users/me", get(get_current_user))
        .route("/api/users/public", get(get_public_users))
        .route("/api/users/{username}/avatar", get(get_avatar_by_username))
        .route("/api/users/{username}", get(get_user))
        .route("/api/users/{username}/profile", get(get_user_profile))
        .route("/api/users/{username}/starred", get(get_user_starred))
}
