const crypto = require("node:crypto");
const { send, readJson, HttpError } = require("../lib/http");
const { createLimiter } = require("../lib/auth");
const { validateCustomer, newId } = require("../lib/people");
const { buildThemeCss } = require("../../shared/theme");
const sms = require("../lib/sms");
const svc = require("../services");

const joinLimiter = createLimiter({ windowMs: 60 * 60_000, max: 10 });

function sendDynamic(ctx, body, type) {
  const etag = `W/"${crypto.createHash("sha1").update(body).digest("base64url")}"`;
  const headers = { "Content-Type": type, "Cache-Control": "no-cache", ETag: etag };
  if (ctx.req.headers["if-none-match"] === etag) return send(ctx.res, 304, "", headers);
  send(ctx.res, 200, ctx.req.method === "HEAD" ? "" : body, headers);
}

module.exports = function publicRoutes(router) {
  // The menu the public site renders (hidden items removed, no private settings).
  router.get("/js/menu-data.js", async (ctx) => {
    const [menu, club, theme] = await Promise.all([svc.getMenu(), svc.getClub(), svc.getTheme()]);
    const categories = menu.categories
      .map((cat) => ({ ...cat, items: cat.items.filter((item) => !item.hidden) }))
      .filter((cat) => cat.items.length);

    const payload = {
      cafe: menu.cafe,
      categories,
      theme: { brand: theme.brand },
      club: { enabled: club.enabled, title: club.title, text: club.text, mode: "server" },
    };
    sendDynamic(ctx, `window.MENU = ${JSON.stringify(payload).replace(/</g, "\\u003c")};\n`, "text/javascript; charset=utf-8");
  });

  router.get("/css/theme.css", async (ctx) => {
    sendDynamic(ctx, buildThemeCss(await svc.getTheme()), "text/css; charset=utf-8");
  });

  // Customer Club sign-up from the menu page.
  router.post("/api/club/join", async (ctx) => {
    const body = await readJson(ctx.req, 10_000);

    const limit = joinLimiter.check(ctx.ip);
    if (!limit.allowed) throw new HttpError(429, "too_many_attempts", "Too many requests. Please try again later.");
    joinLimiter.hit(ctx.ip);

    // Honeypot field: real visitors never see or fill it.
    if (body.website) return { status: "joined" };

    const club = await svc.getClub();
    if (!club.enabled) throw new HttpError(403, "club_closed", "The customer club is not accepting members right now.");
    if (body.consent !== true) throw new HttpError(422, "validation", "Consent is required", { field: "consent" });

    const data = validateCustomer({ name: body.name, phone: body.phone, birthday: body.birthday, smsOptIn: true });

    let status = "joined";
    let created = null;
    await svc.updateCustomers((list) => {
      const existing = list.find((c) => c.phone === data.phone);
      if (existing) {
        status = "already_member";
        if (!existing.smsOptIn) {
          existing.smsOptIn = true;
          existing.updatedAt = new Date().toISOString();
        }
        return;
      }
      const now = new Date().toISOString();
      created = { id: newId(), ...data, note: "", source: "menu", lang: body.lang === "en" ? "en" : "fa", createdAt: now, updatedAt: now };
      list.push(created);
    });

    if (created && club.welcomeSms.enabled && club.welcomeSms.text && (await sms.isConfigured())) {
      sms.sendToCustomers([created], club.welcomeSms.text, { audience: "welcome" }).catch((err) => {
        console.error("[club] welcome SMS failed:", err.message);
      });
    }

    return { status };
  });
};
