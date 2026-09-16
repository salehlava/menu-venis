/*
 * Venice Café — menu server
 *   npm start            → http://localhost:3000        (menu)
 *                         http://localhost:3000/admin  (admin panel)
 */
const http = require("node:http");
const config = require("./config");
const { json, send, serveStatic, clientIp, HttpError } = require("./lib/http");
const { createRouter } = require("./lib/router");
const auth = require("./lib/auth");

const router = createRouter();
require("./routes/public")(router);
require("./routes/admin")(router);

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "SAMEORIGIN",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

const ADMIN_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self'",
  "frame-src 'self'",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const server = http.createServer(async (req, res) => {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);

  let url;
  try {
    url = new URL(req.url, "http://localhost");
  } catch {
    return send(res, 400, "Bad request");
  }

  const ctx = { req, res, url, ip: clientIp(req), params: {}, session: null };

  try {
    if (await router.handle(ctx)) return;

    if (url.pathname.startsWith("/api/")) return json(res, 404, { error: "not_found" });
    if (req.method !== "GET" && req.method !== "HEAD") return json(res, 405, { error: "method_not_allowed" });

    if (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) {
      res.setHeader("Content-Security-Policy", ADMIN_CSP);
      res.setHeader("X-Robots-Tag", "noindex, nofollow");
    }

    if (url.pathname.startsWith("/shared/") && (await serveStatic(req, res, config.sharedDir, url.pathname.slice("/shared".length)))) return;
    if (await serveStatic(req, res, config.publicDir, url.pathname)) return;

    send(res, 404, "Not found", { "Content-Type": "text/plain; charset=utf-8" });
  } catch (err) {
    if (err instanceof HttpError) {
      if (err.details && err.details.retryAfter) res.setHeader("Retry-After", err.details.retryAfter);
      return json(res, err.status, { error: err.code, message: err.message, ...(err.details || {}) });
    }
    console.error(`[error] ${req.method} ${url.pathname}`, err);
    if (!res.headersSent) json(res, 500, { error: "server_error", message: "Something went wrong." });
    else res.end();
  }
});

async function start() {
  // Optional first-run admin from environment variables (handy on hosting panels).
  if (!(await auth.getAdmin()) && process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD) {
    await auth.setAdmin(process.env.ADMIN_USERNAME, process.env.ADMIN_PASSWORD);
    console.log(`[admin] Created admin account "${process.env.ADMIN_USERNAME}" from environment variables.`);
  }

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`\n  ✗ Port ${config.port} is already in use — the menu is probably already running.`);
      console.error(`    Open http://localhost:${config.port} or close the other server window first.\n`);
      process.exit(1);
    }
    throw err;
  });

  server.listen(config.port, config.host, async () => {
    const base = `http://localhost:${config.port}`;
    console.log(`\n  Venice menu   ${base}\n  Admin panel   ${base}/admin\n`);
    if (!(await auth.getAdmin())) {
      console.log("  ⚠  No admin account yet. Create one with:  npm run set-admin\n");
    }
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
