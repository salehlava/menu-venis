/* DOM helpers, icons, dialogs and toasts for the admin panel. */
import { t, getLang } from "./i18n.js";
import { isGithubMode } from "./github.js";

/* ---------- Icons ---------- */
const ICONS = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/><path d="M10 19.5v-5h4v5"/>',
  burger: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.9 1.8-1.9 0-.5-.2-.9-.5-1.3-.3-.3-.5-.8-.5-1.3 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10.5" cy="7" r="1.2"/><circle cx="15" cy="7.5" r="1.2"/>',
  store: '<path d="M4 9.5 5.5 4h13L20 9.5"/><path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0"/><path d="M5.5 12v8h13v-8"/><path d="M10 20v-4.5h4V20"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.8a3.5 3.5 0 0 1 0 6.4M18.5 14.5A6.5 6.5 0 0 1 21.5 20"/>',
  message: '<path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4V6a1 1 0 0 1 1-1z"/><path d="M8 10h8M8 13.5h5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17l5-5-5-5M15 12H3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
  edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6C3.9 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  up: '<path d="M6 15l6-6 6 6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  download: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  percent: '<path d="M19 5 5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
  send: '<path d="M21 3 10 14"/><path d="M21 3l-7 18-4-7-7-4 18-7z"/>',
  gift: '<rect x="3.5" y="8.5" width="17" height="5" rx="1"/><path d="M5 13.5v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6M12 8.5v12"/><path d="M12 8.5S10.8 3.5 8 3.5a2.5 2.5 0 0 0 0 5M12 8.5s1.2-5 4-5a2.5 2.5 0 0 1 0 5"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  more: '<path d="M4 7h16M7 12h10M10 17h4"/>',
  alert: '<path d="M12 3.5 2.5 20h19L12 3.5z"/><path d="M12 10v4.5M12 17.3h.01"/>',
  plug: '<path d="M9 2.5v5M15 2.5v5M6 7.5h12v3.5a6 6 0 0 1-12 0V7.5zM12 17v4.5"/>',
  sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  cake: '<path d="M3.5 21h17"/><path d="M5 21v-8a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v8"/><path d="M5 16.2c1.2.9 2.3.9 3.5 0s2.3-.9 3.5 0 2.3.9 3.5 0 2.3-.9 3.5 0"/><path d="M12 12V8.5"/><path d="M12 6.3c.8 0 1.3-.6 1.3-1.3 0-.9-1.3-2.5-1.3-2.5s-1.3 1.6-1.3 2.5c0 .7.5 1.3 1.3 1.3z"/>',
  userPlus: '<circle cx="10" cy="8" r="4"/><path d="M2.5 21a7.5 7.5 0 0 1 15 0M19 8v6M16 11h6"/>',
};

/* Category icons — same drawings as the public menu. */
export const CATEGORY_ICONS = {
  espresso: '<path d="M4 9h12v4.5A5.5 5.5 0 0 1 10.5 19h-1A5.5 5.5 0 0 1 4 13.5V9z"/><path d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H15.4"/><path d="M3 21.5h14"/><path d="M8 2.5c-.6.8-.6 1.7 0 2.5s.6 1.7 0 2.5M12 2.5c-.6.8-.6 1.7 0 2.5s.6 1.7 0 2.5"/>',
  tea: '<path d="M19.5 4.5C11 4.5 5.5 9 5.5 15.5c0 1.4.3 2.6.9 3.6 1 .6 2.2.9 3.6.9 6.5 0 9.5-6.5 9.5-15.5z"/><path d="M3.5 21.5c3-5 7-9 11.5-12"/>',
  cappuccino: '<path d="M3 20.5h18"/><path d="M5 10.5h12v2.5a6 6 0 0 1-6 6 6 6 0 0 1-6-6v-2.5z"/><path d="M17 11.5h1a2.3 2.3 0 0 1 0 4.6h-1.6"/><path d="M11 8.3S8.6 6.9 8.6 5.4c0-1.6 1.9-2 2.4-.7.5-1.3 2.4-.9 2.4.7 0 1.5-2.4 2.9-2.4 2.9z"/>',
  iced: '<path d="M5 3.5h14l-1.7 16.1a2 2 0 0 1-2 1.9H8.7a2 2 0 0 1-2-1.9L5 3.5z"/><path d="M5.6 9h12.8"/><rect x="8.3" y="11" width="3.4" height="3.4" rx=".7"/><rect x="12.3" y="14.6" width="3.4" height="3.4" rx=".7"/>',
  shake: '<path d="M6.5 10.5h11l-1.3 10.1a1.2 1.2 0 0 1-1.2 1H9a1.2 1.2 0 0 1-1.2-1L6.5 10.5z"/><path d="M5.5 10.5a6.5 6.5 0 0 1 13 0"/><path d="M12.5 7 15 1.8"/>',
  smoothie: '<path d="M5.5 7.5h12l-1.5 13a1.2 1.2 0 0 1-1.2 1H8.2a1.2 1.2 0 0 1-1.2-1L5.5 7.5z"/><path d="M6.2 12.5h10.6"/><path d="M10 7.5 8 2"/><path d="M15.5 7.5a3 3 0 1 1 5.5-1.7"/>',
  cake: ICONS.cake,
  snack: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3"/><path d="M7.4 7.8l.5.4M15.8 7.3l-.4.5M16.9 14.9l-.5-.3M8.4 16.6l.4-.5M12 4.9v.6"/>',
};

