use std::env;

pub struct Config {
    pub port: u16,
    pub database_url: String,
    pub r2_endpoint: String,
    pub r2_access_key_id: String,
    pub r2_secret_access_key: String,
    pub r2_bucket_name: String,
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
            r2_endpoint: env::var("R2_ENDPOINT")
                .expect("R2_ENDPOINT must be set"),
            r2_access_key_id: env::var("R2_ACCESS_KEY_ID")
                .expect("R2_ACCESS_KEY_ID must be set"),
            r2_secret_access_key: env::var("R2_SECRET_ACCESS_KEY")
                .expect("R2_SECRET_ACCESS_KEY must be set"),
            r2_bucket_name: env::var("R2_BUCKET_NAME")
                .expect("R2_BUCKET_NAME must be set"),
            internal_auth_url: env::var("INTERNAL_AUTH_URL")
                .expect("INTERNAL_AUTH_URL must be set"),
            internal_auth_secret: env::var("BETTER_AUTH_SECRET")
                .expect("BETTER_AUTH_SECRET must be set"),
        }
    }
}
