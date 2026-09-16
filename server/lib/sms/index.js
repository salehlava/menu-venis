/*
 * SMS service — the only place the rest of the app talks to an SMS panel.
 * Add real providers to PROVIDERS (see providers/_template.js).
 */
const store = require("../store");

const PROVIDERS = [
  require("./providers/none"),
  // require("./providers/kavenegar"),
];

if (process.env.SMS_DEV === "1") PROVIDERS.push(require("./providers/console"));

const DEFAULT_SETTINGS = { provider: "none", config: {} };
const LOG_LIMIT = 500;

const providerById = (id) => PROVIDERS.find((p) => p.id === id) || PROVIDERS[0];

async function getSettings() {
  const s = await store.read("sms-settings", DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...s, config: s.config || {} };
}

/** Settings safe to show in the admin panel (secrets are masked). */
async function publicSettings() {
  const s = await getSettings();
  const provider = providerById(s.provider);
  const values = {};
  for (const field of provider.fields) {
    const v = s.config[field.key] || "";
    values[field.key] = field.secret ? { set: Boolean(v), hint: v ? `••••${String(v).slice(-4)}` : "" } : v;
  }
  return {
    provider: provider.id,
    configured: provider.configured(s.config),
    values,
    providers: PROVIDERS.map((p) => ({ id: p.id, label: p.label, fields: p.fields })),
  };
}

async function saveSettings({ provider: id, values }) {
  const provider = PROVIDERS.find((p) => p.id === id);
  if (!provider) throw Object.assign(new Error("Unknown SMS provider"), { status: 422 });

  await store.update("sms-settings", DEFAULT_SETTINGS, (s) => {
    const previous = s.provider === id ? s.config || {} : {};
    const config = {};
    for (const field of provider.fields) {
      const incoming = values && typeof values[field.key] === "string" ? values[field.key].trim().slice(0, 500) : "";
      // Secret left empty in the form = keep the stored value.
      config[field.key] = field.secret && !incoming ? previous[field.key] || "" : incoming;
    }
    return { provider: id, config };
  });
  return publicSettings();
}

async function isConfigured() {
  const s = await getSettings();
  return providerById(s.provider).configured(s.config);
}

/** Personalizes {name} placeholders. */
const render = (template, customer) => String(template).replace(/\{name\}/g, customer.name || "");

/**
 * Sends `template` to customers and records the result in data/sms-log.json.
 * @returns log entry
 */
async function sendToCustomers(customers, template, { audience = "custom" } = {}) {
  const s = await getSettings();
  const provider = providerById(s.provider);
  if (!provider.configured(s.config)) {
    const err = new Error("SMS panel is not connected yet");
    err.code = "sms_not_configured";
    throw err;
  }

  const messages = customers.map((c) => ({ to: c.phone, text: render(template, c) }));
  let results;
  try {
    results = await provider.send(messages, s.config);
  } catch (err) {
    results = messages.map((m) => ({ to: m.to, ok: false, error: err.message }));
  }

  const sent = results.filter((r) => r.ok).length;
  const entry = {
    id: require("node:crypto").randomBytes(8).toString("hex"),
    createdAt: new Date().toISOString(),
    provider: provider.id,
    audience,
    message: template,
    recipients: messages.length,
    sent,
    failed: messages.length - sent,
    status: sent === messages.length ? "sent" : sent === 0 ? "failed" : "partial",
    errors: results.filter((r) => !r.ok).slice(0, 20),
  };

  await store.update("sms-log", [], (log) => {
    log.unshift(entry);
    return log.slice(0, LOG_LIMIT);
  });
  return entry;
}

async function getLog() {
  return store.read("sms-log", []);
}

module.exports = { publicSettings, saveSettings, isConfigured, sendToCustomers, getLog };
