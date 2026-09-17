import { t, getLang } from "../i18n.js";
import { api } from "../api.js";
import {
  h, icon, pageHead, button, iconButton, field, switchControl, modal, confirmDialog, toast, errorMessage,
  emptyState, fmtNumber, fmtDate, formatBirthday, localDigits, toLatinDigits, downloadFile, debounce,
} from "../ui.js";

const PAGE_SIZE = 50;

/** Today's month/day in both calendars (cafe time zone). */
export function todayParts() {
  const parts = (cal) => {
    const p = new Intl.DateTimeFormat(`en-u-ca-${cal}-nu-latn`, { timeZone: "Asia/Tehran", month: "numeric", day: "numeric" }).formatToParts(new Date());
    return { m: Number(p.find((x) => x.type === "month").value), d: Number(p.find((x) => x.type === "day").value) };
  };
  return { jalali: parts("persian"), gregorian: parts("gregory") };
}

export function birthdayMatches(b, scope, now) {
  if (!b) return false;
  const tday = now[b.cal];
  return scope === "month" ? b.m === tday.m : b.m === tday.m && b.d === tday.d;
}

const normalize = (s) => toLatinDigits(s).toLowerCase().replace(/[يى]/g, "ی").replace(/ك/g, "ک").replace(/[\s‌]/g, "");

