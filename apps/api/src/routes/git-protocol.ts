import { Hono } from "hono";
import { db, users, repositories } from "@gitbruv/db";
import { eq, and } from "drizzle-orm";
import { authMiddleware, type AuthUser, type AuthVariables } from "../middleware/auth";
import { createGitStore, getRefsAdvertisement } from "../git";
import git from "isomorphic-git";
import { getAuth } from "../auth";
import { putObject, deleteObject } from "../s3";
import { createHash } from "crypto";
import * as zlib from "zlib";

const app = new Hono<{ Variables: AuthVariables }>();

app.use("*", authMiddleware);

async function resolveBasicAuthUser(authHeader: string | undefined): Promise<AuthUser | null> {
  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return null;
  }

  const token = authHeader.slice("Basic ".length).trim();
  let decoded = "";
  try {
    decoded = Buffer.from(token, "base64").toString("utf8");
  } catch {
    return null;
  }

  const separatorIndex = decoded.indexOf(":");
  if (separatorIndex <= 0) {
    return null;
  }

  const identifier = decoded.slice(0, separatorIndex);
  const password = decoded.slice(separatorIndex + 1);
  if (!identifier || !password) {
    return null;
  }

  let email = identifier;
  if (!identifier.includes("@")) {
    const userRow = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        username: users.username,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(eq(users.username, identifier))
      .limit(1);

    if (!userRow[0]) {
      return null;
    }

    email = userRow[0].email;
  }

  const auth = getAuth();
  try {
    const result: any = await auth.api.signInEmail({
      body: {
        email,
        password,
        rememberMe: false,
      },
      headers: new Headers(),
    });
    const user = result?.user ?? result?.session?.user ?? null;
    if (!user) {
      return null;
    }
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
      avatarUrl: user.image ?? null,
    };
  } catch {
    return null;
  }
}

async function resolveGitUser(c: Parameters<typeof app.get>[1] extends (arg: infer T) => any ? T : never): Promise<AuthUser | null> {
  const currentUser = c.get("user");
  if (currentUser) {
    return currentUser;
  }
  return await resolveBasicAuthUser(c.req.header("authorization"));
}

async function getRepoAndStore(owner: string, name: string) {
  const repoName = name.replace(/\.git$/, "");

  const result = await db
    .select({
      id: repositories.id,
      name: repositories.name,
      ownerId: repositories.ownerId,
      visibility: repositories.visibility,
      userId: users.id,
    })
    .from(repositories)
    .innerJoin(users, eq(users.id, repositories.ownerId))
    .where(and(eq(users.username, owner), eq(repositories.name, repoName)))
    .limit(1);

  const row = result[0];
  if (!row) {
    return null;
  }

  const store = createGitStore(row.userId, row.name);
  return {
    repo: {
      id: row.id,
      name: row.name,
      ownerId: row.ownerId,
      visibility: row.visibility,
    },
    store,
    userId: row.userId,
  };
}

function unauthorizedBasic(): Response {
  return new Response("Unauthorized", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="gitbruv"',
    },
  });
}

app.get("/:owner/:name/info/refs", async (c) => {
  const owner = c.req.param("owner");
  const name = c.req.param("name");
  const service = c.req.query("service");
  const currentUser = await resolveGitUser(c);

  if (!service || (service !== "git-upload-pack" && service !== "git-receive-pack")) {
    return c.json({ error: "Invalid service" }, 404);
  }

  const result = await getRepoAndStore(owner, name);
  if (!result) {
    return c.json({ error: "Repository not found" }, 404);
  }

  const { repo, store } = result;

  if (service === "git-receive-pack") {
    if (!currentUser || currentUser.id !== repo.ownerId) {
      return unauthorizedBasic();
    }
  } else if (repo.visibility === "private") {
    if (!currentUser || currentUser.id !== repo.ownerId) {
      return unauthorizedBasic();
    }
  }

  const refs = await getRefsAdvertisement(store.fs, store.dir, service);

  const packet = `# service=${service}\n`;
  const packetLen = (packet.length + 4).toString(16).padStart(4, "0");

  const response = Buffer.concat([
    Buffer.from(packetLen),
    Buffer.from(packet),
    Buffer.from("0000"),
    refs,
  ]);

  return new Response(response, {
    status: 200,
    headers: {
      "Content-Type": `application/x-${service}-advertisement`,
      "Cache-Control": "no-cache",
    },
  });
});

