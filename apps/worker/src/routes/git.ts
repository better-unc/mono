import { type Hono } from "hono";
import { type AppEnv } from "../types";
import { repoMiddleware } from "../middleware/repo";
import { authMiddleware, requireAuth } from "../middleware/auth";
import { createR2Fs } from "../r2-fs";
import { getRefsAdvertisement, handleUploadPack, handleReceivePack } from "../git-handler";

export function registerGitRoutes(app: Hono<AppEnv>) {
  app.get("/:username/:repo/info/refs", repoMiddleware, authMiddleware, async (c) => {
    const { repo, repoPrefix } = c.get("repoData");
    const service = c.req.query("service");

    if (service !== "git-upload-pack" && service !== "git-receive-pack") {
      return c.text("Not found", 404);
    }

    if (service === "git-receive-pack") {
      const authError = requireAuth(c, repo.ownerId);
      if (authError) return authError;
    } else if (repo.visibility === "private") {
      const authError = requireAuth(c, repo.ownerId);
      if (authError) return authError;
    }

    const fs = createR2Fs(c.env.REPO_BUCKET, repoPrefix);
    const refs = await getRefsAdvertisement(fs, "/", service);

    const packet = `# service=${service}\n`;
    const packetLen = (packet.length + 4).toString(16).padStart(4, "0");
    const encoder = new TextEncoder();
    const header = encoder.encode(packetLen + packet + "0000");
    const response = new Uint8Array(header.length + refs.length);
    response.set(header, 0);
    response.set(refs, header.length);

    return new Response(response, {
      headers: {
        "Content-Type": `application/x-${service}-advertisement`,
        "Cache-Control": "no-cache",
      },
    });
  });

  app.post("/:username/:repo/git-upload-pack", repoMiddleware, authMiddleware, async (c) => {
    const { repo, repoPrefix } = c.get("repoData");

    if (repo.visibility === "private") {
      const authError = requireAuth(c, repo.ownerId);
      if (authError) return authError;
    }

    const body = new Uint8Array(await c.req.arrayBuffer());
    const fs = createR2Fs(c.env.REPO_BUCKET, repoPrefix);
    const response = await handleUploadPack(fs, "/", body);

    return new Response(response, {
      headers: {
        "Content-Type": "application/x-git-upload-pack-result",
        "Cache-Control": "no-cache",
      },
    });
  });

  app.post("/:username/:repo/git-receive-pack", repoMiddleware, authMiddleware, async (c) => {
    const { repo, repoPrefix } = c.get("repoData");

    const authError = requireAuth(c, repo.ownerId);
    if (authError) return authError;

    const body = new Uint8Array(await c.req.arrayBuffer());
    const fs = createR2Fs(c.env.REPO_BUCKET, repoPrefix);
    const response = await handleReceivePack(fs, "/", body);

    return new Response(response, {
      headers: {
        "Content-Type": "application/x-git-receive-pack-result",
        "Cache-Control": "no-cache",
      },
    });
  });
}
