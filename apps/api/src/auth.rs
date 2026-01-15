use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::Next,
    response::Response,
};
use chrono::{NaiveDateTime, Utc};
use base64::{engine::general_purpose, Engine as _};
use dashmap::DashMap;
use sha1::{Digest, Sha1};
use std::sync::Arc;
use std::time::{Duration, Instant};

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
use serde_json::json;
use sqlx::FromRow;

use crate::AppState;

#[derive(Clone)]
struct CachedUser {
    user: User,
    cached_at: Instant,
    expires_at: NaiveDateTime,
}

#[derive(Clone)]
pub struct SessionCache {
    cache: Arc<DashMap<String, CachedUser>>,
}

impl SessionCache {
    pub fn new() -> Self {
        let cache = Arc::new(DashMap::new());

        // Spawn background task to clean expired entries
        let cache_clone = cache.clone();
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(300)); // Clean every 5 minutes
            loop {
                interval.tick().await;
                let now = Utc::now().naive_utc();
                cache_clone.retain(|_, cached: &mut CachedUser| {
                    cached.expires_at > now
                });
            }
        });

        Self { cache }
    }

    pub fn get(&self, token: &str) -> Option<User> {
        if let Some(cached) = self.cache.get(token) {
            let now = Utc::now().naive_utc();
            if cached.expires_at > now {
                Some(cached.user.clone())
            } else {
                // Expired, remove from cache
                self.cache.remove(token);
                None
            }
        } else {
            None
        }
    }

    pub fn set(&self, token: String, user: User, expires_at: NaiveDateTime) {
        self.cache.insert(token, CachedUser {
            user,
            cached_at: Instant::now(),
            expires_at,
        });
    }

    pub fn invalidate(&self, token: &str) {
        self.cache.remove(token);
    }
}

#[derive(Clone)]
struct CachedBasicAuth {
    user: User,
    expires_at: Instant,
}

#[derive(Clone)]
pub struct BasicAuthCache {
    cache: Arc<DashMap<String, CachedBasicAuth>>,
    ttl: Duration,
}

impl BasicAuthCache {
    pub fn new(ttl: Duration) -> Self {
        Self {
            cache: Arc::new(DashMap::new()),
            ttl,
        }
    }

    pub fn get(&self, key: &str) -> Option<User> {
        if let Some(cached) = self.cache.get(key) {
            if cached.expires_at > Instant::now() {
                return Some(cached.user.clone());
            }
            self.cache.remove(key);
        }
        None
    }

    pub fn set(&self, key: String, user: User) {
        self.cache.insert(
            key,
            CachedBasicAuth {
                user,
                expires_at: Instant::now() + self.ttl,
            },
        );
    }
}

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
    pub company: Option<String>,
    pub last_active_at: Option<NaiveDateTime>,
    pub git_email: Option<String>,
    pub default_repository_visibility: String,
    pub preferences: Option<serde_json::Value>,
    pub social_links: Option<serde_json::Value>,
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

    let mut user = match token {
        Some(ref token) => {
            if let Some(cached_user) = state.session_cache.get(token) {
                Some(cached_user)
            } else {
                if let Some((user, expires_at)) = get_user_from_session(&state.db.pool, token).await {
                    state.session_cache.set(token.clone(), user.clone(), expires_at);
                    Some(user)
                } else {
                    None
                }
            }
        }
        None => None,
    };

    if user.is_none() && is_git_http_path(request.uri().path()) {
        if let Some((email, password)) = parse_basic_auth(&request) {
            let safe_email = mask_email(&email);
            tracing::debug!("git basic auth attempt {}", safe_email);
            if email.contains('@') {
                let cache_key = basic_auth_cache_key(&email, &password);
                if let Some(cached) = state.basic_auth_cache.get(&cache_key) {
                    tracing::debug!("git basic auth cache hit {}", safe_email);
                    user = Some(cached);
                } else if let Some(found) = verify_basic_credentials(&state, &email, &password).await {
                    tracing::info!("git basic auth ok {}", safe_email);
                    state.basic_auth_cache.set(cache_key, found.clone());
                    user = Some(found);
                } else {
                    tracing::warn!("git basic auth failed {}", safe_email);
                }
            } else {
                tracing::warn!("git basic auth invalid email {}", safe_email);
            }
        } else {
            tracing::debug!("git basic auth missing");
        }
    }

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

fn parse_basic_auth(request: &Request) -> Option<(String, String)> {
    let auth_header = request.headers().get("authorization")?;
    let auth_str = auth_header.to_str().ok()?;
    if !auth_str.starts_with("Basic ") {
        return None;
    }
    let encoded = &auth_str[6..];
    let decoded = general_purpose::STANDARD.decode(encoded.as_bytes()).ok()?;
    let decoded_str = String::from_utf8(decoded).ok()?;
    let mut parts = decoded_str.splitn(2, ':');
    let email = parts.next()?.to_string();
    let password = parts.next()?.to_string();
    if email.is_empty() || password.is_empty() {
        return None;
    }
    Some((email, password))
}

