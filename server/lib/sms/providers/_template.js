/*
 * ─────────────────────────────────────────────────────────────
 *  SMS PROVIDER TEMPLATE
 * ─────────────────────────────────────────────────────────────
 *  To connect an SMS panel (Kavenegar, SMS.ir, Melipayamak, Ghasedak, …):
 *
 *  1. Copy this file, e.g.  providers/kavenegar.js
 *  2. Fill in id, label, fields and send() using your provider's API docs
 *  3. Register it in  server/lib/sms/index.js  (PROVIDERS list)
 *  4. Restart the server, then choose it in  Admin → Settings → SMS panel
 *
 *  The values of `fields` are entered in the admin panel and passed to send()
 *  as `config`. Fields with `secret: true` are never sent back to the browser.
 * ─────────────────────────────────────────────────────────────
 */
module.exports = {
  id: "example", // unique, lowercase
  label: { en: "Example SMS panel", fa: "پنل پیامک نمونه" },

  fields: [
    { key: "apiKey", label: { en: "API key", fa: "کلید API" }, secret: true, required: true },
    { key: "sender", label: { en: "Sender line number", fa: "شماره خط ارسال" }, required: true },
  ],

  /** Return true when every required field has a value. */
  configured(config) {
    return Boolean(config.apiKey && config.sender);
  },

  /**
   * Send messages.
   * @param {Array<{to: string, text: string}>} messages  to = "09xxxxxxxxx"
   * @param {object} config  values of `fields`
   * @returns {Promise<Array<{to: string, ok: boolean, id?: string, error?: string}>>}
   */
  async send(messages, config) {
    const results = [];
    for (const { to, text } of messages) {
      try {
        // Example only — replace with your provider's real endpoint and parameters.
        const res = await fetch("https://api.example-sms.ir/v1/send", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
          body: JSON.stringify({ from: config.sender, to, text }),
          signal: AbortSignal.timeout(15_000),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.message || `HTTP ${res.status}`);
        results.push({ to, ok: true, id: String(body.id || "") });
      } catch (err) {
        results.push({ to, ok: false, error: err.message });
      }
    }
    return results;
  },
};
