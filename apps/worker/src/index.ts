import { type Env } from "./env";
import { createDb } from "./db";
import { createR2Fs, getRepoPrefix } from "./r2-fs";
import { authenticateRequest, getRepoOwnerAndRepo } from "./auth";
import { getRefsAdvertisement, handleUploadPack, handleReceivePack } from "./git-handler";

interface GitPath {
  username: string;
  repoName: string;
  action: string | null;
}

function parseGitPath(pathname: string): GitPath | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length < 2) return null;

  const username = segments[0];
  let repoName = segments[1];

  if (repoName.endsWith(".git")) {
    repoName = repoName.slice(0, -4);
  }

  const remainingPath = segments.slice(2).join("/");

  let action: string | null = null;
  if (remainingPath === "info/refs") {
    action = "info/refs";
  } else if (remainingPath === "git-upload-pack") {
    action = "git-upload-pack";
  } else if (remainingPath === "git-receive-pack") {
    action = "git-receive-pack";
  }

  return { username, repoName, action };
}

function unauthorized(): Response {
  return new Response("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="gitbruv"' },
  });
}

function notFound(): Response {
  return new Response("Not found", { status: 404 });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const parsed = parseGitPath(url.pathname);

    if (!parsed) {
      return notFound();
    }

    const { username, repoName, action } = parsed;
    const db = createDb(env.DB.connectionString);

    const result = await getRepoOwnerAndRepo(db, username, repoName);
    if (!result) {
      return new Response("Repository not found", { status: 404 });
    }

    const { owner, repo } = result;

    if (request.method === "GET" && action === "info/refs") {
      const serviceQuery = url.searchParams.get("service");

      if (serviceQuery === "git-upload-pack" || serviceQuery === "git-receive-pack") {
        if (serviceQuery === "git-receive-pack") {
          const user = await authenticateRequest(request, db);
          if (!user || user.id !== repo.ownerId) {
            return unauthorized();
          }
        } else if (repo.visibility === "private") {
          const user = await authenticateRequest(request, db);
          if (!user || user.id !== repo.ownerId) {
            return unauthorized();
          }
        }

        const repoPrefix = getRepoPrefix(owner.id, `${repoName}.git`);
        const fs = createR2Fs(env.REPO_BUCKET, repoPrefix);

        const refs = await getRefsAdvertisement(fs, "/", serviceQuery);

        const packet = `# service=${serviceQuery}\n`;
        const packetLen = (packet.length + 4).toString(16).padStart(4, "0");
        const encoder = new TextEncoder();
        const header = encoder.encode(packetLen + packet + "0000");
        const response = new Uint8Array(header.length + refs.length);
        response.set(header, 0);
        response.set(refs, header.length);

        return new Response(response, {
          headers: {
            "Content-Type": `application/x-${serviceQuery}-advertisement`,
            "Cache-Control": "no-cache",
          },
        });
      }
    }

    if (request.method === "POST" && (action === "git-upload-pack" || action === "git-receive-pack")) {
      const user = await authenticateRequest(request, db);

      if (action === "git-receive-pack") {
        if (!user || user.id !== repo.ownerId) {
          return unauthorized();
        }
      } else if (repo.visibility === "private") {
        if (!user || user.id !== repo.ownerId) {
          return unauthorized();
        }
      }

      const body = new Uint8Array(await request.arrayBuffer());
      const repoPrefix = getRepoPrefix(owner.id, `${repoName}.git`);
      const fs = createR2Fs(env.REPO_BUCKET, repoPrefix);

      let response: Uint8Array;

      if (action === "git-upload-pack") {
        response = await handleUploadPack(fs, "/", body);
      } else {
        response = await handleReceivePack(fs, "/", body);
      }

      return new Response(response, {
        headers: {
          "Content-Type": `application/x-${action}-result`,
          "Cache-Control": "no-cache",
        },
      });
    }

    return notFound();
  },
};
