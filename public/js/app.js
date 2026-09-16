/*
 * Venice Café — menu app
 * Renders window.MENU (js/menu-data.js) in Persian or English,
 * with search, a sticky category bar and scroll tracking.
 */
(function () {
  "use strict";

  const { cafe, categories } = window.MENU;
  const club = window.MENU.club || { enabled: false };
  const STORAGE_KEY = "venice-menu-lang";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Interface text ---------- */
  const UI = {
    en: {
      menu: "Menu",
      searchLabel: "Search the menu",
      searchPlaceholder: "Search coffee, tea, shakes…",
      clear: "Clear search",
      items: (n) => `${n} ${n === 1 ? "item" : "items"}`,
      ask: "Daily price",
      empty: "Nothing matches your search.",
      emptyHint: "Try another word, or clear the search.",
      toTop: "Back to top",
      categories: "Menu categories",
      tags: { signature: "Signature", new: "New", popular: "Popular" },
      rights: "All rights reserved.",
      clubShort: "Club",
      fieldName: "Your name",
      fieldPhone: "Mobile number",
      fieldBirthday: "Birthday",
      optional: "(optional)",
      day: "Day",
      month: "Month",
      months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
      consent: "I agree to receive SMS messages from the café.",
      join: "Join the club",
      joining: "Joining…",
      joined: "Welcome to the club! You're all set.",
      already: "You're already a member — thank you!",
      errName: "Please enter your name.",
      errPhone: "Please enter a valid mobile number, e.g. 0912 345 6789.",
      errConsent: "Please accept receiving SMS messages.",
      errBusy: "Too many attempts. Please try again later.",
      errGeneric: "Something went wrong. Please try again.",
    },
    fa: {
      menu: "منو",
      searchLabel: "جستجو در منو",
      searchPlaceholder: "جستجوی قهوه، چای، شیک…",
      clear: "پاک کردن جستجو",
      items: (n) => `${formatNumber(n)} مورد`,
      ask: "قیمت روز",
      empty: "موردی با این عبارت پیدا نشد.",
      emptyHint: "عبارت دیگری را امتحان کنید یا جستجو را پاک کنید.",
      toTop: "بازگشت به بالا",
      categories: "دسته‌بندی‌های منو",
      tags: { signature: "ویژه", new: "جدید", popular: "محبوب" },
      rights: "تمامی حقوق محفوظ است.",
      clubShort: "باشگاه",
      fieldName: "نام شما",
      fieldPhone: "شماره موبایل",
      fieldBirthday: "تاریخ تولد",
      optional: "(اختیاری)",
      day: "روز",
      month: "ماه",
      months: ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"],
      consent: "با دریافت پیامک از طرف کافه موافقم.",
      join: "عضویت در باشگاه",
      joining: "در حال ثبت…",
      joined: "عضویت شما با موفقیت انجام شد. خوش آمدید!",
      already: "شما قبلاً عضو باشگاه شده‌اید. سپاس!",
      errName: "لطفاً نام خود را وارد کنید.",
      errPhone: "لطفاً شماره موبایل معتبر وارد کنید، مثلاً ۰۹۱۲۳۴۵۶۷۸۹.",
      errConsent: "لطفاً دریافت پیامک را تأیید کنید.",
      errBusy: "تعداد درخواست‌ها زیاد است. کمی بعد دوباره تلاش کنید.",
      errGeneric: "مشکلی پیش آمد. دوباره تلاش کنید.",
    },
  };

  /* ---------- Icons (24×24 line icons) ---------- */
  const ICONS = {
    espresso:
      '<path d="M4 9h12v4.5A5.5 5.5 0 0 1 10.5 19h-1A5.5 5.5 0 0 1 4 13.5V9z"/><path d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H15.4"/><path d="M3 21.5h14"/><path d="M8 2.5c-.6.8-.6 1.7 0 2.5s.6 1.7 0 2.5M12 2.5c-.6.8-.6 1.7 0 2.5s.6 1.7 0 2.5"/>',
    tea:
      '<path d="M19.5 4.5C11 4.5 5.5 9 5.5 15.5c0 1.4.3 2.6.9 3.6 1 .6 2.2.9 3.6.9 6.5 0 9.5-6.5 9.5-15.5z"/><path d="M3.5 21.5c3-5 7-9 11.5-12"/>',
    cappuccino:
      '<path d="M3 20.5h18"/><path d="M5 10.5h12v2.5a6 6 0 0 1-6 6 6 6 0 0 1-6-6v-2.5z"/><path d="M17 11.5h1a2.3 2.3 0 0 1 0 4.6h-1.6"/><path d="M11 8.3S8.6 6.9 8.6 5.4c0-1.6 1.9-2 2.4-.7.5-1.3 2.4-.9 2.4.7 0 1.5-2.4 2.9-2.4 2.9z"/>',
    iced:
      '<path d="M5 3.5h14l-1.7 16.1a2 2 0 0 1-2 1.9H8.7a2 2 0 0 1-2-1.9L5 3.5z"/><path d="M5.6 9h12.8"/><rect x="8.3" y="11" width="3.4" height="3.4" rx=".7"/><rect x="12.3" y="14.6" width="3.4" height="3.4" rx=".7"/>',
    shake:
      '<path d="M6.5 10.5h11l-1.3 10.1a1.2 1.2 0 0 1-1.2 1H9a1.2 1.2 0 0 1-1.2-1L6.5 10.5z"/><path d="M5.5 10.5a6.5 6.5 0 0 1 13 0"/><path d="M12.5 7 15 1.8"/>',
    smoothie:
      '<path d="M5.5 7.5h12l-1.5 13a1.2 1.2 0 0 1-1.2 1H8.2a1.2 1.2 0 0 1-1.2-1L5.5 7.5z"/><path d="M6.2 12.5h10.6"/><path d="M10 7.5 8 2"/><path d="M15.5 7.5a3 3 0 1 1 5.5-1.7"/>',
    cake:
      '<path d="M3.5 21h17"/><path d="M5 21v-8a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v8"/><path d="M5 16.2c1.2.9 2.3.9 3.5 0s2.3-.9 3.5 0 2.3.9 3.5 0 2.3-.9 3.5 0"/><path d="M12 12V8.5"/><path d="M12 6.3c.8 0 1.3-.6 1.3-1.3 0-.9-1.3-2.5-1.3-2.5s-1.3 1.6-1.3 2.5c0 .7.5 1.3 1.3 1.3z"/>',
    snack:
      '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3"/><path d="M7.4 7.8l.5.4M15.8 7.3l-.4.5M16.9 14.9l-.5-.3M8.4 16.6l.4-.5M12 4.9v.6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    phone:
      '<path d="M5 3.5h3.2l1.6 4.3-2.1 1.4a11 11 0 0 0 5.1 5.1l1.4-2.1 4.3 1.6V17a2 2 0 0 1-2.2 2A15.5 15.5 0 0 1 3 5.7a2 2 0 0 1 2-2.2z"/>',
    instagram: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17 7h.01"/>',
  };

  const icon = (name) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.espresso}</svg>`;

  /* ---------- DOM ---------- */
  const $ = (sel) => document.querySelector(sel);
  const els = {
    root: document.documentElement,
    menu: $("#menu"),
    nav: $("#catNav"),
    navList: $("#catList"),
    search: $("#search"),
    clear: $("#searchClear"),
    empty: $("#empty"),
    toTop: $("#toTop"),
    footerInfo: $("#footerInfo"),
    footerCopy: $("#footerCopy"),
    club: $("#club"),
    clubLink: $("#clubLink"),
    clubForm: $("#clubForm"),
    clubName: $("#clubName"),
    clubPhone: $("#clubPhone"),
    clubDay: $("#clubDay"),
    clubMonth: $("#clubMonth"),
    clubConsent: $("#clubConsent"),
    clubSubmit: $("#clubSubmit"),
    clubMsg: $("#clubMsg"),
  };

  /* ---------- State ---------- */
  const state = { lang: initialLang(), query: "" };
  let activeId = null;
  let spyLockUntil = 0;
  let revealObserver = null;

  function initialLang() {
    const fromUrl = new URLSearchParams(location.search).get("lang");
    if (fromUrl === "en" || fromUrl === "fa") return fromUrl;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "en" || saved === "fa") return saved;
    } catch (_) {}
    return cafe.defaultLang === "en" ? "en" : "fa";
  }

  /* ---------- Helpers ---------- */
  const ui = () => UI[state.lang];
  const t = (obj) => (obj ? obj[state.lang] || obj.en || obj.fa || "" : "");

  function formatNumber(n) {
    return new Intl.NumberFormat(state.lang === "fa" ? "fa-IR" : "en-US").format(n);
  }

  function toLocalDigits(str) {
    return state.lang === "fa" ? String(str).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]) : String(str);
  }

  function escapeHTML(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }

  // Makes search forgiving: case, Arabic vs Persian letters, Persian digits, ZWNJ.
  function normalize(str) {
    return String(str)
      .toLowerCase()
      .replace(/[يى]/g, "ی")
      .replace(/ك/g, "ک")
      .replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d))
      .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
      .replace(/[‌ً-ٟ]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  const haystacks = new WeakMap();
  function haystack(cat, item) {
    if (!haystacks.has(item)) {
      const parts = [item.name, item.desc, cat.title, cat.short].flatMap((o) => (o ? [o.en, o.fa] : []));
      haystacks.set(item, normalize(parts.join(" ")));
    }
    return haystacks.get(item);
  }

  /* ---------- Rendering ---------- */
  function itemHTML(item) {
    const tag = item.tag ? `<span class="badge">${escapeHTML(ui().tags[item.tag] || item.tag)}</span>` : "";
    const desc = item.desc ? `<p class="item__desc">${escapeHTML(t(item.desc))}</p>` : "";
    const price =
      typeof item.price === "number"
        ? `<span class="item__price">${formatNumber(item.price)}</span>`
        : `<span class="item__price item__price--ask">${escapeHTML(ui().ask)}</span>`;

    return `<li class="item">
      <div class="item__main"><h3 class="item__name">${escapeHTML(t(item.name))}${tag}</h3>${desc}</div>
      <span class="item__leader" aria-hidden="true"></span>
      ${price}
    </li>`;
  }

  function sectionHTML(cat, items, animate) {
    return `<section class="section${animate ? " reveal" : ""}" id="${cat.id}" aria-labelledby="${cat.id}-title">
      <header class="section__head">
        <span class="section__icon">${icon(cat.icon)}</span>
        <div class="section__heading">
          <h2 class="section__title" id="${cat.id}-title">${escapeHTML(t(cat.title))}</h2>
          <p class="section__count">${ui().items(items.length)}</p>
        </div>
        <span class="section__rule" aria-hidden="true"></span>
      </header>
      <div class="card"><ul class="items">${items.map(itemHTML).join("")}</ul></div>
    </section>`;
  }

  function render({ animate = false } = {}) {
    const tokens = normalize(state.query).split(" ").filter(Boolean);
    const visible = [];

    for (const cat of categories) {
      const items = tokens.length
        ? cat.items.filter((item) => tokens.every((tok) => haystack(cat, item).includes(tok)))
        : cat.items;
      if (items.length) visible.push({ cat, items });
    }

    els.menu.innerHTML = visible.map(({ cat, items }) => sectionHTML(cat, items, animate)).join("");
    els.navList.innerHTML = visible
      .map(
        ({ cat }) =>
          `<button type="button" class="chip" data-target="${cat.id}">${icon(cat.icon)}<span>${escapeHTML(t(cat.short || cat.title))}</span></button>`
      )
      .join("");

    els.empty.hidden = visible.length > 0;
    els.nav.hidden = visible.length === 0;

    activeId = null;
    if (animate) observeReveal();
    updateSpy();
  }

  function renderStatic() {
    const text = {
      menu: ui().menu,
      name: t(cafe.name),
      tagline: t(cafe.tagline),
      priceNote: t(cafe.priceNote),
      searchLabel: ui().searchLabel,
      empty: ui().empty,
      emptyHint: ui().emptyHint,
      clubShort: ui().clubShort,
      clubTitle: t(club.title),
      clubText: t(club.text),
      fieldName: ui().fieldName,
      fieldPhone: ui().fieldPhone,
      fieldBirthday: ui().fieldBirthday,
      optional: ui().optional,
      consent: ui().consent,
      join: ui().join,
    };
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = text[el.dataset.i18n] || "";
    });

    document.title = t(cafe.title);
    els.search.placeholder = ui().searchPlaceholder;
    els.clear.setAttribute("aria-label", ui().clear);
    els.toTop.setAttribute("aria-label", ui().toTop);
    els.nav.setAttribute("aria-label", ui().categories);

    document.querySelectorAll(".lang button").forEach((btn) => {
      btn.setAttribute("aria-pressed", String(btn.dataset.lang === state.lang));
    });

    // Footer info — only lines that are filled in menu-data.js
    const info = [];
    if (t(cafe.hours)) info.push(`<li>${icon("clock")}<span>${escapeHTML(toLocalDigits(t(cafe.hours)))}</span></li>`);
    if (t(cafe.address)) info.push(`<li>${icon("pin")}<span>${escapeHTML(t(cafe.address))}</span></li>`);
    if (cafe.phone) {
      const tel = cafe.phone.replace(/[^\d+]/g, "");
      info.push(`<li>${icon("phone")}<a href="tel:${tel}" dir="ltr">${escapeHTML(toLocalDigits(cafe.phone))}</a></li>`);
    }
    if (cafe.instagram) {
      const handle = cafe.instagram.replace(/^@/, "");
      info.push(
        `<li>${icon("instagram")}<a href="https://instagram.com/${encodeURIComponent(handle)}" target="_blank" rel="noopener" dir="ltr">@${escapeHTML(handle)}</a></li>`
      );
    }
    els.footerInfo.innerHTML = info.join("");
    els.footerCopy.textContent = `© ${formatNumber(new Date().getFullYear()).replace(/[٬,]/g, "")} ${t(cafe.name)} — ${ui().rights}`;

    renderClubSelects();
  }

  /* ---------- Customer Club ---------- */
  function renderClubSelects() {
    const day = els.clubDay.value;
    const month = els.clubMonth.value;
    const keep = els.clubForm.dataset.lang === state.lang; // calendars differ, so reset on language change
    els.clubForm.dataset.lang = state.lang;

    const option = (value, label) => `<option value="${value}">${escapeHTML(label)}</option>`;
    els.clubDay.innerHTML =
      option("", ui().day) + Array.from({ length: 31 }, (_, i) => option(i + 1, formatNumber(i + 1))).join("");
    els.clubMonth.innerHTML = option("", ui().month) + ui().months.map((name, i) => option(i + 1, name)).join("");
    els.clubDay.setAttribute("aria-label", ui().day);
    els.clubMonth.setAttribute("aria-label", ui().month);

    if (keep) {
      els.clubDay.value = day;
      els.clubMonth.value = month;
    }
    if (!els.clubSubmit.disabled) els.clubSubmit.textContent = ui().join;
  }

  function setClubMessage(text, type) {
    els.clubMsg.textContent = text || "";
    els.clubMsg.className = `club__msg${type ? ` is-${type}` : ""}`;
  }

  async function submitClub(e) {
    e.preventDefault();
    const name = els.clubName.value.trim();
    const phone = els.clubPhone.value.replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d)).replace(/[\s\-()]/g, "");

    els.clubName.removeAttribute("aria-invalid");
    els.clubPhone.removeAttribute("aria-invalid");

    if (!name) {
      els.clubName.setAttribute("aria-invalid", "true");
      els.clubName.focus();
      return setClubMessage(ui().errName, "error");
    }
    if (!/^(\+98|0098|98|0)?9\d{9}$/.test(phone)) {
      els.clubPhone.setAttribute("aria-invalid", "true");
      els.clubPhone.focus();
      return setClubMessage(ui().errPhone, "error");
    }
    if (!els.clubConsent.checked) return setClubMessage(ui().errConsent, "error");

    const birthday =
      els.clubDay.value && els.clubMonth.value
        ? { cal: state.lang === "fa" ? "jalali" : "gregorian", d: Number(els.clubDay.value), m: Number(els.clubMonth.value) }
        : null;

    els.clubSubmit.disabled = true;
    els.clubSubmit.textContent = ui().joining;
    setClubMessage("");

    try {
      const res = await fetch("/api/club/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          birthday,
          consent: true,
          lang: state.lang,
          website: els.clubForm.elements.website.value,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        els.clubForm.reset();
        renderClubSelects();
        setClubMessage(data.status === "already_member" ? ui().already : ui().joined, "success");
      } else if (res.status === 429) {
        setClubMessage(ui().errBusy, "error");
      } else if (data.field === "phone") {
        els.clubPhone.setAttribute("aria-invalid", "true");
        setClubMessage(ui().errPhone, "error");
      } else if (data.field === "name") {
        els.clubName.setAttribute("aria-invalid", "true");
        setClubMessage(ui().errName, "error");
      } else {
        setClubMessage(ui().errGeneric, "error");
      }
    } catch (_) {
      setClubMessage(ui().errGeneric, "error");
    } finally {
      els.clubSubmit.disabled = false;
      els.clubSubmit.textContent = ui().join;
    }
  }

  /* ---------- Language ---------- */
  function applyLang(lang, { initial = false } = {}) {
    // Keep the section the visitor is reading in the same place on screen.
    const anchorEl = !initial && window.scrollY > 0 && activeId && document.getElementById(activeId);
    const anchor = anchorEl ? { id: activeId, top: anchorEl.getBoundingClientRect().top } : null;

    state.lang = lang;
    els.root.lang = lang;
    els.root.dir = lang === "fa" ? "rtl" : "ltr";
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (_) {}

    renderStatic();
    render({ animate: initial });

    if (anchor) {
      const el = document.getElementById(anchor.id);
      if (el) window.scrollBy(0, el.getBoundingClientRect().top - anchor.top);
    }
  }

  function switchLang(lang) {
    if (lang === state.lang) return;
    if (reduceMotion) return applyLang(lang);
    document.body.classList.add("is-switching");
    setTimeout(() => {
      applyLang(lang);
      requestAnimationFrame(() => document.body.classList.remove("is-switching"));
    }, 160);
  }

  /* ---------- Scroll tracking ---------- */
  function updateSpy() {
    const sections = els.menu.querySelectorAll(".section");
    if (!sections.length) return;

    const offset = els.nav.offsetHeight + 28;
    let current = sections[0].id;
    for (const section of sections) {
      if (section.getBoundingClientRect().top - offset <= 0) current = section.id;
      else break;
    }

    const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
    if (atBottom) current = sections[sections.length - 1].id;

    setActive(current);
  }

  function setActive(id) {
    if (id === activeId) return;
    activeId = id;

    let activeChip = null;
    els.navList.querySelectorAll(".chip").forEach((chip) => {
      const on = chip.dataset.target === id;
      chip.classList.toggle("is-active", on);
      if (on) {
        chip.setAttribute("aria-current", "true");
        activeChip = chip;
      } else {
        chip.removeAttribute("aria-current");
      }
    });

    if (activeChip) {
      // Centre the active chip inside the bar (works in both LTR and RTL).
      const list = els.navList.getBoundingClientRect();
      const chip = activeChip.getBoundingClientRect();
      const delta = chip.left + chip.width / 2 - (list.left + list.width / 2);
      els.navList.scrollBy({ left: delta, behavior: reduceMotion ? "auto" : "smooth" });
    }
  }

  function onScroll() {
    els.nav.classList.toggle("is-stuck", els.nav.getBoundingClientRect().top <= 0.5);
    els.toTop.classList.toggle("is-visible", window.scrollY > 700);
    if (performance.now() > spyLockUntil) updateSpy();
  }

  function observeReveal() {
    const nodes = els.menu.querySelectorAll(".reveal");
    if (revealObserver) revealObserver.disconnect();

    if (reduceMotion || !("IntersectionObserver" in window)) {
      nodes.forEach((n) => n.classList.add("is-in"));
      return;
    }

    revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.04 }
    );
    nodes.forEach((n) => revealObserver.observe(n));
  }

  /* ---------- Events ---------- */
  document.querySelectorAll(".lang button").forEach((btn) => {
    btn.addEventListener("click", () => switchLang(btn.dataset.lang));
  });

  els.navList.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    const section = chip && document.getElementById(chip.dataset.target);
    if (!section) return;

    setActive(section.id);
    section.classList.add("is-in");
    spyLockUntil = performance.now() + 1200;

    const top = section.getBoundingClientRect().top + window.scrollY - els.nav.offsetHeight - 10;
    window.scrollTo({ top, behavior: reduceMotion ? "auto" : "smooth" });
  });

  els.search.addEventListener("input", () => {
    state.query = els.search.value;
    els.clear.hidden = !state.query;
    render();
  });

  els.search.addEventListener("keydown", (e) => {
    if (e.key === "Escape") clearSearch();
  });

  els.clear.addEventListener("click", () => {
    clearSearch();
    els.search.focus();
  });

  function clearSearch() {
    els.search.value = "";
    state.query = "";
    els.clear.hidden = true;
    render();
  }

  // Press "/" anywhere to jump to search
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement !== els.search) {
      e.preventDefault();
      els.search.focus();
    }
  });

  els.toTop.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  });

  let ticking = false;
  window.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        onScroll();
      });
    },
    { passive: true }
  );

  window.addEventListener("scrollend", () => {
    spyLockUntil = 0;
    updateSpy();
  });

  window.addEventListener("resize", updateSpy);

  els.clubForm.addEventListener("submit", submitClub);

  /* ---------- Start ---------- */
  els.club.hidden = !club.enabled;
  els.clubLink.hidden = !club.enabled;
  if (window.MENU.theme && window.MENU.theme.brand) {
    document.querySelector('meta[name="theme-color"]').setAttribute("content", window.MENU.theme.brand);
  }

  applyLang(state.lang, { initial: true });
  onScroll();
})();
