use std::env;

fn normalize_url(url: &str) -> String {
    if url.starts_with("http://") || url.starts_with("https://") {
        return url.to_string();
    }

    if url.contains("localhost") || url.starts_with("127.0.0.1") || url.starts_with("::1") {
        return format!("http://{}", url);
    }

    format!("https://{}", url)
}

pub struct Config {
    pub port: u16,
    pub database_url: String,
    pub aws_endpoint_url: String,
    pub aws_access_key_id: String,
    pub aws_secret_access_key: String,
    pub aws_s3_bucket_name: String,
    pub auth_service_url: String,
    pub redis_url: Option<String>,
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            port: env::var("PORT")
                .unwrap_or_else(|_| "3001".to_string())
                .parse()
                .expect("PORT must be a number"),
            database_url: env::var("DATABASE_URL")
                .expect("DATABASE_URL must be set"),
            aws_endpoint_url: env::var("AWS_ENDPOINT_URL")
                .expect("AWS_ENDPOINT_URL must be set"),
            aws_access_key_id: env::var("AWS_ACCESS_KEY_ID")
                .expect("AWS_ACCESS_KEY_ID must be set"),
            aws_secret_access_key: env::var("AWS_SECRET_ACCESS_KEY")
                .expect("AWS_SECRET_ACCESS_KEY must be set"),
            aws_s3_bucket_name: env::var("AWS_S3_BUCKET_NAME")
                .expect("AWS_S3_BUCKET_NAME must be set"),
            auth_service_url: normalize_url(
                &env::var("AUTH_SERVICE_URL")
                    .expect("AUTH_SERVICE_URL must be set")
            ),
            redis_url: Some(env::var("REDIS_URL")
                .map(|url| url.to_string())
                .expect("REDIS_URL must be set")),
        }
    }
}
