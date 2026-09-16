const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { trustProxy } = require("../config");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
};

class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message || code);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function send(res, status, body, headers = {}) {
  if (res.writableEnded) return;
  res.writeHead(status, headers);
  res.end(body);
}

function json(res, status, data, headers = {}) {
  send(res, status, JSON.stringify(data), {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers,
  });
}

function readJson(req, limit = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const type = req.headers["content-type"] || "";
    if (!type.includes("application/json")) {
      reject(new HttpError(415, "unsupported_media_type", "Expected application/json"));
      req.resume();
      return;
    }
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new HttpError(413, "payload_too_large", "Request body is too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {});
      } catch {
        reject(new HttpError(400, "invalid_json", "Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || "").split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const key = part.slice(0, i).trim();
    try {
      out[key] = decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      /* ignore malformed cookie */
    }
  }
  return out;
}

function clientIp(req) {
  if (trustProxy) {
    const fwd = req.headers["x-forwarded-for"];
    if (fwd) return String(fwd).split(",")[0].trim();
  }
  return req.socket.remoteAddress || "unknown";
}

function isSecure(req) {
  if (req.socket.encrypted) return true;
  return trustProxy && String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim() === "https";
}

/** Serves a file from baseDir. Returns false when nothing matched. */
async function serveStatic(req, res, baseDir, urlPath) {
  let rel;
  try {
    rel = decodeURIComponent(urlPath);
  } catch {
    return false;
  }
  if (rel.includes("\0")) return false;

  let file = path.join(baseDir, path.normalize(rel));
  if (file !== baseDir && !file.startsWith(baseDir + path.sep)) return false;
  // Never serve dotfiles (e.g. .env)
  if (path.relative(baseDir, file).split(path.sep).some((seg) => seg.startsWith("."))) return false;

  let stat = await fsp.stat(file).catch(() => null);
  if (stat && stat.isDirectory()) {
    if (!urlPath.endsWith("/")) {
      send(res, 301, "", { Location: urlPath + "/" });
      return true;
    }
    file = path.join(file, "index.html");
    stat = await fsp.stat(file).catch(() => null);
  }
  if (!stat || !stat.isFile()) return false;

  const etag = `W/"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
  const headers = {
    "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
    "Cache-Control": "no-cache",
    ETag: etag,
  };

  if (req.headers["if-none-match"] === etag) {
    send(res, 304, "", headers);
    return true;
  }

  headers["Content-Length"] = stat.size;
  res.writeHead(200, headers);
  if (req.method === "HEAD") res.end();
  else fs.createReadStream(file).pipe(res);
  return true;
}

module.exports = { HttpError, send, json, readJson, parseCookies, clientIp, isSecure, serveStatic };
