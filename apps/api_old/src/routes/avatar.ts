import { type Hono } from "hono";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { type AppEnv } from "../types";

export function registerAvatarRoutes(app: Hono<AppEnv>) {
  app.options("/avatar/:filename", (c) => {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      },
    });
  });

  app.get("/avatar/:filename", async (c) => {
    const filename = c.req.param("filename")!;
    const key = `avatars/${filename}`;
    const s3 = c.get("s3");

    try {
      const response = await s3.client.send(new GetObjectCommand({ Bucket: s3.bucket, Key: key }));

      if (!response.Body) {
        return c.text("Avatar not found", 404);
      }

      const ext = filename.split(".").pop()?.toLowerCase();
      let contentType = "image/png";

      if (ext === "jpg" || ext === "jpeg") {
        contentType = "image/jpeg";
      } else if (ext === "gif") {
        contentType = "image/gif";
      } else if (ext === "webp") {
        contentType = "image/webp";
      }

      const headers = new Headers({
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      });

      if (response.ContentLength) {
        headers.set("Content-Length", response.ContentLength.toString());
      }

      const bytes = await response.Body.transformToByteArray();
      return new Response(bytes, { headers });
    } catch (err: unknown) {
      const error = err as { name?: string };
      if (error.name === "NoSuchKey") {
        return c.text("Avatar not found", 404);
      }
      throw err;
    }
  });
}
