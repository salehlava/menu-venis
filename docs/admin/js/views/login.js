import { t, getLang } from "../i18n.js";
import { api } from "../api.js";
import { h, icon, segmented, errorMessage } from "../ui.js";
import { isGithubMode } from "../github.js";

export default {
  render({ onSuccess, onLangChange }) {
    if (isGithubMode()) return renderTokenLogin({ onSuccess, onLangChange });
    const username = h("input", {
      class: "input ltr",
      id: "username",
      name: "username",
      autocomplete: "username",
      autocapitalize: "none",
      spellcheck: "false",
      dir: "ltr",
      required: true,
    });
    const password = h("input", {
      class: "input ltr",
      id: "password",
      name: "password",
      type: "password",
      autocomplete: "current-password",
      dir: "ltr",
      required: true,
    });

    const toggle = h("button", { type: "button", class: "icon-btn", "aria-label": t("showPassword"), title: t("showPassword") }, icon("eye"));
    toggle.addEventListener("click", () => {
      const show = password.type === "password";
      password.type = show ? "text" : "password";
      toggle.replaceChildren(icon(show ? "eyeOff" : "eye"));
      toggle.setAttribute("aria-label", t(show ? "hidePassword" : "showPassword"));
    });

    const error = h("div", { class: "login__error", role: "alert", hidden: true });
    const submit = h("button", { type: "submit", class: "btn btn--primary btn--block", style: { height: "46px" } }, icon("lock"), t("signIn"));

    const showError = (message) => {
      error.replaceChildren(icon("alert"), h("span", {}, message));
      error.hidden = false;
    };

    const form = h(
      "form",
      { class: "form-stack", novalidate: true },
      h("label", { class: "field", for: "username" }, h("span", { class: "field__label" }, t("username")), username),
      h("label", { class: "field", for: "password" }, h("span", { class: "field__label" }, t("password")), h("div", { class: "input-group" }, password, toggle)),
      error,
      submit
    );

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      error.hidden = true;
      if (!username.value.trim() || !password.value) return showError(t("errLoginEmpty"));

      submit.disabled = true;
      try {
        const user = await api.post("/api/admin/login", { username: username.value.trim(), password: password.value });
        onSuccess(user);
      } catch (err) {
        if (err.code === "too_many_attempts") {
          showError(t("errTooMany", { minutes: Math.max(1, Math.ceil((err.body.retryAfter || 60) / 60)) }));
        } else {
          showError(errorMessage(err));
        }
        password.select();
      } finally {
        submit.disabled = false;
      }
    });

    setTimeout(() => username.focus(), 50);

    return h(
      "div",
      { class: "login" },
      h(
        "div",
        { class: "login__lang" },
        segmented(
          [
            { value: "fa", label: "فارسی" },
            { value: "en", label: "English" },
          ],
          getLang(),
          onLangChange
        )
      ),
      h(
        "div",
        { class: "login__card" },
        h(
          "div",
          { class: "login__head" },
          h("span", { class: "mono", "aria-hidden": "true" }, h("span", {}, "V")),
          h("h1", {}, t("loginTitle")),
          h("p", {}, t("loginSubtitle"))
        ),
        form
      )
    );
  },
};

/* ---------- GitHub mode: sign in with a repository token ---------- */
function renderTokenLogin({ onSuccess, onLangChange }) {
  const token = h("input", {
    class: "input ltr",
    id: "token",
    type: "password",
    autocomplete: "off",
    spellcheck: "false",
    dir: "ltr",
    placeholder: "github_pat_…",
  });

  const toggle = h("button", { type: "button", class: "icon-btn", "aria-label": t("showPassword"), title: t("showPassword") }, icon("eye"));
  toggle.addEventListener("click", () => {
    const show = token.type === "password";
    token.type = show ? "text" : "password";
    toggle.replaceChildren(icon(show ? "eyeOff" : "eye"));
  });

  const error = h("div", { class: "login__error", role: "alert", hidden: true });
  const submit = h("button", { type: "submit", class: "btn btn--primary btn--block", style: { height: "46px" } }, icon("lock"), t("signIn"));

  const showError = (message) => {
    error.replaceChildren(icon("alert"), h("span", {}, message));
    error.hidden = false;
  };

  const form = h(
    "form",
    { class: "form-stack", novalidate: true },
    h(
      "label",
      { class: "field", for: "token" },
      h("span", { class: "field__label" }, t("tokenLabel")),
      h("div", { class: "input-group" }, token, toggle),
      h("span", { class: "field__hint" }, t("tokenHint"))
    ),
    error,
    submit,
    h(
      "a",
      {
        class: "btn btn--ghost btn--block",
        href: "https://github.com/settings/personal-access-tokens/new",
        target: "_blank",
        rel: "noopener",
      },
      icon("external"),
      t("tokenCreate")
    )
  );

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    error.hidden = true;
    if (!token.value.trim()) return showError(t("errTokenEmpty"));
    submit.disabled = true;
    try {
      onSuccess(await api.post("/api/admin/login", { token: token.value.trim() }));
    } catch (err) {
      showError(errorMessage(err));
      token.select();
    } finally {
      submit.disabled = false;
    }
  });

  setTimeout(() => token.focus(), 50);

  return h(
    "div",
    { class: "login" },
    h(
      "div",
      { class: "login__lang" },
      segmented([{ value: "fa", label: "فارسی" }, { value: "en", label: "English" }], getLang(), onLangChange)
    ),
    h(
      "div",
      { class: "login__card" },
      h(
        "div",
        { class: "login__head" },
        h("span", { class: "mono", "aria-hidden": "true" }, h("span", {}, "V")),
        h("h1", {}, t("loginTitle")),
        h("p", {}, t("tokenSubtitle"))
      ),
      form
    )
  );
}
