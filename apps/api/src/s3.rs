use aws_sdk_s3::{
    config::{Credentials, Region},
    Client, Config,
};

use crate::config::Config as AppConfig;

#[derive(Clone)]
pub struct S3Client {
    pub client: Client,
    pub bucket: String,
}

impl S3Client {
    pub async fn new(config: &AppConfig) -> Self {
        let credentials = Credentials::new(
            &config.aws_access_key_id,
            &config.aws_secret_access_key,
            None,
            None,
            "s3",
        );

        let s3_config = Config::builder()
            .endpoint_url(&config.aws_endpoint_url)
            .region(Region::new("auto"))
            .credentials_provider(credentials)
            .force_path_style(true)
            .build();

        let client = Client::from_conf(s3_config);

        tracing::info!("S3 client initialized for bucket: {}", config.aws_s3_bucket_name);

        Self {
            client,
            bucket: config.aws_s3_bucket_name.clone(),
        }
    }

    pub fn get_repo_prefix(user_id: &str, repo_name: &str) -> String {
        format!("repos/{}/{}.git", user_id, repo_name)
    }

    pub async fn get_object(&self, key: &str) -> Option<Vec<u8>> {
        let result = self.client
            .get_object()
            .bucket(&self.bucket)
            .key(key)
            .send()
            .await;

        match result {
            Ok(output) => {
                output.body.collect().await.ok().map(|data| data.to_vec())
            }
            Err(_) => None,
        }
    }

    pub async fn put_object(&self, key: &str, data: Vec<u8>) -> Result<(), aws_sdk_s3::Error> {
        self.client
            .put_object()
            .bucket(&self.bucket)
            .key(key)
            .body(data.into())
            .send()
            .await?;
        Ok(())
    }

    pub async fn delete_object(&self, key: &str) -> Result<(), aws_sdk_s3::Error> {
        self.client
            .delete_object()
            .bucket(&self.bucket)
            .key(key)
            .send()
            .await?;
        Ok(())
    }

    pub async fn list_objects(&self, prefix: &str) -> Vec<String> {
        let mut keys = Vec::new();
        let mut continuation_token: Option<String> = None;

        loop {
            let mut request = self.client
                .list_objects_v2()
                .bucket(&self.bucket)
                .prefix(prefix);

            if let Some(token) = continuation_token.take() {
                request = request.continuation_token(token);
            }

            match request.send().await {
                Ok(output) => {
                    if let Some(contents) = output.contents {
                        for obj in contents {
                            if let Some(key) = obj.key {
                                keys.push(key);
                            }
                        }
                    }

                    if output.is_truncated.unwrap_or(false) {
                        continuation_token = output.next_continuation_token;
                    } else {
                        break;
                    }
                }
                Err(_) => break,
            }
        }

        keys
    }

    pub async fn delete_prefix(&self, prefix: &str) -> Result<(), aws_sdk_s3::Error> {
        let keys = self.list_objects(prefix).await;

        for chunk in keys.chunks(1000) {
            let objects: Vec<_> = chunk
                .iter()
                .map(|key| {
                    aws_sdk_s3::types::ObjectIdentifier::builder()
                        .key(key)
                        .build()
                        .unwrap()
                })
                .collect();

            if !objects.is_empty() {
                self.client
                    .delete_objects()
                    .bucket(&self.bucket)
                    .delete(
                        aws_sdk_s3::types::Delete::builder()
                            .set_objects(Some(objects))
                            .build()
                            .unwrap()
                    )
                    .send()
                    .await?;
            }
        }

        Ok(())
    }
}