fn mask_email(email: &str) -> String {
    let at_pos = email.find('@');
    let first = email.chars().next().unwrap_or('*');
    match at_pos {
        Some(pos) => format!("{}***{}", first, &email[pos..]),
        None => format!("{}***", first),
    }
}

fn basic_auth_cache_key(email: &str, password: &str) -> String {
    let mut hasher = Sha1::new();
    hasher.update(email.as_bytes());
    hasher.update(b":");
    hasher.update(password.as_bytes());
    hex::encode(hasher.finalize())
}

fn is_git_http_path(path: &str) -> bool {
    path.ends_with("/info/refs")
        || path.ends_with("/git-receive-pack")
        || path.ends_with("/git-upload-pack")
}

#[derive(Deserialize)]
struct InternalAuthResponse {
    user: serde_json::Value,
}

async fn verify_basic_credentials(state: &AppState, email: &str, password: &str) -> Option<User> {
    let response = match state
        .http_client
        .post(&state.config.internal_auth_url)
        .header("x-internal-auth", &state.config.internal_auth_secret)
        .json(&json!({
            "email": email,
            "password": password,
        }))
        .send()
        .await
    {
        Ok(res) => res,
        Err(err) => {
            tracing::warn!("internal auth request failed {}", err);
            return None;
        }
    };

    if !response.status().is_success() {
        tracing::warn!("internal auth rejected {}", response.status());
        return None;
    }

    let data: InternalAuthResponse = match response.json().await {
        Ok(data) => data,
        Err(err) => {
            tracing::warn!("internal auth invalid json {}", err);
            return None;
        }
    };
    map_internal_user(&data.user)
}

fn map_internal_user(value: &serde_json::Value) -> Option<User> {
    let now = Utc::now().naive_utc();
    let id = get_string(value, "id")?;
    let email = get_string(value, "email").unwrap_or_default();
    let username = get_string(value, "username").unwrap_or_else(|| email.clone());
    let name = get_string(value, "name").unwrap_or_else(|| email.clone());
    let default_repository_visibility =
        get_string(value, "defaultRepositoryVisibility").unwrap_or_else(|| "public".to_string());
    let created_at = parse_datetime(value, "createdAt").unwrap_or(now);
    let updated_at = parse_datetime(value, "updatedAt").unwrap_or(now);

    Some(User {
        id,
        name,
        email,
        username,
        bio: get_string(value, "bio"),
        location: get_string(value, "location"),
        website: get_string(value, "website"),
        pronouns: get_string(value, "pronouns"),
        avatar_url: get_string(value, "avatarUrl"),
        company: get_string(value, "company"),
        last_active_at: parse_datetime(value, "lastActiveAt"),
        git_email: get_string(value, "gitEmail"),
        default_repository_visibility,
        preferences: value.get("preferences").cloned(),
        social_links: value.get("socialLinks").cloned(),
        created_at,
        updated_at,
    })
}

fn get_string(value: &serde_json::Value, key: &str) -> Option<String> {
    value.get(key)?.as_str().map(|s| s.to_string())
}

fn parse_datetime(value: &serde_json::Value, key: &str) -> Option<NaiveDateTime> {
    let raw = value.get(key)?.as_str()?;
    let trimmed = raw.trim_end_matches('Z');
    NaiveDateTime::parse_from_str(trimmed, "%Y-%m-%dT%H:%M:%S%.3f")
        .or_else(|_| NaiveDateTime::parse_from_str(trimmed, "%Y-%m-%dT%H:%M:%S"))
        .ok()
}

async fn get_user_from_session(pool: &sqlx::PgPool, token: &str) -> Option<(User, NaiveDateTime)> {
    #[derive(sqlx::FromRow)]
    struct SessionRow {
        #[sqlx(flatten)]
        user: User,
        expires_at: NaiveDateTime,
    }

    sqlx::query_as::<_, SessionRow>(
        r#"
        SELECT u.id, u.name, u.email, u.username, u.bio, u.location,
               u.website, u.pronouns, u.avatar_url, u.company, u.last_active_at,
               u.git_email, u.default_repository_visibility, u.preferences,
               u.social_links, u.created_at, u.updated_at,
               s.expires_at
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
    .map(|row| (row.user, row.expires_at))
}

pub fn require_auth(auth: &AuthUser) -> Result<&User, (StatusCode, &'static str)> {
    auth.0.as_ref().ok_or((StatusCode::UNAUTHORIZED, "Unauthorized"))
}
