#!/usr/bin/env node
/*
 * Exports a STATIC copy of the public menu into docs/ for free hosting
 * (GitHub Pages, Netlify drop, any web host).
 *
 *   npm run export
 *
 * ONLY the menu page is exported. The admin panel and the server stay in this
 * private repository and are never published, so nobody can download them.
 *
 * After every menu or color change:  npm run export  → commit → push
 */
const fs = require("node:fs/promises");
const path = require("node:path");
const { buildThemeCss } = require("../shared/theme");
const svc = require("../server/services");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "docs");

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

  const html = relative(await fs.readFile(path.join(ROOT, "public", "index.html"), "utf8"));
  await fs.writeFile(path.join(OUT, "index.html"), html);
  await fs.copyFile(path.join(ROOT, "public", "css", "style.css"), path.join(OUT, "css", "style.css"));
  await fs.copyFile(path.join(ROOT, "public", "js", "app.js"), path.join(OUT, "js", "app.js"));
  await fs.writeFile(path.join(OUT, "css", "theme.css"), buildThemeCss(theme));
  await fs.writeFile(path.join(OUT, "js", "menu-data.js"), `window.MENU = ${JSON.stringify(payload)};\n`);
  await fs.writeFile(path.join(OUT, ".nojekyll"), "");

  const items = categories.reduce((n, c) => n + c.items.length, 0);
  console.log(`✓ Exported ${items} items in ${categories.length} categories to docs/ (menu only)`);
  if (club.enabled && !canJoin) {
    console.log("  ⚠ Customer Club is hidden on the published menu: add a WhatsApp or SMS number");
    console.log("    in Admin → Settings → Customer Club, then publish again.");
  }
  console.log("  Now run:  git add -A && git commit -m \"update menu\" && git push");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
