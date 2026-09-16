/*
 * Minimal router: router.get("/api/items/:id", guard, handler)
 * Handlers receive ctx = { req, res, params, url, ip, session } and may return data (sent as JSON).
 */
const { json } = require("./http");

function createRouter() {
  const routes = [];

  function add(method, pattern, handlers) {
    const keys = [];
    const source = pattern.replace(/:([a-zA-Z]+)/g, (_, key) => {
      keys.push(key);
      return "([^/]+)";
    });
    routes.push({ method, re: new RegExp(`^${source}/?$`), keys, handlers });
  }

  const router = {
    async handle(ctx) {
      const method = ctx.req.method === "HEAD" ? "GET" : ctx.req.method;
      let pathMatched = false;

      for (const route of routes) {
        const m = route.re.exec(ctx.url.pathname);
        if (!m) continue;
        pathMatched = true;
        if (route.method !== method) continue;

        ctx.params = {};
        route.keys.forEach((key, i) => {
          ctx.params[key] = decodeURIComponent(m[i + 1]);
        });

        let result;
        for (const handler of route.handlers) {
          result = await handler(ctx);
          if (ctx.res.writableEnded) return true;
        }
        json(ctx.res, 200, result === undefined ? { ok: true } : result);
        return true;
      }

      if (pathMatched) {
        json(ctx.res, 405, { error: "method_not_allowed" });
        return true;
      }
      return false;
    },
  };

  for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
    router[method.toLowerCase()] = (pattern, ...handlers) => add(method, pattern, handlers);
  }
  return router;
}

module.exports = { createRouter };
