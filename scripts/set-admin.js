#!/usr/bin/env node
/*
 * Create or reset the admin account.
 *   npm run set-admin                     (asks for username and password)
 *   npm run set-admin -- --username admin --password "••••••••"
 * Restart the server afterwards if it is running (signs out existing sessions).
 */
const readline = require("node:readline");
const auth = require("../server/lib/auth");

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      rl._writeToOutput = (s) => {
        if (s.includes(question)) rl.output.write(s);
        else if (s !== "\r\n" && s !== "\n") rl.output.write("*".repeat(s.length));
        else rl.output.write(s);
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer);
    });
  });
}

(async () => {
  const existing = await auth.getAdmin();
  let username = arg("username");
  let password = arg("password");

  if (!username) {
    const fallback = existing ? existing.username : "admin";
    username = (await ask(`Admin username (${fallback}): `)).trim() || fallback;
  }
  if (!password) {
    password = await ask("New password (min 8 characters): ", { hidden: true });
    const again = await ask("Repeat password: ", { hidden: true });
    if (password !== again) {
      console.error("✗ Passwords do not match.");
      process.exit(1);
    }
  }

  try {
    await auth.setAdmin(username, password);
    console.log(`✓ Admin account "${username}" saved. Sign in at /admin`);
  } catch (err) {
    console.error(`✗ ${err.message}`);
    process.exit(1);
  }
})();