const SVG_NS = "http://www.w3.org/2000/svg";

/** Builds an <svg> from one of the trusted constants above. */
export function icon(name, className = "i") {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", className);
  svg.innerHTML = ICONS[name] || CATEGORY_ICONS[name] || "";
  return svg;
}

export function categoryIcon(name) {
  const svg = icon("x", "");
  svg.innerHTML = CATEGORY_ICONS[name] || CATEGORY_ICONS.espresso;
  svg.setAttribute("stroke-width", "1.6");
  return svg;
}

/* ---------- Element builder ---------- */
const PROPS = new Set(["value", "checked", "disabled", "selected", "hidden", "readOnly", "required", "indeterminate"]);

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    if (key === "class") el.className = value;
    else if (key === "dataset") Object.assign(el.dataset, value);
    else if (key === "style") Object.assign(el.style, value);
    else if (key.startsWith("on") && typeof value === "function") el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (PROPS.has(key)) el[key] = value;
    else el.setAttribute(key, value === true ? "" : value);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

/* ---------- Formatting ---------- */
export const locale = () => (getLang() === "fa" ? "fa-IR" : "en-US");

export function fmtNumber(n) {
  return new Intl.NumberFormat(locale()).format(n);
}

export function fmtDate(iso, withTime = false) {
  if (!iso) return "—";
  const opts = withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" };
  return new Intl.DateTimeFormat(locale(), opts).format(new Date(iso));
}

export const toLatinDigits = (s) =>
  String(s ?? "")
    .replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d))
    .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));

export function localDigits(s) {
  return getLang() === "fa" ? String(s).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]) : String(s);
}

export function formatBirthday(b) {
  if (!b) return "—";
  const months = b.cal === "gregorian" ? t("monthsGregorian") : t("monthsJalali");
  return `${localDigits(b.d)} ${months[b.m - 1]}`;
}

export const debounce = (fn, ms = 200) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
};

/* ---------- Form widgets ---------- */
export function field(label, control, hint) {
  return h("label", { class: "field" }, h("span", { class: "field__label" }, label), control, hint && h("span", { class: "field__hint" }, hint));
}

export function switchControl({ checked, onChange, label, ariaLabel }) {
  const input = h("input", { type: "checkbox", checked: !!checked, "aria-label": ariaLabel || label });
  input.addEventListener("change", () => onChange && onChange(input.checked));
  return h("label", { class: "switch" }, input, h("span", { class: "switch__track" }), label && h("span", { class: "switch__label" }, label));
}

/** Two inputs (fa + en) bound to obj[key] = { fa, en }. */
export function biField(label, obj, key, { max = 120, textarea = false, onInput, hint } = {}) {
  obj[key] = obj[key] || { en: "", fa: "" };
  const make = (lang) => {
    const attrs = {
      class: textarea ? "textarea" : "input",
      dir: lang === "fa" ? "rtl" : "ltr",
      lang,
      maxlength: max,
      value: obj[key][lang] || "",
      "aria-label": `${label} (${lang === "fa" ? "فارسی" : "English"})`,
      onInput: (e) => {
        obj[key][lang] = e.target.value;
        onInput && onInput();
      },
    };
    const control = textarea ? h("textarea", attrs) : h("input", attrs);
    if (textarea) control.value = obj[key][lang] || "";
    return h("div", { class: "bi-field__lang", dataset: { lang } }, control, h("span", { class: "tag" }, lang === "fa" ? "FA" : "EN"));
  };
  return h(
    "div",
    { class: "bi-field" },
    h("span", { class: "field__label" }, label),
    h("div", { class: "bi-field__inputs" }, make("fa"), make("en")),
    hint && h("span", { class: "field__hint" }, hint)
  );
}

