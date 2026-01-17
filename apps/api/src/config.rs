use std::env;

pub struct Config {
    pub port: u16,
    pub database_url: String,
    pub aws_endpoint_url: String,
    pub aws_access_key_id: String,
    pub aws_secret_access_key: String,
    pub aws_bucket_name: String,
    pub internal_auth_url: String,
    pub internal_auth_secret: String,
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
            aws_endpoint_url_url: env::var("AWS_ENDPOINT_URL")
                .expect("AWS_ENDPOINT_URL must be set"),
            aws_access_key_id: env::var("AWS_ACCESS_KEY_ID")
                .expect("AWS_ACCESS_KEY_ID must be set"),
            aws_secret_access_key: env::var("AWS_SECRET_ACCESS_KEY")
                .expect("AWS_SECRET_ACCESS_KEY must be set"),
            aws_bucket_name: env::var("AWS_BUCKET_NAME")
                .expect("AWS_BUCKET_NAME must be set"),
            internal_auth_url: env::var("INTERNAL_AUTH_URL")
                .expect("INTERNAL_AUTH_URL must be set"),
            internal_auth_secret: env::var("BETTER_AUTH_SECRET")
                .expect("BETTER_AUTH_SECRET must be set"),
        }
    }
}
