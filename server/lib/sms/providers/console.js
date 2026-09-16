/*
 * Development-only provider: prints messages in the server terminal instead of sending them.
 * Enabled only when the server is started with SMS_DEV=1.
 */
module.exports = {
  id: "console",
  label: { en: "Test mode (server console)", fa: "حالت تست (نمایش در کنسول سرور)" },
  fields: [],
  configured: () => true,
  async send(messages) {
    for (const m of messages) console.log(`[sms:console] → ${m.to}: ${m.text}`);
    return messages.map((m) => ({ to: m.to, ok: true, id: "console" }));
  },
};
