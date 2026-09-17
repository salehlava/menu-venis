# Venice Café Menu · منوی کافه ونیز

This is a digital menu for Venice Café in **Persian (RTL)** and **English**. It comes with:

- an **admin panel** protected by username and password, for editing prices and items, menu colors and cafe info;
- a **Customer Club**, where visitors join from the menu and the admin sends them SMS messages.

**Live menu (for customers / QR codes):** https://salehlava.github.io/venezia/

> **Two repositories:** this one is **private** and holds all the source code. The published menu lives in the
> public repository `salehlava/venezia`, which contains only the finished menu page. `npm run publish` updates it.

**Theme:** mallard green (green-headed goose) · rose gold · gray. The admin can change these colors.
**Stack:** Node.js with no dependencies (nothing to `npm install`), plain HTML/CSS/JS, and JSON files for storage.

---

## Contents

1. [Quick start](#quick-start)
2. [Project structure](#project-structure)
3. [Admin panel](#admin-panel)
4. [Customer Club](#customer-club)
5. [Connecting an SMS panel](#connecting-an-sms-panel)
6. [Data and backups](#data-and-backups)
7. [Configuration](#configuration)
8. [Deployment](#deployment)
9. [Security](#security)
10. [API reference](#api-reference)
11. [Notes on the source price list](#notes-on-the-source-price-list)
12. [راهنمای فارسی](#راهنمای-فارسی)

---

## Quick start

You need **Node.js 20 or newer**.

```bash
# 1. Create the admin account (asks for a username and a password)
npm run set-admin

# 2. Start the server
npm start
```

| Address | What it is |
|---|---|
| http://localhost:3000 | The public menu |
| http://localhost:3000/admin | The admin panel |

While you're developing, `npm run dev` restarts the server whenever a file changes.

> The site now needs the server to run. Opening `index.html` directly no longer works, because the menu data, the colors and the club sign-ups all come from the server.

## Project structure

```
menu-venis/
├── public/                      Everything the browser loads
│   ├── index.html               Public menu page
│   ├── css/style.css            Menu styles (colors come from /css/theme.css)
│   ├── js/app.js                Menu rendering, language switch, search, club form
│   └── admin/                   Admin panel (single-page app)
│       ├── index.html
│       ├── admin.css
│       └── js/
│           ├── main.js          Login check, layout, router
│           ├── api.js           API calls
│           ├── i18n.js          Admin texts in Persian + English
│           ├── ui.js            Shared UI helpers (dialogs, toasts, icons)
│           └── views/           dashboard, menu, theme, info, customers, sms, settings, login
├── server/
│   ├── index.js                 HTTP server entry point
│   ├── config.js                Settings from environment variables
│   ├── services.js              Reads and writes the menu, theme, club and customers
│   ├── routes/public.js         /js/menu-data.js, /css/theme.css, club sign-up
│   ├── routes/admin.js          Admin API (login required)
│   ├── lib/                     auth, store (JSON files), validation, phone numbers, SMS
│   │   └── sms/providers/       SMS provider adapters ← connect your SMS panel here
│   └── seed/menu.json           Starting menu (copied to data/ on first run)
├── shared/theme.js              Turns 4 base colors into the full palette (used by server + admin)
├── scripts/set-admin.js         Creates or resets the admin account
├── data/                        Live data, created automatically (not in git)
└── peymets-commodity.txt        Original price list
```

The public menu loads two addresses that the server **generates** from the admin settings:

- `/js/menu-data.js` contains the menu (hidden items removed), the cafe info and the club form texts.
- `/css/theme.css` contains the color palette.

## Admin panel

Open `/admin` and sign in. The panel works on phones, and you can switch it between Persian and English.

| Section | What you can do |
|---|---|
| **Dashboard** | Number of menu items, club members, birthdays today, SMS sent, and whether the SMS panel is connected. |
| **Menu & prices** | Edit Persian and English names and prices directly in the list. Add, delete and reorder items and categories. Hide an item without deleting it (the **Visible** switch). Add a description and a badge (Signature / New / Popular). Leave the price empty to show "Daily price / قیمت روز". |
| ↳ **Adjust prices** | Raise or lower all prices, or one category, by a percentage, with rounding (for example +15%, rounded to the nearest 5). You see the result before saving. |
| ↳ **History** | A backup is taken before every save (the last 30 are kept). You can restore any one of them. |
| **Menu colors** | Ready-made color sets or your own main, accent, neutral and background colors. A live phone preview shows light and dark mode. Automatic dark mode can be turned on or off. The panel warns you when the header text would be hard to read. |
| **Cafe info** | Name, tagline, browser tab title, price note, default language, opening hours, address, phone and Instagram. |
| **Customer Club** | Member list with search, filters (accepts SMS, birthday today or this month, source), add, edit and delete, a per-customer SMS on/off switch, and CSV export (opens in Excel). You can select members and send them an SMS. |
| **Send SMS** | Choose recipients (all members, birthday today, birthday this month, or selected customers). Write the message with `{name}` for personalization, use templates, see a character and SMS-part counter, send a test, and review the send history. |
| **Settings** | Turn the club on or off and edit its form texts. Set up the welcome SMS and the SMS provider. Change the admin username and password. |

Save buttons appear as soon as you change something. If you try to leave a page with unsaved changes, the panel asks first. In the menu editor, `Ctrl+S` saves.

## Customer Club

- A sign-up card appears near the bottom of the menu, and a **Club** button in the header jumps to it.
- Visitors enter their **name**, **mobile number** and, if they want, their **birthday** (day and month), and they must **agree to receive SMS**.
  - Persian visitors pick a **Jalali** month and English visitors pick a **Gregorian** month. The calendar is saved with the birthday, so "birthday today" is always correct.
- Mobile numbers are cleaned up automatically: `۰۹۱۲…`, `+98912…` and `0098912…` all become `0912…`. Each number can join only once.
- Spam protection includes a hidden trap field and a limit of 10 sign-ups per hour from each IP address.
- If **Welcome SMS** is on and an SMS panel is connected, new members get a welcome message.
- Birthdays are checked in the `Asia/Tehran` time zone. You can change this with `TIME_ZONE`.

## Connecting an SMS panel

The club collects members right away. Sending SMS needs a provider adapter, which is one small file.

1. Copy `server/lib/sms/providers/_template.js` to a new file, for example `providers/kavenegar.js`.
2. In that file, set `id`, `label` and `fields` (usually the API key and the sender line number). Write `send(messages, config)` using your provider's API documentation. It receives `[{ to: "0912…", text }]` and must return `[{ to, ok, id?, error? }]`.
3. Register the file in `server/lib/sms/index.js`:
   ```js
   const PROVIDERS = [
     require("./providers/none"),
     require("./providers/kavenegar"),
   ];
   ```
4. Restart the server. Then go to **Admin → Settings → SMS panel**, choose the provider and enter the API key.

API keys are stored only on the server in `data/sms-settings.json`. The admin panel shows them masked (`••••1234`).

**Testing without a real panel:** start the server with `SMS_DEV=1`. A "Test mode (server console)" provider appears, and it prints messages in the terminal instead of sending them.

```bash
SMS_DEV=1 npm start          # PowerShell: $env:SMS_DEV=1; npm start
```

## Data and backups

Live data is stored in `data/`, which is created on first run and excluded from git:

| File | Contents |
|---|---|
| `admin.json` | Admin username and **password hash** (scrypt; the password itself is never stored) |
| `menu.json` | Categories, items, prices and cafe info |
| `theme.json` | Menu colors |
| `customers.json` | Club members (name, mobile, birthday, SMS consent, notes) |
| `club-settings.json` | Club on/off, form texts, welcome SMS |
| `sms-settings.json` | SMS provider and API key |
| `sms-log.json` | Send history (last 500) |
| `backups/menu-*.json` | Menu versions (last 30) |

**Back up the `data/` folder regularly.** It holds your customer list. To start with a fresh menu, delete `data/menu.json`; it is recreated from `server/seed/menu.json`.

## Configuration

All settings are optional environment variables:

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | Port the server listens on |
| `HOST` | `0.0.0.0` | Network address to listen on |
| `DATA_DIR` | `./data` | Where live data is stored |
| `TRUST_PROXY` | off | Set to `1` behind nginx or a hosting proxy, so real client IPs and HTTPS are detected (secure cookies) |
| `SESSION_HOURS` | `12` | How long an admin stays signed in |
| `TIME_ZONE` | `Asia/Tehran` | Time zone used for "birthday today" |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | — | Creates the admin on first start if none exists (handy on hosting panels) |
| `SMS_DEV` | off | `1` enables the console test SMS provider |

## The public menu link (GitHub Pages)

The menu is published for free at **https://salehlava.github.io/venezia/** — anyone can open it, and it is the address to put on a QR code.

It is served from the separate **public** repository `salehlava/venezia`, so this source repository can stay private.

That link is a **static copy** of the menu: it needs no server, so it costs nothing and is always online. Because there is no server behind it:

- the **admin panel** is not there (you run it on your own computer with `npm start`);
- the **Customer Club form is hidden**, since sign-ups need the server.

### Updating the public menu

After changing prices, items or colors in the admin panel, run one command:

```bash
npm run publish
```

It exports your live data to `docs/`, copies it into the public menu repository and pushes it. The public link
updates about a minute later. (`npm run export` only builds `docs/` without publishing.)

> To put the **whole** system online — admin panel and club sign-ups included — deploy the Node server to a host (see below) and point your QR code at that address instead.

## Deployment

You need a host that can **run Node.js**. Static-only hosting is not enough anymore. Some options:

- **Iranian Node platforms** (Liara, Chabokan, Hamravesh, …): upload the project, set the start command to `npm start`, and attach a **persistent disk** mounted at `DATA_DIR`. Without persistent storage, customers and menu edits are lost when the app redeploys. Set `ADMIN_USERNAME`, `ADMIN_PASSWORD` and `TRUST_PROXY=1`.
- **cPanel with "Setup Node.js App"**: set the application startup file to `server/index.js`.
- **VPS**: run the server with a process manager, and put nginx in front of it for HTTPS.

  ```bash
  npm run set-admin
  PORT=3000 TRUST_PROXY=1 pm2 start server/index.js --name venice-menu
  ```

  Example nginx configuration:

  ```nginx
  server {
    server_name menu.example.com;
    location / {
      proxy_pass http://127.0.0.1:3000;
      proxy_set_header Host $host;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
    }
  }
  ```

**Always use HTTPS in production**, because admin passwords and customer phone numbers travel over this connection.

QR code addresses:

```
https://menu.example.com/            → default language
https://menu.example.com/?lang=fa    → Persian
https://menu.example.com/?lang=en    → English
https://menu.example.com/#smoothies  → jump to a category
```

## Security

- **Passwords:** hashed with scrypt, using a random salt for each password.
- **Brute force:** after 5 failed sign-ins, that IP address is locked out for 15 minutes.
- **Sessions:** random tokens held in server memory, sent in an `HttpOnly`, `SameSite=Strict` cookie (`Secure` under HTTPS). Changing the password signs out every other device. Restarting the server signs everyone out.
- **CSRF:** every admin request that changes data must include the `X-Venice-Admin: 1` header, and cross-site requests cannot add it.
- **Server-side checks:** the server validates every input: text lengths, prices, color hex codes (colors are never written into CSS unchecked), phone numbers and birthdays.
- **XSS:** the menu escapes all text, and the admin panel builds pages with DOM text nodes.
- **Admin page headers:** a strict Content-Security-Policy, `noindex`, and `X-Frame-Options: SAMEORIGIN`.
- **Files:** the server only serves files from `public/` and `shared/`. `data/`, `server/` and dotfiles are never served.
- **CSV export:** protected against spreadsheet formula injection.

## API reference

**Public** (no sign-in):

| Method | Path | Description |
|---|---|---|
| GET | `/js/menu-data.js` | Menu data for the public page |
| GET | `/css/theme.css` | Generated color palette |
| POST | `/api/club/join` | `{ name, phone, birthday?: {cal, m, d}, consent: true, lang }` |

**Admin** (session cookie required; data-changing requests also need `X-Venice-Admin: 1`):

| Method | Path | Description |
|---|---|---|
| POST | `/api/admin/login` · `/logout` | Sign in or out |
| GET | `/api/admin/me` | Current admin |
| PUT | `/api/admin/account` | `{ currentPassword, username?, newPassword? }` |
| GET | `/api/admin/overview` | Dashboard numbers |
| GET | `/api/admin/menu` | Full menu, including hidden items |
| PUT | `/api/admin/menu/categories` | `{ categories }` |
| PUT | `/api/admin/menu/cafe` | Cafe info |
| GET / POST | `/api/admin/menu/backups` · `/menu/restore` | List backups / restore `{ file }` |
| GET / PUT | `/api/admin/theme` | `{ brand, accent, neutral, background, darkMode }` |
| GET / POST | `/api/admin/customers` | List / create |
| PUT / DELETE | `/api/admin/customers/:id` | Update / delete |
| GET / PUT | `/api/admin/club` | Club settings |
| GET / PUT | `/api/admin/sms/settings` | SMS provider settings |
| POST | `/api/admin/sms/send` | `{ message, audience: all \| birthday-today \| birthday-month \| selected, ids? }` |
| POST | `/api/admin/sms/test` | `{ phone, message }` |
| GET | `/api/admin/sms/log` | Send history |

## Notes on the source price list

`peymets-commodity.txt` was turned into the starting menu (`server/seed/menu.json`) with these decisions. **Please check them with the cafe.** You can change any of them in the admin panel.

| In the source list | On the menu | Why |
|---|---|---|
| "Shake" section listed twice | Listed once | Exact duplicate |
| Last untitled list (Sun mix, Red smoothie, …) | Used as the **Smoothie names**, with the fruit as the description | Each one matches a smoothie with the same price |
| Sitraious | Citrious / سیتریوس | Spelling guess |
| Certado, Frappacino, Krak Tea, Romano Presso, Roulette | Cortado, Frappuccino, Karak Tea, Espresso Romano, Roulade | Spelling fixes |
| Garden Tongue | Borage / گل گاوزبان | Translation |
| Demi Tea | Brewed Tea / چای دمی | Clearer in English |
| Talebi | Cantaloupe / طالبی | Translation |
| Capo Classic, all cakes | "Daily price" | **Prices missing** |
| Capo Gulf | Capo Gulf / کاپو گلف | Meaning unclear |
| Lemon (herbal) | Lemon / دمنوش لیمو | Might be به‌لیمو |
| Category "Cappuccino" | "Cappuccino & Chocolate" | The section includes the hot chocolates |

---

## راهنمای فارسی

### راه‌اندازی
۱. نسخه ۲۰ یا جدیدتر Node.js را نصب کنید.
۲. در پوشه پروژه، دستور `npm run set-admin` را اجرا کنید و نام کاربری و رمز عبور مدیر را بسازید.
۳. دستور `npm start` را اجرا کنید.
۴. منو در آدرس `http://localhost:3000` و پنل مدیریت در آدرس `http://localhost:3000/admin` است.

### پنل مدیریت
- **منو و قیمت‌ها:** قیمت یا نام را در همان جدول تغییر دهید و «ذخیره تغییرات» را بزنید. برای پنهان کردن موقت یک آیتم، کلید «نمایش» را خاموش کنید. اگر قیمت را خالی بگذارید، روی منو «قیمت روز» نمایش داده می‌شود.
- **تغییر گروهی قیمت:** همه قیمت‌ها را با یک درصد مشخص (مثلاً ۱۵٪) و با گرد کردن افزایش دهید.
- **تاریخچه:** قبل از هر ذخیره، یک نسخه پشتیبان گرفته می‌شود و می‌توانید به هر نسخه برگردید.
- **رنگ‌بندی منو:** یک طرح آماده انتخاب کنید یا رنگ‌ها را خودتان تعیین کنید. پیش‌نمایش زنده در کنار صفحه نمایش داده می‌شود.
- **اطلاعات کافه:** نام، شعار، ساعت کاری، آدرس، تلفن و اینستاگرام.
- **باشگاه مشتریان:** فهرست اعضا، جستجو، فیلتر تولد، افزودن و ویرایش، و خروجی اکسل.
- **ارسال پیامک:** ارسال به همه اعضا، متولدین امروز یا این ماه، یا مشتریان انتخاب‌شده. با `{name}` نام مشتری داخل پیام قرار می‌گیرد.
- **تنظیمات:** فعال یا غیرفعال کردن باشگاه، پیامک خوش‌آمد، پنل پیامک، و تغییر رمز عبور.

### اتصال پنل پیامک
برنامه‌نویس از روی فایل `server/lib/sms/providers/_template.js` یک فایل سرویس برای پنل پیامک شما (مثل کاوه‌نگار، SMS.ir یا ملی‌پیامک) می‌سازد و آن را در `server/lib/sms/index.js` ثبت می‌کند. بعد از آن، از بخش «تنظیمات ← پنل پیامک» سرویس را انتخاب کنید و کلید API را وارد کنید.

### نکات مهم
- از پوشه `data` به‌طور منظم نسخه پشتیبان بگیرید. اطلاعات مشتریان در این پوشه است.
- روی سرور اصلی حتماً از HTTPS استفاده کنید.
- اگر رمز عبور را فراموش کردید، روی سرور دستور `npm run set-admin` را دوباره اجرا کنید.
