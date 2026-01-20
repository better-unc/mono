use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{delete, get, patch, post},
    Extension, Json, Router,
};
use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::{auth::{require_auth, AuthUser, naive_datetime_as_utc}, AppState};

#[derive(Debug, Clone, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct IssueAuthor {
    pub id: String,
    pub username: String,
    pub name: String,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Label {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub color: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReactionSummary {
    pub emoji: String,
    pub count: i64,
    pub reacted: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Issue {
    pub id: Uuid,
    pub number: i32,
    pub title: String,
    pub body: Option<String>,
    pub state: String,
    pub locked: bool,
    pub author: IssueAuthor,
    pub labels: Vec<Label>,
    pub assignees: Vec<IssueAuthor>,
    pub reactions: Vec<ReactionSummary>,
    pub comment_count: i64,
    #[serde(with = "naive_datetime_as_utc")]
    pub created_at: NaiveDateTime,
    #[serde(with = "naive_datetime_as_utc")]
    pub updated_at: NaiveDateTime,
    #[serde(with = "naive_datetime_as_utc::option")]
    pub closed_at: Option<NaiveDateTime>,
    pub closed_by: Option<IssueAuthor>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IssueComment {
    pub id: Uuid,
    pub body: String,
    pub author: IssueAuthor,
    pub reactions: Vec<ReactionSummary>,
    #[serde(with = "naive_datetime_as_utc")]
    pub created_at: NaiveDateTime,
    #[serde(with = "naive_datetime_as_utc")]
    pub updated_at: NaiveDateTime,
}

#[derive(FromRow)]
struct IssueRow {
    id: Uuid,
    number: i32,
    title: String,
    body: Option<String>,
    state: String,
    locked: bool,
    created_at: NaiveDateTime,
    updated_at: NaiveDateTime,
    closed_at: Option<NaiveDateTime>,
    author_id: String,
    author_username: String,
    author_name: String,
    author_avatar_url: Option<String>,
    closed_by_id: Option<String>,
    closed_by_username: Option<String>,
    closed_by_name: Option<String>,
    closed_by_avatar_url: Option<String>,
}

#[derive(FromRow)]
struct CommentRow {
    id: Uuid,
    body: String,
    created_at: NaiveDateTime,
    updated_at: NaiveDateTime,
    author_id: String,
    author_username: String,
    author_name: String,
    author_avatar_url: Option<String>,
}

#[derive(FromRow)]
struct ReactionRow {
    emoji: String,
    count: i64,
}

#[derive(FromRow)]
struct UserReactionRow {
    emoji: String,
}

#[derive(Deserialize)]
pub struct ListIssuesQuery {
    pub state: Option<String>,
    pub label: Option<String>,
    pub assignee: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Deserialize)]
pub struct CreateIssueRequest {
    pub title: String,
    pub body: Option<String>,
    pub labels: Option<Vec<Uuid>>,
    pub assignees: Option<Vec<String>>,
}

#[derive(Deserialize)]
pub struct UpdateIssueRequest {
    pub title: Option<String>,
    pub body: Option<String>,
    pub state: Option<String>,
    pub locked: Option<bool>,
}

#[derive(Deserialize)]
pub struct CreateLabelRequest {
    pub name: String,
    pub description: Option<String>,
    pub color: String,
}

#[derive(Deserialize)]
pub struct UpdateLabelRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub color: Option<String>,
}

#[derive(Deserialize)]
pub struct AddLabelsRequest {
    pub labels: Vec<Uuid>,
}

#[derive(Deserialize)]
pub struct AddAssigneesRequest {
    pub assignees: Vec<String>,
}

#[derive(Deserialize)]
pub struct CreateCommentRequest {
    pub body: String,
}

#[derive(Deserialize)]
pub struct UpdateCommentRequest {
    pub body: String,
}

#[derive(Deserialize)]
pub struct ReactionRequest {
    pub emoji: String,
}

const VALID_EMOJIS: &[&str] = &["+1", "-1", "laugh", "hooray", "confused", "heart", "rocket", "eyes"];

async fn get_repo_and_check_access(
    state: &AppState,
    owner: &str,
    name: &str,
    auth: &AuthUser,
) -> Result<(Uuid, String), (StatusCode, String)> {
    #[derive(FromRow)]
    struct RepoRow {
        id: Uuid,
        owner_id: String,
        visibility: String,
    }

    let repo: RepoRow = sqlx::query_as(
        r#"
        SELECT r.id, r.owner_id, r.visibility
        FROM repositories r
        JOIN users u ON u.id = r.owner_id
        WHERE u.username = $1 AND r.name = $2
        "#,
    )
    .bind(owner)
    .bind(name)
    .fetch_optional(&state.db.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Repository not found".to_string()))?;

    if repo.visibility == "private" {
        if auth.0.as_ref().map(|u| u.id != repo.owner_id).unwrap_or(true) {
            return Err((StatusCode::NOT_FOUND, "Repository not found".to_string()));
        }
    }

    Ok((repo.id, repo.owner_id))
}

async fn list_issues(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path((owner, name)): Path<(String, String)>,
    Query(query): Query<ListIssuesQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let (repo_id, _) = get_repo_and_check_access(&state, &owner, &name, &auth).await?;

    let state_filter = query.state.unwrap_or_else(|| "open".to_string());
    let limit = query.limit.unwrap_or(30);
    let offset = query.offset.unwrap_or(0);

    let mut sql = String::from(
        r#"
        SELECT i.id, i.number, i.title, i.body, i.state, i.locked, i.created_at, i.updated_at, i.closed_at,
               a.id as author_id, a.username as author_username, a.name as author_name, a.avatar_url as author_avatar_url,
               c.id as closed_by_id, c.username as closed_by_username, c.name as closed_by_name, c.avatar_url as closed_by_avatar_url
        FROM issues i
        JOIN users a ON a.id = i.author_id
        LEFT JOIN users c ON c.id = i.closed_by_id
        WHERE i.repository_id = $1
        "#,
    );

    let mut param_idx = 2;
    let mut bindings: Vec<String> = vec![];

    if state_filter != "all" {
        sql.push_str(&format!(" AND i.state = ${}", param_idx));
        bindings.push(state_filter);
        param_idx += 1;
    }

    if let Some(ref label_name) = query.label {
        sql.push_str(&format!(
            " AND EXISTS (SELECT 1 FROM issue_labels il JOIN labels l ON l.id = il.label_id WHERE il.issue_id = i.id AND l.name = ${})",
            param_idx
        ));
        bindings.push(label_name.clone());
        param_idx += 1;
    }

    if let Some(ref assignee_username) = query.assignee {
        sql.push_str(&format!(
            " AND EXISTS (SELECT 1 FROM issue_assignees ia JOIN users u ON u.id = ia.user_id WHERE ia.issue_id = i.id AND u.username = ${})",
            param_idx
        ));
        bindings.push(assignee_username.clone());
    }

    sql.push_str(" ORDER BY i.created_at DESC LIMIT $100 OFFSET $101");
    let sql = sql.replace("$100", &format!("${}", param_idx)).replace("$101", &format!("${}", param_idx + 1));

    let mut query_builder = sqlx::query_as::<_, IssueRow>(&sql).bind(repo_id);
    for binding in &bindings {
        query_builder = query_builder.bind(binding);
    }
    query_builder = query_builder.bind(limit + 1).bind(offset);

    let rows: Vec<IssueRow> = query_builder
        .fetch_all(&state.db.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let has_more = rows.len() as i64 > limit;
    let rows: Vec<_> = rows.into_iter().take(limit as usize).collect();

    let mut issues = Vec::new();
    for row in rows {
        let labels = get_issue_labels(&state, row.id).await?;
        let assignees = get_issue_assignees(&state, row.id).await?;
        let reactions = get_issue_reactions(&state, row.id, auth.0.as_ref().map(|u| u.id.as_str())).await?;
        let comment_count = get_comment_count(&state, row.id).await?;

        issues.push(Issue {
            id: row.id,
            number: row.number,
            title: row.title,
            body: row.body,
            state: row.state,
            locked: row.locked,
            author: IssueAuthor {
                id: row.author_id,
                username: row.author_username,
                name: row.author_name,
                avatar_url: row.author_avatar_url,
            },
            labels,
            assignees,
            reactions,
            comment_count,
            created_at: row.created_at,
            updated_at: row.updated_at,
            closed_at: row.closed_at,
            closed_by: row.closed_by_id.map(|id| IssueAuthor {
                id,
                username: row.closed_by_username.unwrap_or_default(),
                name: row.closed_by_name.unwrap_or_default(),
                avatar_url: row.closed_by_avatar_url,
            }),
        });
    }

    Ok(Json(serde_json::json!({
        "issues": issues,
        "hasMore": has_more,
    })))
}

async fn get_issue(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path((owner, name, number)): Path<(String, String, i32)>,
) -> Result<Json<Issue>, (StatusCode, String)> {
    let (repo_id, _) = get_repo_and_check_access(&state, &owner, &name, &auth).await?;

    let row: IssueRow = sqlx::query_as(
        r#"
        SELECT i.id, i.number, i.title, i.body, i.state, i.locked, i.created_at, i.updated_at, i.closed_at,
               a.id as author_id, a.username as author_username, a.name as author_name, a.avatar_url as author_avatar_url,
               c.id as closed_by_id, c.username as closed_by_username, c.name as closed_by_name, c.avatar_url as closed_by_avatar_url
        FROM issues i
        JOIN users a ON a.id = i.author_id
        LEFT JOIN users c ON c.id = i.closed_by_id
        WHERE i.repository_id = $1 AND i.number = $2
        "#,
    )
    .bind(repo_id)
    .bind(number)
    .fetch_optional(&state.db.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Issue not found".to_string()))?;

    let labels = get_issue_labels(&state, row.id).await?;
    let assignees = get_issue_assignees(&state, row.id).await?;
    let reactions = get_issue_reactions(&state, row.id, auth.0.as_ref().map(|u| u.id.as_str())).await?;
    let comment_count = get_comment_count(&state, row.id).await?;

    Ok(Json(Issue {
        id: row.id,
        number: row.number,
        title: row.title,
        body: row.body,
        state: row.state,
        locked: row.locked,
        author: IssueAuthor {
            id: row.author_id,
            username: row.author_username,
            name: row.author_name,
            avatar_url: row.author_avatar_url,
        },
        labels,
        assignees,
        reactions,
        comment_count,
        created_at: row.created_at,
        updated_at: row.updated_at,
        closed_at: row.closed_at,
        closed_by: row.closed_by_id.map(|id| IssueAuthor {
            id,
            username: row.closed_by_username.unwrap_or_default(),
            name: row.closed_by_name.unwrap_or_default(),
            avatar_url: row.closed_by_avatar_url,
        }),
    }))
}

async fn create_issue(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path((owner, name)): Path<(String, String)>,
    Json(body): Json<CreateIssueRequest>,
) -> Result<Json<Issue>, (StatusCode, String)> {
    let user = require_auth(&auth).map_err(|e| (e.0, e.1.to_string()))?;
    let (repo_id, _) = get_repo_and_check_access(&state, &owner, &name, &auth).await?;

    if body.title.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Title cannot be empty".to_string()));
    }

    let next_number: (i32,) = sqlx::query_as(
        "SELECT COALESCE(MAX(number), 0) + 1 FROM issues WHERE repository_id = $1"
    )
    .bind(repo_id)
    .fetch_one(&state.db.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    #[derive(FromRow)]
    struct InsertedIssue {
        id: Uuid,
        number: i32,
        created_at: NaiveDateTime,
        updated_at: NaiveDateTime,
    }

    let inserted: InsertedIssue = sqlx::query_as(
        r#"
        INSERT INTO issues (repository_id, author_id, title, body, number)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, number, created_at, updated_at
        "#,
    )
    .bind(repo_id)
    .bind(&user.id)
    .bind(&body.title)
    .bind(&body.body)
    .bind(next_number.0)
    .fetch_one(&state.db.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if let Some(ref label_ids) = body.labels {
        for label_id in label_ids {
            let _ = sqlx::query("INSERT INTO issue_labels (issue_id, label_id) VALUES ($1, $2) ON CONFLICT DO NOTHING")
                .bind(inserted.id)
                .bind(label_id)
                .execute(&state.db.pool)
                .await;
        }
    }

    if let Some(ref assignee_ids) = body.assignees {
        for assignee_id in assignee_ids {
            let _ = sqlx::query("INSERT INTO issue_assignees (issue_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING")
                .bind(inserted.id)
                .bind(assignee_id)
                .execute(&state.db.pool)
                .await;
        }
    }

    let labels = get_issue_labels(&state, inserted.id).await?;
    let assignees = get_issue_assignees(&state, inserted.id).await?;

    Ok(Json(Issue {
        id: inserted.id,
        number: inserted.number,
        title: body.title,
        body: body.body,
        state: "open".to_string(),
        locked: false,
        author: IssueAuthor {
            id: user.id.clone(),
            username: user.username.clone(),
            name: user.name.clone(),
            avatar_url: user.avatar_url.clone(),
        },
        labels,
        assignees,
        reactions: vec![],
        comment_count: 0,
        created_at: inserted.created_at,
        updated_at: inserted.updated_at,
        closed_at: None,
        closed_by: None,
    }))
}

async fn update_issue(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateIssueRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let user = require_auth(&auth).map_err(|e| (e.0, e.1.to_string()))?;

    #[derive(FromRow)]
    struct IssueCheck {
        author_id: String,
        owner_id: String,
        state: String,
    }

    let issue: IssueCheck = sqlx::query_as(
        r#"
        SELECT i.author_id, r.owner_id, i.state
        FROM issues i
        JOIN repositories r ON r.id = i.repository_id
        WHERE i.id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(&state.db.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Issue not found".to_string()))?;

    if user.id != issue.author_id && user.id != issue.owner_id {
        return Err((StatusCode::FORBIDDEN, "Not authorized".to_string()));
    }

    let mut updates: Vec<String> = vec!["updated_at = NOW()".to_string()];
    let mut values: Vec<String> = vec![];

    if let Some(ref title) = body.title {
        if title.trim().is_empty() {
            return Err((StatusCode::BAD_REQUEST, "Title cannot be empty".to_string()));
        }
        updates.push("title = $2".to_string());
        values.push(title.clone());
    }

    if let Some(ref body_text) = body.body {
        let idx = values.len() + 2;
        updates.push(format!("body = ${}", idx));
        values.push(body_text.clone());
    }

    if let Some(ref state) = body.state {
        if state != "open" && state != "closed" {
            return Err((StatusCode::BAD_REQUEST, "Invalid state".to_string()));
        }
        let idx = values.len() + 2;
        updates.push(format!("state = ${}", idx));
        values.push(state.clone());
        
        if state == "closed" && issue.state == "open" {
            updates.push(format!("closed_at = NOW(), closed_by_id = ${}", values.len() + 2));
            values.push(user.id.clone());
        } else if state == "open" && issue.state == "closed" {
            updates.push("closed_at = NULL, closed_by_id = NULL".to_string());
        }
    }

    if let Some(locked) = body.locked {
        updates.push(format!("locked = ${}", values.len() + 2));
        values.push(locked.to_string());
    }

    let sql = format!("UPDATE issues SET {} WHERE id = $1", updates.join(", "));
    let mut query = sqlx::query(&sql).bind(id);
    for value in &values {
        query = query.bind(value);
    }

    query
        .execute(&state.db.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(serde_json::json!({ "success": true })))
}

async fn delete_issue(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let user = require_auth(&auth).map_err(|e| (e.0, e.1.to_string()))?;

    #[derive(FromRow)]
    struct IssueCheck {
        owner_id: String,
    }

    let issue: IssueCheck = sqlx::query_as(
        r#"
        SELECT r.owner_id
        FROM issues i
        JOIN repositories r ON r.id = i.repository_id
        WHERE i.id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(&state.db.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Issue not found".to_string()))?;

    if user.id != issue.owner_id {
        return Err((StatusCode::FORBIDDEN, "Only repo owner can delete issues".to_string()));
    }

    sqlx::query("DELETE FROM issues WHERE id = $1")
        .bind(id)
        .execute(&state.db.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(serde_json::json!({ "success": true })))
}

async fn list_labels(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path((owner, name)): Path<(String, String)>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let (repo_id, _) = get_repo_and_check_access(&state, &owner, &name, &auth).await?;

    let labels: Vec<Label> = sqlx::query_as(
        "SELECT id, name, description, color FROM labels WHERE repository_id = $1 ORDER BY name"
    )
    .bind(repo_id)
    .fetch_all(&state.db.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(serde_json::json!({ "labels": labels })))
}

async fn create_label(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path((owner, name)): Path<(String, String)>,
    Json(body): Json<CreateLabelRequest>,
) -> Result<Json<Label>, (StatusCode, String)> {
    let user = require_auth(&auth).map_err(|e| (e.0, e.1.to_string()))?;
    let (repo_id, owner_id) = get_repo_and_check_access(&state, &owner, &name, &auth).await?;

    if user.id != owner_id {
        return Err((StatusCode::FORBIDDEN, "Only repo owner can create labels".to_string()));
    }

    if body.name.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Name cannot be empty".to_string()));
    }

    let label: Label = sqlx::query_as(
        r#"
        INSERT INTO labels (repository_id, name, description, color)
        VALUES ($1, $2, $3, $4)
        RETURNING id, name, description, color
        "#,
    )
    .bind(repo_id)
    .bind(&body.name)
    .bind(&body.description)
    .bind(&body.color)
    .fetch_one(&state.db.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(label))
}

async fn update_label(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateLabelRequest>,
) -> Result<Json<Label>, (StatusCode, String)> {
    let user = require_auth(&auth).map_err(|e| (e.0, e.1.to_string()))?;

    #[derive(FromRow)]
    struct LabelCheck {
        owner_id: String,
    }

    let label: LabelCheck = sqlx::query_as(
        r#"
        SELECT r.owner_id
        FROM labels l
        JOIN repositories r ON r.id = l.repository_id
        WHERE l.id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(&state.db.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Label not found".to_string()))?;

    if user.id != label.owner_id {
        return Err((StatusCode::FORBIDDEN, "Only repo owner can update labels".to_string()));
    }

    let updated: Label = sqlx::query_as(
        r#"
        UPDATE labels 
        SET name = COALESCE($2, name),
            description = COALESCE($3, description),
            color = COALESCE($4, color)
        WHERE id = $1
        RETURNING id, name, description, color
        "#,
    )
    .bind(id)
    .bind(&body.name)
    .bind(&body.description)
    .bind(&body.color)
    .fetch_one(&state.db.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(updated))
}

async fn delete_label(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let user = require_auth(&auth).map_err(|e| (e.0, e.1.to_string()))?;

    #[derive(FromRow)]
    struct LabelCheck {
        owner_id: String,
    }

    let label: LabelCheck = sqlx::query_as(
        r#"
        SELECT r.owner_id
        FROM labels l
        JOIN repositories r ON r.id = l.repository_id
        WHERE l.id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(&state.db.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Label not found".to_string()))?;

    if user.id != label.owner_id {
        return Err((StatusCode::FORBIDDEN, "Only repo owner can delete labels".to_string()));
    }

    sqlx::query("DELETE FROM labels WHERE id = $1")
        .bind(id)
        .execute(&state.db.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(serde_json::json!({ "success": true })))
}

async fn add_labels_to_issue(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(issue_id): Path<Uuid>,
    Json(body): Json<AddLabelsRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let user = require_auth(&auth).map_err(|e| (e.0, e.1.to_string()))?;

    #[derive(FromRow)]
    struct IssueCheck {
        author_id: String,
        owner_id: String,
    }

    let issue: IssueCheck = sqlx::query_as(
        r#"
        SELECT i.author_id, r.owner_id
        FROM issues i
        JOIN repositories r ON r.id = i.repository_id
        WHERE i.id = $1
        "#,
    )
    .bind(issue_id)
    .fetch_optional(&state.db.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Issue not found".to_string()))?;

    if user.id != issue.author_id && user.id != issue.owner_id {
        return Err((StatusCode::FORBIDDEN, "Not authorized".to_string()));
    }

    for label_id in &body.labels {
        let _ = sqlx::query("INSERT INTO issue_labels (issue_id, label_id) VALUES ($1, $2) ON CONFLICT DO NOTHING")
            .bind(issue_id)
            .bind(label_id)
            .execute(&state.db.pool)
            .await;
    }

    Ok(Json(serde_json::json!({ "success": true })))
}

async fn remove_label_from_issue(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path((issue_id, label_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let user = require_auth(&auth).map_err(|e| (e.0, e.1.to_string()))?;

    #[derive(FromRow)]
    struct IssueCheck {
        author_id: String,
        owner_id: String,
    }

    let issue: IssueCheck = sqlx::query_as(
        r#"
        SELECT i.author_id, r.owner_id
        FROM issues i
        JOIN repositories r ON r.id = i.repository_id
        WHERE i.id = $1
        "#,
    )
    .bind(issue_id)
    .fetch_optional(&state.db.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Issue not found".to_string()))?;

    if user.id != issue.author_id && user.id != issue.owner_id {
        return Err((StatusCode::FORBIDDEN, "Not authorized".to_string()));
    }

    sqlx::query("DELETE FROM issue_labels WHERE issue_id = $1 AND label_id = $2")
        .bind(issue_id)
        .bind(label_id)
        .execute(&state.db.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(serde_json::json!({ "success": true })))
}

async fn add_assignees(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(issue_id): Path<Uuid>,
    Json(body): Json<AddAssigneesRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let user = require_auth(&auth).map_err(|e| (e.0, e.1.to_string()))?;

    #[derive(FromRow)]
    struct IssueCheck {
        author_id: String,
        owner_id: String,
    }

    let issue: IssueCheck = sqlx::query_as(
        r#"
        SELECT i.author_id, r.owner_id
        FROM issues i
        JOIN repositories r ON r.id = i.repository_id
        WHERE i.id = $1
        "#,
    )
    .bind(issue_id)
    .fetch_optional(&state.db.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Issue not found".to_string()))?;

    if user.id != issue.author_id && user.id != issue.owner_id {
        return Err((StatusCode::FORBIDDEN, "Not authorized".to_string()));
    }

    for assignee_id in &body.assignees {
        let _ = sqlx::query("INSERT INTO issue_assignees (issue_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING")
            .bind(issue_id)
            .bind(assignee_id)
            .execute(&state.db.pool)
            .await;
    }

    Ok(Json(serde_json::json!({ "success": true })))
}

async fn remove_assignee(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path((issue_id, user_id)): Path<(Uuid, String)>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let user = require_auth(&auth).map_err(|e| (e.0, e.1.to_string()))?;

    #[derive(FromRow)]
    struct IssueCheck {
        author_id: String,
        owner_id: String,
    }

    let issue: IssueCheck = sqlx::query_as(
        r#"
        SELECT i.author_id, r.owner_id
        FROM issues i
        JOIN repositories r ON r.id = i.repository_id
        WHERE i.id = $1
        "#,
    )
    .bind(issue_id)
    .fetch_optional(&state.db.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Issue not found".to_string()))?;

    if user.id != issue.author_id && user.id != issue.owner_id {
        return Err((StatusCode::FORBIDDEN, "Not authorized".to_string()));
    }

    sqlx::query("DELETE FROM issue_assignees WHERE issue_id = $1 AND user_id = $2")
        .bind(issue_id)
        .bind(&user_id)
        .execute(&state.db.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(serde_json::json!({ "success": true })))
}

async fn list_comments(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(issue_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let rows: Vec<CommentRow> = sqlx::query_as(
        r#"
        SELECT c.id, c.body, c.created_at, c.updated_at,
               u.id as author_id, u.username as author_username, u.name as author_name, u.avatar_url as author_avatar_url
        FROM issue_comments c
        JOIN users u ON u.id = c.author_id
        WHERE c.issue_id = $1
        ORDER BY c.created_at ASC
        "#,
    )
    .bind(issue_id)
    .fetch_all(&state.db.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let user_id = auth.0.as_ref().map(|u| u.id.as_str());
    let mut comments = Vec::new();
    for row in rows {
        let reactions = get_comment_reactions(&state, row.id, user_id).await?;
        comments.push(IssueComment {
            id: row.id,
            body: row.body,
            author: IssueAuthor {
                id: row.author_id,
                username: row.author_username,
                name: row.author_name,
                avatar_url: row.author_avatar_url,
            },
            reactions,
            created_at: row.created_at,
            updated_at: row.updated_at,
        });
    }

    Ok(Json(serde_json::json!({ "comments": comments })))
}

async fn create_comment(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(issue_id): Path<Uuid>,
    Json(body): Json<CreateCommentRequest>,
) -> Result<Json<IssueComment>, (StatusCode, String)> {
    let user = require_auth(&auth).map_err(|e| (e.0, e.1.to_string()))?;

    if body.body.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Comment cannot be empty".to_string()));
    }

    let exists: Option<(Uuid,)> = sqlx::query_as("SELECT id FROM issues WHERE id = $1")
        .bind(issue_id)
        .fetch_optional(&state.db.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if exists.is_none() {
        return Err((StatusCode::NOT_FOUND, "Issue not found".to_string()));
    }

    #[derive(FromRow)]
    struct InsertedComment {
        id: Uuid,
        created_at: NaiveDateTime,
        updated_at: NaiveDateTime,
    }

    let inserted: InsertedComment = sqlx::query_as(
        r#"
        INSERT INTO issue_comments (issue_id, author_id, body)
        VALUES ($1, $2, $3)
        RETURNING id, created_at, updated_at
        "#,
    )
    .bind(issue_id)
    .bind(&user.id)
    .bind(&body.body)
    .fetch_one(&state.db.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(IssueComment {
        id: inserted.id,
        body: body.body,
        author: IssueAuthor {
            id: user.id.clone(),
            username: user.username.clone(),
            name: user.name.clone(),
            avatar_url: user.avatar_url.clone(),
        },
        reactions: vec![],
        created_at: inserted.created_at,
        updated_at: inserted.updated_at,
    }))
}

async fn update_comment(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateCommentRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let user = require_auth(&auth).map_err(|e| (e.0, e.1.to_string()))?;

    #[derive(FromRow)]
    struct CommentCheck {
        author_id: String,
    }

    let comment: CommentCheck = sqlx::query_as("SELECT author_id FROM issue_comments WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Comment not found".to_string()))?;

    if user.id != comment.author_id {
        return Err((StatusCode::FORBIDDEN, "Only comment author can edit".to_string()));
    }

    if body.body.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Comment cannot be empty".to_string()));
    }

    sqlx::query("UPDATE issue_comments SET body = $1, updated_at = NOW() WHERE id = $2")
        .bind(&body.body)
        .bind(id)
        .execute(&state.db.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(serde_json::json!({ "success": true })))
}

async fn delete_comment(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let user = require_auth(&auth).map_err(|e| (e.0, e.1.to_string()))?;

    #[derive(FromRow)]
    struct CommentCheck {
        author_id: String,
        owner_id: String,
    }

    let comment: CommentCheck = sqlx::query_as(
        r#"
        SELECT c.author_id, r.owner_id
        FROM issue_comments c
        JOIN issues i ON i.id = c.issue_id
        JOIN repositories r ON r.id = i.repository_id
        WHERE c.id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(&state.db.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Comment not found".to_string()))?;

    if user.id != comment.author_id && user.id != comment.owner_id {
        return Err((StatusCode::FORBIDDEN, "Not authorized".to_string()));
    }

    sqlx::query("DELETE FROM issue_comments WHERE id = $1")
        .bind(id)
        .execute(&state.db.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(serde_json::json!({ "success": true })))
}

async fn toggle_issue_reaction(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(issue_id): Path<Uuid>,
    Json(body): Json<ReactionRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let user = require_auth(&auth).map_err(|e| (e.0, e.1.to_string()))?;

    if !VALID_EMOJIS.contains(&body.emoji.as_str()) {
        return Err((StatusCode::BAD_REQUEST, "Invalid emoji".to_string()));
    }

    let exists: Option<(Uuid,)> = sqlx::query_as("SELECT id FROM issues WHERE id = $1")
        .bind(issue_id)
        .fetch_optional(&state.db.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if exists.is_none() {
        return Err((StatusCode::NOT_FOUND, "Issue not found".to_string()));
    }

    let existing: Option<(Uuid,)> = sqlx::query_as(
        "SELECT id FROM issue_reactions WHERE issue_id = $1 AND user_id = $2 AND emoji = $3"
    )
    .bind(issue_id)
    .bind(&user.id)
    .bind(&body.emoji)
    .fetch_optional(&state.db.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let added = if existing.is_some() {
        sqlx::query("DELETE FROM issue_reactions WHERE issue_id = $1 AND user_id = $2 AND emoji = $3")
            .bind(issue_id)
            .bind(&user.id)
            .bind(&body.emoji)
            .execute(&state.db.pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        false
    } else {
        sqlx::query("INSERT INTO issue_reactions (issue_id, user_id, emoji) VALUES ($1, $2, $3)")
            .bind(issue_id)
            .bind(&user.id)
            .bind(&body.emoji)
            .execute(&state.db.pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        true
    };

    Ok(Json(serde_json::json!({ "added": added })))
}

async fn toggle_comment_reaction(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(comment_id): Path<Uuid>,
    Json(body): Json<ReactionRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let user = require_auth(&auth).map_err(|e| (e.0, e.1.to_string()))?;

    if !VALID_EMOJIS.contains(&body.emoji.as_str()) {
        return Err((StatusCode::BAD_REQUEST, "Invalid emoji".to_string()));
    }

    let exists: Option<(Uuid,)> = sqlx::query_as("SELECT id FROM issue_comments WHERE id = $1")
        .bind(comment_id)
        .fetch_optional(&state.db.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if exists.is_none() {
        return Err((StatusCode::NOT_FOUND, "Comment not found".to_string()));
    }

    let existing: Option<(Uuid,)> = sqlx::query_as(
        "SELECT id FROM issue_reactions WHERE comment_id = $1 AND user_id = $2 AND emoji = $3"
    )
    .bind(comment_id)
    .bind(&user.id)
    .bind(&body.emoji)
    .fetch_optional(&state.db.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let added = if existing.is_some() {
        sqlx::query("DELETE FROM issue_reactions WHERE comment_id = $1 AND user_id = $2 AND emoji = $3")
            .bind(comment_id)
            .bind(&user.id)
            .bind(&body.emoji)
            .execute(&state.db.pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        false
    } else {
        sqlx::query("INSERT INTO issue_reactions (comment_id, user_id, emoji) VALUES ($1, $2, $3)")
            .bind(comment_id)
            .bind(&user.id)
            .bind(&body.emoji)
            .execute(&state.db.pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        true
    };

    Ok(Json(serde_json::json!({ "added": added })))
}

async fn get_issue_count(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path((owner, name)): Path<(String, String)>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let (repo_id, _) = get_repo_and_check_access(&state, &owner, &name, &auth).await?;

    let open_count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM issues WHERE repository_id = $1 AND state = 'open'"
    )
    .bind(repo_id)
    .fetch_one(&state.db.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let closed_count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM issues WHERE repository_id = $1 AND state = 'closed'"
    )
    .bind(repo_id)
    .fetch_one(&state.db.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(serde_json::json!({
        "open": open_count.0,
        "closed": closed_count.0,
    })))
}

async fn get_issue_labels(state: &AppState, issue_id: Uuid) -> Result<Vec<Label>, (StatusCode, String)> {
    sqlx::query_as(
        r#"
        SELECT l.id, l.name, l.description, l.color
        FROM labels l
        JOIN issue_labels il ON il.label_id = l.id
        WHERE il.issue_id = $1
        ORDER BY l.name
        "#,
    )
    .bind(issue_id)
    .fetch_all(&state.db.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

async fn get_issue_assignees(state: &AppState, issue_id: Uuid) -> Result<Vec<IssueAuthor>, (StatusCode, String)> {
    sqlx::query_as(
        r#"
        SELECT u.id, u.username, u.name, u.avatar_url
        FROM users u
        JOIN issue_assignees ia ON ia.user_id = u.id
        WHERE ia.issue_id = $1
        "#,
    )
    .bind(issue_id)
    .fetch_all(&state.db.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

async fn get_issue_reactions(
    state: &AppState,
    issue_id: Uuid,
    user_id: Option<&str>,
) -> Result<Vec<ReactionSummary>, (StatusCode, String)> {
    let counts: Vec<ReactionRow> = sqlx::query_as(
        "SELECT emoji, COUNT(*) as count FROM issue_reactions WHERE issue_id = $1 GROUP BY emoji"
    )
    .bind(issue_id)
    .fetch_all(&state.db.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let user_reactions: Vec<UserReactionRow> = if let Some(uid) = user_id {
        sqlx::query_as(
            "SELECT emoji FROM issue_reactions WHERE issue_id = $1 AND user_id = $2"
        )
        .bind(issue_id)
        .bind(uid)
        .fetch_all(&state.db.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    } else {
        vec![]
    };

    let user_emojis: Vec<&str> = user_reactions.iter().map(|r| r.emoji.as_str()).collect();

    Ok(counts
        .into_iter()
        .map(|r| ReactionSummary {
            emoji: r.emoji.clone(),
            count: r.count,
            reacted: user_emojis.contains(&r.emoji.as_str()),
        })
        .collect())
}

async fn get_comment_reactions(
    state: &AppState,
    comment_id: Uuid,
    user_id: Option<&str>,
) -> Result<Vec<ReactionSummary>, (StatusCode, String)> {
    let counts: Vec<ReactionRow> = sqlx::query_as(
        "SELECT emoji, COUNT(*) as count FROM issue_reactions WHERE comment_id = $1 GROUP BY emoji"
    )
    .bind(comment_id)
    .fetch_all(&state.db.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let user_reactions: Vec<UserReactionRow> = if let Some(uid) = user_id {
        sqlx::query_as(
            "SELECT emoji FROM issue_reactions WHERE comment_id = $1 AND user_id = $2"
        )
        .bind(comment_id)
        .bind(uid)
        .fetch_all(&state.db.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    } else {
        vec![]
    };

    let user_emojis: Vec<&str> = user_reactions.iter().map(|r| r.emoji.as_str()).collect();

    Ok(counts
        .into_iter()
        .map(|r| ReactionSummary {
            emoji: r.emoji.clone(),
            count: r.count,
            reacted: user_emojis.contains(&r.emoji.as_str()),
        })
        .collect())
}

async fn get_comment_count(state: &AppState, issue_id: Uuid) -> Result<i64, (StatusCode, String)> {
    let count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM issue_comments WHERE issue_id = $1"
    )
    .bind(issue_id)
    .fetch_one(&state.db.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(count.0)
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/repositories/{owner}/{name}/issues", get(list_issues))
        .route("/api/repositories/{owner}/{name}/issues", post(create_issue))
        .route("/api/repositories/{owner}/{name}/issues/count", get(get_issue_count))
        .route("/api/repositories/{owner}/{name}/issues/{number}", get(get_issue))
        .route("/api/issues/{id}", patch(update_issue))
        .route("/api/issues/{id}", delete(delete_issue))
        .route("/api/repositories/{owner}/{name}/labels", get(list_labels))
        .route("/api/repositories/{owner}/{name}/labels", post(create_label))
        .route("/api/labels/{id}", patch(update_label))
        .route("/api/labels/{id}", delete(delete_label))
        .route("/api/issues/{id}/labels", post(add_labels_to_issue))
        .route("/api/issues/{id}/labels/{label_id}", delete(remove_label_from_issue))
        .route("/api/issues/{id}/assignees", post(add_assignees))
        .route("/api/issues/{id}/assignees/{user_id}", delete(remove_assignee))
        .route("/api/issues/{id}/comments", get(list_comments))
        .route("/api/issues/{id}/comments", post(create_comment))
        .route("/api/issues/comments/{id}", patch(update_comment))
        .route("/api/issues/comments/{id}", delete(delete_comment))
        .route("/api/issues/{id}/reactions", post(toggle_issue_reaction))
        .route("/api/issues/comments/{id}/reactions", post(toggle_comment_reaction))
}
