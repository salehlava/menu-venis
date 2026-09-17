#!/usr/bin/env node
/*
 * Publishes the public menu.
 *
 *   npm run publish
 *
 * 1. exports the menu from your live data into docs/
 * 2. copies it into .site/ (a checkout of the PUBLIC menu repository)
 * 3. commits and pushes it, so the public link updates
 *
 * The source code stays in this repository, which is private.
 */
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const DOCS = path.join(ROOT, "docs");
const SITE = path.join(ROOT, ".site");
const REMOTE = process.env.SITE_REMOTE || "https://github.com/salehlava/venezia.git";

const git = (args, cwd = SITE) => execFileSync("git", args, { cwd, stdio: "pipe" }).toString().trim();

function run() {
  // 1. Export the menu
  execFileSync(process.execPath, [path.join(ROOT, "scripts", "export-static.js")], { stdio: "inherit" });

  // 2. Make sure .site is an up-to-date checkout of the public repository
  if (!fs.existsSync(path.join(SITE, ".git"))) {
    fs.mkdirSync(SITE, { recursive: true });
    git(["init", "-b", "main"]);
    git(["remote", "add", "origin", REMOTE]);
  }
  try {
    git(["fetch", "origin", "main"]);
    git(["reset", "--hard", "origin/main"]);
  } catch {
    /* the public repository is still empty — nothing to fetch */
  }

  // 3. Replace the site files (keep .git)
  for (const entry of fs.readdirSync(SITE)) {
    if (entry !== ".git") fs.rmSync(path.join(SITE, entry), { recursive: true, force: true });
  }
  fs.cpSync(DOCS, SITE, { recursive: true });
  fs.writeFileSync(
    path.join(SITE, "README.md"),
    "# VENEZIA Café — menu\n\nThis repository holds only the published menu page.\n\n**Open the menu:** https://salehlava.github.io/venezia/\n"
  );

  // 4. Commit and push
  git(["add", "-A"]);
  const changed = git(["status", "--porcelain"]);
  if (!changed) {
    console.log("✓ Public menu is already up to date.");
    return;
  }
  git(["commit", "-m", `Update menu — ${new Date().toISOString().slice(0, 16).replace("T", " ")}`]);
  git(["push", "-u", "origin", "main"]);
  console.log("\n✓ Published. The public menu updates in about a minute:");
  console.log("  https://salehlava.github.io/venezia/");
}

try {
  run();
} catch (err) {
  console.error("\n✗ Publishing failed:", err.message);
  if (err.stderr) console.error(err.stderr.toString());
  process.exit(1);
}
