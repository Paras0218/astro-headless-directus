# Thrive — Headless Astro + Directus Site

A headless marketing website: an **Astro** (SSR) front-end that renders fully
CMS-editable content served by a **Directus** back-end on **PostgreSQL**. Every
page degrades safely — if Directus is unreachable, the front-end falls back to
built-in TypeScript defaults so the site never breaks.

```
┌─────────────────┐      REST + static token      ┌──────────────────┐      ┌──────────────┐
│  Astro frontend │ ───────────────────────────▶ │  Directus CMS     │ ───▶ │ PostgreSQL   │
│  (SSR, :4321)   │   /items/<collection>         │  (:8055 /admin)   │      │ directus_cms │
└─────────────────┘                               └──────────────────┘      └──────────────┘
```

---

## 1. Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| **Node.js** | 20+ (24 used in dev) | Front-end + Directus both run on Node |
| **PostgreSQL** | 16 / 17 | Directus database |
| **npm** | bundled with Node | |
| **Git** | any | |

Two folders make up the project (kept side by side):

| Path | What |
|------|------|
| `E:\Astro-headless` | **Front-end** (this repo) — Astro SSR site |
| `E:\directus-cms`   | **Back-end** — Directus install + setup/seed scripts |

> The front-end and back-end are separate Node projects with their own
> `package.json` and `.env`.

---

## 2. First-time setup

### 2.1 Database (PostgreSQL)

Create the Directus database (one-time):

```powershell
& "C:\Program Files\PostgreSQL\17\bin\createdb.exe" -U postgres -p 5432 -E UTF8 directus_cms
```

### 2.2 Back-end (Directus) — `E:\directus-cms`

1. Create `E:\directus-cms\.env`:

   ```ini
   # --- Server ---
   HOST=0.0.0.0
   PORT=8055
   PUBLIC_URL=http://localhost:8055
   KEY=<random-uuid>
   SECRET=<random-uuid>
   TELEMETRY=false
   LOG_LEVEL=info

   # --- Database (local PostgreSQL) ---
   DB_CLIENT=pg
   DB_HOST=127.0.0.1
   DB_PORT=5432
   DB_DATABASE=directus_cms
   DB_USER=postgres
   DB_PASSWORD=<your-postgres-password>

   # --- First admin (created on bootstrap) ---
   ADMIN_EMAIL=admin@example.com
   ADMIN_PASSWORD=<your-admin-password>
   ```

2. Install deps + bootstrap the database (creates system tables + the admin user):

   ```powershell
   cd E:\directus-cms
   npm install
   npm run bootstrap
   ```

3. Start Directus and log in at <http://localhost:8055/admin>:

   ```powershell
   npm run start
   # or: .\node_modules\.bin\directus.cmd start
   ```

4. **Seed the content collections.** The `setup-*.mjs` scripts create each
   collection's fields and seed content via the Directus API (Directus must be
   running). Run the ones you need, e.g.:

   ```powershell
   node setup-homepage-full.mjs
   node setup-megamenu.mjs
   node setup-header.mjs
   node setup-services-promo.mjs
   node setup-results.mjs
   node setup-search.mjs
   node setup-dms.mjs
   node setup-dms-strategy.mjs
   node setup-enterprise.mjs
   ```

   Each script sets a **static admin token** on the admin user (saved to
   `static-token.txt`). Copy that token into the front-end `.env`
   (`DIRECTUS_STATIC_TOKEN`) so the front-end can read content.

   > To target a **remote** Directus instead of local, set env vars before the
   > script: `$env:DIRECTUS_URL="https://…"; $env:ADMIN_PASSWORD="…"; node setup-enterprise.mjs`

### 2.3 Front-end (Astro) — `E:\Astro-headless`

1. Create `E:\Astro-headless\.env`:

   ```ini
   DIRECTUS_URL=http://localhost:8055
   DIRECTUS_STATIC_TOKEN=<token from E:\directus-cms\static-token.txt>

   # --- SMTP (lead-form notification emails; Gmail app password, no spaces) ---
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=<your@gmail.com>
   SMTP_PASS=<gmail-app-password>
   SMTP_FROM=<your@gmail.com>
   LEAD_NOTIFY_TO=<inbox-to-receive-leads@example.com>
   ```

