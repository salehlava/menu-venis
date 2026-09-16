/* Admin panel entry: auth check, shell, hash router. */
import { t, getLang, setLang } from "./i18n.js";
import { api } from "./api.js";
import { h, icon, iconButton, segmented, confirmDialog, toast, errorMessage, emptyState } from "./ui.js";
import loginView from "./views/login.js";
import dashboardView from "./views/dashboard.js";
import menuView from "./views/menu.js";
import themeView from "./views/theme.js";
import infoView from "./views/info.js";
import customersView from "./views/customers.js";
import smsView from "./views/sms.js";
import settingsView from "./views/settings.js";

const ROUTES = {
  "": dashboardView,
  menu: menuView,
  theme: themeView,
  info: infoView,
  customers: customersView,
  sms: smsView,
  settings: settingsView,
};

const NAV = [
  { path: "", icon: "home", label: "navDashboard" },
  { path: "menu", icon: "list", label: "navMenu" },
  { path: "theme", icon: "palette", label: "navTheme" },
  { path: "info", icon: "store", label: "navInfo" },
  { sep: true },
  { path: "customers", icon: "users", label: "navCustomers" },
  { path: "sms", icon: "message", label: "navSms" },
  { sep: true },
  { path: "settings", icon: "settings", label: "navSettings" },
];

const app = document.getElementById("app");

const ctx = {
  user: null,
  dirty: false,
  state: {}, // shared between views, e.g. selected customers → SMS
  setDirty(value) {
    this.dirty = Boolean(value);
  },
  navigate(path) {
    location.hash = `#/${path}`;
  },
  setUser(user) {
    this.user = user;
    renderShell();
  },
};

let els = {};
let cleanup = null;
let lastHash = location.hash;

/* ---------- boot ---------- */
async function boot() {
  applyLang();
  try {
    ctx.user = await api.get("/api/admin/me");
    renderShell();
  } catch (err) {
    if (err.status === 401) renderLogin();
    else app.replaceChildren(h("div", { class: "boot" }, emptyState("alert", t("errGeneric"), errorMessage(err))));
  }
}

function applyLang() {
  const lang = getLang();
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "fa" ? "rtl" : "ltr";
}

window.addEventListener("auth:required", () => {
  if (!ctx.user) return;
  ctx.user = null;
  ctx.dirty = false;
  toast(t("sessionExpired"), "error");
  renderLogin();
});

window.addEventListener("beforeunload", (e) => {
  if (ctx.dirty) {
    e.preventDefault();
    e.returnValue = "";
  }
});

function renderLogin() {
  runCleanup();
  document.title = `${t("loginTitle")} · Venice`;
  app.replaceChildren(
    loginView.render({
      onLangChange: changeLang,
      onSuccess: (user) => {
        ctx.user = user;
        if (!location.hash) location.hash = "#/";
        renderShell();
      },
    })
  );
}

async function changeLang(lang) {
  if (lang === getLang()) return;
  if (ctx.dirty && !(await confirmLeave())) {
    // Put the switch back without re-rendering the page (keeps unsaved edits).
    const current = els.sidebar && els.sidebar.querySelector(".sidebar__footer .segmented");
    if (current) current.replaceWith(els.langSwitch());
    return;
  }
  ctx.dirty = false;
  setLang(lang);
  applyLang();
  if (ctx.user) renderShell();
  else renderLogin();
}

