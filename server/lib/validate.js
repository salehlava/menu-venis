const { HttpError } = require("./http");

const ICONS = ["espresso", "tea", "cappuccino", "iced", "shake", "smoothie", "cake", "snack"];
const TAGS = ["signature", "new", "popular"];

const fail = (field, message) => {
  throw new HttpError(422, "validation", message, { field });
};

function str(value, field, { max = 120, required = false, pattern } = {}) {
  if (value == null) value = "";
  if (typeof value !== "string") fail(field, `${field} must be text`);
  const v = value.trim().replace(/\s+/g, " ");
  if (required && !v) fail(field, `${field} is required`);
  if (v.length > max) fail(field, `${field} is too long (max ${max})`);
  if (v && pattern && !pattern.test(v)) fail(field, `${field} has an invalid format`);
  return v;
}

/** { en, fa } text. `required` means at least one language must be filled. */
function i18n(value, field, { max = 120, required = false } = {}) {
  const src = value && typeof value === "object" ? value : {};
  const out = { en: str(src.en, `${field}.en`, { max }), fa: str(src.fa, `${field}.fa`, { max }) };
  if (required && !out.en && !out.fa) fail(field, `${field} is required`);
  return out;
}

function validateCafe(input) {
  const c = input && typeof input === "object" ? input : fail("cafe", "cafe is required");
  return {
    name: i18n(c.name, "cafe.name", { max: 60, required: true }),
    tagline: i18n(c.tagline, "cafe.tagline", { max: 80 }),
    title: i18n(c.title, "cafe.title", { max: 80 }),
    priceNote: i18n(c.priceNote, "cafe.priceNote", { max: 120 }),
    defaultLang: c.defaultLang === "en" ? "en" : "fa",
    hours: i18n(c.hours, "cafe.hours", { max: 120 }),
    address: i18n(c.address, "cafe.address", { max: 200 }),
    phone: str(c.phone, "cafe.phone", { max: 30, pattern: /^[+\d\s()\-۰-۹]+$/ }),
    instagram: str(String(c.instagram || "").replace(/^@/, ""), "cafe.instagram", { max: 30, pattern: /^[A-Za-z0-9._]+$/ }),
  };
}

function validateCategories(input) {
  if (!Array.isArray(input)) fail("categories", "categories must be a list");
  if (input.length > 60) fail("categories", "Too many categories");

  const ids = new Set();
  return input.map((cat, ci) => {
    const f = `categories[${ci}]`;
    if (!cat || typeof cat !== "object") fail(f, "Invalid category");

    const id = str(cat.id, `${f}.id`, { max: 40, required: true, pattern: /^[a-z0-9][a-z0-9-]*$/ });
    if (ids.has(id)) fail(`${f}.id`, `Duplicate category id "${id}"`);
    ids.add(id);

    if (!Array.isArray(cat.items)) fail(`${f}.items`, "items must be a list");
    if (cat.items.length > 300) fail(`${f}.items`, "Too many items");

    const out = {
      id,
      icon: ICONS.includes(cat.icon) ? cat.icon : "espresso",
      title: i18n(cat.title, `${f}.title`, { max: 60, required: true }),
    };
    const short = i18n(cat.short, `${f}.short`, { max: 30 });
    if (short.en || short.fa) out.short = short;

    out.items = cat.items.map((item, ii) => {
      const g = `${f}.items[${ii}]`;
      if (!item || typeof item !== "object") fail(g, "Invalid item");

      let price = item.price;
      if (price === "" || price === undefined) price = null;
      if (price !== null) {
        price = Number(price);
        if (!Number.isFinite(price) || price < 0 || price > 1e12) fail(`${g}.price`, "Price must be a positive number");
        price = Math.round(price * 100) / 100;
      }

      const o = { name: i18n(item.name, `${g}.name`, { max: 80, required: true }), price };
      const desc = i18n(item.desc, `${g}.desc`, { max: 160 });
      if (desc.en || desc.fa) o.desc = desc;
      if (TAGS.includes(item.tag)) o.tag = item.tag;
      if (item.hidden === true) o.hidden = true;
      return o;
    });

    return out;
  });
}

module.exports = { str, i18n, fail, validateCafe, validateCategories, ICONS, TAGS };
