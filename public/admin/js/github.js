/*
 * GitHub mode backend.
 *
 * When the admin panel is opened from the published GitHub Pages site there is
 * no server. This module answers the same calls as api.js, but reads and writes
 * files in the public menu repository through the GitHub API.
 *
 * Signing in = a GitHub token that can write to that one repository. The token
 * is kept only in this browser (localStorage) and sent only to api.github.com.
 *
 * Handled here: menu, cafe info, colors, history.
 * Needs the server: customer club, SMS, admin account settings.
 */
const TOKEN_KEY = "venice-gh-token";
const API = "https://api.github.com";

const repo = () => window.VENICE_REPO || "";
const branch = () => window.VENICE_BRANCH || "main";

const PATHS = {
  menu: "data/menu.json",
  theme: "data/theme.json",
  menuData: "js/menu-data.js",
  themeCss: "css/theme.css",
};

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
};

const setToken = (value) => {
  try {
    if (value) localStorage.setItem(TOKEN_KEY, value);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage blocked */
  }
};

class GhError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code || (status === 401 ? "unauthorized" : "github_error");
  }
}

async function gh(path, { method = "GET", body, token = getToken() } = {}) {
  let res;
  try {
    res = await fetch(API + path, {
      method,
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(token ? { Authorization: "Bearer " + token } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new GhError(0, "network", "network");
  }

  if (res.status === 401) throw new GhError(401, "Bad or expired token", "bad_token");
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const code = res.status === 403 ? "no_access" : res.status === 404 ? "not_found" : "github_error";
    throw new GhError(res.status, data.message || "GitHub error " + res.status, code);
  }
  return res.json();
}

/* ---------- base64 for UTF-8 text ---------- */
function encode(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function decode(base64) {
  const binary = atob(String(base64).replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/* ---------- reading ---------- */
async function readJson(path, fallback) {
  try {
    const file = await gh("/repos/" + repo() + "/contents/" + path + "?ref=" + branch() + "&t=" + Date.now());
    return JSON.parse(decode(file.content));
  } catch (err) {
    if (err.code === "not_found" && fallback !== undefined) return fallback;
    throw err;
  }
}

/* ---------- writing: several files in one commit ---------- */
async function commitFiles(files, message) {
  const r = repo();
  const ref = await gh("/repos/" + r + "/git/ref/heads/" + branch());
  const head = ref.object.sha;
  const headCommit = await gh("/repos/" + r + "/git/commits/" + head);

  const tree = [];
  for (const file of files) {
    const blob = await gh("/repos/" + r + "/git/blobs", {
      method: "POST",
      body: { content: encode(file.content), encoding: "base64" },
    });
    tree.push({ path: file.path, mode: "100644", type: "blob", sha: blob.sha });
  }

  const newTree = await gh("/repos/" + r + "/git/trees", {
    method: "POST",
    body: { base_tree: headCommit.tree.sha, tree },
  });
  const commit = await gh("/repos/" + r + "/git/commits", {
    method: "POST",
    body: { message, tree: newTree.sha, parents: [head] },
  });
  await gh("/repos/" + r + "/git/refs/heads/" + branch(), { method: "PATCH", body: { sha: commit.sha } });
  return commit.sha;
}

/* ---------- the file the public menu page reads ---------- */
function menuDataJs(menu, theme) {
  const categories = menu.categories
    .map((cat) => ({ ...cat, items: cat.items.filter((item) => !item.hidden) }))
    .filter((cat) => cat.items.length);

  const payload = {
    cafe: menu.cafe,
    categories,
    theme: { brand: theme.brand },
    club: { enabled: false }, // the club sign-up form needs a server
  };
  return "window.MENU = " + JSON.stringify(payload) + ";\n";
}

/* ---------- validation (normally done by the server) ---------- */
const trim = (v, max) => String(v == null ? "" : v).trim().replace(/\s+/g, " ").slice(0, max);
const pair = (o, max) => ({ en: trim(o && o.en, max), fa: trim(o && o.fa, max) });

function cleanMenu(menu) {
  const fail = (msg, field) => {
    const err = new GhError(422, msg, "validation");
    err.field = field;
    throw err;
  };

  const cafe = menu.cafe || {};
  const out = {
    cafe: {
      name: pair(cafe.name, 60),
      tagline: pair(cafe.tagline, 80),
      title: pair(cafe.title, 80),
      priceNote: pair(cafe.priceNote, 120),
      defaultLang: cafe.defaultLang === "en" ? "en" : "fa",
      hours: pair(cafe.hours, 120),
      address: pair(cafe.address, 200),
      phone: trim(cafe.phone, 30),
      instagram: trim(String(cafe.instagram || "").replace(/^@/, ""), 30),
    },
    categories: [],
  };
  if (!out.cafe.name.en && !out.cafe.name.fa) fail("Cafe name is required", "cafe.name");

  const ids = new Set();
  out.categories = (menu.categories || []).map((cat, ci) => {
    const id = trim(cat.id, 40).toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) fail("Invalid category id", "categories[" + ci + "].id");
    if (ids.has(id)) fail("Duplicate category id", "categories[" + ci + "].id");
    ids.add(id);

    const title = pair(cat.title, 60);
    if (!title.en && !title.fa) fail("Category name is required", "categories[" + ci + "].title");

    const category = { id, icon: cat.icon || "espresso", title };
    const short = pair(cat.short, 30);
    if (short.en || short.fa) category.short = short;

    category.items = (cat.items || []).map((item, ii) => {
      const where = "categories[" + ci + "].items[" + ii + "]";
      const name = pair(item.name, 80);
      if (!name.en && !name.fa) fail("Item name is required", where + ".name");

      let price = item.price;
      if (price === "" || price === undefined) price = null;
      if (price !== null) {
        price = Number(price);
        if (!Number.isFinite(price) || price < 0) fail("Invalid price", where + ".price");
      }

      const result = { name, price };
      const desc = pair(item.desc, 160);
      if (desc.en || desc.fa) result.desc = desc;
      if (["signature", "new", "popular"].includes(item.tag)) result.tag = item.tag;
      if (item.hidden) result.hidden = true;
      return result;
    });
    return category;
  });

  return out;
}

/* ---------- routes ---------- */
const serverOnly = () => {
  throw new GhError(409, "This part needs the server", "server_only");
};

async function saveMenu(menu, message) {
  const theme = window.VeniceTheme.normalizeTheme(await readJson(PATHS.theme, window.VeniceTheme.DEFAULT_THEME));
  await commitFiles(
    [
      { path: PATHS.menu, content: JSON.stringify(menu, null, 2) },
      { path: PATHS.menuData, content: menuDataJs(menu, theme) },
    ],
    message
  );
  return menu;
}

const ROUTES = {
  "GET /api/admin/me": async () => {
    if (!getToken()) throw new GhError(401, "not signed in");
    const user = await gh("/user");
    return { username: user.login, mode: "github" };
  },

  "POST /api/admin/login": async (body) => {
    const token = String(body.token || body.password || "").trim();
    if (!token) throw new GhError(422, "Token is required", "validation");
    const user = await gh("/user", { token });
    const access = await gh("/repos/" + repo(), { token });
    if (!access.permissions || !access.permissions.push) {
      throw new GhError(403, "This token cannot write to the menu repository", "no_access");
    }
    setToken(token);
    return { username: user.login, mode: "github" };
  },

  "POST /api/admin/logout": async () => {
    setToken("");
    return { ok: true };
  },

  "GET /api/admin/overview": async () => {
    const menu = await readJson(PATHS.menu);
    const items = menu.categories.flatMap((c) => c.items);
    return {
      mode: "github",
      categories: menu.categories.length,
      items: items.length,
      hiddenItems: items.filter((i) => i.hidden).length,
      customers: 0,
      optedIn: 0,
      newThisWeek: 0,
      birthdaysToday: 0,
      smsConfigured: false,
      smsSent: 0,
      clubEnabled: false,
    };
  },

  "GET /api/admin/menu": () => readJson(PATHS.menu),

  "PUT /api/admin/menu/categories": async (body) => {
    const current = await readJson(PATHS.menu);
    return saveMenu(cleanMenu({ cafe: current.cafe, categories: body.categories }), "Update menu items and prices");
  },

  "PUT /api/admin/menu/cafe": async (body) => {
    const current = await readJson(PATHS.menu);
    return saveMenu(cleanMenu({ cafe: body, categories: current.categories }), "Update cafe information");
  },

  "GET /api/admin/theme": async () =>
    window.VeniceTheme.normalizeTheme(await readJson(PATHS.theme, window.VeniceTheme.DEFAULT_THEME)),

  "PUT /api/admin/theme": async (body) => {
    const theme = window.VeniceTheme.normalizeTheme(body);
    const menu = await readJson(PATHS.menu);
    await commitFiles(
      [
        { path: PATHS.theme, content: JSON.stringify(theme, null, 2) },
        { path: PATHS.themeCss, content: window.VeniceTheme.buildThemeCss(theme) },
        { path: PATHS.menuData, content: menuDataJs(menu, theme) },
      ],
      "Update menu colors"
    );
    return theme;
  },

  // History = the commits that changed the menu file.
  "GET /api/admin/menu/backups": async () => {
    const commits = await gh("/repos/" + repo() + "/commits?sha=" + branch() + "&path=" + PATHS.menu + "&per_page=30");
    return commits.map((c) => ({ file: c.sha, date: c.commit.committer.date }));
  },

  "POST /api/admin/menu/restore": async (body) => {
    const file = await gh("/repos/" + repo() + "/contents/" + PATHS.menu + "?ref=" + encodeURIComponent(body.file));
    return saveMenu(cleanMenu(JSON.parse(decode(file.content))), "Restore an earlier menu version");
  },

  "GET /api/admin/customers": serverOnly,
  "POST /api/admin/customers": serverOnly,
  "GET /api/admin/club": serverOnly,
  "PUT /api/admin/club": serverOnly,
  "GET /api/admin/sms/settings": serverOnly,
  "PUT /api/admin/sms/settings": serverOnly,
  "GET /api/admin/sms/log": serverOnly,
  "POST /api/admin/sms/send": serverOnly,
  "POST /api/admin/sms/test": serverOnly,
  "PUT /api/admin/account": serverOnly,
};

export async function githubRequest(method, url, body) {
  const route = ROUTES[method + " " + url];
  if (!route) serverOnly();
  return route(body || {});
}

export const isGithubMode = () => window.VENICE_MODE === "github";