export default {
  title: () => t("navCustomers"),

  async render(root, ctx) {
    let customers = await api.get("/api/admin/customers");
    let query = "";
    let filter = "all";
    let page = 0;
    const selected = new Set();
    const now = todayParts();

    const FILTERS = {
      all: () => true,
      optedIn: (c) => c.smsOptIn,
      optedOut: (c) => !c.smsOptIn,
      birthdayToday: (c) => birthdayMatches(c.birthday, "day", now),
      birthdayMonth: (c) => birthdayMatches(c.birthday, "month", now),
      fromMenu: (c) => c.source === "menu",
      fromAdmin: (c) => c.source === "admin",
    };

    const filtered = () => {
      const q = normalize(query);
      return customers
        .filter(FILTERS[filter])
        .filter((c) => !q || normalize(`${c.name} ${c.phone} ${c.note || ""}`).includes(q))
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    };

    /* ---------- containers ---------- */
    const statsEl = h("div", { class: "mini-stats" });
    const tableCard = h("section", { class: "card" });

    function renderStats() {
      const weekAgo = Date.now() - 7 * 86400_000;
      const stat = (n, label) => h("span", { class: "mini-stat" }, h("b", {}, fmtNumber(n)), label);
      statsEl.replaceChildren(
        stat(customers.length, t("statMembers")),
        stat(customers.filter((c) => c.smsOptIn).length, t("filter_optedIn")),
        stat(customers.filter((c) => Date.parse(c.createdAt) >= weekAgo).length, t("newThisWeek")),
        stat(customers.filter(FILTERS.birthdayMonth).length, t("filter_birthdayMonth"))
      );
    }

    function renderTable() {
      const list = filtered();
      const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
      page = Math.min(page, pages - 1);
      const rows = list.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

      if (!customers.length) {
        tableCard.replaceChildren(emptyState("users", t("noCustomers"), t("noCustomersText")));
        return;
      }

      const allChecked = list.length > 0 && list.every((c) => selected.has(c.id));
      const headCheck = h("input", {
        type: "checkbox",
        checked: allChecked,
        indeterminate: !allChecked && list.some((c) => selected.has(c.id)),
        "aria-label": t("selectAll"),
        onChange: (e) => {
          list.forEach((c) => (e.target.checked ? selected.add(c.id) : selected.delete(c.id)));
          renderTable();
        },
      });

      const selectionBar =
        selected.size > 0 &&
        h(
          "div",
          { class: "selection-bar" },
          h("span", {}, t("selectedCount", { n: fmtNumber(selected.size) })),
          button(t("sendSmsSelected"), {
            size: "sm",
            variant: "primary",
            iconName: "send",
            onClick: () => {
              ctx.state.smsSelected = [...selected];
              ctx.navigate("sms");
            },
          }),
          button(t("clearSelection"), { size: "sm", variant: "ghost", onClick: () => { selected.clear(); renderTable(); } })
        );

      const body = rows.length
        ? h(
            "div",
            { class: "table-wrap" },
            h(
              "table",
              { class: "table table--cards" },
              h(
                "thead",
                {},
                h(
                  "tr",
                  {},
                  h("th", { class: "col-check" }, headCheck),
                  h("th", {}, t("name")),
                  h("th", {}, t("mobile")),
                  h("th", {}, t("birthday")),
                  h("th", {}, t("joined")),
                  h("th", {}, t("smsOptIn")),
                  h("th", { class: "col-actions" }, h("span", { class: "sr-only" }, t("actions")))
                )
              ),
              h("tbody", {}, rows.map(rowEl))
            )
          )
        : emptyState("search", t("noResults"), t("noResultsText"));

      const pager =
        list.length > PAGE_SIZE &&
        h(
          "div",
          { class: "pager" },
          h(
            "span",
            {},
            t("pageRange", {
              from: fmtNumber(page * PAGE_SIZE + 1),
              to: fmtNumber(Math.min(list.length, (page + 1) * PAGE_SIZE)),
              total: fmtNumber(list.length),
            })
          ),
          h(
            "div",
            { class: "pager__buttons" },
            button(t("previous"), { size: "sm", disabled: page === 0, onClick: () => { page--; renderTable(); } }),
            button(t("next"), { size: "sm", disabled: page >= pages - 1, onClick: () => { page++; renderTable(); } })
          )
        );

      tableCard.replaceChildren(selectionBar || "", body, pager || "");
    }

    function rowEl(c) {
      const check = h("input", {
        type: "checkbox",
        checked: selected.has(c.id),
        "aria-label": t("selectCustomer", { name: c.name }),
        onChange: (e) => {
          if (e.target.checked) selected.add(c.id);
          else selected.delete(c.id);
          renderTable();
        },
      });

      const sms = switchControl({
        checked: c.smsOptIn,
        ariaLabel: t("smsOptIn"),
        onChange: async (on) => {
          try {
            Object.assign(c, await api.put(`/api/admin/customers/${c.id}`, { smsOptIn: on }));
            renderStats();
          } catch (err) {
            sms.querySelector("input").checked = !on;
            toast(errorMessage(err), "error");
          }
        },
      });

      return h(
        "tr",
        {},
        h("td", { class: "col-check" }, check),
        h("td", { class: "cell-name" }, h("strong", {}, c.name), c.note ? h("span", { title: c.note }, c.note) : null),
        h("td", { "data-label": t("mobile") }, h("span", { class: "ltr nowrap" }, localDigits(c.phone))),
        h("td", { "data-label": t("birthday") }, formatBirthday(c.birthday)),
        h(
          "td",
          { "data-label": t("joined") },
          h("span", { class: "nowrap" }, fmtDate(c.createdAt)),
          " ",
          h("span", { class: `badge ${c.source === "menu" ? "badge--brand" : ""}` }, t(`source_${c.source}`))
        ),
        h("td", { "data-label": t("smsOptIn") }, sms),
        h(
          "td",
          { class: "col-actions" },
          iconButton("edit", t("edit"), () => openCustomer(c)),
          iconButton(
            "trash",
            t("delete"),
            async () => {
              const ok = await confirmDialog({ title: t("deleteCustomer"), message: t("deleteCustomerConfirm", { name: c.name }), confirmLabel: t("delete"), danger: true });
              if (!ok) return;
              try {
                await api.del(`/api/admin/customers/${c.id}`);
                customers = customers.filter((x) => x.id !== c.id);
                selected.delete(c.id);
                renderStats();
                renderTable();
                toast(t("deleted"));
              } catch (err) {
                toast(errorMessage(err), "error");
              }
            },
            { danger: true }
          )
        )
      );
    }

    /* ---------- add / edit dialog ---------- */
    function openCustomer(existing) {
      const data = {
        name: existing ? existing.name : "",
        phone: existing ? existing.phone : "",
        smsOptIn: existing ? existing.smsOptIn : true,
        note: existing ? existing.note || "" : "",
        cal: existing && existing.birthday ? existing.birthday.cal : getLang() === "fa" ? "jalali" : "gregorian",
        m: existing && existing.birthday ? String(existing.birthday.m) : "",
        d: existing && existing.birthday ? String(existing.birthday.d) : "",
      };

      const name = h("input", { class: "input", maxlength: 60, value: data.name, onInput: (e) => (data.name = e.target.value) });
      const phone = h("input", { class: "input ltr", dir: "ltr", type: "tel", maxlength: 16, value: data.phone, placeholder: "09xx xxx xxxx", onInput: (e) => (data.phone = e.target.value) });
      const note = h("textarea", { class: "textarea", maxlength: 300, rows: 3, onInput: (e) => (data.note = e.target.value) });
      note.value = data.note;

      const day = h("select", { class: "select", "aria-label": t("day"), onChange: (e) => (data.d = e.target.value) });
      const month = h("select", { class: "select", "aria-label": t("month"), onChange: (e) => (data.m = e.target.value) });
      const fillDates = () => {
        day.replaceChildren(h("option", { value: "" }, t("day")), ...Array.from({ length: 31 }, (_, i) => h("option", { value: i + 1, selected: String(i + 1) === data.d }, localDigits(i + 1))));
        const names = data.cal === "gregorian" ? t("monthsGregorian") : t("monthsJalali");
        month.replaceChildren(h("option", { value: "" }, t("month")), ...names.map((n, i) => h("option", { value: i + 1, selected: String(i + 1) === data.m }, n)));
      };
      const cal = h(
        "select",
        {
          class: "select",
          "aria-label": t("calendar"),
          onChange: (e) => {
            data.cal = e.target.value;
            data.m = "";
            data.d = "";
            fillDates();
          },
        },
        h("option", { value: "jalali", selected: data.cal === "jalali" }, t("calJalali")),
        h("option", { value: "gregorian", selected: data.cal === "gregorian" }, t("calGregorian"))
      );
      fillDates();

      const optIn = switchControl({ checked: data.smsOptIn, label: t("smsOptInLabel"), onChange: (v) => (data.smsOptIn = v) });

      modal({
        title: existing ? t("editCustomer") : t("addCustomer"),
        body: h(
          "div",
          { class: "form-stack" },
          h("div", { class: "grid-2" }, field(t("name"), name), field(t("mobile"), phone)),
          h(
            "div",
            { class: "field" },
            h("span", { class: "field__label" }, `${t("birthday")} ${t("optional")}`),
            h("div", { style: { display: "grid", gridTemplateColumns: "1.1fr 0.8fr 1.1fr", gap: "8px" } }, cal, day, month)
          ),
          field(t("note"), note, t("noteHint")),
          optIn
        ),
        actions: [
          { label: t("cancel") },
          {
            label: existing ? t("saveChanges") : t("add"),
            variant: "primary",
            onClick: async () => {
              [name, phone].forEach((el) => el.removeAttribute("aria-invalid"));
              const payload = {
                name: data.name,
                phone: data.phone,
                smsOptIn: data.smsOptIn,
                note: data.note,
                birthday: data.m && data.d ? { cal: data.cal, m: Number(data.m), d: Number(data.d) } : null,
              };
              try {
                const res = existing
                  ? await api.put(`/api/admin/customers/${existing.id}`, payload)
                  : await api.post("/api/admin/customers", payload);
                if (existing) Object.assign(existing, res);
                else customers.push(res);
                renderStats();
                renderTable();
                toast(t("saved"));
              } catch (err) {
                const target = err.field === "phone" ? phone : err.field === "name" ? name : null;
                if (target) {
                  target.setAttribute("aria-invalid", "true");
                  target.focus();
                }
                toast(errorMessage(err), "error");
                return false;
              }
            },
          },
        ],
      });
    }

    /* ---------- CSV ---------- */
    function exportCsv() {
      const cell = (v) => {
        let s = String(v ?? "");
        if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // spreadsheet formula injection guard
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const header = [t("name"), t("mobile"), t("birthday"), t("smsOptIn"), t("source"), t("joined"), t("note")];
      const lines = filtered().map((c) =>
        [c.name, c.phone, formatBirthday(c.birthday).replace("—", ""), c.smsOptIn ? t("yes") : t("no"), t(`source_${c.source}`), fmtDate(c.createdAt), c.note || ""].map(cell).join(",")
      );
      const stamp = new Date().toISOString().slice(0, 10);
      downloadFile(`customers-${stamp}.csv`, "﻿" + [header.map(cell).join(","), ...lines].join("\r\n"), "text/csv;charset=utf-8");
    }

    /* ---------- layout ---------- */
    const search = h("input", { class: "input", type: "search", placeholder: t("searchCustomers"), "aria-label": t("searchCustomers") });
    search.addEventListener(
      "input",
      debounce(() => {
        query = search.value;
        page = 0;
        renderTable();
      }, 150)
    );

    const filterSel = h(
      "select",
      {
        class: "select",
        style: { width: "auto" },
        "aria-label": t("filter"),
        onChange: (e) => {
          filter = e.target.value;
          page = 0;
          renderTable();
        },
      },
      Object.keys(FILTERS).map((k) => h("option", { value: k }, t(`filter_${k}`)))
    );

    root.append(
      pageHead(
        t("navCustomers"),
        t("customersSubtitle"),
        button(t("exportCsv"), { iconName: "download", onClick: exportCsv }),
        button(t("addCustomer"), { variant: "primary", iconName: "userPlus", onClick: () => openCustomer(null) })
      ),
      statsEl,
      h("div", { class: "toolbar" }, h("div", { class: "input-icon" }, icon("search"), search), filterSel),
      tableCard
    );

    renderStats();
    renderTable();
  },
};
