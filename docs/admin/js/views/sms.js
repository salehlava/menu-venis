import { t } from "../i18n.js";
import { api } from "../api.js";
import { h, icon, pageHead, button, field, confirmDialog, toast, errorMessage, emptyState, fmtNumber, fmtDate, withBusy } from "../ui.js";
import { todayParts, birthdayMatches } from "./customers.js";

/** SMS length estimate. Persian text uses Unicode SMS: 70 chars (67 per part when split). */
function smsInfo(text) {
  const sample = text.replace(/\{name\}/g, "xxxxxxxx");
  const len = [...sample].length;
  const unicode = /[^\x00-\x7F]/.test(sample);
  const single = unicode ? 70 : 160;
  const multi = unicode ? 67 : 153;
  return { len, unicode, parts: len === 0 ? 0 : len <= single ? 1 : Math.ceil(len / multi) };
}

export default {
  title: () => t("navSms"),

  async render(root, ctx) {
    const [settings, customers, initialLog] = await Promise.all([
      api.get("/api/admin/sms/settings"),
      api.get("/api/admin/customers"),
      api.get("/api/admin/sms/log"),
    ]);
    let log = initialLog;

    const now = todayParts();
    const selectedIds = new Set(ctx.state.smsSelected || []);
    const opted = customers.filter((c) => c.smsOptIn);

    const AUDIENCES = [
      { id: "all", list: opted },
      { id: "birthday-today", list: opted.filter((c) => birthdayMatches(c.birthday, "day", now)) },
      { id: "birthday-month", list: opted.filter((c) => birthdayMatches(c.birthday, "month", now)) },
      { id: "selected", list: opted.filter((c) => selectedIds.has(c.id)) },
    ];
    let audience = selectedIds.size ? "selected" : "all";
    const recipients = () => AUDIENCES.find((a) => a.id === audience).list;

    /* ---------- compose ---------- */
    const message = h("textarea", { class: "textarea", rows: 5, maxlength: 1000, placeholder: t("messagePlaceholder") });
    const counter = h("div", { class: "counter", "aria-live": "polite" });
    const bubble = h("div", { class: "bubble is-empty" }, t("previewEmpty"));
    const bubbleMeta = h("div", { class: "bubble__meta" });
    const sendBtn = button(t("send"), { variant: "primary", iconName: "send" });

    function update() {
      const text = message.value;
      const info = smsInfo(text);
      const n = recipients().length;
      counter.replaceChildren(
        h("span", {}, t("chars"), " ", h("b", {}, fmtNumber(info.len))),
        h("span", {}, t("smsParts"), " ", h("b", {}, fmtNumber(info.parts))),
        h("span", {}, t("recipients"), " ", h("b", {}, fmtNumber(n))),
        h("span", {}, t("totalSms"), " ", h("b", {}, `≈ ${fmtNumber(info.parts * n)}`))
      );
      const sampleName = (recipients()[0] || {}).name || t("sampleName");
      bubble.textContent = text ? text.replace(/\{name\}/g, sampleName) : t("previewEmpty");
      bubble.classList.toggle("is-empty", !text);
      bubbleMeta.textContent = info.unicode || !text ? t("unicodeNote") : "";
      sendBtn.disabled = !settings.configured || !text.trim() || n === 0;
    }
    message.addEventListener("input", update);

    const insertAtCursor = (snippet) => {
      const { selectionStart: s, selectionEnd: e, value } = message;
      message.value = value.slice(0, s) + snippet + value.slice(e);
      message.focus();
      message.selectionStart = message.selectionEnd = s + snippet.length;
      update();
    };

    const audienceEls = h(
      "div",
      { class: "audiences", role: "radiogroup", "aria-label": t("audience") },
      AUDIENCES.map((a) =>
        h(
          "label",
          { class: "audience" },
          h("input", {
            type: "radio",
            name: "audience",
            value: a.id,
            checked: a.id === audience,
            disabled: a.id === "selected" && selectedIds.size === 0,
            onChange: () => {
              audience = a.id;
              update();
            },
          }),
          h("span", { class: "audience__box" }, h("strong", {}, t(`aud_${a.id}`)), h("span", {}, t("customersCount", { n: fmtNumber(a.list.length) })))
        )
      )
    );

    sendBtn.addEventListener("click", async () => {
      const n = recipients().length;
      const info = smsInfo(message.value);
      const ok = await confirmDialog({
        title: t("sendConfirmTitle"),
        message: t("sendConfirm", { n: fmtNumber(n), sms: fmtNumber(info.parts * n) }),
        confirmLabel: t("send"),
      });
      if (!ok) return;
      await withBusy(sendBtn, async () => {
        try {
          const entry = await api.post("/api/admin/sms/send", {
            message: message.value,
            audience,
            ids: audience === "selected" ? [...selectedIds] : undefined,
          });
          log = [entry, ...log];
          renderLog();
          toast(t("sendResult", { sent: fmtNumber(entry.sent), failed: fmtNumber(entry.failed) }), entry.failed ? "error" : "success");
          if (entry.sent) {
            message.value = "";
            ctx.state.smsSelected = null;
          }
        } catch (err) {
          toast(errorMessage(err), "error");
        } finally {
          update();
        }
      });
    });

    /* ---------- test ---------- */
    const testPhone = h("input", { class: "input ltr", dir: "ltr", type: "tel", placeholder: "09xx xxx xxxx", maxlength: 16 });
    const testBtn = button(t("sendTest"), { iconName: "send", disabled: !settings.configured });
    testBtn.addEventListener("click", () =>
      withBusy(testBtn, async () => {
        if (!message.value.trim()) return toast(t("errMessageEmpty"), "error");
        try {
          const entry = await api.post("/api/admin/sms/test", { phone: testPhone.value, message: message.value });
          log = [entry, ...log];
          renderLog();
          toast(entry.sent ? t("testSent") : t("testFailed"), entry.sent ? "success" : "error");
        } catch (err) {
          toast(errorMessage(err), "error");
        }
      })
    );

    /* ---------- history ---------- */
    const logCard = h("section", { class: "card" });
    function renderLog() {
      const head = h("div", { class: "card__head" }, h("div", {}, h("h2", {}, t("sendHistory")), h("p", {}, t("sendHistoryHint"))));
      if (!log.length) return logCard.replaceChildren(head, emptyState("message", t("noHistorySms"), t("noHistorySmsText")));

      const statusBadge = (s) => h("span", { class: `badge ${s === "sent" ? "badge--success" : s === "partial" ? "badge--warning" : "badge--danger"}` }, t(`status_${s}`));
      logCard.replaceChildren(
        head,
        h(
          "div",
          { class: "table-wrap" },
          h(
            "table",
            { class: "table table--cards" },
            h("thead", {}, h("tr", {}, [t("date"), t("audience"), t("message"), t("delivered"), t("status")].map((x) => h("th", {}, x)))),
            h(
              "tbody",
              {},
              log.slice(0, 100).map((e) =>
                h(
                  "tr",
                  {},
                  h("td", { "data-label": t("date") }, h("span", { class: "nowrap" }, fmtDate(e.createdAt, true))),
                  h("td", { "data-label": t("audience") }, t(`aud_${e.audience}`)),
                  h("td", { "data-label": t("message") }, h("div", { class: "log-message", title: e.message }, e.message)),
                  h("td", { "data-label": t("delivered") }, `${fmtNumber(e.sent)} / ${fmtNumber(e.recipients)}`),
                  h("td", { "data-label": t("status") }, statusBadge(e.status))
                )
              )
            )
          )
        )
      );
    }

    /* ---------- layout ---------- */
    const status = settings.configured
      ? h(
          "div",
          { class: "notice notice--success" },
          icon("check"),
          h("div", { class: "notice__body" }, h("strong", {}, t("smsConnected")), h("p", {}, t("smsProvider", { name: (settings.providers.find((p) => p.id === settings.provider) || {}).label?.[document.documentElement.lang] || settings.provider })))
        )
      : h(
          "div",
          { class: "notice notice--warning" },
          icon("plug"),
          h("div", { class: "notice__body" }, h("strong", {}, t("smsNotConnectedTitle")), h("p", {}, t("smsNotConnectedSend"))),
          h("a", { class: "btn btn--sm", href: "#/settings" }, t("connect"))
        );

    root.append(
      pageHead(t("navSms"), t("smsSubtitle")),
      h("div", { style: { marginBottom: "20px" } }, status),
      h(
        "div",
        { class: "sms-layout" },
        h(
          "div",
          { class: "stack" },
          h(
            "section",
            { class: "card" },
            h("div", { class: "card__head" }, h("div", {}, h("h2", {}, t("newMessage")), h("p", {}, t("newMessageHint")))),
            h(
              "div",
              { class: "card__body form-stack" },
              h("div", { class: "field" }, h("span", { class: "field__label" }, t("audience")), audienceEls, h("span", { class: "field__hint" }, t("audienceHint"))),
              h(
                "div",
                { class: "field" },
                h("label", { class: "field__label" }, t("message")),
                message,
                counter,
                h(
                  "div",
                  { class: "chips" },
                  h("button", { type: "button", class: "chip-btn", onClick: () => insertAtCursor("{name}") }, t("insertName")),
                  ["tplBirthday", "tplOffer", "tplNew"].map((k) =>
                    h("button", { type: "button", class: "chip-btn", onClick: () => { message.value = t(k); update(); message.focus(); } }, t(`${k}Label`))
                  )
                )
              )
            ),
            h("div", { class: "card__foot" }, sendBtn)
          ),
          logCard
        ),
        h(
          "div",
          { class: "stack" },
          h(
            "section",
            { class: "card" },
            h("div", { class: "card__head" }, h("h2", {}, t("preview"))),
            h("div", { class: "bubble-wrap" }, bubble, bubbleMeta)
          ),
          h(
            "section",
            { class: "card" },
            h("div", { class: "card__head" }, h("div", {}, h("h2", {}, t("testMessage")), h("p", {}, t("testMessageHint")))),
            h("div", { class: "card__body form-stack" }, field(t("mobile"), testPhone), testBtn)
          )
        )
      )
    );

    renderLog();
    update();
  },
};
