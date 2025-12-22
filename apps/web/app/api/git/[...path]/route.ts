import { NextRequest, NextResponse } from "next/server";
import { db, users, repositories } from "@gitbruv/db";
import { eq, and } from "drizzle-orm";
import git from "isomorphic-git";
import { createR2Fs, getRepoPrefix, R2Fs } from "@/lib/r2-fs";
import { revalidateTag } from "next/cache";
import { rateLimit } from "@/lib/rate-limit";
import { authenticateRequest } from "@/lib/api-auth";
import { createHash } from "crypto";
import { invalidateRepoCache } from "@/lib/git-cache";

function parseGitPath(pathSegments: string[]): { username: string; repoName: string; action: string | null } | null {
  if (pathSegments.length < 2) return null;

  const username = pathSegments[0];
  let repoName = pathSegments[1];

  if (repoName.endsWith(".git")) {
    repoName = repoName.slice(0, -4);
  }

  const remainingPath = pathSegments.slice(2).join("/");

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

async function getRefsAdvertisement(fs: R2Fs, gitdir: string, service: string): Promise<Buffer> {
  const capabilities =
    service === "git-upload-pack"
      ? ["ofs-delta", "shallow", "no-progress", "include-tag", "symref=HEAD:refs/heads/main"]
      : ["report-status", "delete-refs", "ofs-delta"];

  const refs: { name: string; oid: string }[] = [];

  const [branchList, tagList, headResult] = await Promise.all([
    git.listBranches({ fs, gitdir }).catch(() => [] as string[]),
    git.listTags({ fs, gitdir }).catch(() => [] as string[]),
    git.resolveRef({ fs, gitdir, ref: "HEAD" }).catch(() => ""),
  ]);

  const refPromises = [
    ...branchList.map(async (branch) => {
      try {
        const oid = await git.resolveRef({ fs, gitdir, ref: branch });
        return { name: `refs/heads/${branch}`, oid };
      } catch {
        return null;
      }
    }),
    ...tagList.map(async (tag) => {
      try {
        const oid = await git.resolveRef({ fs, gitdir, ref: tag });
        return { name: `refs/tags/${tag}`, oid };
      } catch {
        return null;
      }
    }),
  ];

  const refResults = await Promise.all(refPromises);
  for (const ref of refResults) {
    if (ref) refs.push(ref);
  }

  const head = headResult;
  const lines: string[] = [];

  if (refs.length === 0) {
    const zeroId = "0".repeat(40);
    const capsLine = `${zeroId} capabilities^{}\0${capabilities.join(" ")}\n`;
    lines.push(capsLine);
  } else {
    const firstRef = head ? { name: "HEAD", oid: head } : refs[0];
    const capsLine = `${firstRef.oid} ${firstRef.name}\0${capabilities.join(" ")}\n`;
    lines.push(capsLine);

    for (const ref of refs) {
      if (ref.name !== firstRef.name || !head) {
        lines.push(`${ref.oid} ${ref.name}\n`);
      }
    }
  }

  const packets: Buffer[] = [];
  for (const line of lines) {
    const len = (line.length + 4).toString(16).padStart(4, "0");
    packets.push(Buffer.from(len + line));
  }
  packets.push(Buffer.from("0000"));

  return Buffer.concat(packets);
}

const BATCH_SIZE = 50;

async function collectReachableObjects(fs: R2Fs, gitdir: string, oids: string[]): Promise<string[]> {
  const visited = new Set<string>();
  let currentBatch = [...oids];

  while (currentBatch.length > 0) {
    const toProcess = currentBatch.filter((oid) => !visited.has(oid));
    if (toProcess.length === 0) break;

    for (const oid of toProcess) {
      visited.add(oid);
    }

    const objectPromises = toProcess.slice(0, BATCH_SIZE).map(async (oid) => {
      try {
        const { object, type } = await git.readObject({ fs, gitdir, oid });
        return { oid, object, type };
      } catch {
        return null;
      }
    });

    const results = await Promise.all(objectPromises);
    const nextBatch: string[] = [];

    for (const result of results) {
      if (!result) continue;
      const { object, type } = result;

      if (type === "commit") {
        const commit = object as { tree: string; parent: string[] };
        if (commit.tree && !visited.has(commit.tree)) {
          nextBatch.push(commit.tree);
        }
        if (commit.parent) {
          for (const parent of commit.parent) {
            if (!visited.has(parent)) {
              nextBatch.push(parent);
            }
          }
        }
      } else if (type === "tree") {
        const tree = object as Array<{ oid: string }>;
        for (const entry of tree) {
          if (!visited.has(entry.oid)) {
            nextBatch.push(entry.oid);
          }
        }
      }
    }

    currentBatch = [...toProcess.slice(BATCH_SIZE), ...nextBatch];
  }

  return Array.from(visited);
}

async function handleUploadPack(fs: R2Fs, gitdir: string, body: Buffer): Promise<Buffer> {
  const lines = parsePktLines(body);
  const wants: string[] = [];
  const haves: string[] = [];

  for (const line of lines) {
    if (line.startsWith("want ")) {
      wants.push(line.slice(5, 45));
    } else if (line.startsWith("have ")) {
      haves.push(line.slice(5, 45));
    }
  }

  if (wants.length === 0) {
    return Buffer.from("0000");
  }

  try {
    const allOids = await collectReachableObjects(fs, gitdir, wants);

    const haveSet = new Set(haves);
    const neededOids = allOids.filter((oid) => !haveSet.has(oid));

    if (neededOids.length === 0) {
      return Buffer.from("0008NAK\n0000");
    }

    const packfile = await git.packObjects({
      fs,
      gitdir,
      oids: neededOids,
    });

    const nakLine = "0008NAK\n";
    if (!packfile.packfile) {
      return Buffer.from(nakLine + "0000");
    }
    return Buffer.concat([Buffer.from(nakLine), Buffer.from(packfile.packfile)]);
  } catch (err) {
    console.error("Pack error:", err);
    return Buffer.from("0000");
  }
}

async function handleReceivePack(fs: R2Fs, gitdir: string, body: Buffer): Promise<Buffer> {
  const packStart = body.indexOf(Buffer.from("PACK"));

  if (packStart === -1) {
    return Buffer.from("000eunpack ok\n0000");
  }

  const commandSection = body.slice(0, packStart);
  const packData = body.slice(packStart);

  const lines = parsePktLines(commandSection);

  const updates: { oldOid: string; newOid: string; ref: string }[] = [];

  for (const line of lines) {
    const match = line.match(/^([0-9a-f]{40}) ([0-9a-f]{40}) (.+)$/);
    if (match) {
      updates.push({ oldOid: match[1], newOid: match[2], ref: match[3].replace("\0", "").split(" ")[0] });
    }
  }

  try {
    await fs.promises.mkdir("/objects").catch(() => {});
    await fs.promises.mkdir("/objects/pack").catch(() => {});

    const packHash = createHash("sha1").update(packData).digest("hex");
    const packFileName = `pack-${packHash}`;
    const packPath = `/objects/pack/${packFileName}.pack`;

    await fs.promises.writeFile(packPath, packData);

    await git.indexPack({ fs, dir: "/", gitdir: "/", filepath: `objects/pack/${packFileName}.pack` });

    for (const update of updates) {
      const refPath = update.ref.startsWith("refs/") ? update.ref : `refs/heads/${update.ref}`;

      if (update.newOid === "0".repeat(40)) {
        await fs.promises.unlink(`/${refPath}`).catch(() => {});
      } else {
        const refDir = "/" + refPath.split("/").slice(0, -1).join("/");
        await fs.promises.mkdir(refDir).catch(() => {});
        await fs.promises.writeFile(`/${refPath}`, update.newOid + "\n");
      }
    }

    const response = ["unpack ok"];
    for (const update of updates) {
      response.push(`ok ${update.ref}`);
    }

    let responseStr = "";
    for (const line of response) {
      const pktLine = line + "\n";
      const len = (pktLine.length + 4).toString(16).padStart(4, "0");
      responseStr += len + pktLine;
    }
    responseStr += "0000";

    return Buffer.from(responseStr);
  } catch (err) {
    console.error("[ReceivePack] Error:", err);
    const errMsg = `ng unpack error ${err}\n`;
    const len = (errMsg.length + 4).toString(16).padStart(4, "0");
    return Buffer.from(len + errMsg + "0000");
  }
}

function parsePktLines(data: Buffer): string[] {
  const lines: string[] = [];
  let offset = 0;

  while (offset < data.length) {
    const lenHex = data.slice(offset, offset + 4).toString("utf-8");
    const len = parseInt(lenHex, 16);

    if (len === 0) {
      offset += 4;
      continue;
    }

    if (len < 4) break;

    const lineData = data.slice(offset + 4, offset + len);
    lines.push(lineData.toString("utf-8").trim());
    offset += len;
  }

  return lines;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const rateLimitResult = rateLimit(request, "git", { limit: 100, windowMs: 60000 });
  if (!rateLimitResult.success) {
    return new NextResponse("Too Many Requests", {
      status: 429,
      headers: { "Retry-After": Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000).toString() },
    });
  }

  const { path: pathSegments } = await params;
  const parsed = parseGitPath(pathSegments);

  if (!parsed) {
    return new NextResponse("Not found", { status: 404 });
  }

  const { username, repoName, action } = parsed;

  const owner = await db.query.users.findFirst({
    where: eq(users.username, username),
  });

  if (!owner) {
    return new NextResponse("Repository not found", { status: 404 });
  }

  const repo = await db.query.repositories.findFirst({
    where: and(eq(repositories.ownerId, owner.id), eq(repositories.name, repoName)),
  });

  if (!repo) {
    return new NextResponse("Repository not found", { status: 404 });
  }

  if (repo.visibility === "private") {
    const user = await authenticateRequest(request);
    if (!user || user.id !== repo.ownerId) {
      return new NextResponse("Unauthorized", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="gitbruv"' },
      });
    }
  }

  if (action === "info/refs") {
    const serviceQuery = request.nextUrl.searchParams.get("service");

    if (serviceQuery === "git-upload-pack" || serviceQuery === "git-receive-pack") {
      if (serviceQuery === "git-receive-pack") {
        const user = await authenticateRequest(request);
        if (!user || user.id !== repo.ownerId) {
          return new NextResponse("Unauthorized", {
            status: 401,
            headers: { "WWW-Authenticate": 'Basic realm="gitbruv"' },
          });
        }
      }

      const repoPrefix = getRepoPrefix(owner.id, `${repoName}.git`);
      const fs = createR2Fs(repoPrefix);

      const refs = await getRefsAdvertisement(fs, "/", serviceQuery);

      const packet = `# service=${serviceQuery}\n`;
      const packetLen = (packet.length + 4).toString(16).padStart(4, "0");
      const response = Buffer.concat([Buffer.from(packetLen + packet + "0000"), refs]);

      return new NextResponse(new Uint8Array(response), {
        headers: {
          "Content-Type": `application/x-${serviceQuery}-advertisement`,
          "Cache-Control": "no-cache",
        },
      });
    }
  }

  return new NextResponse("Not found", { status: 404 });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const rateLimitResult = rateLimit(request, "git", { limit: 30, windowMs: 60000 });
  if (!rateLimitResult.success) {
    return new NextResponse("Too Many Requests", {
      status: 429,
      headers: { "Retry-After": Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000).toString() },
    });
  }

  const { path: pathSegments } = await params;
  const parsed = parseGitPath(pathSegments);

  if (!parsed) {
    return new NextResponse("Not found", { status: 404 });
  }

  const { username, repoName, action } = parsed;

  if (action !== "git-upload-pack" && action !== "git-receive-pack") {
    return new NextResponse("Not found", { status: 404 });
  }

  const owner = await db.query.users.findFirst({
    where: eq(users.username, username),
  });

  if (!owner) {
    return new NextResponse("Repository not found", { status: 404 });
  }

  const repo = await db.query.repositories.findFirst({
    where: and(eq(repositories.ownerId, owner.id), eq(repositories.name, repoName)),
  });

  if (!repo) {
    return new NextResponse("Repository not found", { status: 404 });
  }

  const user = await authenticateRequest(request);

  if (action === "git-receive-pack") {
    if (!user || user.id !== repo.ownerId) {
      return new NextResponse("Unauthorized", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="gitbruv"' },
      });
    }
  } else if (repo.visibility === "private") {
    if (!user || user.id !== repo.ownerId) {
      return new NextResponse("Unauthorized", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="gitbruv"' },
      });
    }
  }

  const body = Buffer.from(await request.arrayBuffer());
  const repoPrefix = getRepoPrefix(owner.id, `${repoName}.git`);
  const fs = createR2Fs(repoPrefix);

  let response: Buffer;

  if (action === "git-upload-pack") {
    response = await handleUploadPack(fs, "/", body);
  } else {
    response = await handleReceivePack(fs, "/", body);
    invalidateRepoCache(repoPrefix);
    revalidateTag(`repo:${username}/${repoName}`, { expire: 0 });
  }

  return new NextResponse(new Uint8Array(response), {
    headers: {
      "Content-Type": `application/x-${action}-result`,
      "Cache-Control": "no-cache",
    },
  });
}
