#!/usr/bin/env node
/*
 * Exports a STATIC copy of the site into docs/ for free hosting
 * (GitHub Pages, Netlify drop, any web host).
 *
 *   npm run export     build docs/
 *   npm run publish    build docs/ and push it to the public menu repository
 *
 * Exported: the menu page + the admin panel in "GitHub mode" (the panel signs
 * in with a GitHub token and saves changes back into the published repository).
 *
 * Every script and stylesheet is bundled and minified first, so the published
 * site carries one compressed file instead of readable source files.
 *
 * Never exported: the readable source, the server, the customer database,
 * the SMS code and every key — they stay in this private repository.
 */
const fs = require("node:fs/promises");
const path = require("node:path");
const esbuild = require("esbuild");
const { buildThemeCss } = require("../shared/theme");
const svc = require("../server/services");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "docs");

// "owner/repo" of the PUBLIC menu repository that the admin panel writes to.
const SITE_REPO =
  process.env.SITE_REPO ||
  (process.env.SITE_REMOTE || "https://github.com/salehlava/menu-venis.git")
    .replace(/^.*github\.com[/:]/, "")
    .replace(/\.git$/, "");

// Branch the published site lives on (gh-pages of the private repository, so the
// site is public while the source stays private).
const SITE_BRANCH = process.env.SITE_BRANCH || "gh-pages";

/* ---------- minifying ---------- */
/** Minifies one file; with `bundle`, pulls every imported module into it too. */
function minify(file, { bundle = false } = {}) {
  const result = esbuild.buildSync({
    entryPoints: [path.join(ROOT, file)],
    bundle,
    minify: true,
    format: bundle ? "iife" : undefined,
    platform: "browser",
    target: ["es2020"],
    legalComments: "none",
    write: false,
  });
  return result.outputFiles[0].text;
}

/** Absolute /css/… and /shared/… links become relative, so a subfolder works. */
const relative = (html, prefix = "") =>
  html.replace(/(href|src)="\/(css|js|shared)\//g, (m, attr, dir) => `${attr}="${prefix}${dir}/`);

async function main() {
  const [menu, theme, club] = await Promise.all([svc.getMenu(), svc.getTheme(), svc.getClub()]);
  const contact = club.contact || {};
  const canJoin = Boolean(contact.whatsapp || contact.sms);

  const categories = menu.categories
    .map((cat) => ({ ...cat, items: cat.items.filter((item) => !item.hidden) }))
    .filter((cat) => cat.items.length);

  const payload = {
    cafe: menu.cafe,
    categories,
    theme: { brand: theme.brand },
    // No server here: the visitor fills the form and sends the details to the café.
    club: {
      enabled: Boolean(club.enabled && canJoin),
      title: club.title,
      text: club.text,
      mode: "message",
      whatsapp: contact.whatsapp || "",
      sms: contact.sms || "",
    },
  };

  await fs.rm(OUT, { recursive: true, force: true });
  await fs.mkdir(path.join(OUT, "css"), { recursive: true });
  await fs.mkdir(path.join(OUT, "js"), { recursive: true });
  await fs.mkdir(path.join(OUT, "admin"), { recursive: true });
  await fs.mkdir(path.join(OUT, "data"), { recursive: true });

  /* ---------- menu page ---------- */
  await fs.writeFile(path.join(OUT, "index.html"), relative(await fs.readFile(path.join(ROOT, "public", "index.html"), "utf8")));
  await fs.writeFile(path.join(OUT, "css", "style.css"), minify("public/css/style.css"));
  await fs.writeFile(path.join(OUT, "js", "app.js"), minify("public/js/app.js"));
  await fs.writeFile(path.join(OUT, "css", "theme.css"), buildThemeCss(theme));
  await fs.writeFile(path.join(OUT, "js", "menu-data.js"), `window.MENU = ${JSON.stringify(payload)};\n`);
  await fs.writeFile(path.join(OUT, ".nojekyll"), "");

  /* ---------- admin panel: one compressed file ---------- */
  // Menu data the panel reads and writes through the GitHub API (data, not code).
  await fs.writeFile(path.join(OUT, "data", "menu.json"), JSON.stringify(menu, null, 2));
  await fs.writeFile(path.join(OUT, "data", "theme.json"), JSON.stringify(theme, null, 2));

  const settings =
    `window.VENICE_MODE="github";window.VENICE_REPO=${JSON.stringify(SITE_REPO)};window.VENICE_BRANCH=${JSON.stringify(SITE_BRANCH)};`;
  const themeLib = minify("shared/theme.js"); // defines window.VeniceTheme
  const panel = minify("public/admin/js/main.js", { bundle: true });
  await fs.writeFile(path.join(OUT, "admin", "app.js"), `${settings}\n${themeLib}\n${panel}`);
  await fs.writeFile(path.join(OUT, "admin", "admin.css"), minify("public/admin/admin.css"));

  const adminHtml = relative(await fs.readFile(path.join(ROOT, "public", "admin", "index.html"), "utf8"), "../")
    .replace(`  <script src="../shared/theme.js" defer></script>\n`, "")
    .replace(`<script src="js/main.js" type="module"></script>`, `<script src="app.js" defer></script>`);

  if (adminHtml.includes("js/main.js") || adminHtml.includes("shared/theme.js")) {
    throw new Error("The admin page still points at source files — check public/admin/index.html");
  }
  await fs.writeFile(path.join(OUT, "admin", "index.html"), adminHtml);

  /* ---------- report ---------- */
  const items = categories.reduce((n, c) => n + c.items.length, 0);
  const size = (await fs.stat(path.join(OUT, "admin", "app.js"))).size;
  console.log(`✓ Exported ${items} items in ${categories.length} categories to docs/`);
  console.log(`  admin panel: 1 compressed file (${Math.round(size / 1024)} KB) — no source published`);
  console.log(`  publishes to: ${SITE_REPO} (branch ${SITE_BRANCH})`);
  if (club.enabled && !canJoin) {
    console.log("  ⚠ Customer Club is hidden on the published menu: add a WhatsApp or SMS number");
    console.log("    in Admin → Settings → Customer Club, then publish again.");
  }
  console.log("  Now run:  npm run publish");
}

main().catch((err) => {
  console.error(`\n✗ ${err.message}`);
  process.exit(1);
});
