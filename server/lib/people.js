/* Phone numbers, birthdays and customer records for the Customer Club. */
const crypto = require("node:crypto");
const { fail, str } = require("./validate");
const { timeZone } = require("../config");

const toLatinDigits = (s) =>
  String(s)
    .replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d))
    .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));

/** Normalizes Iranian mobile numbers to 09xxxxxxxxx. Returns null when invalid. */
function normalizeMobile(input) {
  let s = toLatinDigits(input || "").replace(/[\s\-().]/g, "");
  if (s.startsWith("+98")) s = "0" + s.slice(3);
  else if (s.startsWith("0098")) s = "0" + s.slice(4);
  else if (s.startsWith("98") && s.length === 12) s = "0" + s.slice(2);
  else if (s.startsWith("9") && s.length === 10) s = "0" + s;
  return /^09\d{9}$/.test(s) ? s : null;
}

const MONTH_DAYS = {
  jalali: [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 30],
  gregorian: [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31],
};

/** Birthday is stored as day + month in the calendar the customer used: { cal, m, d }. */
function validateBirthday(input, field = "birthday") {
  if (input == null || input === "") return null;
  if (typeof input !== "object") fail(field, "Invalid birthday");
  if (input.m === "" || input.d === "" || input.m == null || input.d == null) return null;
  const cal = input.cal === "gregorian" ? "gregorian" : "jalali";
  const m = Number(input.m);
  const d = Number(input.d);
  if (!Number.isInteger(m) || m < 1 || m > 12) fail(field, "Invalid birthday month");
  if (!Number.isInteger(d) || d < 1 || d > MONTH_DAYS[cal][m - 1]) fail(field, "Invalid birthday day");
  return { cal, m, d };
}

/** Today's month/day in both calendars, in the cafe's time zone. */
function today(date = new Date()) {
  const parts = (calendar) => {
    const p = new Intl.DateTimeFormat(`en-u-ca-${calendar}-nu-latn`, { timeZone, month: "numeric", day: "numeric" }).formatToParts(date);
    return { m: Number(p.find((x) => x.type === "month").value), d: Number(p.find((x) => x.type === "day").value) };
  };
  return { jalali: parts("persian"), gregorian: parts("gregory") };
}

function birthdayMatches(birthday, scope, now = today()) {
  if (!birthday) return false;
  const t = now[birthday.cal];
  return scope === "month" ? birthday.m === t.m : birthday.m === t.m && birthday.d === t.d;
}

function validateCustomer(input, { partial = false } = {}) {
  const src = input && typeof input === "object" ? input : {};
  const out = {};

  if (!partial || "name" in src) out.name = str(src.name, "name", { max: 60, required: true });
  if (!partial || "phone" in src) {
    const phone = normalizeMobile(src.phone);
    if (!phone) fail("phone", "Enter a valid mobile number (09xxxxxxxxx)");
    out.phone = phone;
  }
  if (!partial || "birthday" in src) out.birthday = validateBirthday(src.birthday);
  if (!partial || "smsOptIn" in src) out.smsOptIn = src.smsOptIn !== false;
  if (!partial || "note" in src) out.note = str(src.note, "note", { max: 300 });
  return out;
}

const newId = () => crypto.randomBytes(8).toString("hex");

module.exports = { normalizeMobile, validateBirthday, validateCustomer, today, birthdayMatches, newId };
