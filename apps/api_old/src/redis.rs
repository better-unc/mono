use redis::aio::ConnectionManager;
use redis::AsyncCommands;

#[derive(Clone)]
pub struct RedisClient {
    conn: ConnectionManager,
}

pub struct CacheTtl;

impl CacheTtl {
    pub const GIT_OBJECT: u64 = 3600;
    pub const FILE_CONTENT: u64 = 300;
    pub const TREE_LISTING: u64 = 300;
    pub const REF_RESOLUTION: u64 = 30;
}

impl RedisClient {
    pub async fn new(redis_url: &str) -> Result<Self, redis::RedisError> {
        let client = redis::Client::open(redis_url)?;
        let conn = ConnectionManager::new(client).await?;
        Ok(Self { conn })
    }

    pub async fn get(&self, key: &str) -> Option<Vec<u8>> {
        let mut conn = self.conn.clone();
        match conn.get::<_, Option<Vec<u8>>>(key).await {
            Ok(data) => data,
            Err(e) => {
                tracing::warn!("Redis GET error for key {}: {}", key, e);
                None
            }
        }
    }

    pub async fn get_string(&self, key: &str) -> Option<String> {
        let mut conn = self.conn.clone();
        match conn.get::<_, Option<String>>(key).await {
            Ok(data) => data,
            Err(e) => {
                tracing::warn!("Redis GET error for key {}: {}", key, e);
                None
            }
        }
    }

    pub async fn set_ex(&self, key: &str, value: &[u8], ttl_seconds: u64) {
        let mut conn = self.conn.clone();
        if let Err(e) = conn.set_ex::<_, _, ()>(key, value, ttl_seconds).await {
            tracing::warn!("Redis SET error for key {}: {}", key, e);
        }
    }

    pub async fn set_ex_string(&self, key: &str, value: &str, ttl_seconds: u64) {
        let mut conn = self.conn.clone();
        if let Err(e) = conn.set_ex::<_, _, ()>(key, value, ttl_seconds).await {
            tracing::warn!("Redis SET error for key {}: {}", key, e);
        }
    }

    pub async fn delete(&self, key: &str) {
        let mut conn = self.conn.clone();
        if let Err(e) = conn.del::<_, ()>(key).await {
            tracing::warn!("Redis DEL error for key {}: {}", key, e);
        }
    }

    pub async fn delete_pattern(&self, pattern: &str) {
        let mut conn = self.conn.clone();
        let keys: Vec<String> = match conn.keys(pattern).await {
            Ok(k) => k,
            Err(e) => {
                tracing::warn!("Redis KEYS error for pattern {}: {}", pattern, e);
                return;
            }
        };

        for key in keys {
            if let Err(e) = conn.del::<_, ()>(&key).await {
                tracing::warn!("Redis DEL error for key {}: {}", key, e);
            }
        }
    }

    pub fn object_key(repo_prefix: &str, oid: &str) -> String {
        format!("git:obj:{}:{}", repo_prefix, oid)
    }

    pub fn file_key(repo_prefix: &str, branch: &str, path: &str) -> String {
        format!("git:file:{}:{}:{}", repo_prefix, branch, path)
    }

    pub fn tree_key(repo_prefix: &str, branch: &str, path: &str) -> String {
        format!("git:tree:{}:{}:{}", repo_prefix, branch, path)
    }

    pub fn ref_key(repo_prefix: &str, ref_name: &str) -> String {
        format!("git:ref:{}:{}", repo_prefix, ref_name)
    }

    pub fn branch_pattern(repo_prefix: &str, branch: &str) -> String {
        format!("git:*:{}:{}:*", repo_prefix, branch)
    }
}
