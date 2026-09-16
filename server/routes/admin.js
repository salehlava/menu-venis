const { readJson, HttpError } = require("../lib/http");
const auth = require("../lib/auth");
const store = require("../lib/store");
const { validateCafe, validateCategories, i18n, str } = require("../lib/validate");
const { validateCustomer, birthdayMatches, today, newId } = require("../lib/people");
const { normalizeTheme, HEX } = require("../../shared/theme");
const sms = require("../lib/sms");
const svc = require("../services");

const guard = auth.requireAdmin;

module.exports = function adminRoutes(router) {
  /* ---------- session ---------- */
  router.post("/api/admin/login", async (ctx) => auth.login(ctx, await readJson(ctx.req, 10_000)));

  router.post("/api/admin/logout", (ctx) => {
    auth.endSession(ctx);
    return { ok: true };
  });

  router.get("/api/admin/me", guard, (ctx) => ({ username: ctx.session.username }));

  router.put("/api/admin/account", guard, async (ctx) => auth.changeAccount(ctx, await readJson(ctx.req, 10_000)));

  /* ---------- overview ---------- */
  router.get("/api/admin/overview", guard, async () => {
    const [menu, customers, log, smsReady, club] = await Promise.all([
      svc.getMenu(),
      svc.getCustomers(),
      sms.getLog(),
      sms.isConfigured(),
      svc.getClub(),
    ]);
    const items = menu.categories.flatMap((c) => c.items);
    const weekAgo = Date.now() - 7 * 86400_000;
    const now = today();
    return {
      categories: menu.categories.length,
      items: items.length,
      hiddenItems: items.filter((i) => i.hidden).length,
      customers: customers.length,
      optedIn: customers.filter((c) => c.smsOptIn).length,
      newThisWeek: customers.filter((c) => Date.parse(c.createdAt) >= weekAgo).length,
      birthdaysToday: customers.filter((c) => birthdayMatches(c.birthday, "day", now)).length,
      smsConfigured: smsReady,
      smsSent: log.reduce((sum, e) => sum + (e.sent || 0), 0),
      clubEnabled: club.enabled,
    };
  });

  /* ---------- menu ---------- */
  router.get("/api/admin/menu", guard, () => svc.getMenu());

  router.put("/api/admin/menu/categories", guard, async (ctx) => {
    const body = await readJson(ctx.req);
    const categories = validateCategories(body.categories);
    const saved = await svc.updateMenu(async (menu) => {
      await store.backup("menu", menu);
      menu.categories = categories;
    });
    return saved;
  });

  router.put("/api/admin/menu/cafe", guard, async (ctx) => {
    const cafe = validateCafe(await readJson(ctx.req, 50_000));
    return svc.updateMenu(async (menu) => {
      await store.backup("menu", menu);
      menu.cafe = cafe;
    });
  });

  router.get("/api/admin/menu/backups", guard, () => store.listBackups("menu"));

  router.post("/api/admin/menu/restore", guard, async (ctx) => {
    const { file } = await readJson(ctx.req, 10_000);
    const snapshot = await store.readBackup(String(file || ""));
    if (!snapshot) throw new HttpError(404, "not_found", "Backup not found");
    const restored = { cafe: validateCafe(snapshot.cafe), categories: validateCategories(snapshot.categories) };
    return svc.updateMenu(async (menu) => {
      await store.backup("menu", menu);
      return restored;
    });
  });

  /* ---------- theme ---------- */
  router.get("/api/admin/theme", guard, () => svc.getTheme());

  router.put("/api/admin/theme", guard, async (ctx) => {
    const body = await readJson(ctx.req, 10_000);
    for (const key of ["brand", "accent", "neutral", "background"]) {
      if (!HEX.test(String(body[key] || ""))) throw new HttpError(422, "validation", `Invalid color: ${key}`, { field: key });
    }
    return svc.saveTheme(normalizeTheme(body));
  });

  /* ---------- customers ---------- */
  router.get("/api/admin/customers", guard, () => svc.getCustomers());

  router.post("/api/admin/customers", guard, async (ctx) => {
    const data = validateCustomer(await readJson(ctx.req, 20_000));
    let created;
    await svc.updateCustomers((list) => {
      if (list.some((c) => c.phone === data.phone)) {
        throw new HttpError(409, "duplicate_phone", "A customer with this mobile number already exists.", { field: "phone" });
      }
      const now = new Date().toISOString();
      created = { id: newId(), ...data, source: "admin", createdAt: now, updatedAt: now };
      list.push(created);
    });
    return created;
  });

  router.put("/api/admin/customers/:id", guard, async (ctx) => {
    const data = validateCustomer(await readJson(ctx.req, 20_000), { partial: true });
    let updated;
    await svc.updateCustomers((list) => {
      const customer = list.find((c) => c.id === ctx.params.id);
      if (!customer) throw new HttpError(404, "not_found", "Customer not found");
      if (data.phone && list.some((c) => c.phone === data.phone && c.id !== customer.id)) {
        throw new HttpError(409, "duplicate_phone", "A customer with this mobile number already exists.", { field: "phone" });
      }
      Object.assign(customer, data, { updatedAt: new Date().toISOString() });
      updated = customer;
    });
    return updated;
  });

  router.delete("/api/admin/customers/:id", guard, async (ctx) => {
    let found = false;
    await svc.updateCustomers((list) => {
      const next = list.filter((c) => c.id !== ctx.params.id);
      found = next.length !== list.length;
      return next;
    });
    if (!found) throw new HttpError(404, "not_found", "Customer not found");
    return { ok: true };
  });

  /* ---------- club settings ---------- */
  router.get("/api/admin/club", guard, () => svc.getClub());

  router.put("/api/admin/club", guard, async (ctx) => {
    const body = await readJson(ctx.req, 20_000);
    const w = body.welcomeSms || {};
    return svc.saveClub({
      enabled: body.enabled !== false,
      title: i18n(body.title, "title", { max: 60, required: true }),
      text: i18n(body.text, "text", { max: 240 }),
      welcomeSms: { enabled: w.enabled === true, text: str(w.text, "welcomeSms.text", { max: 500 }) },
    });
  });

  /* ---------- SMS ---------- */
  router.get("/api/admin/sms/settings", guard, () => sms.publicSettings());

  router.put("/api/admin/sms/settings", guard, async (ctx) => {
    try {
      return await sms.saveSettings(await readJson(ctx.req, 20_000));
    } catch (err) {
      if (err.status === 422) throw new HttpError(422, "validation", err.message);
      throw err;
    }
  });

  router.get("/api/admin/sms/log", guard, () => sms.getLog());

  router.post("/api/admin/sms/send", guard, async (ctx) => {
    const body = await readJson(ctx.req, 200_000);
    const message = str(body.message, "message", { max: 1000, required: true });
    const audience = ["all", "birthday-today", "birthday-month", "selected"].includes(body.audience) ? body.audience : null;
    if (!audience) throw new HttpError(422, "validation", "Choose who receives the message", { field: "audience" });

    const now = today();
    const ids = new Set(Array.isArray(body.ids) ? body.ids.map(String) : []);
    const recipients = (await svc.getCustomers()).filter((c) => {
      if (!c.smsOptIn) return false;
      if (audience === "birthday-today") return birthdayMatches(c.birthday, "day", now);
      if (audience === "birthday-month") return birthdayMatches(c.birthday, "month", now);
      if (audience === "selected") return ids.has(c.id);
      return true;
    });
    if (!recipients.length) throw new HttpError(422, "no_recipients", "No customers match this audience.");

    return sendOrExplain(() => sms.sendToCustomers(recipients, message, { audience }));
  });

  router.post("/api/admin/sms/test", guard, async (ctx) => {
    const body = await readJson(ctx.req, 20_000);
    const message = str(body.message, "message", { max: 1000, required: true });
    const { phone } = validateCustomer({ name: "test", phone: body.phone }, { partial: true });
    return sendOrExplain(() => sms.sendToCustomers([{ name: "", phone }], message, { audience: "test" }));
  });
};

async function sendOrExplain(fn) {
  try {
    return await fn();
  } catch (err) {
    if (err.code === "sms_not_configured") throw new HttpError(409, "sms_not_configured", err.message);
    throw err;
  }
}
