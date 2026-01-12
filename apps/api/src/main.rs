mod config;
mod db;
mod auth;
mod s3;
mod git;
mod routes;

use std::sync::Arc;
use axum::{middleware, Router};
use axum::http::Method;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::config::Config;
use crate::db::Database;
use crate::s3::S3Client;
use crate::auth::auth_middleware;

#[derive(Clone)]
pub struct AppState {
    pub db: Database,
    pub s3: S3Client,
    pub config: Arc<Config>,
}

#[tokio::main]
async fn main() {
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

    let state = AppState { db, s3, config: config.clone() };

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
        .layer(middleware::from_fn_with_state(state.clone(), auth_middleware))
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state);

    let addr = format!("0.0.0.0:{}", config.port);
    tracing::info!("Starting server on {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
