# trip2movie — fake-door landing page

A single-page "fake door" to validate demand for trip2movie (turn trip photos + clips into a
short cinematic film). It looks and behaves like the real product, but takes **no payment** —
every call to action collects an email for the waitlist and records which pricing people click.

- **No app backend, no database to run.** Just a static page + one tiny serverless function.
- **Analytics:** PostHog (autocaptures every click + scroll) and Vercel Web Analytics.
- **Data + waitlist:** Vercel serverless functions store signups & signals in Supabase Postgres, and serve a live waitlist count.
- **Built-in price A/B/C test** to learn willingness-to-pay before launch.

---

## Project structure

```
trip2movie/
├─ index.html         # the entire page (HTML + CSS + JS inline)
├─ api/
│  ├─ subscribe.js    # POST — store a signup, return the live waitlist count
│  ├─ waitlist.js     # GET  — the live, DB-backed waitlist count
│  └─ event.js        # POST — store conversion signals (pricing clicks, WTP)
├─ lib/
│  └─ db.js           # shared Supabase Postgres client + schema bootstrap
├─ db/
│  └─ schema.sql      # the tables (auto-created; also paste-able in Supabase)
├─ assets/            # your real photos & video clips (see "Add real media")
├─ vercel.json        # clean URLs + asset caching
├─ package.json       # ESM + the `postgres` dependency
└─ README.md
```

There is **no build step** — Vercel serves `index.html` statically, installs the `postgres`
dependency, and runs the `/api` functions on demand.

---

## Quick start (TL;DR)

