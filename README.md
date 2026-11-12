# Lotmates

Neighbourhood group buying: neighbours book a deal together, the price drops as more homes join, and early bookers get the difference back.

- `site/` – Astro 5 shell with a React 19 + Tailwind 4 single-page app (`npm ci && npm run build`).
- `lotmates-core/` – WordPress plugin (REST namespace `lotmates/v1`): data tables, roles, payments, emails, link-preview cards.

## Build

```bash
cd site
cp .env.example .env   # function names for the payment endpoints
npm ci
npm run build          # output in site/dist
```

Payment keys are entered in WordPress admin (Settings → Lotmates payments), never in this repo. `.env`, `up.env` and build output are git-ignored.
