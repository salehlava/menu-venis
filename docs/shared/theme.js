/*
 * Venice theme engine — shared by the server (require) and the admin panel (<script>).
 * Turns four base colors into the full palette used by public/css/style.css.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.VeniceTheme = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const DEFAULT_THEME = {
    brand: "#0F4C3A", // mallard green (green-headed goose)
    accent: "#B76E79", // rose gold
    neutral: "#7C8285", // gray
    background: "#F5F4F1",
    darkMode: true,
  };

  const PRESETS = [
    { id: "venice", name: { en: "Venice", fa: "ونیز" }, colors: { brand: "#0F4C3A", accent: "#B76E79", neutral: "#7C8285", background: "#F5F4F1" } },
    { id: "espresso", name: { en: "Espresso", fa: "اسپرسو" }, colors: { brand: "#3B2A20", accent: "#C8A27A", neutral: "#857C75", background: "#F6F2EC" } },
    { id: "midnight", name: { en: "Midnight", fa: "نیمه‌شب" }, colors: { brand: "#1B2A41", accent: "#C9A227", neutral: "#7D8590", background: "#F4F5F7" } },
    { id: "olive", name: { en: "Olive", fa: "زیتونی" }, colors: { brand: "#3F4F24", accent: "#D08C60", neutral: "#838079", background: "#F5F3EE" } },
    { id: "bordeaux", name: { en: "Bordeaux", fa: "شرابی" }, colors: { brand: "#5B1A2B", accent: "#D4A373", neutral: "#857B7D", background: "#F7F3F1" } },
  ];

  const HEX = /^#[0-9a-f]{6}$/i;
  const COLOR_KEYS = ["brand", "accent", "neutral", "background"];

  function normalizeTheme(input) {
    const src = input && typeof input === "object" ? input : {};
    const out = {};
    for (const key of COLOR_KEYS) {
      out[key] = typeof src[key] === "string" && HEX.test(src[key]) ? src[key].toUpperCase() : DEFAULT_THEME[key];
    }
    out.darkMode = typeof src.darkMode === "boolean" ? src.darkMode : DEFAULT_THEME.darkMode;
    return out;
  }

  /* ---------- color math ---------- */
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function rgbToHex(r, g, b) {
    return "#" + [r, g, b].map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, "0")).join("").toUpperCase();
  }

  function hexToHsl(hex) {
    let [r, g, b] = hexToRgb(hex).map((v) => v / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0;
    let s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return [h, s * 100, l * 100];
  }

  function hslToHex(h, s, l) {
    s = clamp(s, 0, 100) / 100;
    l = clamp(l, 0, 100) / 100;
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255);
  }

  const rgbChannels = (hex) => hexToRgb(hex).join(" ");

  function luminance(hex) {
    const [r, g, b] = hexToRgb(hex).map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function contrast(a, b) {
    const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
  }

  /* ---------- palette ---------- */
  function palette(themeInput) {
    const theme = normalizeTheme(themeInput);
    const [bh, bs, bl] = hexToHsl(theme.brand);
    const [ah, as, al] = hexToHsl(theme.accent);
    const [nh, ns] = hexToHsl(theme.neutral);

    return {
      brand900: hslToHex(bh, bs, bl * 0.55),
      brand800: hslToHex(bh, bs, bl * 0.75),
      brand700: theme.brand,
      brand600: hslToHex(bh, bs, Math.min(bl * 1.25, 90)),
      brand500: hslToHex(bh, bs, Math.min(bl * 1.55, 92)),

      accent700: hslToHex(ah, as, al - 10),
      accent600: theme.accent,
      accent400: hslToHex(ah + 8, as + 12, al + 13),
      accent200: hslToHex(ah + 14, as + 10, al + 26),
      accentShine: hslToHex(ah + 14, as + 30, al + 33),
      accentSoft: hslToHex(ah + 14, as + 20, 92),
      accentBright: hslToHex(ah + 10, as + 18, al + 20),

      neutral900: hslToHex(nh, ns, 15),
      neutral700: hslToHex(nh, ns, 29),
      neutral500: theme.neutral,
      neutral300: hslToHex(nh, ns, 79),
      neutral200: hslToHex(nh, ns, 89),
      neutral100: hslToHex(nh, ns, 94),
      textMuted: hslToHex(nh, ns, 45),

      background: theme.background,

      darkBg: hslToHex(bh, Math.min(bs, 25), 6),
      darkSurface: hslToHex(bh, Math.min(bs, 18), 9.5),
      darkLine: hslToHex(bh, Math.min(bs, 15), 17),
      darkLeader: hslToHex(bh, Math.min(bs, 10), 24),
      darkText: hslToHex(nh, Math.min(ns, 8), 93),
      darkMuted: hslToHex(nh, Math.min(ns, 8), 62),
    };
  }

  /*
   * mode: "auto"  — light tokens + dark tokens under prefers-color-scheme (if darkMode is on)
   *       "light" / "dark" — force one set (used by the admin live preview)
   */
  function buildThemeCss(themeInput, mode) {
    const theme = normalizeTheme(themeInput);
    const p = palette(theme);
    mode = mode || "auto";

    const base = [
      `--brand-900:${p.brand900}`, `--brand-800:${p.brand800}`, `--brand-700:${p.brand700}`,
      `--brand-600:${p.brand600}`, `--brand-500:${p.brand500}`,
      `--brand-900-rgb:${rgbChannels(p.brand900)}`, `--brand-500-rgb:${rgbChannels(p.brand500)}`,
      `--accent-700:${p.accent700}`, `--accent-600:${p.accent600}`, `--accent-400:${p.accent400}`, `--accent-200:${p.accent200}`,
      `--accent-600-rgb:${rgbChannels(p.accent600)}`, `--accent-400-rgb:${rgbChannels(p.accent400)}`,
      `--accent-200-rgb:${rgbChannels(p.accent200)}`,
      `--accent-gradient:linear-gradient(135deg,${p.accent700} 0%,${p.accent400} 38%,${p.accentShine} 52%,${p.accentBright} 72%,${p.accent700} 100%)`,
      `--neutral-900:${p.neutral900}`, `--neutral-700:${p.neutral700}`, `--neutral-500:${p.neutral500}`,
      `--neutral-300:${p.neutral300}`, `--neutral-200:${p.neutral200}`, `--neutral-100:${p.neutral100}`,
      `--hero-text:${hslToHex(hexToHsl(p.accent200)[0], 30, 94)}`,
    ];

    const light = [
      `color-scheme:light`,
      `--bg:${p.background}`, `--surface:#FFFFFF`, `--text:${p.neutral900}`, `--text-muted:${p.textMuted}`,
      `--line:${p.neutral200}`, `--leader:${p.neutral300}`, `--price:${p.brand700}`,
      `--accent-soft:${p.accentSoft}`, `--accent-text:${p.accent700}`,
      `--nav-bg:rgb(${rgbChannels(p.background)} / .86)`,
      `--shadow:0 1px 2px rgb(${rgbChannels(p.brand900)} / .05), 0 10px 28px -14px rgb(${rgbChannels(p.brand900)} / .22)`,
    ];

    const dark = [
      `color-scheme:dark`,
      `--bg:${p.darkBg}`, `--surface:${p.darkSurface}`, `--text:${p.darkText}`, `--text-muted:${p.darkMuted}`,
      `--line:${p.darkLine}`, `--leader:${p.darkLeader}`, `--price:${hslToHex(hexToHsl(p.accent400)[0], hexToHsl(p.accent400)[1], 78)}`,
      `--accent-soft:rgb(${rgbChannels(p.accent400)} / .13)`, `--accent-text:${hslToHex(hexToHsl(p.accent400)[0], hexToHsl(p.accent400)[1], 78)}`,
      `--nav-bg:rgb(${rgbChannels(p.darkBg)} / .86)`,
      `--shadow:0 1px 2px rgb(0 0 0 / .3), 0 12px 30px -14px rgb(0 0 0 / .7)`,
    ];

    const block = (decls) => decls.join(";");
    let css = `/* Generated from the admin panel theme settings */\n:root{${block(base)};${block(mode === "dark" ? dark : light)}}\n`;
    if (mode === "auto" && theme.darkMode) {
      css += `@media (prefers-color-scheme: dark){:root{${block(dark)}}}\n`;
    }
    return css;
  }

  return { DEFAULT_THEME, PRESETS, normalizeTheme, palette, buildThemeCss, contrast, HEX };
});
