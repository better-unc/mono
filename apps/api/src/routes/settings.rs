use axum::{
    extract::{Multipart, State},
    http::StatusCode,
    routing::{get, patch, post},
    Extension, Json, Router,
};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use crate::{auth::{require_auth, AuthUser, User}, s3::S3Client, AppState};

#[derive(Debug, Deserialize)]
pub struct UpdateProfileRequest {
    pub name: Option<String>,
    pub username: Option<String>,
    pub bio: Option<String>,
    pub location: Option<String>,
    pub website: Option<String>,
    pub pronouns: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateEmailRequest {
    pub email: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateSocialLinksRequest {
    pub github: Option<String>,
    pub twitter: Option<String>,
    pub linkedin: Option<String>,
    pub custom: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePasswordRequest {
    #[serde(rename = "currentPassword")]
    pub current_password: String,
    #[serde(rename = "newPassword")]
    pub new_password: String,
}

#[derive(Debug, Serialize)]
pub struct SettingsResponse {
    pub user: User,
}

#[derive(FromRow)]
struct AccountRow {
    id: String,
    password: Option<String>,
}

#[derive(FromRow)]
struct RepoRow {
    name: String,
}

async fn get_settings(
    Extension(auth): Extension<AuthUser>,
) -> Result<Json<SettingsResponse>, (StatusCode, &'static str)> {
    let user = require_auth(&auth)?;
    Ok(Json(SettingsResponse { user: user.clone() }))
}

async fn update_profile(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(body): Json<UpdateProfileRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let user = require_auth(&auth).map_err(|e| (e.0, e.1.to_string()))?;

    let normalized_username = body.username.as_ref().map(|u| {
        u.to_lowercase().replace(' ', "-")
    });

    if let Some(ref username) = normalized_username {
        let re = regex::Regex::new(r"^[a-zA-Z0-9_-]+$").unwrap();
        if !re.is_match(username) {
            return Err((StatusCode::BAD_REQUEST, "Username can only contain letters, numbers, underscores, and hyphens".to_string()));
        }
        if username.len() < 3 {
            return Err((StatusCode::BAD_REQUEST, "Username must be at least 3 characters".to_string()));
        }

        let existing: Option<(String,)> = sqlx::query_as(
            "SELECT id FROM users WHERE username = $1 AND id != $2"
        )
        .bind(username)
        .bind(&user.id)
        .fetch_optional(&state.db.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        if existing.is_some() {
            return Err((StatusCode::BAD_REQUEST, "Username is already taken".to_string()));
        }
    }

    let final_username = normalized_username.unwrap_or_else(|| user.username.clone());

    sqlx::query(
        r#"
        UPDATE users 
        SET name = COALESCE($1, name),
            username = $2,
            bio = COALESCE($3, bio),
            location = COALESCE($4, location),
            website = COALESCE($5, website),
            pronouns = COALESCE($6, pronouns),
            updated_at = NOW()
        WHERE id = $7
        "#
    )
    .bind(&body.name)
    .bind(&final_username)
    .bind(&body.bio)
    .bind(&body.location)
    .bind(&body.website)
    .bind(&body.pronouns)
    .bind(&user.id)
    .execute(&state.db.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(serde_json::json!({ "success": true, "username": final_username })))
}

async fn update_email(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(body): Json<UpdateEmailRequest>,
) -> Result<Json<User>, (StatusCode, String)> {
    let user = require_auth(&auth).map_err(|e| (e.0, e.1.to_string()))?;

    let existing: Option<(String,)> = sqlx::query_as(
        "SELECT id FROM users WHERE email = $1 AND id != $2"
    )
    .bind(&body.email)
    .bind(&user.id)
    .fetch_optional(&state.db.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if existing.is_some() {
        return Err((StatusCode::BAD_REQUEST, "Email already in use".to_string()));
    }

    let updated: User = sqlx::query_as(
        r#"
        UPDATE users 
        SET email = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
        "#
    )
    .bind(&body.email)
    .bind(&user.id)
    .fetch_one(&state.db.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(updated))
}

async fn delete_account(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let user = require_auth(&auth).map_err(|e| (e.0, e.1.to_string()))?;

    let repos: Vec<RepoRow> = sqlx::query_as(
        "SELECT name FROM repositories WHERE owner_id = $1"
    )
    .bind(&user.id)
    .fetch_all(&state.db.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    for repo in repos {
        let repo_prefix = S3Client::get_repo_prefix(&user.id, &repo.name);
        let _ = state.s3.delete_prefix(&repo_prefix).await;
    }

    let avatar_prefix = format!("avatars/{}", user.id);
    let _ = state.s3.delete_prefix(&avatar_prefix).await;

    sqlx::query("DELETE FROM users WHERE id = $1")
        .bind(&user.id)
        .execute(&state.db.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(serde_json::json!({ "success": true })))
}

async fn update_social_links(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(body): Json<UpdateSocialLinksRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let user = require_auth(&auth).map_err(|e| (e.0, e.1.to_string()))?;

    let social_links = serde_json::json!({
        "github": body.github.filter(|s| !s.is_empty()),
        "twitter": body.twitter.filter(|s| !s.is_empty()),
        "linkedin": body.linkedin.filter(|s| !s.is_empty()),
        "custom": body.custom.map(|c| c.into_iter().filter(|s| !s.is_empty()).collect::<Vec<_>>()),
    });

    sqlx::query(
        "UPDATE users SET social_links = $1, updated_at = NOW() WHERE id = $2"
    )
    .bind(&social_links)
    .bind(&user.id)
    .execute(&state.db.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(serde_json::json!({ "success": true })))
}

async fn update_password(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(body): Json<UpdatePasswordRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let user = require_auth(&auth).map_err(|e| (e.0, e.1.to_string()))?;

    let account: Option<AccountRow> = sqlx::query_as(
        "SELECT id, password FROM accounts WHERE user_id = $1 AND provider_id = 'credential'"
    )
    .bind(&user.id)
    .fetch_optional(&state.db.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let account = account.ok_or((StatusCode::BAD_REQUEST, "No password set for this account".to_string()))?;
    let stored_hash = account.password.ok_or((StatusCode::BAD_REQUEST, "No password set for this account".to_string()))?;

    let valid = bcrypt::verify(&body.current_password, &stored_hash)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Password verification failed".to_string()))?;

    if !valid {
        return Err((StatusCode::BAD_REQUEST, "Current password is incorrect".to_string()));
    }

    let new_hash = bcrypt::hash(&body.new_password, 12)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Password hashing failed".to_string()))?;

    sqlx::query(
        "UPDATE accounts SET password = $1, updated_at = NOW() WHERE id = $2"
    )
    .bind(&new_hash)
    .bind(&account.id)
    .execute(&state.db.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(serde_json::json!({ "success": true })))
}

async fn upload_avatar(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    mut multipart: Multipart,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let user = require_auth(&auth).map_err(|e| (e.0, e.1.to_string()))?;

    while let Some(field) = multipart.next_field().await.map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))? {
        let name = field.name().unwrap_or("").to_string();
        if name != "avatar" {
            continue;
        }

        let content_type = field.content_type().unwrap_or("application/octet-stream").to_string();
        if !content_type.starts_with("image/") {
            return Err((StatusCode::BAD_REQUEST, "File must be an image".to_string()));
        }

        let filename = field.file_name().unwrap_or("avatar.png").to_string();
        let ext = filename.split('.').last().unwrap_or("png");

        let data = field.bytes().await.map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;

        if data.len() > 5 * 1024 * 1024 {
            return Err((StatusCode::BAD_REQUEST, "File size must be less than 5MB".to_string()));
        }

        let key = format!("avatars/{}.{}", user.id, ext);

        state.s3.client
            .put_object()
            .bucket(&state.s3.bucket)
            .key(&key)
            .body(data.to_vec().into())
            .content_type(&content_type)
            .send()
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to upload avatar: {}", e)))?;

        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis();
        let avatar_url = format!("/api/avatar/{}.{}?v={}", user.id, ext, timestamp);

        sqlx::query("UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2")
            .bind(&avatar_url)
            .bind(&user.id)
            .execute(&state.db.pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        return Ok(Json(serde_json::json!({
            "success": true,
            "avatarUrl": avatar_url
        })));
    }

    Err((StatusCode::BAD_REQUEST, "No avatar file provided".to_string()))
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/settings", get(get_settings))
        .route("/api/settings/profile", patch(update_profile))
        .route("/api/settings/email", patch(update_email))
        .route("/api/settings/avatar", post(upload_avatar))
        .route("/api/settings/social-links", patch(update_social_links))
        .route("/api/settings/password", patch(update_password))
        .route("/api/settings/account", axum::routing::delete(delete_account))
        .route("/api/settings/current-user", get(get_current_user))
}

async fn get_current_user(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let user = require_auth(&auth).map_err(|e| (e.0, e.1.to_string()))?;

    #[derive(FromRow)]
    struct FullUserRow {
        id: String,
        name: String,
        email: String,
        email_verified: bool,
        username: String,
        bio: Option<String>,
        location: Option<String>,
        website: Option<String>,
        pronouns: Option<String>,
        avatar_url: Option<String>,
        social_links: Option<serde_json::Value>,
        created_at: chrono::NaiveDateTime,
        updated_at: chrono::NaiveDateTime,
    }

    let user_data: FullUserRow = sqlx::query_as(
        "SELECT id, name, email, email_verified, username, bio, location, website, pronouns, avatar_url, social_links, created_at, updated_at FROM users WHERE id = $1"
    )
    .bind(&user.id)
    .fetch_one(&state.db.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(serde_json::json!({
        "id": user_data.id,
        "name": user_data.name,
        "email": user_data.email,
        "emailVerified": user_data.email_verified,
        "username": user_data.username,
        "bio": user_data.bio,
        "location": user_data.location,
        "website": user_data.website,
        "pronouns": user_data.pronouns,
        "avatarUrl": user_data.avatar_url,
        "socialLinks": user_data.social_links,
        "createdAt": format!("{}Z", user_data.created_at.format("%Y-%m-%dT%H:%M:%S%.3f")),
        "updatedAt": format!("{}Z", user_data.updated_at.format("%Y-%m-%dT%H:%M:%S%.3f")),
    })))
}
