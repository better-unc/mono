import { type Hono } from "hono";
import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command, HeadObjectCommand, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { type AppEnv } from "../types";
import { authMiddleware } from "../middleware/auth";

export function registerR2Routes(app: Hono<AppEnv>) {
  app.all("/api/r2/:key", authMiddleware, async (c) => {
    const key = decodeURIComponent(c.req.param("key")!);
    const user = c.get("user");
    const s3 = c.get("s3");

    if (!user) {
      return c.text("Unauthorized", 401);
    }

    if (c.req.method === "HEAD") {
      try {
        const response = await s3.client.send(new HeadObjectCommand({ Bucket: s3.bucket, Key: key }));

        const headers = new Headers();
        if (response.ContentLength) {
          headers.set("Content-Length", response.ContentLength.toString());
        }
        if (response.ContentType) {
          headers.set("Content-Type", response.ContentType);
        }

        return new Response(null, { headers });
      } catch (err: unknown) {
        const error = err as { name?: string };
        if (error.name === "NotFound") {
          return c.text("Not found", 404);
        }
        throw err;
      }
    }

    if (c.req.method === "GET") {
      try {
        const response = await s3.client.send(new GetObjectCommand({ Bucket: s3.bucket, Key: key }));

        if (!response.Body) {
          return c.text("Not found", 404);
        }

        const headers = new Headers();
        if (response.ContentLength) {
          headers.set("Content-Length", response.ContentLength.toString());
        }
        if (response.ContentType) {
          headers.set("Content-Type", response.ContentType);
        }

        const bytes = await response.Body.transformToByteArray();
        return new Response(bytes, { headers });
      } catch (err: unknown) {
        const error = err as { name?: string };
        if (error.name === "NoSuchKey") {
          return c.text("Not found", 404);
        }
        throw err;
      }
    }
  });

  app.put("/api/r2/:key", authMiddleware, async (c) => {
    const key = decodeURIComponent(c.req.param("key")!);
    const user = c.get("user");
    const s3 = c.get("s3");

    if (!user) {
      return c.text("Unauthorized", 401);
    }

    const body = await c.req.arrayBuffer();
    const contentType = c.req.header("Content-Type") || "application/octet-stream";

    await s3.client.send(
      new PutObjectCommand({
        Bucket: s3.bucket,
        Key: key,
        Body: new Uint8Array(body),
        ContentType: contentType,
      })
    );

    return c.json({ success: true });
  });

  app.delete("/api/r2/:key", authMiddleware, async (c) => {
    const key = decodeURIComponent(c.req.param("key")!);
    const user = c.get("user");
    const s3 = c.get("s3");

    if (!user) {
      return c.text("Unauthorized", 401);
    }

    await s3.client.send(new DeleteObjectCommand({ Bucket: s3.bucket, Key: key }));

    return c.json({ success: true });
  });

  app.get("/api/r2/list/:prefix", authMiddleware, async (c) => {
    const prefix = decodeURIComponent(c.req.param("prefix")!);
    const user = c.get("user");
    const s3 = c.get("s3");

    if (!user) {
      return c.text("Unauthorized", 401);
    }

    const keys: string[] = [];
    let continuationToken: string | undefined;

    do {
      const response = await s3.client.send(
        new ListObjectsV2Command({
          Bucket: s3.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        })
      );
      for (const obj of response.Contents || []) {
        if (obj.Key) {
          keys.push(obj.Key);
        }
      }
      continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
    } while (continuationToken);

    return c.json({ keys });
  });

  app.post("/api/r2/batch/get", authMiddleware, async (c) => {
    const user = c.get("user");
    const s3 = c.get("s3");

    if (!user) {
      return c.text("Unauthorized", 401);
    }

    const { keys } = await c.req.json<{ keys: string[] }>();

    const results: Record<string, string | null> = {};

    for (const key of keys) {
      try {
        const response = await s3.client.send(new GetObjectCommand({ Bucket: s3.bucket, Key: key }));
        if (response.Body) {
          const bytes = await response.Body.transformToByteArray();
          const base64 = btoa(String.fromCharCode(...bytes));
          results[key] = base64;
        } else {
          results[key] = null;
        }
      } catch {
        results[key] = null;
      }
    }

    return c.json({ results });
  });

  app.post("/api/r2/batch/put", authMiddleware, async (c) => {
    const user = c.get("user");
    const s3 = c.get("s3");

    if (!user) {
      return c.text("Unauthorized", 401);
    }

    const { items } = await c.req.json<{ items: Array<{ key: string; data: string; contentType?: string }> }>();

    for (const item of items) {
      const data = Uint8Array.from(atob(item.data), (c) => c.charCodeAt(0));
      await s3.client.send(
        new PutObjectCommand({
          Bucket: s3.bucket,
          Key: item.key,
          Body: data,
          ContentType: item.contentType || "application/octet-stream",
        })
      );
    }

    return c.json({ success: true });
  });

  app.delete("/api/r2/prefix/:prefix", authMiddleware, async (c) => {
    const prefix = decodeURIComponent(c.req.param("prefix")!);
    const user = c.get("user");
    const s3 = c.get("s3");

    if (!user) {
      return c.text("Unauthorized", 401);
    }

    const keys: string[] = [];
    let continuationToken: string | undefined;

    do {
      const response = await s3.client.send(
        new ListObjectsV2Command({
          Bucket: s3.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        })
      );
      for (const obj of response.Contents || []) {
        if (obj.Key) {
          keys.push(obj.Key);
        }
      }
      continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
    } while (continuationToken);

    if (keys.length > 0) {
      const batches: string[][] = [];
      for (let i = 0; i < keys.length; i += 1000) {
        batches.push(keys.slice(i, i + 1000));
      }
      for (const batch of batches) {
        await s3.client.send(
          new DeleteObjectsCommand({
            Bucket: s3.bucket,
            Delete: { Objects: batch.map((key) => ({ Key: key })) },
          })
        );
      }
    }

    return c.json({ success: true, deleted: keys.length });
  });
}