/* ---------- shell ---------- */
function renderShell() {
  const langSwitch = () =>
    segmented(
      [
        { value: "fa", label: "فارسی" },
        { value: "en", label: "English" },
      ],
      getLang(),
      changeLang
    );

  const navLinks = NAV.map((item) =>
    item.sep
      ? h("div", { class: "nav-sep", role: "presentation" })
      : h("a", { class: "nav-link", href: `#/${item.path}`, dataset: { path: item.path } }, icon(item.icon), t(item.label))
  );

  const sidebar = h(
    "aside",
    { class: "sidebar", id: "sidebar" },
    h(
      "div",
      { class: "sidebar__brand" },
      h("span", { class: "mono mono--sm", "aria-hidden": "true" }, h("span", {}, "V")),
      h("div", {}, h("strong", {}, t("brandName")), h("small", {}, t("adminPanel")))
    ),
    h("nav", { class: "sidebar__nav", "aria-label": t("adminPanel") }, navLinks),
    h(
      "div",
      { class: "sidebar__footer" },
      h("a", { class: "nav-link", href: "/", target: "_blank", rel: "noopener" }, icon("external"), t("viewSite")),
      langSwitch(),
      h(
        "div",
        { class: "user-row" },
        h("span", { class: "user-row__avatar", "aria-hidden": "true" }, (ctx.user.username || "?").slice(0, 1)),
        h("span", { class: "user-row__name ltr" }, ctx.user.username),
        iconButton("logout", t("logout"), logout)
      )
    )
  );

  const title = h("span", { class: "topbar__title" });
  const topbar = h(
    "header",
    { class: "topbar" },
    iconButton("burger", t("openMenu"), () => els.shell.classList.add("is-drawer-open")),
    title,
    h("a", { class: "icon-btn", href: "/", target: "_blank", rel: "noopener", "aria-label": t("viewSite"), title: t("viewSite") }, icon("external"))
  );

  const main = h("main", { class: "main", id: "main", tabindex: "-1" });
  const backdrop = h("div", { class: "backdrop", onClick: () => els.shell.classList.remove("is-drawer-open") });
  const shell = h("div", { class: "shell" }, sidebar, backdrop, topbar, main);

  els = { shell, main, title, sidebar, langSwitch };
  app.replaceChildren(shell);
  lastHash = location.hash;
  route(true);
}

async function logout() {
  if (ctx.dirty && !(await confirmLeave())) return;
  ctx.dirty = false;
  try {
    await api.post("/api/admin/logout");
  } catch {
    /* ignore */
  }
  ctx.user = null;
  renderLogin();
}

/* ---------- router ---------- */
function confirmLeave() {
  return confirmDialog({ title: t("unsavedTitle"), message: t("unsavedMessage"), confirmLabel: t("leaveWithoutSaving"), danger: true });
}

function runCleanup() {
  if (typeof cleanup === "function") cleanup();
  cleanup = null;
}

window.addEventListener("hashchange", () => {
  if (ctx.user && els.main) route();
});

async function route(force = false) {
  if (!force && location.hash === lastHash) return;
  if (!force && ctx.dirty) {
    const target = location.hash;
    history.replaceState(null, "", lastHash || "#/");
    if (!(await confirmLeave())) return;
    ctx.dirty = false;
    history.replaceState(null, "", target);
  }
  lastHash = location.hash;

  const path = location.hash.replace(/^#\/?/, "").split("?")[0];
  const view = ROUTES[path] || dashboardView;
  const activePath = ROUTES[path] ? path : "";

  els.sidebar.querySelectorAll(".nav-link[data-path]").forEach((a) => {
    const on = a.dataset.path === activePath;
    a.classList.toggle("is-active", on);
    if (on) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  els.shell.classList.remove("is-drawer-open");
  els.title.textContent = view.title();
  document.title = `${view.title()} · ${t("adminPanel")}`;

  runCleanup();
  ctx.dirty = false;
  els.main.replaceChildren(h("div", { class: "loading" }, h("div", { class: "spinner" })));
  window.scrollTo(0, 0);

  const container = h("div", {});
  try {
    cleanup = await view.render(container, ctx);
    if (lastHash !== location.hash) return; // user navigated away while loading
    els.main.replaceChildren(container);
  } catch (err) {
    console.error(err);
    els.main.replaceChildren(emptyState("alert", t("errGeneric"), errorMessage(err)));
  }
}

boot();
