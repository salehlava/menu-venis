const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

module.exports = {
  root: ROOT,
  publicDir: path.join(ROOT, "public"),
  sharedDir: path.join(ROOT, "shared"),
  seedDir: path.join(__dirname, "seed"),
  dataDir: process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, "data"),

  port: Number(process.env.PORT) || 3000,
  host: process.env.HOST || "0.0.0.0",

  // Set TRUST_PROXY=1 when running behind nginx / a hosting proxy (for real client IPs + HTTPS detection).
  trustProxy: process.env.TRUST_PROXY === "1",

  sessionHours: Number(process.env.SESSION_HOURS) || 12,

  // Used to decide "birthday today" for club members.
  timeZone: process.env.TIME_ZONE || "Asia/Tehran",

  menuBackupsToKeep: 30,
};
