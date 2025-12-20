import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, repositories, accounts } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import git from "isomorphic-git";
import { createR2Fs, getRepoPrefix } from "@/lib/r2-fs";
import { scryptAsync } from "@noble/hashes/scrypt.js";
import { hexToBytes } from "@noble/hashes/utils.js";

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    const [salt, key] = hash.split(":");
    if (!salt || !key) return false;

    const derivedKey = await scryptAsync(password.normalize("NFKC"), salt, {
      N: 16384,
      r: 16,
      p: 1,
      dkLen: 64,
    });

    return constantTimeEqual(derivedKey, hexToBytes(key));
  } catch (err) {
    console.error("[Git Auth] Password verify error:", err);
    return false;
  }
}

async function authenticateUser(authHeader: string | null): Promise<{ id: string; username: string } | null> {
  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return null;
  }

  const base64Credentials = authHeader.split(" ")[1];
  const credentials = Buffer.from(base64Credentials, "base64").toString("utf-8");
  const [email, password] = credentials.split(":");

  if (!email || !password) {
    return null;
  }

  try {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user) {
      return null;
    }

    const account = await db.query.accounts.findFirst({
      where: eq(accounts.userId, user.id),
    });

    if (!account?.password) {
      return null;
    }

    const valid = await verifyPassword(password, account.password);
    if (!valid) {
      return null;
    }

    return { id: user.id, username: user.username };
  } catch {
    return null;
  }
}

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

async function getRefsAdvertisement(fs: any, gitdir: string, service: string): Promise<Buffer> {
  const capabilities =
    service === "git-upload-pack"
      ? [
          "multi_ack",
          "thin-pack",
          "side-band",
          "side-band-64k",
          "ofs-delta",
          "shallow",
          "no-progress",
          "include-tag",
          "multi_ack_detailed",
          "symref=HEAD:refs/heads/main",
        ]
      : ["report-status", "delete-refs", "ofs-delta"];

  const refs: { name: string; oid: string }[] = [];

  try {
    const branches = await git.listBranches({ fs, gitdir });
    for (const branch of branches) {
      const oid = await git.resolveRef({ fs, gitdir, ref: branch });
      refs.push({ name: `refs/heads/${branch}`, oid });
    }
  } catch {}

  try {
    const tags = await git.listTags({ fs, gitdir });
    for (const tag of tags) {
      const oid = await git.resolveRef({ fs, gitdir, ref: tag });
      refs.push({ name: `refs/tags/${tag}`, oid });
    }
  } catch {}

  let head = "";
  try {
    head = await git.resolveRef({ fs, gitdir, ref: "HEAD" });
  } catch {}

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

async function handleUploadPack(fs: any, gitdir: string, body: Buffer): Promise<Buffer> {
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
    const packfile = await git.packObjects({
      fs,
      gitdir,
      oids: wants,
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

async function handleReceivePack(fs: any, gitdir: string, body: Buffer): Promise<Buffer> {
  console.log("[ReceivePack] Starting, body length:", body.length);

  const packStart = body.indexOf(Buffer.from("PACK"));
  console.log("[ReceivePack] PACK header at:", packStart);

  if (packStart === -1) {
    console.log("[ReceivePack] No PACK header found");
    return Buffer.from("000eunpack ok\n0000");
  }

  const commandSection = body.slice(0, packStart);
  const packData = body.slice(packStart);
  console.log("[ReceivePack] Command section length:", commandSection.length, "Pack data length:", packData.length);

  const lines = parsePktLines(commandSection);
  console.log("[ReceivePack] Parsed lines:", lines);

  const updates: { oldOid: string; newOid: string; ref: string }[] = [];

  for (const line of lines) {
    const match = line.match(/^([0-9a-f]{40}) ([0-9a-f]{40}) (.+)$/);
    if (match) {
      updates.push({ oldOid: match[1], newOid: match[2], ref: match[3].replace("\0", "").split(" ")[0] });
    }
  }
  console.log("[ReceivePack] Updates:", updates);

  try {
    console.log("[ReceivePack] Creating directories...");
    await fs.promises.mkdir("/objects", { recursive: true }).catch(() => {});
    await fs.promises.mkdir("/objects/pack", { recursive: true }).catch(() => {});

    const packHash = require("crypto").createHash("sha1").update(packData).digest("hex");
    const packFileName = `pack-${packHash}`;
    const packPath = `/objects/pack/${packFileName}.pack`;
    const idxPath = `/objects/pack/${packFileName}.idx`;

    console.log("[ReceivePack] Writing pack file:", packPath);
    await fs.promises.writeFile(packPath, packData);

    console.log("[ReceivePack] Calling indexPack...");
    const result = await git.indexPack({ fs, dir: "/", gitdir: "/", filepath: `objects/pack/${packFileName}.pack` });
    console.log("[ReceivePack] indexPack result, oids:", result.oids?.length);

    console.log("[ReceivePack] Writing refs...");
    for (const update of updates) {
      const refPath = update.ref.startsWith("refs/") ? update.ref : `refs/heads/${update.ref}`;
      console.log("[ReceivePack] Writing ref:", refPath, "->", update.newOid);

      if (update.newOid === "0".repeat(40)) {
        await fs.promises.unlink(`/${refPath}`).catch(() => {});
      } else {
        const refDir = "/" + refPath.split("/").slice(0, -1).join("/");
        await fs.promises.mkdir(refDir, { recursive: true }).catch(() => {});
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

    console.log("[ReceivePack] Success!");
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
    const user = await authenticateUser(request.headers.get("authorization"));
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
        const user = await authenticateUser(request.headers.get("authorization"));
        if (!user || user.id !== repo.ownerId) {
          return new NextResponse("Unauthorized", {
            status: 401,
            headers: { "WWW-Authenticate": 'Basic realm="gitbruv"' },
          });
        }
      }

      const repoPrefix = getRepoPrefix(owner.id, repoName);
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

  const user = await authenticateUser(request.headers.get("authorization"));

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
  const repoPrefix = getRepoPrefix(owner.id, repoName);
  const fs = createR2Fs(repoPrefix);

  let response: Buffer;

  if (action === "git-upload-pack") {
    response = await handleUploadPack(fs, "/", body);
  } else {
    response = await handleReceivePack(fs, "/", body);
  }

  return new NextResponse(new Uint8Array(response), {
    headers: {
      "Content-Type": `application/x-${action}-result`,
      "Cache-Control": "no-cache",
    },
  });
}