app.post("/:owner/:name/git-upload-pack", async (c) => {
  const owner = c.req.param("owner");
  const name = c.req.param("name");
  const currentUser = await resolveGitUser(c);

  const result = await getRepoAndStore(owner, name);
  if (!result) {
    return c.json({ error: "Repository not found" }, 404);
  }

  const { repo, store } = result;

  if (repo.visibility === "private") {
    if (!currentUser || currentUser.id !== repo.ownerId) {
      return unauthorizedBasic();
    }
  }

  const body = await c.req.arrayBuffer();
  const requestData = Buffer.from(body);

  try {
    const packResult = await git.uploadPack({
      fs: store.fs,
      dir: store.dir,
      advertiseRefs: false,
    });

    return new Response(packResult, {
      status: 200,
      headers: {
        "Content-Type": "application/x-git-upload-pack-result",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("[API] upload-pack error:", error);
    return new Response("0008NAK\n", {
      status: 200,
      headers: {
        "Content-Type": "application/x-git-upload-pack-result",
        "Cache-Control": "no-cache",
      },
    });
  }
});

function parsePktLines(data: Buffer): string[] {
  const lines: string[] = [];
  let offset = 0;

  while (offset < data.length) {
    if (offset + 4 > data.length) break;

    const lenHex = data.slice(offset, offset + 4).toString("utf8");
    const len = parseInt(lenHex, 16);

    if (len === 0) break;
    if (len < 4) break;

    const contentLen = len - 4;
    if (offset + len > data.length) break;

    const content = data.slice(offset + 4, offset + len).toString("utf8");
    if (content.length > 0) {
      lines.push(content);
    }

    offset += len;
  }

  return lines;
}

const OBJ_COMMIT = 1;
const OBJ_TREE = 2;
const OBJ_BLOB = 3;
const OBJ_TAG = 4;
const OBJ_OFS_DELTA = 6;
const OBJ_REF_DELTA = 7;

interface PackObject {
  type: number;
  data: Buffer;
  offset: number;
  baseOid?: string;
  baseOffset?: number;
}

function readPackVarInt(buf: Buffer, offset: number): { value: number; type: number; bytesRead: number } {
  let byte = buf[offset];
  const type = (byte >> 4) & 0x7;
  let value = byte & 0x0f;
  let shift = 4;
  let bytesRead = 1;

  while (byte & 0x80) {
    byte = buf[offset + bytesRead];
    value |= (byte & 0x7f) << shift;
    shift += 7;
    bytesRead++;
  }

  return { value, type, bytesRead };
}

function readOfsOffset(buf: Buffer, offset: number): { value: number; bytesRead: number } {
  let byte = buf[offset];
  let value = byte & 0x7f;
  let bytesRead = 1;

  while (byte & 0x80) {
    byte = buf[offset + bytesRead];
    value = ((value + 1) << 7) | (byte & 0x7f);
    bytesRead++;
  }

  return { value, bytesRead };
}

function applyDelta(base: Buffer, delta: Buffer): Buffer {
  let offset = 0;

  let baseSize = 0;
  let shift = 0;
  while (offset < delta.length) {
    const byte = delta[offset++];
    baseSize |= (byte & 0x7f) << shift;
    shift += 7;
    if (!(byte & 0x80)) break;
  }

  let resultSize = 0;
  shift = 0;
  while (offset < delta.length) {
    const byte = delta[offset++];
    resultSize |= (byte & 0x7f) << shift;
    shift += 7;
    if (!(byte & 0x80)) break;
  }

  const result: Buffer[] = [];
  let resultLen = 0;

  while (offset < delta.length) {
    const cmd = delta[offset++];

    if (cmd & 0x80) {
      let copyOffset = 0;
      let copySize = 0;

      if (cmd & 0x01) copyOffset = delta[offset++];
      if (cmd & 0x02) copyOffset |= delta[offset++] << 8;
      if (cmd & 0x04) copyOffset |= delta[offset++] << 16;
      if (cmd & 0x08) copyOffset |= delta[offset++] << 24;

      if (cmd & 0x10) copySize = delta[offset++];
      if (cmd & 0x20) copySize |= delta[offset++] << 8;
      if (cmd & 0x40) copySize |= delta[offset++] << 16;

      if (copySize === 0) copySize = 0x10000;

      result.push(base.subarray(copyOffset, copyOffset + copySize));
      resultLen += copySize;
    } else if (cmd > 0) {
      result.push(delta.subarray(offset, offset + cmd));
      offset += cmd;
      resultLen += cmd;
    }
  }

  return Buffer.concat(result);
}

function typeToString(type: number): string {
  switch (type) {
    case OBJ_COMMIT: return "commit";
    case OBJ_TREE: return "tree";
    case OBJ_BLOB: return "blob";
    case OBJ_TAG: return "tag";
    default: return "unknown";
  }
}

function hashObject(type: string, data: Buffer): string {
  const header = `${type} ${data.length}\0`;
  const store = Buffer.concat([Buffer.from(header), data]);
  return createHash("sha1").update(store).digest("hex");
}

function inflateObject(buf: Buffer, offset: number, expectedSize: number): { data: Buffer; bytesRead: number } {
  const remaining = buf.subarray(offset);
  
  try {
    const result = zlib.inflateSync(remaining);
    
    let consumed = 0;
    let low = 2;
    let high = remaining.length;
    
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      try {
        zlib.inflateSync(remaining.subarray(0, mid));
        consumed = mid;
        high = mid - 1;
      } catch {
        low = mid + 1;
      }
    }
    
    return { data: result, bytesRead: consumed || remaining.length };
  } catch {
    try {
      const result = zlib.inflateRawSync(remaining);
      
      let consumed = 0;
      let low = 1;
      let high = remaining.length;
      
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        try {
          zlib.inflateRawSync(remaining.subarray(0, mid));
          consumed = mid;
          high = mid - 1;
        } catch {
          low = mid + 1;
        }
      }
      
      return { data: result, bytesRead: consumed || remaining.length };
    } catch (e) {
      throw new Error(`Failed to inflate at offset ${offset}: ${e}`);
    }
  }
}

async function unpackPackFile(
  packData: Buffer,
  storeObject: (oid: string, type: string, data: Buffer) => Promise<void>
): Promise<{ success: boolean; objectCount: number; error?: string }> {
  try {
    if (packData.length < 12) {
      return { success: false, objectCount: 0, error: "Pack file too small" };
    }

    const signature = packData.subarray(0, 4).toString("ascii");
    if (signature !== "PACK") {
      return { success: false, objectCount: 0, error: "Invalid pack signature" };
    }

    const version = packData.readUInt32BE(4);
    if (version !== 2 && version !== 3) {
      return { success: false, objectCount: 0, error: `Unsupported pack version: ${version}` };
    }

    const numObjects = packData.readUInt32BE(8);
    console.log(`[API] unpack: version ${version}, ${numObjects} objects, pack size ${packData.length}`);
    console.log(`[API] unpack: first 32 bytes: ${packData.subarray(0, 32).toString("hex")}`);

    const objects: Map<number, PackObject> = new Map();
    let offset = 12;

    for (let i = 0; i < numObjects; i++) {
      const objOffset = offset;
      const header = readPackVarInt(packData, offset);
      offset += header.bytesRead;

      console.log(`[API] unpack: object ${i}, type=${header.type}, size=${header.value}, offset=${objOffset}`);

      const obj: PackObject = {
        type: header.type,
        data: Buffer.alloc(0),
        offset: objOffset,
      };

      if (header.type === OBJ_OFS_DELTA) {
        const ofs = readOfsOffset(packData, offset);
        offset += ofs.bytesRead;
        obj.baseOffset = objOffset - ofs.value;
        console.log(`[API] unpack: OFS_DELTA base offset ${obj.baseOffset}`);
      } else if (header.type === OBJ_REF_DELTA) {
        obj.baseOid = packData.subarray(offset, offset + 20).toString("hex");
        offset += 20;
        console.log(`[API] unpack: REF_DELTA base oid ${obj.baseOid}`);
      }

      console.log(`[API] unpack: inflate starting at offset ${offset}, bytes: ${packData.subarray(offset, offset + 16).toString("hex")}`);

      const inflated = inflateObject(packData, offset, header.value);
      obj.data = inflated.data;
      offset += inflated.bytesRead;
      objects.set(objOffset, obj);

      if (i < 3) {
        console.log(`[API] unpack: object ${i} inflated ${inflated.data.length} bytes, consumed ${inflated.bytesRead}`);
      }
    }

    const resolveDelta = (obj: PackObject): { type: number; data: Buffer } | null => {
      if (obj.type !== OBJ_OFS_DELTA && obj.type !== OBJ_REF_DELTA) {
        return { type: obj.type, data: obj.data };
      }

      let base: PackObject | undefined;
      if (obj.baseOffset !== undefined) {
        base = objects.get(obj.baseOffset);
      }

      if (!base) {
        return null;
      }

      const resolvedBase = resolveDelta(base);
      if (!resolvedBase) {
        return null;
      }

      const resolvedData = applyDelta(resolvedBase.data, obj.data);
      return { type: resolvedBase.type, data: resolvedData };
    };

    let stored = 0;
    for (const [objOffset, obj] of objects) {
      const resolved = resolveDelta(obj);
      if (!resolved) {
        console.error(`[API] unpack: failed to resolve delta for object at offset ${objOffset}`);
        continue;
      }

      const typeStr = typeToString(resolved.type);
      const oid = hashObject(typeStr, resolved.data);

      await storeObject(oid, typeStr, resolved.data);
      stored++;
    }

    console.log(`[API] unpack: stored ${stored} objects`);
    return { success: true, objectCount: stored };
  } catch (error) {
    console.error("[API] unpack error:", error);
    return { success: false, objectCount: 0, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

app.post("/:owner/:name/git-receive-pack", async (c) => {
  const owner = c.req.param("owner");
  const name = c.req.param("name");
  const currentUser = await resolveGitUser(c);

  const result = await getRepoAndStore(owner, name);
  if (!result) {
    return c.json({ error: "Repository not found" }, 404);
  }

  const { repo, store } = result;

  if (!currentUser || currentUser.id !== repo.ownerId) {
    return unauthorizedBasic();
  }

  const body = await c.req.arrayBuffer();
  const requestData = Buffer.from(body);

  try {
    console.log(`[API] receive-pack: received ${requestData.length} bytes`);
    const packSignature = Buffer.from([0x50, 0x41, 0x43, 0x4b]);
    let packStart = -1;

    for (let i = 0; i <= requestData.length - 4; i++) {
      if (requestData.slice(i, i + 4).equals(packSignature)) {
        packStart = i;
        break;
      }
    }

    if (packStart === -1) {
      const unpackOk = "unpack ok\n";
      const unpackOkLen = unpackOk.length + 4;
      const response = Buffer.concat([
        Buffer.from(unpackOkLen.toString(16).padStart(4, "0") + unpackOk, "ascii"),
        Buffer.from("0000", "ascii"),
      ]);
      return new Response(response, {
        status: 200,
        headers: {
          "Content-Type": "application/x-git-receive-pack-result",
          "Cache-Control": "no-cache",
        },
      });
    }

    const commandSection = requestData.slice(0, packStart);
    const packData = requestData.slice(packStart);

    const commands = parsePktLines(commandSection);
    const updates: Array<{ oldOid: string; newOid: string; ref: string }> = [];

    for (const line of commands) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 3 && parts[0].length === 40 && parts[1].length === 40) {
        const refName = parts[2].split("\0")[0];
        updates.push({
          oldOid: parts[0],
          newOid: parts[1],
          ref: refName,
        });
      }
    }

    const storeObject = async (oid: string, type: string, data: Buffer) => {
      const prefix = oid.substring(0, 2);
      const suffix = oid.substring(2);
      const objectPath = `repos/${result.userId}/${repo.name}/objects/${prefix}/${suffix}`;
      
      const header = `${type} ${data.length}\0`;
      const store = Buffer.concat([Buffer.from(header), data]);
      const compressed = zlib.deflateSync(store);
      
      await putObject(objectPath, compressed);
    };

    const unpackResult = await unpackPackFile(packData, storeObject);
    if (!unpackResult.success) {
      console.error(`[API] receive-pack: unpack failed: ${unpackResult.error}`);
      throw new Error(unpackResult.error || "Failed to unpack");
    }
    console.log(`[API] receive-pack: unpacked ${unpackResult.objectCount} objects`)

    for (const update of updates) {
      const refPath = update.ref.startsWith("refs/") ? update.ref : `refs/heads/${update.ref}`;
      const refKey = `repos/${result.userId}/${repo.name}/${refPath}`;

      if (update.newOid === "0".repeat(40)) {
        await deleteObject(refKey).catch(() => {});
      } else {
        await putObject(refKey, Buffer.from(update.newOid + "\n"));
        console.log(`[API] receive-pack: stored ref ${refPath} -> ${update.newOid}`);
      }
    }

    if (updates.length > 0) {
      const defaultBranch = updates[0].ref.startsWith("refs/") 
        ? updates[0].ref.replace("refs/heads/", "")
        : updates[0].ref;
      const headRef = `refs/heads/${defaultBranch}`;
      const headKey = `repos/${result.userId}/${repo.name}/HEAD`;
      await putObject(headKey, Buffer.from(`ref: ${headRef}\n`));
      console.log(`[API] receive-pack: created HEAD -> ${headRef}`);
    }

    let response = "";
    const unpackOk = "unpack ok\n";
    const unpackOkLen = unpackOk.length + 4;
    response += unpackOkLen.toString(16).padStart(4, "0") + unpackOk;

    for (const update of updates) {
      const line = `ok ${update.ref}\n`;
      const lineLen = line.length + 4;
      response += lineLen.toString(16).padStart(4, "0") + line;
    }

    response += "0000";

    return new Response(Buffer.from(response, "ascii"), {
      status: 200,
      headers: {
        "Content-Type": "application/x-git-receive-pack-result",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("[API] receive-pack error:", error);
    const errorText = error instanceof Error ? error.message : "unpack error";
    const errorLine = `ng ${errorText}\n`;
    const errorLen = errorLine.length + 4;
    const response = errorLen.toString(16).padStart(4, "0") + errorLine + "0000";
    return new Response(Buffer.from(response, "ascii"), {
      status: 200,
      headers: {
        "Content-Type": "application/x-git-receive-pack-result",
        "Cache-Control": "no-cache",
      },
    });
  }
});

export default app;
