import { Hono } from "hono";
import {
  db,
  users,
  repositories,
  projects,
  projectColumns,
  projectItems,
  issues,
  pullRequests,
} from "@gitbruv/db";
import { eq, sql, and, asc } from "drizzle-orm";
import { authMiddleware, requireAuth, type AuthVariables } from "../middleware/auth";

const app = new Hono<{ Variables: AuthVariables }>();

app.use("*", authMiddleware);

async function getRepoAndCheckAccess(owner: string, name: string, userId?: string) {
  const result = await db
    .select({
      id: repositories.id,
      ownerId: repositories.ownerId,
      visibility: repositories.visibility,
    })
    .from(repositories)
    .innerJoin(users, eq(users.id, repositories.ownerId))
    .where(and(eq(users.username, owner), eq(repositories.name, name)))
    .limit(1);

  const row = result[0];
  if (!row) return null;

  if (row.visibility === "private" && userId !== row.ownerId) {
    return null;
  }

  return { repoId: row.id, ownerId: row.ownerId };
}

async function enrichProjectItem(item: any) {
  if (item.issueId) {
    const issue = await db.query.issues.findFirst({
      where: eq(issues.id, item.issueId),
    });
    if (issue) {
      const author = await db.query.users.findFirst({
        where: eq(users.id, issue.authorId),
        columns: { id: true, username: true, name: true, avatarUrl: true },
      });
      return {
        id: item.id,
        type: "issue" as const,
        position: item.position,
        issue: {
          id: issue.id,
          number: issue.number,
          title: issue.title,
          state: issue.state,
          author,
        },
      };
    }
  }

  if (item.pullRequestId) {
    const pr = await db.query.pullRequests.findFirst({
      where: eq(pullRequests.id, item.pullRequestId),
    });
    if (pr) {
      const author = await db.query.users.findFirst({
        where: eq(users.id, pr.authorId),
        columns: { id: true, username: true, name: true, avatarUrl: true },
      });
      return {
        id: item.id,
        type: "pull_request" as const,
        position: item.position,
        pullRequest: {
          id: pr.id,
          number: pr.number,
          title: pr.title,
          state: pr.state,
          author,
        },
      };
    }
  }

  if (item.noteContent) {
    return {
      id: item.id,
      type: "note" as const,
      position: item.position,
      noteContent: item.noteContent,
    };
  }

  return null;
}

app.get("/api/repositories/:owner/:name/projects", async (c) => {
  const owner = c.req.param("owner");
  const name = c.req.param("name");
  const currentUser = c.get("user");

  const repoAccess = await getRepoAndCheckAccess(owner, name, currentUser?.id);
  if (!repoAccess) {
    return c.json({ error: "Repository not found" }, 404);
  }

  const projectList = await db
    .select()
    .from(projects)
    .where(eq(projects.repositoryId, repoAccess.repoId))
    .orderBy(projects.createdAt);

  return c.json({ projects: projectList });
});

app.post("/api/repositories/:owner/:name/projects", requireAuth, async (c) => {
  const owner = c.req.param("owner");
  const name = c.req.param("name");
  const user = c.get("user")!;
  const body = await c.req.json<{ name: string; description?: string }>();

  const repoAccess = await getRepoAndCheckAccess(owner, name, user.id);
  if (!repoAccess) {
    return c.json({ error: "Repository not found" }, 404);
  }

  if (user.id !== repoAccess.ownerId) {
    return c.json({ error: "Only repo owner can create projects" }, 403);
  }

  if (!body.name?.trim()) {
    return c.json({ error: "Project name is required" }, 400);
  }

  const [inserted] = await db
    .insert(projects)
    .values({
      repositoryId: repoAccess.repoId,
      name: body.name,
      description: body.description,
    })
    .returning();

  const defaultColumns = ["To Do", "In Progress", "Done"];
  for (let i = 0; i < defaultColumns.length; i++) {
    await db.insert(projectColumns).values({
      projectId: inserted.id,
      name: defaultColumns[i],
      position: i,
    });
  }

  return c.json(inserted);
});

