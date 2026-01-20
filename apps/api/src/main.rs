mod config;
mod db;
mod auth;
mod s3;
mod git;
mod routes;
mod redis;

use std::sync::Arc;
use std::time::Duration;
use axum::{middleware, Router};
use axum::http::Method;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::config::Config;
use crate::db::Database;
use crate::s3::S3Client;
use crate::auth::{auth_middleware, SessionCache, BasicAuthCache};
use crate::redis::RedisClient;

#[derive(Clone)]
pub struct AppState {
    pub db: Database,
    pub s3: S3Client,
    pub config: Arc<Config>,
    pub session_cache: SessionCache,
    pub http_client: reqwest::Client,
    pub basic_auth_cache: BasicAuthCache,
    pub redis: Option<RedisClient>,
}

#[tokio::main]
async fn main() {
    rustls::crypto::ring::default_provider()
        .install_default()
        .expect("Failed to install rustls crypto provider");

    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::try_from_default_env()
            .unwrap_or_else(|_| "gitbruv_api=debug,tower_http=debug".into()))
        .with(tracing_subscriber::fmt::layer())
        .init();

    dotenvy::from_filename("../../.env").ok();
    dotenvy::dotenv().ok();

    let config = Arc::new(Config::from_env());
    let db = Database::connect(&config.database_url).await;
    let s3 = S3Client::new(&config).await;
    let session_cache = SessionCache::new();
    let http_client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .unwrap();
    let basic_auth_cache = BasicAuthCache::new(Duration::from_secs(60));

    let redis = if let Some(ref redis_url) = config.redis_url {
        match RedisClient::new(redis_url).await {
            Ok(client) => {
                tracing::info!("Connected to Redis");
                Some(client)
            }
            Err(e) => {
                tracing::warn!("Failed to connect to Redis: {}. Continuing without cache.", e);
                None
            }
        }
    } else {
        tracing::info!("REDIS_URL not set, running without Redis cache");
        None
    };

    let state = AppState { 
        db, 
        s3, 
        config: config.clone(),
        session_cache,
        http_client,
        basic_auth_cache,
        redis,
    };

    let cors = CorsLayer::new()
        .allow_origin(tower_http::cors::AllowOrigin::mirror_request())
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::PATCH,
            Method::DELETE,
            Method::OPTIONS,
            Method::HEAD,
        ])
        .allow_headers([
            axum::http::header::CONTENT_TYPE,
            axum::http::header::AUTHORIZATION,
            axum::http::header::COOKIE,
        ])
        .expose_headers([axum::http::header::SET_COOKIE])
        .allow_credentials(true);

    let app = Router::new()
        .merge(routes::health::router())
        .merge(routes::repositories::router())
        .merge(routes::users::router())
        .merge(routes::settings::router())
        .merge(routes::git::router())
        .merge(routes::file::router())
        .merge(routes::issues::router())
        .layer(middleware::from_fn_with_state(state.clone(), auth_middleware))
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state);

    let addr = format!("0.0.0.0:{}", config.port);
    tracing::info!("Starting server on {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
