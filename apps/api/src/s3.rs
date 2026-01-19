use aws_sdk_s3::{
    config::{Credentials, Region},
    types::{CompletedMultipartUpload, CompletedPart},
    Client, Config,
};
use aws_sdk_s3::primitives::ByteStream;
use std::time::Instant;

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
        let start = Instant::now();
        let result = self.client
            .get_object()
            .bucket(&self.bucket)
            .key(key)
            .send()
            .await;

        match result {
            Ok(output) => {
                let data = output.body.collect().await.ok().map(|data| data.to_vec());
                tracing::info!("s3_get_object key={} elapsed_ms={}", key, start.elapsed().as_millis());
                data
            }
            Err(err) => {
                tracing::info!("s3_get_object key={} error={} elapsed_ms={}", key, err, start.elapsed().as_millis());
                None
            }
        }
    }

    pub async fn put_object(&self, key: &str, data: Vec<u8>) -> Result<(), aws_sdk_s3::Error> {
        let start = Instant::now();
        self.client
            .put_object()
            .bucket(&self.bucket)
            .key(key)
            .body(data.into())
            .send()
            .await?;
        tracing::info!("s3_put_object key={} elapsed_ms={}", key, start.elapsed().as_millis());
        Ok(())
    }

    pub async fn put_object_multipart(&self, key: &str, data: Vec<u8>, part_size: usize) -> Result<(), aws_sdk_s3::Error> {
        let start = Instant::now();
        let create = self.client
            .create_multipart_upload()
            .bucket(&self.bucket)
            .key(key)
            .send()
            .await?;

        let upload_id = match create.upload_id() {
            Some(id) => id.to_string(),
            None => {
                tracing::info!("s3_multipart_create key={} missing_upload_id", key);
                return self.put_object(key, data).await;
            }
        };

        let mut completed_parts: Vec<CompletedPart> = Vec::new();
        let mut part_number = 1i32;

        let upload_result: Result<(), aws_sdk_s3::Error> = async {
            for chunk in data.chunks(part_size) {
                let resp = self.client
                    .upload_part()
                    .bucket(&self.bucket)
                    .key(key)
                    .upload_id(&upload_id)
                    .part_number(part_number)
                    .body(ByteStream::from(chunk.to_vec()))
                    .send()
                    .await?;

                let e_tag = resp.e_tag().map(|v| v.to_string());
                let part = CompletedPart::builder()
                    .set_e_tag(e_tag)
                    .part_number(part_number)
                    .build();
                completed_parts.push(part);
                part_number += 1;
            }
            Ok(())
        }
        .await;

        if let Err(err) = upload_result {
            let _ = self.client
                .abort_multipart_upload()
                .bucket(&self.bucket)
                .key(key)
                .upload_id(&upload_id)
                .send()
                .await;
            tracing::info!("s3_multipart_abort key={} error={}", key, err);
            return Err(err);
        }

        let completed = CompletedMultipartUpload::builder()
            .set_parts(Some(completed_parts))
            .build();

        self.client
            .complete_multipart_upload()
            .bucket(&self.bucket)
            .key(key)
            .upload_id(&upload_id)
            .multipart_upload(completed)
            .send()
            .await?;

        tracing::info!("s3_multipart_complete key={} parts={} elapsed_ms={}", key, part_number - 1, start.elapsed().as_millis());
        Ok(())
    }

    pub async fn delete_object(&self, key: &str) -> Result<(), aws_sdk_s3::Error> {
        let start = Instant::now();
        self.client
            .delete_object()
            .bucket(&self.bucket)
            .key(key)
            .send()
            .await?;
        tracing::info!("s3_delete_object key={} elapsed_ms={}", key, start.elapsed().as_millis());
        Ok(())
    }

    pub async fn list_objects(&self, prefix: &str) -> Vec<String> {
        let start = Instant::now();
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

        tracing::info!("s3_list_objects prefix={} count={} elapsed_ms={}", prefix, keys.len(), start.elapsed().as_millis());
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
