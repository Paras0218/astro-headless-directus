# Thrive — Astro Front-End

The SSR front-end for the Thrive marketing site. It renders fully CMS-editable
content fetched from a **Directus** back-end, and falls back to built-in
TypeScript defaults if Directus is unreachable (so the site never breaks).

> **Back-end setup is a separate guide:** see [`E:\directus-cms\README.md`](../directus-cms/README.md).
> This README covers the front-end only.

```
┌─────────────────┐   REST + static token   ┌──────────────────┐
│  Astro (SSR)    │ ─────────────────────▶ │  Directus CMS     │
│  localhost:4321 │  /items/<collection>    │  localhost:8055   │
└─────────────────┘                         └──────────────────┘
```

---

## Prerequisites

- **Node.js 20+** (24 used in dev)
- A running **Directus** back-end (local or remote) — see the Directus README
- The Directus **static token** (so the front-end can read content)

## Setup

```powershell
cd E:\Astro-headless
npm install
# create .env (see below)
npm run dev          # → http://localhost:4321
```

### Environment variables — `.env`

```ini
# Directus connection
DIRECTUS_URL=http://localhost:8055
DIRECTUS_STATIC_TOKEN=<token from E:\directus-cms\static-token.txt>

# SMTP for the lead form (/api/lead). Gmail app password, spaces removed.
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<your@gmail.com>
SMTP_PASS=<gmail-app-password>
SMTP_FROM=<your@gmail.com>
LEAD_NOTIFY_TO=<inbox-to-receive-leads@example.com>
```

`.env` is git-ignored — never commit real secrets.

---

## Run commands

| Command | What it does |
|---------|--------------|
| `npm run dev` | Dev server with HMR → <http://localhost:4321> |
| `npm run build` | Production build → `dist/` (`@astrojs/node` standalone) |
| `npm start` | Run the production build → `HOST=0.0.0.0 node ./dist/server/entry.mjs` |
| `npm run preview` | Preview the production build |
| `npm run check` | `astro check` (type checking) |

---

## Tech stack

- **Astro 4** — `output: 'hybrid'` + `@astrojs/node` (standalone). Content pages
  set `export const prerender = false` → live SSR (CMS edits show on refresh).
- **Tailwind CSS** (`@astrojs/tailwind`) + **astro-icon** (Lucide icon set).
- **nodemailer** — lead-form emails via the `/api/lead` endpoint.

## Project structure

```
src/
├─ pages/                       # routes
│  ├─ index.astro               # home
│  ├─ digital-marketing-services.astro
│  ├─ digital-marketing-services/digital-marketing-strategy-development.astro
│  ├─ enterprise-digital-marketing.astro
│  ├─ search.astro
│  └─ api/lead.ts               # POST: store lead in Directus + email
├─ components/                  # SiteHeader, SiteFooter, …
├─ layouts/Layout.astro         # <head>, header/footer, optional `head` slot
└─ lib/directus.ts              # typed getters + fail-safe DEFAULT_* content
```

## How content works

Every page imports a typed getter from [`src/lib/directus.ts`](src/lib/directus.ts)
(`getHomepage()`, `getEnterprise()`, `getNavItems()`, …). Each getter:

1. Fetches from Directus with the static token.
2. Returns a **fail-safe default** if Directus is down or a field is blank — so
   the site always renders.

Repeating sections use a newline / `|`-delimited row convention parsed in the
`.astro` page (see `digital-marketing-strategy-development.astro` and
`enterprise-digital-marketing.astro`).

## Routes

| Route | Source |
|-------|--------|
| `/` | `getHomepage()` + home collections |
| `/digital-marketing-services` | `getDMS()` + dms collections |
| `/digital-marketing-services/digital-marketing-strategy-development` | `getDMSStrategy()` |
| `/enterprise-digital-marketing` | `getEnterprise()` |
| `/search` | `getSearchPage()` (indexes nav + mega-menu links) |
| `/api/lead` (POST) | Stores a lead in Directus + emails via SMTP |

---

## Deployment (Render)

This app is **SSR**, so deploy it as a **Web Service** (not a Static Site):

- **Build command:** `npm install && npm run build`
- **Start command:** `npm start`
- **Environment:** `HOST=0.0.0.0`, `DIRECTUS_URL=<directus public url>`,
  `DIRECTUS_STATIC_TOKEN`, and the `SMTP_*` vars.

Render injects `PORT`; the Node adapter binds to `HOST`+`PORT`.

## Notes

- If Directus is unreachable, pages render from the defaults in `directus.ts`
  (you'll see placeholder copy instead of CMS content).
- Keep `DIRECTUS_STATIC_TOKEN` in sync with the token on the Directus admin user
  (`E:\directus-cms\static-token.txt`).