1. Deploy to Vercel (see [Deploy](#1-deploy-to-vercel)).
2. Paste your **PostHog** key into `index.html` (see [PostHog](#2-set-up-posthog-analytics)).
3. Turn on **Vercel Web Analytics** in the dashboard (see [Vercel Analytics](#3-turn-on-vercel-web-analytics)).
4. Add a **Supabase Postgres** `DATABASE_URL` env var so data is stored and the count goes live (see [Database](#4-set-up-the-database-supabase-postgres)).

Until you do 2–4, the page still works perfectly — analytics are no-ops, signups just log instead
of storing, and the waitlist number shows the seeded fallback. Nothing breaks.

---

## 1. Deploy to Vercel

### Option A — Vercel CLI (fastest)

```bash
npm i -g vercel          # install the CLI (or: pnpm add -g vercel)
cd trip2movie
vercel                   # first run links/creates the project → gives you a preview URL
vercel --prod            # promote to your production domain
```

When prompted for settings, accept the defaults. Framework preset = **Other**, no build command.

### Option B — Git (recommended for ongoing work)

1. Push this folder to a GitHub/GitLab/Bitbucket repo.
2. In the Vercel dashboard → **Add New… → Project** → import the repo.
3. Framework preset: **Other**. Leave build & output settings empty. Click **Deploy**.
4. Every push to your main branch now auto-deploys to production; every PR gets a preview URL.

### Test the serverless function locally

The plain static preview can't run `/api`. To exercise the function on your machine:

```bash
vercel dev               # serves the page AND the function at http://localhost:3000
```

---

## 2. Set up PostHog (analytics)

PostHog autocaptures **every click (any element) and scroll depth** with zero extra tagging,
and also receives our custom events (`pricing_cta_click`, `lead_captured`, `wtp_response`, …), each tagged with
the visitor's price variant.

1. Create a free account at <https://posthog.com> and a new project.
2. Go to **Settings → Project → API keys** and copy the **Project API key** (starts with `phc_`).
3. Open `index.html`, find this line near the top:
   ```js
   var POSTHOG_KEY="phc_REPLACE_WITH_YOUR_PROJECT_KEY";
   ```
   Replace the placeholder with your key.
4. **If your PostHog project is in the EU**, also change the host in the same `<script>` block
   and in `posthog.init(...)`:
   ```js
   api_host:"https://eu.i.posthog.com"   // was us.i.posthog.com
   ```
5. Redeploy. Open the live page, click around, then check **Activity → Live events** in PostHog —
   you'll see autocaptured `$autocapture`, `$pageview`, and your custom events streaming in.

> The Project API key is a **public, client-side** key — it's safe to commit in `index.html`.

**Recommended toggles** (in PostHog dashboard):
- **Heatmaps** → see where people click/scroll on the page.
- **Session Replay** → watch real sessions.
- Build a **Funnel**: `$pageview → pricing_cta_click → lead_captured`, broken down by
  `price_variant`, to see which price converts best.

---

## 3. Turn on Vercel Web Analytics

The page already includes the Vercel Analytics script; it just needs enabling.

1. Vercel dashboard → your project → **Analytics** tab → **Enable**.
2. Redeploy (or wait for the next deploy). Traffic and your custom events will appear there.

---

## 4. Set up the database (Supabase Postgres)

All collected data lives in **Supabase Postgres** — two tidy tables (`signups`, `events`) you can
browse and export from the Supabase **Table Editor**. The waitlist number is read from here too.

1. Create a project at <https://supabase.com> (free tier is plenty).
2. **Project Settings → Database → Connection string → "Transaction" pooler** (port **6543**).
   Copy that URI and fill in your DB password.
3. In Vercel → your project → **Settings → Environment Variables**, add:
   - `DATABASE_URL` = the transaction-pooler connection string from step 2.
   - *(optional)* `WAITLIST_SEED` = the base number the counter starts from (default `3120`).
4. Redeploy. The tables **auto-create on first request** (via `ensureSchema()` in `lib/db.js`).
   Prefer to set them up explicitly? Paste [`db/schema.sql`](db/schema.sql) into the Supabase
   **SQL Editor** once.
5. Submit a test email on the live page → the hero number ticks up and the row appears in the
   `signups` table.

> The functions use the porsager **`postgres`** driver with `prepare:false` (required by the
> Supabase transaction pooler). Vercel installs the dependency automatically from `package.json`.

### What gets stored

| Table | Rows | Key columns |
|-------|------|-------------|
| `signups` | one per unique email (de-duped) | `email, source, tier, price_variant, wtp_amount, created_at` |
| `events`  | conversion signals (pricing clicks, WTP) | `name, email, tier, price_variant, amount, props, created_at` |

### Read / export (Supabase Table Editor → or SQL Editor)

```sql
select count(*) from signups;                                   -- real signups (number shown = WAITLIST_SEED + this)
select email, source, tier, price_variant, wtp_amount, created_at
  from signups order by created_at desc;                        -- the list (export as CSV from the UI)
select amount, count(*) from events
  where name = 'wtp_response' group by amount order by amount;   -- willingness-to-pay distribution
```

> Emails are **de-duplicated** (a repeat signup won't create a second row or inflate the count).
> Because PostHog also `identify()`s each email, you have a second copy of the list there too.

### How the live waitlist number works

`GET /api/waitlist` returns `WAITLIST_SEED + count(signups)`. The page fetches it on load, and
`POST /api/subscribe` returns the new count so the pill ticks up the instant someone joins.
It's deterministic — identical on refresh, +1 when they sign up — so the seeded base feels real.

---

## Configuration reference

All of these live inside `index.html`.

### Waitlist count (social proof)
```js
var WAITLIST = 3120;   // shown in the hero proof pill
```

### Pricing model — value editions with an early-adopter discount
Pricing is framed as **editions of one film**, on dimensions a first-timer can judge *before*
using the product (resolution, ownership, priority speed) — deliberately **not** "number of
films / unlimited", which would just measure usage-prediction confidence. Each paid edition
shows a struck "was" anchor + the discounted early-adopter price + a "−N%" savings badge:

- **Free preview** — full film with sound, watermarked ($0, the hook).
- **Standard** — ~~$89~~ **$19.99** · 1080p, no watermark, keep forever.
- **Cinema 4K** (featured "Most chosen") — ~~$199~~ **$59** · everything in Standard + 4K + priority.

Every reserve modal also shows an **early-adopter bonus**: a free Cinema 4K film added to the
first order, regardless of which option is chosen — to delight and lift email conversion.

### Prices & the (paused) A/B test
```js
var PRICE_OLD      = { standard:89,    cinema:199 };   // struck "was" anchors
var PRICE_VARIANTS = { A:{standard:19.99,cinema:59},   // discounted price actually charged
                       B:{standard:19.99,cinema:59},   // A/B variance is PAUSED (all equal)
                       C:{standard:19.99,cinema:59} };
```
- Update `PRICE_OLD` / `PRICE_VARIANTS` (and the static fallback `<div class="amt">` markup) to
  change prices. The savings badge `−N%` is computed automatically.
- A/B variance is currently **off** (all buckets equal) so the offer is consistent everywhere.
  Give the buckets different numbers to **re-enable the willingness-to-pay test** — the bucket is
  still assigned and tagged on every event as `price_variant` either way.
- Force a bucket while testing: `localStorage.setItem('rv_price_variant','C')`, then reload.

### Willingness-to-pay micro-survey
After **any** signup (hero/footer form or the modal), the success screen asks "what feels fair
to pay for your finished film?" with one-tap chips. Each tap fires a `wtp_response` event
(`{ amount, source, price_variant }`) — stated WTP to complement the revealed signal from which
edition people click. Edit the chip amounts in the `wtpInner()` function in `index.html`.

---

## Add real media

The hero shows styled placeholders until you drop real files into `assets/`:

| File | What it is | Aspect ratio |
|------|------------|--------------|
| `assets/snap-1.jpg` … `snap-3.jpg` | the 3 fanned snapshot cards | 4:5 (portrait) |
| `assets/movie-1.mp4` … `movie-4.mp4` | short clips that cross-fade in the hero player | 16:9, **muted** |
| `assets/avatars/1.jpg` … `4.jpg` | the waitlist proof avatars | square |
| `assets/theme-1.jpg` … `theme-4.jpg` | resting poster for each theme card | 4:3 |
| `assets/theme-1.mp4` … `theme-4.mp4` | per-theme clip that plays on hover | 4:3 or 16:9, **muted** |

Any missing file automatically falls back to its gradient placeholder, so the page never looks
broken. Keep clips short (a few seconds) and compressed for fast loading.

> The Themes section currently reuses the hero `movie-*.mp4` clips as a working hover demo
> (see the comment above `.themes` in `index.html`). Add `theme-*.mp4` and point each card's
> `<video src>` at them for genuinely per-theme previews.

---

## How it works (summary)

- **CTAs don't charge anyone.** Every pricing/gift button opens the email modal; the hero and
  footer forms post straight to `/api/subscribe`.
- **`track(event, props)`** fans each custom event out to PostHog + Vercel.
- **`submitEmail(email, props)`** identifies the person in PostHog and POSTs the signup to the
  serverless function.
- If a key/integration isn't set yet, every piece **degrades to a safe no-op** — the visitor
  still sees "You're on the list."
