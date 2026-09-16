import { t, getLang } from "../i18n.js";
import { api } from "../api.js";
import {
  h, icon, categoryIcon, CATEGORY_ICONS, pageHead, button, iconButton, field, biField, switchControl,
  modal, confirmDialog, toast, errorMessage, emptyState, fmtNumber, fmtDate, toLatinDigits, withBusy,
} from "../ui.js";

const TAGS = ["signature", "new", "popular"];

/** Canonical form — mirrors the server validation, used for change detection and saving. */
function clean(categories) {
  const pair = (o) => ({ en: (o && o.en) || "", fa: (o && o.fa) || "" });
  const filled = (o) => o && ((o.en || "").trim() || (o.fa || "").trim());
  return categories.map((c) => {
    const out = { id: c.id, icon: c.icon, title: pair(c.title) };
    if (filled(c.short)) out.short = pair(c.short);
    out.items = c.items.map((i) => {
      const item = { name: pair(i.name), price: i.price ?? null };
      if (filled(i.desc)) item.desc = pair(i.desc);
      if (i.tag) item.tag = i.tag;
      if (i.hidden) item.hidden = true;
      return item;
    });
    return out;
  });
}

const slug = (s) =>
  String(s || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

const normalize = (s) =>
  toLatinDigits(s).toLowerCase().replace(/[يى]/g, "ی").replace(/ك/g, "ک").replace(/‌/g, "");

export default {
  title: () => t("navMenu"),

  async render(root, ctx) {
    const menu = await api.get("/api/admin/menu");
    let saved = JSON.stringify(clean(menu.categories));
    let draft = structuredClone(menu.categories);
    let open = new Set(draft.length ? [draft[0]] : []);
    let query = "";
    const lang = getLang();
    const other = lang === "fa" ? "en" : "fa";

    const titleOf = (o) => (o && (o[lang] || o[other])) || "";

    /* ---------- dirty state ---------- */
    const savebar = h("div", { class: "savebar", hidden: true, role: "region", "aria-label": t("unsavedChanges") });
    const saveBtn = button(t("saveChanges"), { variant: "accent", iconName: "check", size: "sm" });
    const discardBtn = button(t("discard"), { variant: "ghost", size: "sm" });
    savebar.append(h("span", { class: "savebar__text" }, h("span", { class: "savebar__dot" }), t("unsavedChanges")), discardBtn, saveBtn);

    function markDirty() {
      const dirty = JSON.stringify(clean(draft)) !== saved;
      ctx.setDirty(dirty);
      savebar.hidden = !dirty;
    }

    /* ---------- list ---------- */
    const listEl = h("div", { class: "cat-list" });

    function renderList(focus) {
      if (!draft.length) {
        listEl.replaceChildren(h("div", { class: "card" }, emptyState("list", t("noCategories"), t("noCategoriesText"))));
        return;
      }
      listEl.replaceChildren(...draft.map((cat, ci) => categoryCard(cat, ci)));
      applySearch();
      if (focus) {
        const el = listEl.querySelector(focus);
        if (el) {
          el.focus();
          if (el.scrollIntoView) el.scrollIntoView({ block: "nearest" });
        }
      }
    }

    function categoryCard(cat, ci) {
      const isOpen = open.has(cat) || Boolean(query);
      const hiddenCount = cat.items.filter((i) => i.hidden).length;

      const body = h("div", { class: "cat-card__body", hidden: !isOpen });
      const card = h("section", { class: `card cat-card${isOpen ? " is-open" : ""}`, dataset: { ci } });

      const toggle = h(
        "button",
        { type: "button", class: "cat-card__toggle", "aria-expanded": String(isOpen) },
        h("span", { class: "cat-card__icon" }, categoryIcon(cat.icon)),
        h(
          "span",
          { class: "cat-card__titles" },
          h("strong", {}, titleOf(cat.title) || t("untitled")),
          h(
            "span",
            {},
            [cat.title[other], t("itemsCount", { n: fmtNumber(cat.items.length) }), hiddenCount ? t("hiddenCount", { n: fmtNumber(hiddenCount) }) : ""]
              .filter(Boolean)
              .join(" · ")
          )
        ),
        icon("down", "i cat-card__chevron")
      );
      toggle.addEventListener("click", () => {
        const now = !card.classList.contains("is-open");
        if (now) open.add(cat);
        else open.delete(cat);
        card.classList.toggle("is-open", now);
        body.hidden = !now;
        toggle.setAttribute("aria-expanded", String(now));
      });

      const moveCat = (dir) => {
        const to = ci + dir;
        [draft[ci], draft[to]] = [draft[to], draft[ci]];
        renderList(`.cat-card[data-ci="${to}"] [data-move="${dir}"]`);
        markDirty();
      };

      const up = iconButton("up", t("moveUp"), () => moveCat(-1), { disabled: ci === 0 });
      up.dataset.move = "-1";
      const down = iconButton("down", t("moveDown"), () => moveCat(1), { disabled: ci === draft.length - 1 });
      down.dataset.move = "1";

      const actions = h(
        "div",
        { class: "cat-card__actions" },
        up,
        down,
        iconButton("edit", t("editCategory"), () => openCategoryModal(cat)),
        iconButton(
          "trash",
          t("deleteCategory"),
          async () => {
            const ok = await confirmDialog({
              title: t("deleteCategory"),
              message: t("deleteCategoryConfirm", { name: titleOf(cat.title), n: fmtNumber(cat.items.length) }),
              confirmLabel: t("delete"),
              danger: true,
            });
            if (!ok) return;
            draft.splice(ci, 1);
            renderList();
            markDirty();
          },
          { danger: true }
        )
      );

      body.append(
        h(
          "div",
          { class: "item-head", "aria-hidden": "true" },
          h("span"),
          h("span", {}, t("nameFa")),
          h("span", {}, t("nameEn")),
          h("span", {}, t("price")),
          h("span", {}, t("badge")),
          h("span", {}, t("visible")),
          h("span")
        ),
        ...cat.items.map((item, ii) => itemRow(cat, ci, item, ii)),
        h(
          "div",
          { class: "cat-card__add" },
          button(t("addItem"), {
            iconName: "plus",
            size: "sm",
            onClick: () => {
              cat.items.push({ name: { fa: "", en: "" }, price: null });
              open.add(cat);
              renderList(`.item-row[data-ci="${ci}"][data-ii="${cat.items.length - 1}"] [name="name.fa"]`);
              markDirty();
            },
          })
        )
      );

      card.append(h("div", { class: "cat-card__head" }, toggle, actions), body);
      return card;
    }

    function itemRow(cat, ci, item, ii) {
      const row = h("div", { class: `item-row${item.hidden ? " is-hidden" : ""}`, dataset: { ci, ii } });
      row.dataset.search = normalize([item.name.fa, item.name.en, item.desc && item.desc.fa, item.desc && item.desc.en].join(" "));

      const cell = (cls, label, control) => h("div", { class: cls }, h("span", { class: "mobile-label" }, label), control);

      const text = (lang, path, max, label) => {
        const [key, sub] = path.split(".");
        return h("input", {
          class: "input",
          dir: lang === "fa" ? "rtl" : "ltr",
          lang,
          name: path,
          maxlength: max,
          value: (item[key] && item[key][sub]) || "",
          "aria-label": label,
          onInput: (e) => {
            item[key] = item[key] || { fa: "", en: "" };
            item[key][sub] = e.target.value;
            e.target.removeAttribute("aria-invalid");
            markDirty();
          },
        });
      };

      const price = h("input", {
        class: "input price-input ltr",
        dir: "ltr",
        name: "price",
        inputmode: "decimal",
        autocomplete: "off",
        placeholder: t("dailyPrice"),
        value: item.price == null ? "" : String(item.price),
        "aria-label": t("price"),
        onInput: (e) => {
          const raw = toLatinDigits(e.target.value).replace(/[,\s٬]/g, "");
          if (raw === "") {
            item.price = null;
            e.target.removeAttribute("aria-invalid");
          } else if (/^\d+(\.\d+)?$/.test(raw)) {
            item.price = Number(raw);
            e.target.removeAttribute("aria-invalid");
          } else {
            e.target.setAttribute("aria-invalid", "true");
          }
          markDirty();
        },
      });

      const tag = h(
        "select",
        {
          class: "select",
          name: "tag",
          "aria-label": t("badge"),
          onChange: (e) => {
            if (e.target.value) item.tag = e.target.value;
            else delete item.tag;
            markDirty();
          },
        },
        h("option", { value: "" }, t("tagNone")),
        TAGS.map((tg) => h("option", { value: tg, selected: item.tag === tg }, t(`tag_${tg}`)))
      );

      const visible = switchControl({
        checked: !item.hidden,
        ariaLabel: t("visible"),
        onChange: (on) => {
          if (on) delete item.hidden;
          else item.hidden = true;
          row.classList.toggle("is-hidden", !on);
          markDirty();
        },
      });

      const hasDesc = Boolean(item.desc && (item.desc.fa || item.desc.en));
      const details = h(
        "div",
        { class: "item-details", hidden: !hasDesc },
        h("div", {}, h("span", { class: "mobile-label" }, t("descFa")), text("fa", "desc.fa", 160, t("descFa"))),
        h("div", {}, h("span", { class: "mobile-label" }, t("descEn")), text("en", "desc.en", 160, t("descEn")))
      );
      details.querySelector('[name="desc.fa"]').placeholder = t("descFa");
      details.querySelector('[name="desc.en"]').placeholder = t("descEn");

      const detailsBtn = iconButton("more", t("description"), () => {
        details.hidden = !details.hidden;
        detailsBtn.setAttribute("aria-expanded", String(!details.hidden));
        if (!details.hidden) details.querySelector("input").focus();
      });
      detailsBtn.setAttribute("aria-expanded", String(hasDesc));
      if (hasDesc) detailsBtn.classList.add("is-on");

      const moveItem = (dir) => {
        const to = ii + dir;
        [cat.items[ii], cat.items[to]] = [cat.items[to], cat.items[ii]];
        renderList(`.item-row[data-ci="${ci}"][data-ii="${to}"] [data-move="${dir}"]`);
        markDirty();
      };
      const up = iconButton("up", t("moveUp"), () => moveItem(-1), { disabled: ii === 0 });
      up.dataset.move = "-1";
      const down = iconButton("down", t("moveDown"), () => moveItem(1), { disabled: ii === cat.items.length - 1 });
      down.dataset.move = "1";

      row.append(
        h("div", { class: "move" }, up, down),
        cell("f-fa", t("nameFa"), text("fa", "name.fa", 80, t("nameFa"))),
        cell("f-en", t("nameEn"), text("en", "name.en", 80, t("nameEn"))),
        cell("f-price", t("price"), price),
        cell("f-tag", t("badge"), tag),
        cell("f-vis", t("visible"), visible),
        h(
          "div",
          { class: "item-row__actions" },
          detailsBtn,
          iconButton(
            "trash",
            t("deleteItem"),
            () => {
              cat.items.splice(ii, 1);
              renderList();
              markDirty();
              toast(t("itemRemoved"));
            },
            { danger: true }
          )
        ),
        details
      );
      return row;
    }

    function applySearch() {
      const q = normalize(query.trim());
      listEl.querySelectorAll(".cat-card").forEach((card) => {
        const cat = draft[Number(card.dataset.ci)];
        const titleHit = q && normalize(`${cat.title.fa} ${cat.title.en}`).includes(q);
        let hits = 0;
        card.querySelectorAll(".item-row").forEach((row) => {
          const hit = !q || titleHit || row.dataset.search.includes(q);
          row.classList.toggle("is-match-none", !hit);
          if (hit) hits++;
        });
        card.hidden = Boolean(q) && !titleHit && hits === 0;
      });
    }

    /* ---------- category dialog ---------- */
    function openCategoryModal(cat) {
      const isNew = !cat;
      const data = {
        title: structuredClone((cat && cat.title) || { fa: "", en: "" }),
        short: structuredClone((cat && cat.short) || { fa: "", en: "" }),
        icon: (cat && cat.icon) || "espresso",
      };
      const idInput = h("input", { class: "input ltr", dir: "ltr", maxlength: 40, value: (cat && cat.id) || "", placeholder: "hot-drinks" });

      const picker = h(
        "div",
        { class: "icon-picker", role: "radiogroup", "aria-label": t("icon") },
        Object.keys(CATEGORY_ICONS).map((name) =>
          h(
            "label",
            { title: name },
            h("input", { type: "radio", name: "cat-icon", value: name, checked: data.icon === name, onChange: () => (data.icon = name) }),
            h("span", {}, categoryIcon(name))
          )
        )
      );

      modal({
        title: isNew ? t("addCategory") : t("editCategory"),
        body: h(
          "div",
          { class: "form-stack" },
          biField(t("categoryTitle"), data, "title", { max: 60 }),
          biField(t("categoryShort"), data, "short", { max: 30, hint: t("categoryShortHint") }),
          h("div", { class: "field" }, h("span", { class: "field__label" }, t("icon")), picker),
          field(t("categoryId"), idInput, t("categoryIdHint"))
        ),
        actions: [
          { label: t("cancel") },
          {
            label: isNew ? t("add") : t("apply"),
            variant: "primary",
            onClick: () => {
              if (!data.title.fa.trim() && !data.title.en.trim()) {
                toast(t("errTitleRequired"), "error");
                return false;
              }
              let id = slug(idInput.value) || slug(data.title.en) || (cat && cat.id) || `category-${Date.now().toString(36)}`;
              const taken = new Set(draft.filter((c) => c !== cat).map((c) => c.id));
              const base = id;
              for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;

              if (isNew) {
                const created = { id, icon: data.icon, title: data.title, short: data.short, items: [] };
                draft.push(created);
                open.add(created);
                renderList(`.cat-card[data-ci="${draft.length - 1}"] .cat-card__add button`);
              } else {
                Object.assign(cat, { id, icon: data.icon, title: data.title, short: data.short });
                renderList();
              }
              markDirty();
            },
          },
        ],
      });
    }

    /* ---------- bulk price change ---------- */
    function openAdjust() {
      const pct = h("input", { class: "input ltr", dir: "ltr", inputmode: "decimal", placeholder: "10", autocomplete: "off" });
      const step = h(
        "select",
        { class: "select" },
        [1, 5, 10, 50, 100, 1000].map((s) => h("option", { value: s }, s === 1 ? t("roundWhole") : t("roundTo", { n: fmtNumber(s) })))
      );
      const scope = h(
        "select",
        { class: "select" },
        h("option", { value: "all" }, t("allCategories")),
        draft.map((c, i) => h("option", { value: i }, titleOf(c.title)))
      );
      const preview = h("div", { class: "preview-line" }, t("adjustHint"));

      const compute = () => {
        const p = Number(toLatinDigits(pct.value).replace(/[%\s]/g, ""));
        if (!Number.isFinite(p) || p === 0 || p <= -100) return null;
        const s = Number(step.value);
        const cats = scope.value === "all" ? draft : [draft[Number(scope.value)]];
        return cats
          .flatMap((c) => c.items)
          .filter((i) => typeof i.price === "number")
          .map((i) => [i, Math.max(0, Math.round((i.price * (1 + p / 100)) / s) * s)])
          .filter(([i, next]) => next !== i.price);
      };

      const update = () => {
        const changes = compute();
        if (!changes) return preview.replaceChildren(t("adjustHint"));
        if (!changes.length) return preview.replaceChildren(t("adjustNothing"));
        const [item, next] = changes[0];
        preview.replaceChildren(
          h("strong", {}, t("adjustPreview", { n: fmtNumber(changes.length) })),
          h("br"),
          `${titleOf(item.name)}: ${fmtNumber(item.price)} → ${fmtNumber(next)}`
        );
      };
      [pct, step, scope].forEach((el) => el.addEventListener("input", update));

      modal({
        title: t("adjustPrices"),
        body: h(
          "div",
          { class: "form-stack" },
          h("p", { class: "muted", style: { margin: 0 } }, t("adjustText")),
          field(t("adjustPercent"), pct, t("adjustPercentHint")),
          h("div", { class: "grid-2" }, field(t("rounding"), step), field(t("applyTo"), scope)),
          preview
        ),
        actions: [
          { label: t("cancel") },
          {
            label: t("apply"),
            variant: "primary",
            icon: "percent",
            onClick: () => {
              const changes = compute();
              if (!changes || !changes.length) {
                toast(t("adjustNothing"), "error");
                return false;
              }
              changes.forEach(([item, next]) => (item.price = next));
              renderList();
              markDirty();
              toast(t("adjustApplied", { n: fmtNumber(changes.length) }));
            },
          },
        ],
      });
    }

    /* ---------- history ---------- */
    async function openHistory() {
      const backups = await api.get("/api/admin/menu/backups");
      const body = backups.length
        ? h(
            "div",
            { class: "form-stack" },
            h("p", {}, t("historyText")),
            h(
              "ul",
              { class: "backup-list" },
              backups.map((b) =>
                h(
                  "li",
                  {},
                  h("span", {}, fmtDate(b.date, true)),
                  button(t("restore"), {
                    size: "sm",
                    iconName: "history",
                    onClick: async (e) => {
                      const btn = e.currentTarget;
                      const ok = await confirmDialog({ title: t("restore"), message: t("restoreConfirm"), confirmLabel: t("restore"), danger: true });
                      if (!ok) return;
                      await withBusy(btn, async () => {
                        try {
                          const res = await api.post("/api/admin/menu/restore", { file: b.file });
                          adopt(res.categories);
                          m.close();
                          toast(t("restored"));
                        } catch (err) {
                          toast(errorMessage(err), "error");
                        }
                      });
                    },
                  })
                )
              )
            )
          )
        : emptyState("history", t("noHistory"), t("noHistoryText"));
      const m = modal({ title: t("history"), body });
    }

    /* ---------- save ---------- */
    function adopt(categories) {
      const openIds = new Set([...open].map((c) => c.id));
      saved = JSON.stringify(clean(categories));
      draft = structuredClone(categories);
      open = new Set(draft.filter((c) => openIds.has(c.id)));
      renderList();
      markDirty();
    }

    async function save() {
      const invalid = listEl.querySelector('[aria-invalid="true"]');
      if (invalid) {
        invalid.focus();
        return toast(t("errFixHighlighted"), "error");
      }
      await withBusy(saveBtn, async () => {
        try {
          const res = await api.put("/api/admin/menu/categories", { categories: clean(draft) });
          adopt(res.categories);
          toast(t("saved"));
        } catch (err) {
          highlight(err.field);
          toast(errorMessage(err), "error");
        }
      });
    }

    function highlight(path) {
      const m = /categories\[(\d+)\](?:\.items\[(\d+)\])?(?:\.([a-z]+)(?:\.([a-z]+))?)?/.exec(path || "");
      if (!m) return;
      const cat = draft[Number(m[1])];
      if (!cat) return;
      query = "";
      searchInput.value = "";
      open.add(cat);
      renderList();
      if (m[2] === undefined) return openCategoryModal(cat);
      const row = listEl.querySelector(`.item-row[data-ci="${m[1]}"][data-ii="${m[2]}"]`);
      if (!row) return;
      const name = m[3] ? (m[4] ? `${m[3]}.${m[4]}` : m[3]) : "";
      const input = (name && row.querySelector(`[name="${name}"]`)) || row.querySelector("input");
      if (name === "name" || !input) {
        row.querySelectorAll('[name^="name."]').forEach((el) => el.setAttribute("aria-invalid", "true"));
      }
      if (input) {
        input.setAttribute("aria-invalid", "true");
        input.focus();
      }
    }

    saveBtn.addEventListener("click", save);
    discardBtn.addEventListener("click", async () => {
      const ok = await confirmDialog({ title: t("discard"), message: t("discardConfirm"), confirmLabel: t("discard"), danger: true });
      if (!ok) return;
      adopt(JSON.parse(saved));
    });

    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!savebar.hidden) save();
      }
    };
    document.addEventListener("keydown", onKey);

    /* ---------- layout ---------- */
    const searchInput = h("input", { class: "input", type: "search", placeholder: t("searchItems"), "aria-label": t("searchItems") });
    searchInput.addEventListener("input", () => {
      query = searchInput.value;
      renderList();
    });

    root.append(
      pageHead(
        t("navMenu"),
        t("menuSubtitle"),
        button(t("history"), { iconName: "history", onClick: openHistory }),
        button(t("adjustPrices"), { iconName: "percent", onClick: openAdjust }),
        button(t("addCategory"), { variant: "primary", iconName: "plus", onClick: () => openCategoryModal(null) })
      ),
      h(
        "div",
        { class: "toolbar" },
        h("div", { class: "input-icon" }, icon("search"), searchInput),
        button(t("expandAll"), { size: "sm", variant: "ghost", onClick: () => { open = new Set(draft); renderList(); } }),
        button(t("collapseAll"), { size: "sm", variant: "ghost", onClick: () => { open = new Set(); renderList(); } })
      ),
      listEl,
      savebar
    );

    renderList();

    return () => document.removeEventListener("keydown", onKey);
  },
};
