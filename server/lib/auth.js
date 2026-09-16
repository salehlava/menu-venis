/*
 * Admin authentication
 * - one admin account stored in data/admin.json (scrypt password hash, never the password)
 * - server-side sessions in memory, HttpOnly + SameSite=Strict cookie
 * - login rate limiting per IP
 * - state-changing admin requests must carry the X-Venice-Admin header (CSRF protection)
 */
const crypto = require("node:crypto");
const store = require("./store");
const { HttpError, parseCookies, isSecure } = require("./http");
const { sessionHours } = require("../config");

const COOKIE = "venice_admin";
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEYLEN = 64;

/* ---------- passwords ---------- */
function scrypt(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(String(password).normalize("NFKC"), salt, KEYLEN, SCRYPT, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt);
  return { algo: "scrypt", salt: salt.toString("base64"), hash: key.toString("base64") };
}

async function verifyPassword(password, record) {
  const salt = Buffer.from(record.salt, "base64");
  const expected = Buffer.from(record.hash, "base64");
  const key = await scrypt(password, salt);
  return key.length === expected.length && crypto.timingSafeEqual(key, expected);
}

const DUMMY = { salt: crypto.randomBytes(16).toString("base64"), hash: crypto.randomBytes(KEYLEN).toString("base64") };

function safeEqualText(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function validateCredentials(username, password) {
  if (typeof username !== "string" || !/^[A-Za-z0-9._-]{3,32}$/.test(username)) {
    throw new HttpError(422, "invalid_username", "Username must be 3–32 characters: letters, digits, dot, dash or underscore.");
  }
  if (typeof password !== "string" || password.length < 8 || password.length > 128) {
    throw new HttpError(422, "weak_password", "Password must be at least 8 characters.");
  }
}

async function getAdmin() {
  return store.read("admin", undefined);
}

async function setAdmin(username, password) {
  validateCredentials(username, password);
  const record = { username, ...(await hashPassword(password)), updatedAt: new Date().toISOString() };
  await store.update("admin", {}, () => record);
  destroyAllSessions();
  return record;
}

/* ---------- rate limiting ---------- */
function createLimiter({ windowMs, max }) {
  const hits = new Map();
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) if (entry.reset <= now) hits.delete(key);
  }, 60_000);
  timer.unref();

  return {
    check(key) {
      const entry = hits.get(key);
      if (!entry || entry.reset <= Date.now()) return { allowed: true };
      return entry.count >= max ? { allowed: false, retryAfter: Math.ceil((entry.reset - Date.now()) / 1000) } : { allowed: true };
    },
    hit(key) {
      const now = Date.now();
      const entry = hits.get(key);
      if (!entry || entry.reset <= now) hits.set(key, { count: 1, reset: now + windowMs });
      else entry.count++;
    },
    reset(key) {
      hits.delete(key);
    },
  };
}

const loginLimiter = createLimiter({ windowMs: 15 * 60_000, max: 5 });

/* ---------- sessions ---------- */
const sessions = new Map(); // token -> { username, expires }

setInterval(() => {
  const now = Date.now();
  for (const [token, s] of sessions) if (s.expires <= now) sessions.delete(token);
}, 10 * 60_000).unref();

function destroyAllSessions() {
  sessions.clear();
}

function cookieHeader(req, value, maxAgeSeconds) {
  const parts = [`${COOKIE}=${value}`, "Path=/", "HttpOnly", "SameSite=Strict", `Max-Age=${maxAgeSeconds}`];
  if (isSecure(req)) parts.push("Secure");
  return parts.join("; ");
}

function startSession(ctx, username) {
  const token = crypto.randomBytes(32).toString("base64url");
  sessions.set(token, { username, expires: Date.now() + sessionHours * 3600_000 });
  ctx.res.setHeader("Set-Cookie", cookieHeader(ctx.req, token, sessionHours * 3600));
}

function endSession(ctx) {
  const token = parseCookies(ctx.req)[COOKIE];
  if (token) sessions.delete(token);
  ctx.res.setHeader("Set-Cookie", cookieHeader(ctx.req, "", 0));
}

function currentSession(req) {
  const token = parseCookies(req)[COOKIE];
  const session = token && sessions.get(token);
  if (!session) return null;
  if (session.expires <= Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session;
}

/* ---------- route guards ---------- */
function requireAdmin(ctx) {
  const session = currentSession(ctx.req);
  if (!session) throw new HttpError(401, "unauthorized", "Please sign in.");

  const method = ctx.req.method;
  if (method !== "GET" && method !== "HEAD" && ctx.req.headers["x-venice-admin"] !== "1") {
    throw new HttpError(403, "csrf", "Missing admin request header.");
  }
  ctx.session = session;
}

async function login(ctx, { username, password }) {
  const key = ctx.ip;
  const limit = loginLimiter.check(key);
  if (!limit.allowed) {
    throw new HttpError(429, "too_many_attempts", "Too many attempts. Try again later.", { retryAfter: limit.retryAfter });
  }

  const admin = await getAdmin();
  if (!admin || !admin.hash) {
    throw new HttpError(503, "admin_not_configured", "No admin account yet. Run: npm run set-admin");
  }

  const userOk = safeEqualText(username || "", admin.username);
  const passOk = await verifyPassword(String(password || ""), userOk ? admin : DUMMY);

  if (!userOk || !passOk) {
    loginLimiter.hit(key);
    throw new HttpError(401, "invalid_credentials", "Wrong username or password.");
  }

  loginLimiter.reset(key);
  startSession(ctx, admin.username);
  return { username: admin.username };
}

async function changeAccount(ctx, { currentPassword, username, newPassword }) {
  const admin = await getAdmin();
  if (!(await verifyPassword(String(currentPassword || ""), admin))) {
    throw new HttpError(401, "wrong_password", "Current password is incorrect.");
  }
  const nextUsername = username ? String(username).trim() : admin.username;
  if (newPassword) {
    await setAdmin(nextUsername, newPassword);
  } else {
    if (!/^[A-Za-z0-9._-]{3,32}$/.test(nextUsername)) validateCredentials(nextUsername, "x".repeat(8));
    await store.update("admin", {}, (rec) => ({ ...rec, username: nextUsername, updatedAt: new Date().toISOString() }));
    destroyAllSessions();
  }
  // All other sessions are signed out; keep this one signed in.
  startSession(ctx, nextUsername);
  return { username: nextUsername };
}

module.exports = {
  requireAdmin,
  login,
  endSession,
  currentSession,
  changeAccount,
  getAdmin,
  setAdmin,
  createLimiter,
};
