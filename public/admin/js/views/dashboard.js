import { t } from "../i18n.js";
import { api } from "../api.js";
import { h, icon, pageHead, fmtNumber } from "../ui.js";

export default {
  title: () => t("navDashboard"),

  async render(root, ctx) {
    const o = await api.get("/api/admin/overview");

    const stat = (iconName, value, label, sub, badge) =>
      h(
        "div",
        { class: "card stat" },
        h("div", { class: "stat__top" }, h("span", { class: "stat__icon" }, icon(iconName)), badge || null),
        h("div", {}, h("div", { class: "stat__value" }, value), h("div", { class: "stat__label" }, label)),
        sub ? h("div", { class: "stat__sub" }, sub) : null
      );

    const quick = (href, iconName, title, text) =>
      h("a", { class: "card", href }, h("span", { class: "quick__icon" }, icon(iconName)), h("div", {}, h("strong", {}, title), h("span", {}, text)));

    const parts = [
      pageHead(t("welcome", { name: ctx.user.username }), t("dashboardSubtitle")),

      !o.smsConfigured &&
        h(
          "div",
          { class: "notice notice--info", style: { marginBottom: "20px" } },
          icon("plug"),
          h("div", { class: "notice__body" }, h("strong", {}, t("smsNotConnectedTitle")), h("p", {}, t("smsNotConnectedText"))),
          h("a", { class: "btn btn--sm", href: "#/settings" }, t("connect"))
        ),

      h(
        "div",
        { class: "stats" },
        stat("list", fmtNumber(o.items), t("statItems"), o.hiddenItems ? t("statHidden", { n: fmtNumber(o.hiddenItems) }) : t("statCategories", { n: fmtNumber(o.categories) })),
        stat("users", fmtNumber(o.customers), t("statMembers"), t("statNewWeek", { n: fmtNumber(o.newThisWeek) }), !o.clubEnabled && h("span", { class: "badge badge--warning" }, t("clubOff"))),
        stat("cake", fmtNumber(o.birthdaysToday), t("statBirthdays"), t("statOptedIn", { n: fmtNumber(o.optedIn) })),
        stat(
          "message",
          fmtNumber(o.smsSent),
          t("statSmsSent"),
          null,
          h("span", { class: `badge ${o.smsConfigured ? "badge--success" : "badge--warning"}` }, o.smsConfigured ? t("connected") : t("notConnected"))
        )
      ),

      h("h2", { class: "section-title" }, t("quickActions")),
      h(
        "div",
        { class: "quick" },
        quick("#/menu", "list", t("quickMenu"), t("quickMenuText")),
        quick("#/theme", "palette", t("quickTheme"), t("quickThemeText")),
        quick("#/customers", "users", t("quickCustomers"), t("quickCustomersText")),
        quick("#/sms", "send", t("quickSms"), t("quickSmsText"))
      ),
    ];
    root.append(...parts.filter(Boolean));
  },
};
