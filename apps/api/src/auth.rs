use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::Next,
    response::Response,
};
use chrono::NaiveDateTime;

pub mod naive_datetime_as_utc {
    use chrono::NaiveDateTime;
    use serde::{self, Deserialize, Deserializer, Serializer};

    pub fn serialize<S>(date: &NaiveDateTime, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&format!("{}Z", date.format("%Y-%m-%dT%H:%M:%S%.3f")))
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<NaiveDateTime, D::Error>
    where
        D: Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        let s = s.trim_end_matches('Z');
        NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S%.3f")
            .or_else(|_| NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S"))
            .map_err(serde::de::Error::custom)
    }
}
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use crate::AppState;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct User {
    pub id: String,
    pub name: String,
    pub email: String,
    pub username: String,
    pub bio: Option<String>,
    pub location: Option<String>,
    pub website: Option<String>,
    pub pronouns: Option<String>,
    pub avatar_url: Option<String>,
    #[serde(with = "naive_datetime_as_utc")]
    pub created_at: NaiveDateTime,
    #[serde(with = "naive_datetime_as_utc")]
    pub updated_at: NaiveDateTime,
}

#[derive(Clone)]
pub struct AuthUser(pub Option<User>);

pub async fn auth_middleware(
    State(state): State<AppState>,
    mut request: Request,
    next: Next,
) -> Response {
    let token = extract_token(&request);
    
    let user = match token {
        Some(token) => get_user_from_session(&state.db.pool, &token).await,
        None => None,
    };

    request.extensions_mut().insert(AuthUser(user));
    next.run(request).await
}

fn extract_token(request: &Request) -> Option<String> {
    if let Some(auth_header) = request.headers().get("authorization") {
        if let Ok(auth_str) = auth_header.to_str() {
            if auth_str.starts_with("Bearer ") {
                return Some(auth_str[7..].to_string());
            }
        }
    }

    if let Some(cookie_header) = request.headers().get("cookie") {
        if let Ok(cookie_str) = cookie_header.to_str() {
            for cookie in cookie_str.split(';') {
                let cookie = cookie.trim();
                if cookie.starts_with("better-auth.session_token=") {
                    return Some(cookie["better-auth.session_token=".len()..].to_string());
                }
            }
        }
    }

    None
}

async fn get_user_from_session(pool: &sqlx::PgPool, token: &str) -> Option<User> {
    sqlx::query_as::<_, User>(
        r#"
        SELECT u.id, u.name, u.email, u.username, u.bio, u.location, 
               u.website, u.pronouns, u.avatar_url, u.created_at, u.updated_at
        FROM users u
        JOIN sessions s ON s.user_id = u.id
        WHERE s.token = $1 AND s.expires_at > NOW()
        "#
    )
    .bind(token)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten()
}

pub fn require_auth(auth: &AuthUser) -> Result<&User, (StatusCode, &'static str)> {
    auth.0.as_ref().ok_or((StatusCode::UNAUTHORIZED, "Unauthorized"))
}