app.get("/api/projects/:id", async (c) => {
  const id = c.req.param("id");
  const currentUser = c.get("user");

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });

  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  const repo = await db.query.repositories.findFirst({
    where: eq(repositories.id, project.repositoryId),
  });

  if (!repo) {
    return c.json({ error: "Repository not found" }, 404);
  }

  if (repo.visibility === "private" && currentUser?.id !== repo.ownerId) {
    return c.json({ error: "Project not found" }, 404);
  }

  const columns = await db
    .select()
    .from(projectColumns)
    .where(eq(projectColumns.projectId, id))
    .orderBy(asc(projectColumns.position));

  const columnsWithItems = await Promise.all(
    columns.map(async (column) => {
      const items = await db
        .select()
        .from(projectItems)
        .where(eq(projectItems.columnId, column.id))
        .orderBy(asc(projectItems.position));

      const enrichedItems = (await Promise.all(items.map(enrichProjectItem))).filter(Boolean);

      return {
        id: column.id,
        name: column.name,
        position: column.position,
        items: enrichedItems,
      };
    })
  );

  return c.json({
    id: project.id,
    name: project.name,
    description: project.description,
    columns: columnsWithItems,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  });
});

app.patch("/api/projects/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;
  const body = await c.req.json<{ name?: string; description?: string }>();

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });

  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  const repo = await db.query.repositories.findFirst({
    where: eq(repositories.id, project.repositoryId),
  });

  if (user.id !== repo?.ownerId) {
    return c.json({ error: "Only repo owner can update projects" }, 403);
  }

  const updates: Record<string, any> = { updatedAt: new Date() };
  if (body.name !== undefined) updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description;

  await db.update(projects).set(updates).where(eq(projects.id, id));

  return c.json({ success: true });
});

app.delete("/api/projects/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });

  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  const repo = await db.query.repositories.findFirst({
    where: eq(repositories.id, project.repositoryId),
  });

  if (user.id !== repo?.ownerId) {
    return c.json({ error: "Only repo owner can delete projects" }, 403);
  }

  await db.delete(projects).where(eq(projects.id, id));

  return c.json({ success: true });
});

app.post("/api/projects/:id/columns", requireAuth, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;
  const body = await c.req.json<{ name: string }>();

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });

  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  const repo = await db.query.repositories.findFirst({
    where: eq(repositories.id, project.repositoryId),
  });

  if (user.id !== repo?.ownerId) {
    return c.json({ error: "Only repo owner can add columns" }, 403);
  }

  const [maxPosition] = await db
    .select({ max: sql<number>`COALESCE(MAX(position), -1)` })
    .from(projectColumns)
    .where(eq(projectColumns.projectId, id));

  const [inserted] = await db
    .insert(projectColumns)
    .values({
      projectId: id,
      name: body.name,
      position: (maxPosition?.max ?? -1) + 1,
    })
    .returning();

  return c.json(inserted);
});

app.patch("/api/projects/columns/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;
  const body = await c.req.json<{ name?: string; position?: number }>();

  const column = await db.query.projectColumns.findFirst({
    where: eq(projectColumns.id, id),
  });

  if (!column) {
    return c.json({ error: "Column not found" }, 404);
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, column.projectId),
  });

  const repo = project
    ? await db.query.repositories.findFirst({
        where: eq(repositories.id, project.repositoryId),
      })
    : null;

  if (user.id !== repo?.ownerId) {
    return c.json({ error: "Only repo owner can update columns" }, 403);
  }

  const updates: Record<string, any> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.position !== undefined) updates.position = body.position;

  if (Object.keys(updates).length > 0) {
    await db.update(projectColumns).set(updates).where(eq(projectColumns.id, id));
  }

  return c.json({ success: true });
});

app.delete("/api/projects/columns/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;

  const column = await db.query.projectColumns.findFirst({
    where: eq(projectColumns.id, id),
  });

  if (!column) {
    return c.json({ error: "Column not found" }, 404);
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, column.projectId),
  });

  const repo = project
    ? await db.query.repositories.findFirst({
        where: eq(repositories.id, project.repositoryId),
      })
    : null;

  if (user.id !== repo?.ownerId) {
    return c.json({ error: "Only repo owner can delete columns" }, 403);
  }

  await db.delete(projectColumns).where(eq(projectColumns.id, id));

  return c.json({ success: true });
});