export function segmented(options, value, onChange) {
  const wrap = h("div", { class: "segmented", role: "group" });
  const render = (current) => {
    wrap.replaceChildren(
      ...options.map((o) =>
        h(
          "button",
          {
            type: "button",
            "aria-pressed": String(o.value === current),
            onClick: () => {
              render(o.value);
              onChange(o.value);
            },
          },
          o.icon ? icon(o.icon) : null,
          o.label
        )
      )
    );
  };
  render(value);
  return wrap;
}

export function emptyState(iconName, title, text) {
  return h("div", { class: "empty-state" }, h("div", { class: "empty-state__icon" }, icon(iconName)), h("strong", {}, title), text && h("p", {}, text));
}

export function pageHead(title, subtitle, ...actions) {
  return h(
    "header",
    { class: "page-head" },
    h("div", {}, h("h1", {}, title), subtitle && h("p", {}, subtitle)),
    actions.length ? h("div", { class: "page-head__actions" }, actions) : null
  );
}

export function button(label, { variant = "", iconName, onClick, type = "button", size, disabled, title } = {}) {
  const cls = ["btn", variant && `btn--${variant}`, size && `btn--${size}`].filter(Boolean).join(" ");
  return h("button", { type, class: cls, onClick, disabled, title }, iconName ? icon(iconName) : null, label);
}

export function iconButton(name, label, onClick, { danger = false, disabled = false } = {}) {
  return h("button", { type: "button", class: `icon-btn${danger ? " icon-btn--danger" : ""}`, title: label, "aria-label": label, onClick, disabled }, icon(name));
}

/** Button that shows a busy state while an async action runs. */
export async function withBusy(btn, fn) {
  if (btn.disabled) return;
  btn.disabled = true;
  btn.setAttribute("aria-busy", "true");
  try {
    return await fn();
  } finally {
    btn.disabled = false;
    btn.removeAttribute("aria-busy");
  }
}

/** "Saved" on the server, "published" when saving straight to GitHub. */
export const savedMessage = () => t(isGithubMode() ? "publishedLive" : "saved");

/* ---------- Toasts ---------- */
let toastRoot;
export function toast(message, type = "success") {
  if (!toastRoot) {
    toastRoot = h("div", { class: "toasts", role: "status", "aria-live": "polite" });
    document.body.append(toastRoot);
  }
  const el = h("div", { class: `toast toast--${type}` }, icon(type === "error" ? "alert" : "check"), message);
  toastRoot.append(el);
  setTimeout(() => {
    el.classList.add("is-leaving");
    setTimeout(() => el.remove(), 250);
  }, type === "error" ? 5000 : 2800);
}

/** Human message for an ApiError. */
export function errorMessage(err) {
  if (!err) return t("errGeneric");
  if (err.code === "network") return t("errNetwork");
  const key = `err_${err.code}`;
  const translated = t(key);
  if (translated !== key) return translated;
  return err.message || t("errGeneric");
}

/* ---------- Dialogs ---------- */
export function modal({ title, body, actions = [], size }) {
  const dialog = h("dialog", { class: `modal${size ? ` modal--${size}` : ""}` });
  const close = (value) => {
    dialog.close();
    dialog.remove();
    resolveFn(value);
  };
  let resolveFn;
  const done = new Promise((r) => (resolveFn = r));

  const footer = actions.length
    ? h(
        "footer",
        { class: "modal__foot" },
        actions.map((a) => {
          const b = button(a.label, { variant: a.variant, iconName: a.icon, type: "button" });
          b.addEventListener("click", async () => {
            if (!a.onClick) return close(a.value);
            await withBusy(b, async () => {
              const result = await a.onClick(close);
              if (result !== false && dialog.open && a.autoClose !== false) close(a.value);
            });
          });
          return b;
        })
      )
    : null;

  dialog.append(
    h("header", { class: "modal__head" }, h("h2", {}, title), iconButton("x", t("close"), () => close(undefined))),
    h("div", { class: "modal__body" }, body),
    footer
  );
  dialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    close(undefined);
  });
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) close(undefined);
  });

  document.body.append(dialog);
  dialog.showModal();
  const first = dialog.querySelector(".modal__body input, .modal__body select, .modal__body textarea");
  if (first) first.focus();
  return { dialog, close, done };
}

export function confirmDialog({ title, message, confirmLabel, danger = false }) {
  const { done } = modal({
    title,
    size: "sm",
    body: h("p", {}, message),
    actions: [
      { label: t("cancel"), value: false },
      { label: confirmLabel || t("confirm"), variant: danger ? "danger-solid" : "primary", value: true },
    ],
  });
  return done.then(Boolean);
}

export function downloadFile(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = h("a", { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
