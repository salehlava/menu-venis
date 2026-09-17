/* Data access shared by the routes. */
const fs = require("node:fs/promises");
const path = require("node:path");
const store = require("./lib/store");
const { seedDir } = require("./config");
const { normalizeTheme, DEFAULT_THEME } = require("../shared/theme");

const seedMenu = async () => JSON.parse(await fs.readFile(path.join(seedDir, "menu.json"), "utf8"));

const DEFAULT_CLUB = {
  enabled: true,
  title: { en: "Customer Club", fa: "باشگاه مشتریان" },
  text: {
    en: "Join our club to receive news and special offers by SMS.",
    fa: "عضو باشگاه مشتریان شوید تا اخبار و پیشنهادهای ویژه را پیامکی دریافت کنید.",
  },
  welcomeSms: {
    enabled: false,
    text: "{name} عزیز، به باشگاه مشتریان کافه ونیز خوش آمدید!",
  },
  // Used by the published (static) menu, which has no server: visitors send
  // their details to these numbers instead of the sign-up being stored here.
  contact: { whatsapp: "", sms: "" },
};

module.exports = {
  getMenu: () => store.read("menu", seedMenu),
  updateMenu: (fn) => store.update("menu", seedMenu, fn),

  getTheme: async () => normalizeTheme(await store.read("theme", DEFAULT_THEME)),
  saveTheme: (theme) => store.update("theme", DEFAULT_THEME, () => normalizeTheme(theme)),

  getClub: async () => {
    const c = await store.read("club-settings", DEFAULT_CLUB);
    return {
      ...DEFAULT_CLUB,
      ...c,
      welcomeSms: { ...DEFAULT_CLUB.welcomeSms, ...(c.welcomeSms || {}) },
      contact: { ...DEFAULT_CLUB.contact, ...(c.contact || {}) },
    };
  },
  saveClub: (club) => store.update("club-settings", DEFAULT_CLUB, () => club),

  getCustomers: () => store.read("customers", []),
  updateCustomers: (fn) => store.update("customers", [], fn),
};
