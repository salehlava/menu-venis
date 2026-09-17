import { t } from "../i18n.js";
import { api } from "../api.js";
import { h, pageHead, button, field, biField, segmented, toast, savedMessage, errorMessage, withBusy } from "../ui.js";

const I18N_KEYS = ["name", "tagline", "title", "priceNote", "hours", "address"];

function clean(cafe) {
  const out = {};
  for (const k of I18N_KEYS) out[k] = { en: (cafe[k] && cafe[k].en) || "", fa: (cafe[k] && cafe[k].fa) || "" };
  out.defaultLang = cafe.defaultLang === "en" ? "en" : "fa";
  out.phone = cafe.phone || "";
  out.instagram = (cafe.instagram || "").replace(/^@/, "");
  return out;
}

export default {
  title: () => t("navInfo"),

  async render(root, ctx) {
    const menu = await api.get("/api/admin/menu");
    const draft = clean(menu.cafe);
    let saved = JSON.stringify(draft);

    const saveBtn = button(t("saveChanges"), { variant: "primary", iconName: "check", disabled: true });
    const onInput = () => {
      const dirty = JSON.stringify(clean(draft)) !== saved;
      ctx.setDirty(dirty);
      saveBtn.disabled = !dirty;
    };

    const phone = h("input", { class: "input ltr", dir: "ltr", type: "tel", maxlength: 30, value: draft.phone, placeholder: "021 1234 5678" });
    phone.addEventListener("input", () => {
      draft.phone = phone.value;
      onInput();
    });

    const instagram = h("input", { class: "input ltr", dir: "ltr", maxlength: 31, value: draft.instagram, placeholder: "venice.cafe" });
    instagram.addEventListener("input", () => {
      draft.instagram = instagram.value.replace(/^@/, "");
      onInput();
    });

    const card = (title, hint, ...children) =>
      h(
        "section",
        { class: "card" },
        h("div", { class: "card__head" }, h("div", {}, h("h2", {}, title), hint && h("p", {}, hint))),
        h("div", { class: "card__body form-stack" }, children)
      );

    saveBtn.addEventListener("click", () =>
      withBusy(saveBtn, async () => {
        try {
          const res = await api.put("/api/admin/menu/cafe", clean(draft));
          Object.assign(draft, clean(res.cafe));
          saved = JSON.stringify(clean(res.cafe));
          onInput();
          toast(savedMessage());
        } catch (err) {
          toast(errorMessage(err), "error");
        }
      })
    );

    root.append(
      pageHead(t("navInfo"), t("infoSubtitle"), saveBtn),
      h(
        "div",
        { class: "stack", style: { maxWidth: "860px" } },
        card(
          t("infoBrand"),
          t("infoBrandHint"),
          biField(t("cafeName"), draft, "name", { max: 60, onInput }),
          biField(t("tagline"), draft, "tagline", { max: 80, onInput }),
          biField(t("pageTitle"), draft, "title", { max: 80, onInput, hint: t("pageTitleHint") }),
          biField(t("priceNote"), draft, "priceNote", { max: 120, onInput, hint: t("priceNoteHint") }),
          h(
            "div",
            { class: "field" },
            h("span", { class: "field__label" }, t("defaultLang")),
            h(
              "div",
              {},
              segmented(
                [
                  { value: "fa", label: "فارسی" },
                  { value: "en", label: "English" },
                ],
                draft.defaultLang,
                (v) => {
                  draft.defaultLang = v;
                  onInput();
                }
              )
            ),
            h("span", { class: "field__hint" }, t("defaultLangHint"))
          )
        ),
        card(
          t("infoContact"),
          t("infoContactHint"),
          biField(t("hours"), draft, "hours", { max: 120, onInput }),
          biField(t("address"), draft, "address", { max: 200, onInput, textarea: true }),
          h("div", { class: "grid-2" }, field(t("phone"), phone), field(t("instagram"), instagram, t("instagramHint")))
        )
      )
    );
  },
};
