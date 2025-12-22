import git from "isomorphic-git";
import { createHash } from "node:crypto";
import { type R2Fs } from "./r2-fs";

export async function getRefsAdvertisement(fs: R2Fs, gitdir: string, service: string): Promise<Uint8Array> {
  const capabilities =
    service === "git-upload-pack"
      ? ["ofs-delta", "shallow", "no-progress", "include-tag", "symref=HEAD:refs/heads/main"]
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

  const packets: Uint8Array[] = [];
  const encoder = new TextEncoder();
  for (const line of lines) {
    const len = (line.length + 4).toString(16).padStart(4, "0");
    packets.push(encoder.encode(len + line));
  }
  packets.push(encoder.encode("0000"));

  return concatUint8Arrays(packets);
}

async function collectReachableObjects(fs: R2Fs, gitdir: string, oids: string[]): Promise<string[]> {
  const visited = new Set<string>();
  const toVisit = [...oids];

  while (toVisit.length > 0) {
    const oid = toVisit.pop()!;
    if (visited.has(oid)) continue;
    visited.add(oid);

    try {
      const { object, type } = await git.readObject({ fs, gitdir, oid });

      if (type === "commit") {
        const commit = object as { tree: string; parent: string[] };
        if (commit.tree && !visited.has(commit.tree)) {
          toVisit.push(commit.tree);
        }
        if (commit.parent) {
          for (const parent of commit.parent) {
            if (!visited.has(parent)) {
              toVisit.push(parent);
            }
          }
        }
      } else if (type === "tree") {
        const tree = object as Array<{ oid: string }>;
        for (const entry of tree) {
          if (!visited.has(entry.oid)) {
            toVisit.push(entry.oid);
          }
        }
      }
    } catch {
      continue;
    }
  }

  return Array.from(visited);
}

export async function handleUploadPack(fs: R2Fs, gitdir: string, body: Uint8Array): Promise<Uint8Array> {
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
    return new TextEncoder().encode("0000");
  }

  try {
    const allOids = await collectReachableObjects(fs, gitdir, wants);

    const haveSet = new Set(haves);
    const neededOids = allOids.filter((oid) => !haveSet.has(oid));

    if (neededOids.length === 0) {
      return new TextEncoder().encode("0008NAK\n0000");
    }

    const packfile = await git.packObjects({
      fs,
      gitdir,
      oids: neededOids,
    });

    const nakLine = new TextEncoder().encode("0008NAK\n");
    if (!packfile.packfile) {
      return concatUint8Arrays([nakLine, new TextEncoder().encode("0000")]);
    }
    return concatUint8Arrays([nakLine, new Uint8Array(packfile.packfile)]);
  } catch (err) {
    console.error("Pack error:", err);
    return new TextEncoder().encode("0000");
  }
}

export async function handleReceivePack(fs: R2Fs, gitdir: string, body: Uint8Array): Promise<Uint8Array> {
  const packSignature = new Uint8Array([0x50, 0x41, 0x43, 0x4b]);
  let packStart = -1;

  for (let i = 0; i <= body.length - 4; i++) {
    if (body[i] === packSignature[0] && body[i + 1] === packSignature[1] && body[i + 2] === packSignature[2] && body[i + 3] === packSignature[3]) {
      packStart = i;
      break;
    }
  }

  if (packStart === -1) {
    return new TextEncoder().encode("000eunpack ok\n0000");
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

    return new TextEncoder().encode(responseStr);
  } catch (err) {
    console.error("[ReceivePack] Error:", err);
    const errMsg = `ng unpack error ${err}\n`;
    const len = (errMsg.length + 4).toString(16).padStart(4, "0");
    return new TextEncoder().encode(len + errMsg + "0000");
  }
}

function parsePktLines(data: Uint8Array): string[] {
  const decoder = new TextDecoder();
  const lines: string[] = [];
  let offset = 0;

  while (offset < data.length) {
    const lenHex = decoder.decode(data.slice(offset, offset + 4));
    const len = parseInt(lenHex, 16);

    if (len === 0) {
      offset += 4;
      continue;
    }

    if (len < 4) break;

    const lineData = data.slice(offset + 4, offset + len);
    lines.push(decoder.decode(lineData).trim());
    offset += len;
  }

  return lines;
}

function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}
