#!/usr/bin/env node
/*
 * Exports a STATIC copy of the public menu into docs/ for free hosting
 * (GitHub Pages, Netlify drop, any web host).
 *
 *   npm run export
 *
 * The export contains the menu only — reading it needs no server.
 * The admin panel and the Customer Club form need the Node server, so
 * they are not part of the export (the club form is hidden).
 *
 * After every menu or color change:  npm run export  → commit → push
 */
const fs = require("node:fs/promises");
const path = require("node:path");
const { buildThemeCss } = require("../shared/theme");
const svc = require("../server/services");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "docs");

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

  // Absolute paths (/css/…) become relative so the site also works in a subfolder.
  let html = await fs.readFile(path.join(ROOT, "public", "index.html"), "utf8");
  html = html.replace(/(href|src)="\/(css|js)\//g, '$1="$2/');

  await fs.writeFile(path.join(OUT, "index.html"), html);
  await fs.copyFile(path.join(ROOT, "public", "css", "style.css"), path.join(OUT, "css", "style.css"));
  await fs.copyFile(path.join(ROOT, "public", "js", "app.js"), path.join(OUT, "js", "app.js"));
  await fs.writeFile(path.join(OUT, "css", "theme.css"), buildThemeCss(theme));
  await fs.writeFile(path.join(OUT, "js", "menu-data.js"), `window.MENU = ${JSON.stringify(payload)};\n`);
  await fs.writeFile(path.join(OUT, ".nojekyll"), "");

  const items = categories.reduce((n, c) => n + c.items.length, 0);
  console.log(`✓ Exported ${items} items in ${categories.length} categories to docs/`);
  console.log("  Now run:  git add -A && git commit -m \"update menu\" && git push");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
