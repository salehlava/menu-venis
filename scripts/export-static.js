#!/usr/bin/env node
/*
 * Exports a STATIC copy of the public menu into docs/ for free hosting
 * (GitHub Pages, Netlify drop, any web host).
 *
 *   npm run export
 *
 * The export contains the menu plus the admin panel in "GitHub mode":
 * the panel signs in with a GitHub token and saves menu, prices, cafe info
 * and colors straight back into the published repository.
 *
 * The Customer Club form is hidden in the export, because storing sign-ups
 * needs the Node server.
 *
 * After every menu or color change:  npm run export  → commit → push
 */
const fs = require("node:fs/promises");
const path = require("node:path");
const { buildThemeCss } = require("../shared/theme");
const svc = require("../server/services");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "docs");

// "owner/repo" of the PUBLIC menu repository the admin panel writes to.
const SITE_REPO =
  process.env.SITE_REPO ||
  (process.env.SITE_REMOTE || "https://github.com/salehlava/venezia.git").replace(/^.*github\.com[/:]/, "").replace(/\.git$/, "");

/** Absolute /css/… and /shared/… links become relative, so a subfolder works. */
const relative = (html, prefix = "") =>
  html.replace(/(href|src)="\/(css|js|shared)\//g, (m, attr, dir) => `${attr}="${prefix}${dir}/`);

async function main() {
  const [menu, theme] = await Promise.all([svc.getMenu(), svc.getTheme()]);

  const categories = menu.categories
    .map((cat) => ({ ...cat, items: cat.items.filter((item) => !item.hidden) }))
    .filter((cat) => cat.items.length);

  const payload = {
    cafe: menu.cafe,
    categories,
    theme: { brand: theme.brand },
    club: { enabled: false }, // needs the server, so it is hidden in the static export
  };

  await fs.rm(OUT, { recursive: true, force: true });
  await fs.mkdir(path.join(OUT, "css"), { recursive: true });
  await fs.mkdir(path.join(OUT, "js"), { recursive: true });

  const html = relative(await fs.readFile(path.join(ROOT, "public", "index.html"), "utf8"));
  await fs.writeFile(path.join(OUT, "index.html"), html);
  await fs.copyFile(path.join(ROOT, "public", "css", "style.css"), path.join(OUT, "css", "style.css"));
  await fs.copyFile(path.join(ROOT, "public", "js", "app.js"), path.join(OUT, "js", "app.js"));
  await fs.writeFile(path.join(OUT, "css", "theme.css"), buildThemeCss(theme));
  await fs.writeFile(path.join(OUT, "js", "menu-data.js"), `window.MENU = ${JSON.stringify(payload)};\n`);
  await fs.writeFile(path.join(OUT, ".nojekyll"), "");

  // The admin panel reads and writes these two files through the GitHub API.
  await fs.mkdir(path.join(OUT, "data"), { recursive: true });
  await fs.writeFile(path.join(OUT, "data", "menu.json"), JSON.stringify(menu, null, 2));
  await fs.writeFile(path.join(OUT, "data", "theme.json"), JSON.stringify(theme, null, 2));

  // Admin panel in GitHub mode
  await fs.cp(path.join(ROOT, "public", "admin"), path.join(OUT, "admin"), { recursive: true });
  const adminHtml = relative(await fs.readFile(path.join(ROOT, "public", "admin", "index.html"), "utf8"), "../").replace(
    '<script src="js/main.js" type="module"></script>',
    `<script src="js/config.js"></script>\n  <script src="js/main.js" type="module"></script>`
  );
  await fs.writeFile(path.join(OUT, "admin", "index.html"), adminHtml);
  await fs.writeFile(
    path.join(OUT, "admin", "js", "config.js"),
    `/* Published admin panel: no server, so it talks to the GitHub API. */
window.VENICE_MODE = "github";
window.VENICE_REPO = ${JSON.stringify(SITE_REPO)};
`
  );
  await fs.mkdir(path.join(OUT, "shared"), { recursive: true });
  await fs.copyFile(path.join(ROOT, "shared", "theme.js"), path.join(OUT, "shared", "theme.js"));

  const items = categories.reduce((n, c) => n + c.items.length, 0);
  console.log(`✓ Exported ${items} items in ${categories.length} categories to docs/ (menu + admin panel for ${SITE_REPO})`);
  console.log("  Now run:  git add -A && git commit -m \"update menu\" && git push");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
