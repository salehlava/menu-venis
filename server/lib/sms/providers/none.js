/* Placeholder used until a real SMS panel is connected. Nothing is sent. */
module.exports = {
  id: "none",
  label: { en: "Not connected", fa: "متصل نشده" },
  fields: [],
  configured: () => false,
  async send() {
    throw new Error("SMS provider is not connected");
  },
};