app.post("/api/projects/:id/items", requireAuth, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;
  const body = await c.req.json<{
    columnId: string;
    issueId?: string;
    pullRequestId?: string;
    noteContent?: string;
  }>();

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });

  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  const repo = await db.query.repositories.findFirst({
    where: eq(repositories.id, project.repositoryId),
  });

  if (user.id !== repo?.ownerId) {
    return c.json({ error: "Only repo owner can add items" }, 403);
  }

  if (!body.columnId) {
    return c.json({ error: "Column is required" }, 400);
  }

  if (!body.issueId && !body.pullRequestId && !body.noteContent) {
    return c.json({ error: "Must provide an issue, PR, or note content" }, 400);
  }

  const [maxPosition] = await db
    .select({ max: sql<number>`COALESCE(MAX(position), -1)` })
    .from(projectItems)
    .where(eq(projectItems.columnId, body.columnId));

  const [inserted] = await db
    .insert(projectItems)
    .values({
      projectId: id,
      columnId: body.columnId,
      issueId: body.issueId || null,
      pullRequestId: body.pullRequestId || null,
      noteContent: body.noteContent || null,
      position: (maxPosition?.max ?? -1) + 1,
    })
    .returning();

  const enriched = await enrichProjectItem(inserted);

  return c.json(enriched);
});

app.patch("/api/projects/items/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;
  const body = await c.req.json<{ columnId?: string; position?: number; noteContent?: string }>();

  const item = await db.query.projectItems.findFirst({
    where: eq(projectItems.id, id),
  });

  if (!item) {
    return c.json({ error: "Item not found" }, 404);
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, item.projectId),
  });

  const repo = project
    ? await db.query.repositories.findFirst({
        where: eq(repositories.id, project.repositoryId),
      })
    : null;

  if (user.id !== repo?.ownerId) {
    return c.json({ error: "Only repo owner can update items" }, 403);
  }

  const updates: Record<string, any> = {};
  if (body.columnId !== undefined) updates.columnId = body.columnId;
  if (body.position !== undefined) updates.position = body.position;
  if (body.noteContent !== undefined) updates.noteContent = body.noteContent;

  if (Object.keys(updates).length > 0) {
    await db.update(projectItems).set(updates).where(eq(projectItems.id, id));
  }

  return c.json({ success: true });
});

app.post("/api/projects/items/reorder", requireAuth, async (c) => {
  const user = c.get("user")!;
  const body = await c.req.json<{ items: { id: string; columnId: string; position: number }[] }>();

  if (!body.items?.length) {
    return c.json({ error: "Items array is required" }, 400);
  }

  const firstItem = await db.query.projectItems.findFirst({
    where: eq(projectItems.id, body.items[0].id),
  });

  if (!firstItem) {
    return c.json({ error: "Item not found" }, 404);
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, firstItem.projectId),
  });

  const repo = project
    ? await db.query.repositories.findFirst({
        where: eq(repositories.id, project.repositoryId),
      })
    : null;

  if (user.id !== repo?.ownerId) {
    return c.json({ error: "Only repo owner can reorder items" }, 403);
  }

  for (const item of body.items) {
    await db
      .update(projectItems)
      .set({ columnId: item.columnId, position: item.position })
      .where(eq(projectItems.id, item.id));
  }

  return c.json({ success: true });
});

app.delete("/api/projects/items/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;

  const item = await db.query.projectItems.findFirst({
    where: eq(projectItems.id, id),
  });

  if (!item) {
    return c.json({ error: "Item not found" }, 404);
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, item.projectId),
  });

  const repo = project
    ? await db.query.repositories.findFirst({
        where: eq(repositories.id, project.repositoryId),
      })
    : null;

  if (user.id !== repo?.ownerId) {
    return c.json({ error: "Only repo owner can delete items" }, 403);
  }

  await db.delete(projectItems).where(eq(projectItems.id, id));

  return c.json({ success: true });
});

export default app;