2. Install + run:

   ```powershell
   cd E:\Astro-headless
   npm install
   npm run dev
   ```

   Open <http://localhost:4321>.

---

## 3. Run commands

### Front-end (`E:\Astro-headless`)

| Command | What it does |
|---------|--------------|
| `npm run dev` | Dev server with HMR → <http://localhost:4321> |
| `npm run build` | Production build → `dist/` (`@astrojs/node` standalone server) |
| `npm start` | Run the production build → `node ./dist/server/entry.mjs` (binds `HOST`/`PORT`) |
| `npm run preview` | Preview the production build |
| `npm run check` | `astro check` (type checking) |

### Back-end (`E:\directus-cms`)

| Command | What it does |
|---------|--------------|
| `npm run bootstrap` | Create/migrate Directus system tables + first admin |
| `npm run start` | Start Directus → <http://localhost:8055> (admin at `/admin`) |
| `node setup-*.mjs` | Create + seed a content collection (Directus must be running) |

---

## 4. Tech stack

- **Astro 4** — `output: 'hybrid'` + `@astrojs/node` (standalone). Content pages
  use `export const prerender = false` (live SSR; CMS edits show on refresh).
- **Tailwind CSS** (`@astrojs/tailwind`) + **astro-icon** (Lucide icon set).
- **nodemailer** — lead-form emails via the `/api/lead` endpoint.
- **Directus 11** on **PostgreSQL** — headless CMS, read with a static token.

---

## 5. Content model (Directus collections)

Singletons: `homepage`, `search_page`, `header`, `services_promo`, `dms`,
`dms_strategy`, `enterprise`.
Repeatable: `nav_items`, `mega_menu`, `result_cards`, `home_results`,
`home_wins`, `home_aiv`, `home_tools`, `home_values`, `testimonials`,
`dms_cases`, `dms_testimonials`, `dms_tools`, `dms_services`, `dms_reasons`,
`dms_faqs`, `strategy_faqs`, `strategy_reasons`, `leads`.

The front-end accesses these through typed helpers in
[`src/lib/directus.ts`](src/lib/directus.ts) (`getHomepage()`, `getEnterprise()`, …),
each returning a fail-safe default when Directus is unavailable.

## 6. Routes

| Route | Source |
|-------|--------|
| `/` | `getHomepage()` + home collections |
| `/digital-marketing-services` | `getDMS()` + dms collections |
| `/digital-marketing-services/digital-marketing-strategy-development` | `getDMSStrategy()` |
| `/enterprise-digital-marketing` | `getEnterprise()` |
| `/search` | `getSearchPage()` (indexes nav + mega-menu links) |
| `/api/lead` (POST) | Stores a lead in Directus + emails via SMTP |

---

## 7. Deployment (Render)

- **Database:** managed PostgreSQL (Render or Neon). Use the **internal**
  connection string for the Directus service.
- **Directus:** a Web Service (official `directus/directus` Docker image) with
  `DB_CLIENT=pg`, `DB_CONNECTION_STRING=<internal pg url>`, fixed `KEY`/`SECRET`,
  `PUBLIC_URL`, `ADMIN_EMAIL`/`ADMIN_PASSWORD`.
- **Front-end:** a **Web Service** (not a Static Site — the app is SSR):
  - Build command: `npm install && npm run build`
  - Start command: `npm start`
  - Env: `HOST=0.0.0.0`, `DIRECTUS_URL=<directus public url>`,
    `DIRECTUS_STATIC_TOKEN`, and the `SMTP_*` vars.

Seed a remote Directus by pointing the setup scripts at it
(`$env:DIRECTUS_URL`, `$env:ADMIN_PASSWORD`) once the service is up.

---

## 8. Notes

- **`.env` files are not committed** — set them locally / in the host dashboard.
- The **static token** lives on the Directus admin user; keep
  `DIRECTUS_STATIC_TOKEN` (front-end) in sync with `static-token.txt`.
- If Directus is down, pages still render from the defaults in `directus.ts`
  (you'll see placeholder copy instead of CMS content).
