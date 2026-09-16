/*
 * Tiny JSON file store.
 * - one file per collection in data/
 * - writes are atomic (temp file + rename) and serialized per file
 */
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { dataDir, menuBackupsToKeep } = require("../config");

const cache = new Map();
const queues = new Map();

const fileOf = (name) => path.join(dataDir, `${name}.json`);
const clone = (v) => (v === undefined ? v : structuredClone(v));

async function writeAtomic(file, text) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${crypto.randomBytes(6).toString("hex")}.tmp`;
  await fs.writeFile(tmp, text, "utf8");
  for (let attempt = 0; ; attempt++) {
    try {
      await fs.rename(tmp, file);
      return;
    } catch (err) {
      // Windows can briefly lock files (antivirus, indexer) — retry a few times.
      if (attempt >= 5 || !["EPERM", "EBUSY", "EACCES"].includes(err.code)) {
        await fs.rm(tmp, { force: true });
        throw err;
      }
      await new Promise((r) => setTimeout(r, 50 * (attempt + 1)));
    }
  }
}

async function load(name, fallback) {
  if (cache.has(name)) return cache.get(name);
  try {
    const data = JSON.parse(await fs.readFile(fileOf(name), "utf8"));
    cache.set(name, data);
    return data;
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
    const value = typeof fallback === "function" ? await fallback() : fallback;
    if (value === undefined) return undefined;
    await save(name, value);
    return value;
  }
}

async function save(name, value) {
  await writeAtomic(fileOf(name), JSON.stringify(value, null, 2));
  cache.set(name, value);
}

/** Read a collection (returns a copy). `fallback` is written to disk if the file does not exist yet. */
async function read(name, fallback) {
  return clone(await enqueue(name, () => load(name, fallback)));
}

/**
 * Change a collection safely. `mutator(data)` may modify `data` in place or return a new value.
 * Resolves with a copy of the saved value.
 */
function update(name, fallback, mutator) {
  return enqueue(name, async () => {
    const current = clone(await load(name, fallback));
    const result = await mutator(current);
    const next = result === undefined ? current : result;
    await save(name, next);
    return clone(next);
  });
}

function enqueue(name, task) {
  const run = (queues.get(name) || Promise.resolve()).catch(() => {}).then(task);
  queues.set(name, run);
  return run;
}

/* ---------- backups (menu history) ---------- */
const backupDir = path.join(dataDir, "backups");

async function backup(name, value) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "");
  await writeAtomic(path.join(backupDir, `${name}-${stamp}.json`), JSON.stringify(value, null, 2));

  const files = (await listBackups(name)).map((b) => b.file);
  for (const old of files.slice(menuBackupsToKeep)) {
    await fs.rm(path.join(backupDir, old), { force: true });
  }
}

async function listBackups(name) {
  let files = [];
  try {
    files = await fs.readdir(backupDir);
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
  const re = new RegExp(`^${name}-(\\d{8}T\\d{6})\\.json$`);
  return files
    .map((file) => {
      const m = re.exec(file);
      if (!m) return null;
      const s = m[1];
      const date = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(9, 11)}:${s.slice(11, 13)}:${s.slice(13, 15)}Z`;
      return { file, date };
    })
    .filter(Boolean)
    .sort((a, b) => (a.file < b.file ? 1 : -1));
}

async function readBackup(file) {
  if (!/^[a-z]+-\d{8}T\d{6}\.json$/.test(file)) return undefined;
  try {
    return JSON.parse(await fs.readFile(path.join(backupDir, file), "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return undefined;
    throw err;
  }
}

module.exports = { read, update, backup, listBackups, readBackup, dataFile: fileOf };
