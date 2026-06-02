# Caddie AI — Golf Coach

A mobile-first golf coaching app: personalized practice plans, round logging,
handicap tracking, LLM-powered chat coach, monthly leaderboards. React frontend,
Supabase backend, Anthropic (Claude) for all generative content via a
server-side proxy.

> **Repo status:** the app was originally built on the Base44 platform and is
> in the middle of a Supabase migration. Most user-facing flows work
> end-to-end; the Stripe and RevenueCat integrations are partially ported (see
> [Pending work](#pending-work)). See [TESTING.md](TESTING.md) for the most
> recent end-to-end verification log.

---

## Tech stack

| Layer | Choice |
|---|---|
| Frontend framework | React 18 + Vite 6 |
| Styling | Tailwind CSS 3 + shadcn/ui (Radix primitives) |
| Routing | react-router-dom 6 |
| State / data | @tanstack/react-query, plus local component state |
| Forms / validation | react-hook-form + zod |
| Motion / charts | framer-motion, recharts |
| Icons / toast / etc. | lucide-react, sonner |
| Backend | Supabase (managed Postgres + edge functions on Deno + Auth + Storage) |
| LLM | Anthropic Claude via the `invokeLLM` edge function (key never reaches the client) |
| Payments (partial) | `@stripe/stripe-js` on the client; Stripe webhook → profile pipeline is not yet ported |

---

## Repository tour

```
caddie-ai-golf-coach/
├── src/                       # React app (Vite root)
│   ├── pages/                 # Route components (one per URL)
│   ├── components/            # Feature components, grouped by domain
│   │   ├── home/  plan/  progress/  session/  leaderboard/  pro/
│   │   ├── welcome/           # Pre-auth marketing page sections
│   │   ├── modals/  popups/  ui/   # Reusable building blocks (ui/ = shadcn)
│   │   └── ...
│   ├── lib/                   # supabase client, AuthContext, getCurrentUser,
│   │                          # invokeLLM proxy, RootRoute, hasAccess
│   ├── hooks/  utils/  api/
│   └── App.jsx                # Route table + global providers
├── supabase/
│   ├── migrations/            # 7 SQL files — schema + RLS policies
│   └── functions/             # 28 edge functions (Deno + TS)
│       └── _shared/           # serviceClient(), getUser(), invokeFunction(),
│                              # anthropic.ts (LLM proxy)
├── public/                    # Static assets (icons, manifest, /images/welcome/*)
├── TESTING.md                 # Full manual + automated verification checklist
├── package.json               # name: "caddie-ai-golf-coach"
└── .env.local                 # local-only secrets (gitignored)
```

---

## Local development

### Prerequisites

- **Node 20+** (built and tested on 24; any LTS ≥ 20 works)
- **npm** (lockfile is npm; pnpm/yarn untested)
- A Supabase project (dev runs against the hosted dev project — no local Docker needed)
- *(Optional, for edge function deploys)* the Supabase CLI: `brew install supabase/tap/supabase`

### Setup

```bash
git clone <repo-url> caddie-ai-golf-coach
cd caddie-ai-golf-coach
npm install
cp .env.local.example .env.local   # (or create .env.local from scratch)
```

Fill in `.env.local` with values from the Supabase dashboard:

```
# Project Settings → Data API → Project URL
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
# Project Settings → API Keys → anon / public
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

The frontend only ever sees the **anon key**. The service-role key and the
Anthropic key live as Supabase edge function secrets and never reach the
browser.

### Run

```bash
npm run dev        # Vite dev server, defaults to http://localhost:5173
npm run build      # Production build → dist/
npm run preview    # Serve the built bundle locally
npm run lint       # ESLint (--quiet)
npm run typecheck  # tsc against jsconfig.json
```

---

## How the pieces fit together

### Auth & routing

1. User lands on `/welcome` (pre-auth) or `/signin` and submits an email.
2. Supabase emails a magic link. The link redirects to `/gateway`.
3. **`Gateway.jsx`** is the post-auth funnel: it loads the user's
   `user_profile` row, checks `hasAccess(profile)` (defined in `lib/`), and
   routes to one of: `/onboarding`, `/subscribe-now`, or `/home`.
4. The route table in `App.jsx` wraps every authenticated page in
   `<ProtectedRoute>`, which redirects to `/signin` when there's no session.
5. Admin-only pages (`/admin/*`) also check `user.app_metadata.role === 'admin'`
   inside the page component itself (see §11 of TESTING.md).

### Frontend ↔ Supabase

- Direct table reads/writes use `supabase.from('<table>').select(...)` /
  `.insert(...)` etc. **RLS gates everything** — each table's policies are
  declared in `supabase/migrations/20260525000002_rls_policies.sql`. Most
  tables follow "owner only" (`user_email = auth.email()`) with admin
  bypasses; some (e.g. `waitlist_email`) have explicit public-insert policies.
- Business logic that needs cross-user reads, service-role writes, or LLM
  calls is implemented as an **edge function** in `supabase/functions/<name>/`
  and invoked from the client via
  `supabase.functions.invoke('<name>', { body })`.
- **Important footgun:** `supabase.functions.invoke()` returns
  `{ data, error }` and does *not* throw on non-2xx. Always check `error`
  before dereferencing `data.<field>` — otherwise a 404 from a not-yet-deployed
  function silently shows the success path or crashes with an NPE. See
  `src/pages/ManageSubscription.jsx`, `CancelSubscription.jsx`, `AccountScreen.jsx`
  for the correct pattern.

### Edge functions

28 functions live under `supabase/functions/`. They split into:

- **LLM-backed coach content:** `invokeLLM` (the proxy), `generateInitialPlan`,
  `generateWeeklyReport`, `generateMonthlyGamePlan`, `generatePreRoundGamePlan`,
  `getCompetitorIntel`, `proWeeklyCoachMessage`.
- **Read aggregations:** `calculateHandicap`, `getLeaderboard`,
  `getPlayerProfile`, `getReferralStats`, `getWaitlistCount`, `getUsageReport`.
- **Writes that need service-role:** `logSession`, `logRound`, `updateHandicap`,
  `updateLeaderboard`, `checkBadges`, `applyClubDistanceDefaults`,
  `applyWaitlistCredit`, `submitFeedback`, `markExistingUsersTourComplete`.
- **Admin tools:** `createManualUserProfile`, `fixUserProfile`, `deleteAccount`.
- **Scheduled (not wired to cron yet):** `cleanupExpiredPendingUsers`,
  `processMonthlyWinner`.

Shared helpers live in `supabase/functions/_shared/`:

- `supabase.ts` — `serviceClient()` (bypasses RLS), `getUser(req)` (auth from
  the request header), `invokeFunction(name, req, body)` (server-to-server fan-out).
- `anthropic.ts` — the Claude wrapper. Two modes: **schema mode** (tool-use
  with `tool_choice: {type:'tool', name:'respond'}` and a JSON schema) and
  **text mode** (free-form). The system prompt is intentionally minimal in
  text mode — anything that mentions the `respond` tool there will make Claude
  hallucinate XML wrappers around plain-text replies.

### LLM proxy: `invokeLLM`

Client code calls `invokeLLM(args)` from `src/lib/db.js`. That helper POSTs
to the `invokeLLM` edge function which forwards to Anthropic with the
project's `ANTHROPIC_API_KEY` (set as a Supabase function secret). The key
never ships in the bundle (`grep "sk-ant-" dist/` returns zero hits).

### Stripe (partial)

- The client has the `@stripe/stripe-js` library installed and the buy.stripe.com
  payment links wired up in `SubscribeNow.jsx`.
- `/checkout` and `/checkout/success` are the post-purchase landings.
- The **post-checkout webhook → user_profile creation pipeline is not yet
  ported** from Base44. A real purchase would not currently create a profile
  on the server side.
- `cancelSubscription` and a handful of Stripe / RevenueCat edge functions
  remain to be implemented.

---

## Deploying changes

### Database migrations

Migrations live in `supabase/migrations/*.sql`. Apply with the Supabase CLI
(authenticated against the target project):

```bash
supabase db push                       # apply all pending migrations
supabase db reset                      # nuclear: drop + reapply everything (dev only!)
```

New migrations should be named `YYYYMMDDHHMMSS_<slug>.sql` so they apply in
order.

### Edge functions

```bash
supabase functions deploy <name>       # deploy a single function
supabase functions deploy --no-verify-jwt <name>   # public function (waitlist counter, etc.)
```

Function secrets (Anthropic key, Stripe secret, etc.) are set via the
dashboard: **Project Settings → Edge Functions → Secrets**.

### Frontend

```bash
npm run build           # → dist/
```

Hosting is up to the team — the bundle is fully static and can be served
from Vercel, Netlify, Cloudflare Pages, or any S3-backed CDN.

---

## Verification & testing

**Manual verification:** [`TESTING.md`](TESTING.md) is the authoritative
checklist. It walks every page, every edge function, and every security
spot-check, with the most recent end-to-end pass logged in §17. Re-run before
any release.

**Automated verification:** a handful of puppeteer-based verifier scripts
live at the repo root (`verify-*.mjs`). They mint a magic link via the admin
API, drive the corresponding page, and assert DB side-effects. They were
useful during the migration verification pass — keep them around or move them
to `tests/verifiers/` once you have a place for them in CI.

There is no Jest/Vitest suite in this repo. Adding one is recommended before
serious ongoing development.

---

## Pending work

Tracked at the bottom of TESTING.md (§16 *Known limitations* and §17
*Verification log → Pending / housekeeping*). High-level:

- **Stripe & RevenueCat** — Webhook → profile pipeline, `cancelSubscription`
  edge function, post-checkout sign-in, RevenueCat as source of truth.
- **Apple OAuth** — provider not configured in Supabase yet; the
  "Continue with Apple" button shows a Supabase 400 JSON page until
  Authentication → Providers → Apple is set up.
- **Resend SMTP** — currently using Supabase's rate-limited built-in sender.
  Configure Resend (or another transactional provider) for production volume.
- **Capacitor native apps + push notifications (FCM/APNs)** — separate
  workstream; not started.
- **Affiliate tracking** — separate workstream; not started.
- **`hasAccess` strictness on trial users** — Gateway sends seemingly-valid
  trial profiles to `/subscribe-now`. Worth tracing before live onboarding.
- **Admin gate UX consistency** — `/admin/flagged` shows inline "Access
  denied" while the other admin pages redirect. Pick one pattern.

---

## License & support

Internal project — see the engagement contract for license terms. For
technical questions about the codebase, the most recent verification log
in TESTING.md §17 is the best entry point.
