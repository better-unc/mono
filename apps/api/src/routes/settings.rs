use axum::{
    extract::{Multipart, State},
    http::StatusCode,
    routing::{get, patch, post},
    Extension, Json, Router,
};
use serde::{Deserialize, Serialize};

use crate::{auth::{require_auth, AuthUser, User}, AppState};

#[derive(Debug, Deserialize)]
pub struct UpdateProfileRequest {
    pub name: Option<String>,
    pub bio: Option<String>,
    pub location: Option<String>,
    pub website: Option<String>,
    pub pronouns: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateEmailRequest {
    pub email: String,
}

#[derive(Debug, Serialize)]
pub struct SettingsResponse {
    pub user: User,
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
) -> Result<Json<User>, (StatusCode, String)> {
    let user = require_auth(&auth).map_err(|e| (e.0, e.1.to_string()))?;

    let updated: User = sqlx::query_as(
        r#"
        UPDATE users 
        SET name = COALESCE($1, name),
            bio = COALESCE($2, bio),
            location = COALESCE($3, location),
            website = COALESCE($4, website),
            pronouns = COALESCE($5, pronouns),
            updated_at = NOW()
        WHERE id = $6
        RETURNING *
        "#
    )
    .bind(&body.name)
    .bind(&body.bio)
    .bind(&body.location)
    .bind(&body.website)
    .bind(&body.pronouns)
    .bind(&user.id)
    .fetch_one(&state.db.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(updated))
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

    sqlx::query("DELETE FROM users WHERE id = $1")
        .bind(&user.id)
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
        let avatar_url = format!("/avatar/{}.{}?v={}", user.id, ext, timestamp);

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
        .route("/api/settings/account", axum::routing::delete(delete_account))
}
