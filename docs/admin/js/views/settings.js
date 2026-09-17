import { t, getLang } from "../i18n.js";
import { api } from "../api.js";
import { h, icon, pageHead, button, field, biField, switchControl, toast, errorMessage, withBusy } from "../ui.js";

export default {
  title: () => t("navSettings"),

  async render(root, ctx) {
    const [club, smsSettings] = await Promise.all([api.get("/api/admin/club"), api.get("/api/admin/sms/settings")]);
    const lang = getLang();

    const card = (iconName, title, hint, body, footer) =>
      h(
        "section",
        { class: "card" },
        h("div", { class: "card__head" }, h("div", { style: { display: "flex", gap: "12px", alignItems: "center" } }, h("span", { class: "stat__icon" }, icon(iconName)), h("div", {}, h("h2", {}, title), hint && h("p", {}, hint)))),
        h("div", { class: "card__body form-stack" }, body),
        footer && h("div", { class: "card__foot" }, footer)
      );

    // Any edit marks the page dirty until that card is saved.
    const dirtyCards = new Set();
    const markDirty = (key, on = true) => {
      if (on) dirtyCards.add(key);
      else dirtyCards.delete(key);
      ctx.setDirty(dirtyCards.size > 0);
    };

    /* ---------- Customer club ---------- */
    const clubDraft = structuredClone(club);
    const welcomeText = h("textarea", { class: "textarea", rows: 3, maxlength: 500, dir: "auto" });
    welcomeText.value = clubDraft.welcomeSms.text || "";
    welcomeText.addEventListener("input", () => {
      clubDraft.welcomeSms.text = welcomeText.value;
      markDirty("club");
    });

    const whatsapp = h("input", { class: "input ltr", dir: "ltr", type: "tel", maxlength: 20, value: (clubDraft.contact || {}).whatsapp || "", placeholder: "09xx xxx xxxx" });
    whatsapp.addEventListener("input", () => {
      clubDraft.contact = { ...(clubDraft.contact || {}), whatsapp: whatsapp.value };
      markDirty("club");
    });

    const smsNumber = h("input", { class: "input ltr", dir: "ltr", type: "tel", maxlength: 20, value: (clubDraft.contact || {}).sms || "", placeholder: "09xx xxx xxxx" });
    smsNumber.addEventListener("input", () => {
      clubDraft.contact = { ...(clubDraft.contact || {}), sms: smsNumber.value };
      markDirty("club");
    });

    const clubSave = button(t("saveChanges"), { variant: "primary", iconName: "check" });
    clubSave.addEventListener("click", () =>
      withBusy(clubSave, async () => {
        try {
          Object.assign(clubDraft, await api.put("/api/admin/club", clubDraft));
          markDirty("club", false);
          toast(t("saved"));
        } catch (err) {
          toast(errorMessage(err), "error");
        }
      })
    );

    const clubCard = card(
      "gift",
      t("clubSettings"),
      t("clubSettingsHint"),
      [
        h(
          "div",
          { class: "setting-row" },
          h("div", { class: "setting-row__text" }, h("strong", {}, t("clubEnabled")), h("span", {}, t("clubEnabledHint"))),
          switchControl({ checked: clubDraft.enabled, ariaLabel: t("clubEnabled"), onChange: (v) => { clubDraft.enabled = v; markDirty("club"); } })
        ),
        biField(t("clubTitle"), clubDraft, "title", { max: 60, onInput: () => markDirty("club") }),
        biField(t("clubText"), clubDraft, "text", { max: 240, textarea: true, onInput: () => markDirty("club") }),
        h("hr", { style: { border: 0, borderTop: "1px solid var(--a-line)", margin: "4px 0" } }),
        h(
          "div",
          { class: "setting-row" },
          h("div", { class: "setting-row__text" }, h("strong", {}, t("welcomeSms")), h("span", {}, t("welcomeSmsHint"))),
          switchControl({ checked: clubDraft.welcomeSms.enabled, ariaLabel: t("welcomeSms"), onChange: (v) => { clubDraft.welcomeSms.enabled = v; markDirty("club"); } })
        ),
        field(t("welcomeSmsText"), welcomeText, t("welcomeSmsTextHint")),
        h("hr", { style: { border: 0, borderTop: "1px solid var(--a-line)", margin: "4px 0" } }),
        h(
          "div",
          { class: "notice notice--info" },
          icon("message"),
          h("div", { class: "notice__body" }, h("strong", {}, t("publishedClubTitle")), h("p", {}, t("publishedClubText")))
        ),
        h("div", { class: "grid-2" }, field(t("clubWhatsapp"), whatsapp, t("clubWhatsappHint")), field(t("clubSmsNumber"), smsNumber, t("clubSmsNumberHint"))),
      ],
      clubSave
    );

    /* ---------- SMS provider ---------- */
    let sms = smsSettings;
    const smsBody = h("div", { class: "form-stack" });
    const smsValues = {};
    const smsSave = button(t("saveChanges"), { variant: "primary", iconName: "check" });

    function renderSms(providerId) {
      const provider = sms.providers.find((p) => p.id === providerId) || sms.providers[0];
      const select = h(
        "select",
        {
          class: "select",
          onChange: (e) => {
            markDirty("sms");
            renderSms(e.target.value);
          },
        },
        sms.providers.map((p) => h("option", { value: p.id, selected: p.id === provider.id }, p.label[lang] || p.label.en))
      );

      Object.keys(smsValues).forEach((k) => delete smsValues[k]);
      const fields = provider.fields.map((f) => {
        const stored = provider.id === sms.provider ? sms.values[f.key] : undefined;
        const input = h("input", {
          class: "input ltr",
          dir: "ltr",
          type: f.secret ? "password" : "text",
          autocomplete: "off",
          value: f.secret ? "" : stored || "",
          placeholder: f.secret && stored && stored.set ? t("secretSaved", { hint: stored.hint }) : "",
        });
        smsValues[f.key] = input;
        input.addEventListener("input", () => markDirty("sms"));
        return field(f.label[lang] || f.label.en, input, f.secret && stored && stored.set ? t("secretKeepHint") : null);
      });

      const statusBadge = h("span", { class: `badge ${sms.configured ? "badge--success" : "badge--warning"}` }, sms.configured ? t("connected") : t("notConnected"));

      smsBody.replaceChildren(
        h("div", { class: "setting-row" }, h("div", { class: "setting-row__text" }, h("strong", {}, t("status"))), statusBadge),
        field(t("smsProviderLabel"), select),
        ...fields
      );
      if (provider.id === "none") {
        smsBody.append(
          h(
            "div",
            { class: "notice notice--info" },
            icon("plug"),
            h("div", { class: "notice__body" }, h("strong", {}, t("smsHowTitle")), h("p", {}, t("smsHowText")), h("p", { class: "ltr", style: { fontFamily: "ui-monospace, Consolas, monospace", fontSize: "0.8rem" } }, "server/lib/sms/providers/_template.js"))
          )
        );
      }
      smsBody.dataset.provider = provider.id;
    }

    smsSave.addEventListener("click", () =>
      withBusy(smsSave, async () => {
        const values = Object.fromEntries(Object.entries(smsValues).map(([k, input]) => [k, input.value]));
        try {
          sms = await api.put("/api/admin/sms/settings", { provider: smsBody.dataset.provider, values });
          markDirty("sms", false);
          renderSms(sms.provider);
          toast(t("saved"));
        } catch (err) {
          toast(errorMessage(err), "error");
        }
      })
    );
    renderSms(sms.provider);

    const smsCard = card("plug", t("smsPanel"), t("smsPanelHint"), smsBody, smsSave);

    /* ---------- Account ---------- */
    const username = h("input", { class: "input ltr", dir: "ltr", autocomplete: "username", value: ctx.user.username, maxlength: 32 });
    const current = h("input", { class: "input ltr", dir: "ltr", type: "password", autocomplete: "current-password" });
    const next = h("input", { class: "input ltr", dir: "ltr", type: "password", autocomplete: "new-password", minlength: 8 });
    const repeat = h("input", { class: "input ltr", dir: "ltr", type: "password", autocomplete: "new-password" });
    [username, next, repeat].forEach((el) => el.addEventListener("input", () => markDirty("account", username.value !== ctx.user.username || next.value || repeat.value)));

    const accountSave = button(t("updateAccount"), { variant: "primary", iconName: "lock" });
    accountSave.addEventListener("click", () =>
      withBusy(accountSave, async () => {
        [current, next, repeat, username].forEach((el) => el.removeAttribute("aria-invalid"));
        if (!current.value) {
          current.setAttribute("aria-invalid", "true");
          current.focus();
          return toast(t("errCurrentPassword"), "error");
        }
        if (next.value && next.value.length < 8) {
          next.setAttribute("aria-invalid", "true");
          return toast(t("err_weak_password"), "error");
        }
        if (next.value !== repeat.value) {
          repeat.setAttribute("aria-invalid", "true");
          return toast(t("errPasswordMismatch"), "error");
        }
        try {
          const res = await api.put("/api/admin/account", { currentPassword: current.value, username: username.value.trim(), newPassword: next.value || undefined });
          [current, next, repeat].forEach((el) => (el.value = ""));
          markDirty("account", false);
          toast(t("accountUpdated"));
          if (res.username !== ctx.user.username) ctx.setUser(res);
        } catch (err) {
          if (err.code === "wrong_password") current.setAttribute("aria-invalid", "true");
          if (err.code === "invalid_username") username.setAttribute("aria-invalid", "true");
          toast(errorMessage(err), "error");
        }
      })
    );

    const accountCard = card(
      "lock",
      t("account"),
      t("accountHint"),
      [
        field(t("username"), username, t("usernameHint")),
        field(t("currentPassword"), current),
        h("div", { class: "grid-2" }, field(t("newPassword"), next, t("newPasswordHint")), field(t("repeatPassword"), repeat)),
      ],
      accountSave
    );

    root.append(pageHead(t("navSettings"), t("settingsSubtitle")), h("div", { class: "stack", style: { maxWidth: "860px" } }, clubCard, smsCard, accountCard));
  },
};
