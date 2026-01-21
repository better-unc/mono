use axum::{
    body::Body,
    extract::{Request, State},
    http::StatusCode,
    response::Response,
};

use crate::AppState;

pub async fn proxy_auth(
    State(state): State<AppState>,
    mut request: Request,
) -> Result<Response, StatusCode> {
    let path = request.uri().path();
    let query = request.uri().query().unwrap_or("");

    let auth_service_url = &state.config.auth_service_url;
    let target_path = path.to_string();

    let target_url = if query.is_empty() {
        format!("{}{}", auth_service_url, target_path)
    } else {
        format!("{}{}?{}", auth_service_url, target_path, query)
    };

    let body_bytes = if request.method() == axum::http::Method::GET
        || request.method() == axum::http::Method::HEAD
    {
        None
    } else {
        let body = std::mem::replace(request.body_mut(), Body::empty());
        let bytes = axum::body::to_bytes(body, usize::MAX)
            .await
            .map_err(|_| StatusCode::BAD_REQUEST)?;
        Some(bytes.to_vec())
    };

    let method = match request.method().as_str() {
        "GET" => reqwest::Method::GET,
        "POST" => reqwest::Method::POST,
        "PUT" => reqwest::Method::PUT,
        "PATCH" => reqwest::Method::PATCH,
        "DELETE" => reqwest::Method::DELETE,
        "OPTIONS" => reqwest::Method::OPTIONS,
        "HEAD" => reqwest::Method::HEAD,
        _ => return Err(StatusCode::METHOD_NOT_ALLOWED),
    };

    let mut proxy_request = state
        .http_client
        .request(method, &target_url);

    for (key, value) in request.headers() {
        let key_str = key.as_str().to_lowercase();
        if key_str != "host" && key_str != "content-length" {
            proxy_request = proxy_request.header(key, value);
        }
    }

    let proxy_request = if let Some(body) = body_bytes {
        proxy_request.body(body)
    } else {
        proxy_request
    };

    let proxy_request = proxy_request
        .build()
        .map_err(|_| StatusCode::BAD_GATEWAY)?;

    let response = state
        .http_client
        .execute(proxy_request)
        .await
        .map_err(|e| {
            tracing::error!("Failed to proxy auth request: {}", e);
            StatusCode::BAD_GATEWAY
        })?;

    let status = response.status();
    let mut response_builder = Response::builder().status(status);

    for (key, value) in response.headers() {
        let key_str = key.as_str().to_lowercase();
        if key_str != "content-encoding"
            && key_str != "transfer-encoding"
            && key_str != "content-length"
            && key_str != "connection"
        {
            response_builder = response_builder.header(key, value);
        }
    }

    let body_bytes = response.bytes().await.map_err(|_| StatusCode::BAD_GATEWAY)?;

    response_builder
        .body(Body::from(body_bytes))
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}
