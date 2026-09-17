import { t, getLang } from "../i18n.js";
import { api } from "../api.js";
import { h, icon, pageHead, button, switchControl, segmented, toast, savedMessage, errorMessage, withBusy } from "../ui.js";
import { isGithubMode } from "../github.js";

const KEYS = ["brand", "accent", "neutral", "background"];
const HEX = /^#[0-9a-f]{6}$/i;

export default {
  title: () => t("navTheme"),

  async render(root, ctx) {
    const Theme = window.VeniceTheme;
    const current = await api.get("/api/admin/theme");
    let saved = JSON.stringify(Theme.normalizeTheme(current));
    const draft = Theme.normalizeTheme(current);
    let previewMode = "light";

    const saveBtn = button(t("saveChanges"), { variant: "primary", iconName: "check" });

    /* ---------- preview ---------- */
    const iframe = h("iframe", { src: `${isGithubMode() ? "../" : "/"}?lang=${getLang()}`, title: t("preview"), loading: "lazy" });

    function paintPreview() {
      const doc = iframe.contentDocument;
      if (!doc || !doc.head) return;
      let style = doc.getElementById("admin-theme-preview");
      if (!style) {
        style = doc.createElement("style");
        style.id = "admin-theme-preview";
        doc.head.append(style);
      }
      style.textContent = Theme.buildThemeCss(draft, previewMode);
    }
    iframe.addEventListener("load", paintPreview);

    /* ---------- controls ---------- */
    const warning = h("div", { class: "notice notice--warning", hidden: true }, icon("alert"), h("div", { class: "notice__body" }, t("contrastWarning")));
    const shades = h("div", { class: "shades", "aria-hidden": "true" });

    function refresh() {
      const dirty = JSON.stringify(draft) !== saved;
      ctx.setDirty(dirty);
      saveBtn.disabled = !dirty;

      const p = Theme.palette(draft);
      shades.replaceChildren(
        ...[p.brand900, p.brand800, p.brand700, p.brand600, p.brand500, p.accent700, p.accent600, p.accent400, p.accent200, p.neutral900, p.neutral500, p.neutral200, p.background].map(
          (c) => h("i", { style: { background: c }, title: c })
        )
      );
      warning.hidden = Theme.contrast("#FFFFFF", draft.brand) >= 4.5;
      presetEls.forEach(({ el, preset }) => el.classList.toggle("is-active", KEYS.every((k) => preset.colors[k].toUpperCase() === draft[k])));
      colorEls.forEach((fn) => fn());
      paintPreview();
    }

    const colorEls = [];
    const colorField = (key) => {
      const picker = h("input", { type: "color", value: draft[key].toLowerCase(), "aria-label": t(`color_${key}`) });
      const hex = h("input", { class: "input ltr", dir: "ltr", maxlength: 7, value: draft[key], "aria-label": `${t(`color_${key}`)} HEX`, spellcheck: "false" });

      picker.addEventListener("input", () => {
        draft[key] = picker.value.toUpperCase();
        refresh();
      });
      hex.addEventListener("input", () => {
        let v = hex.value.trim();
        if (v && v[0] !== "#") v = `#${v}`;
        if (HEX.test(v)) {
          hex.removeAttribute("aria-invalid");
          draft[key] = v.toUpperCase();
          refresh();
        } else {
          hex.setAttribute("aria-invalid", "true");
        }
      });
      colorEls.push(() => {
        if (document.activeElement !== hex) hex.value = draft[key];
        if (document.activeElement !== picker) picker.value = draft[key].toLowerCase();
        hex.removeAttribute("aria-invalid");
      });

      return h(
        "div",
        { class: "color-field" },
        h("label", { class: "color-field__swatch", style: { background: draft[key] } }, picker),
        h(
          "div",
          { class: "color-field__main" },
          h("div", { class: "color-field__text" }, h("strong", {}, t(`color_${key}`)), h("span", {}, t(`color_${key}_hint`))),
          hex
        )
      );
    };

    const presetEls = Theme.PRESETS.map((preset) => {
      const el = h(
        "button",
        {
          type: "button",
          class: "preset",
          onClick: () => {
            Object.assign(draft, Object.fromEntries(KEYS.map((k) => [k, preset.colors[k].toUpperCase()])));
            refresh();
          },
        },
        h("span", { class: "preset__swatches", "aria-hidden": "true" }, KEYS.map((k) => h("i", { style: { background: preset.colors[k] } }))),
        preset.name[getLang()] || preset.name.en
      );
      return { el, preset };
    });

    const darkSwitch = switchControl({
      checked: draft.darkMode,
      ariaLabel: t("darkMode"),
      onChange: (on) => {
        draft.darkMode = on;
        refresh();
      },
    });

    saveBtn.addEventListener("click", () =>
      withBusy(saveBtn, async () => {
        try {
          const res = await api.put("/api/admin/theme", draft);
          Object.assign(draft, res);
          saved = JSON.stringify(Theme.normalizeTheme(res));
          refresh();
          // Update the admin's own colors too.
          const link = document.querySelector('link[href*="css/theme.css"]');
          if (link) link.href = `/css/theme.css?v=${Date.now()}`;
          toast(savedMessage());
        } catch (err) {
          toast(errorMessage(err), "error");
        }
      })
    );

    const resetBtn = button(t("resetDefault"), {
      variant: "ghost",
      iconName: "history",
      onClick: () => {
        Object.assign(draft, Theme.DEFAULT_THEME);
        darkSwitch.querySelector("input").checked = draft.darkMode;
        refresh();
      },
    });

    // Rebuild swatch backgrounds when colors change.
    const swatchSync = () => root.querySelectorAll(".color-field").forEach((el, i) => (el.querySelector(".color-field__swatch").style.background = draft[KEYS[i]]));
    colorEls.push(swatchSync);

    root.append(
      pageHead(t("navTheme"), t("themeSubtitle"), resetBtn, saveBtn),
      h(
        "div",
        { class: "theme-layout" },
        h(
          "div",
          { class: "stack" },
          h(
            "section",
            { class: "card" },
            h("div", { class: "card__head" }, h("div", {}, h("h2", {}, t("presets")), h("p", {}, t("presetsHint")))),
            h("div", { class: "card__body" }, h("div", { class: "presets" }, presetEls.map((p) => p.el)))
          ),
          h(
            "section",
            { class: "card" },
            h("div", { class: "card__head" }, h("div", {}, h("h2", {}, t("colors")), h("p", {}, t("colorsHint")))),
            h(
              "div",
              { class: "card__body" },
              KEYS.map(colorField),
              h("div", { style: { marginTop: "8px" } }, h("span", { class: "field__label" }, t("generatedPalette")), shades),
              h("div", { style: { marginTop: "16px" } }, warning)
            )
          ),
          h(
            "section",
            { class: "card" },
            h(
              "div",
              { class: "card__body" },
              h(
                "div",
                { class: "setting-row" },
                h("div", { class: "setting-row__text" }, h("strong", {}, t("darkMode")), h("span", {}, t("darkModeHint"))),
                darkSwitch
              )
            )
          )
        ),
        h(
          "section",
          { class: "card preview-card" },
          h(
            "div",
            { class: "card__head" },
            h("h2", {}, t("preview")),
            segmented(
              [
                { value: "light", label: t("light"), icon: "sun" },
                { value: "dark", label: t("dark"), icon: "moon" },
              ],
              previewMode,
              (mode) => {
                previewMode = mode;
                paintPreview();
              }
            )
          ),
          h("div", { class: "card__body" }, h("div", { class: "phone" }, iframe))
        )
      )
    );

    refresh();
  },
};
