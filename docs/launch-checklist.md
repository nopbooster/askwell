# Launch checklist (production)

For the product owner. Do the steps in order. Agents have no production access, so every step here is yours.
Background: `docs/project.md` §4 (environments), §9 (security), §11 (variables).

Each step says what it needs and how to check it worked. "Known" means checked in this repo or on dev. "Decide" means a choice only you can make.

---

## 0. Before you start

- [ ] `main` has every Phase 6 PR merged, and its checks are green.
- [ ] Vercel → askwell → Settings → Git: automatic production promotion is **off** (§4). A merge to `main` builds production but doesn't promote it.
- [ ] Decide the Clerk question in step 3b first. It changes which keys go into steps 3 and 4.

---

## 1. Create the Supabase prod project

1. Supabase dashboard → **New project** (free tier). Pick a region close to your Vercel region. Save the database password somewhere safe.
2. **Extensions: nothing to do by hand.** The migrations create both extensions in the `extensions` schema (known: dev has these exact versions):

   | Extension | Created by | Dev version |
   |---|---|---|
   | `vector` (pgvector) | `20261112043544_initial_schema.sql` | 0.8.2 |
   | `pgcrypto` | `20261112140500_create_project.sql` | 1.3 |

3. **Storage: nothing to do by hand.** The private `knowledge` bucket (10 MB, PDF/Markdown/TXT) is created by `20261112155419_knowledge_and_chat.sql`. No need to create it in the dashboard. If one already exists, the migration resets it to the right settings (`on conflict … do update`).
4. **Third-party auth (Clerk).** Supabase → Authentication → Sign In / Providers → **Third-party auth** → Add **Clerk**. Enter the Clerk domain (Frontend API URL) of the Clerk instance production will use (step 3b). Without this, every owner read returns nothing (RLS reads `auth.jwt()->>'sub'`).
   - In Clerk → **Integrations → Supabase**: make sure it's activated for that same instance. It adds the `role: authenticated` claim to session tokens. If production uses the dev instance (option A in 3b), this is already on.
5. **Data API.** Project Settings → Data API: keep the exposed schema `public` (the default). Don't turn on PostgREST aggregates (§9).
6. Copy these values for step 3: the **Project URL**, the **publishable key** (`sb_publishable_…`) and the **secret key** (`sb_secret_…`), from Project Settings → API Keys.

**Check:** Table Editor shows no tables yet (they come in step 2).

---

## 2. Apply every migration, in order

`supabase/migrations` has 4 files. Apply all of them, oldest first. These are the same 4 versions applied on dev (known: `list_migrations` on dev matches the folder exactly).

| # | File | What it does |
|---|---|---|
| 1 | `20261112043544_initial_schema.sql` | `vector` extension; tables `accounts`, `projects`, `widget_configs`, `knowledge_sources`, `knowledge_chunks`, `conversations`, `messages`; RLS, policies, grants; helpers `owned_project_ids()`, `owned_conversation_ids()` |
| 2 | `20261112061707_chunk_project_integrity.sql` | A chunk's `project_id` must match its source's (tenant safety for `match_chunks`) |
| 3 | `20261112140500_create_project.sql` | `pgcrypto`; `create_project()` (plan limit check + public key) |
| 4 | `20261112155419_knowledge_and_chat.sql` | `knowledge` Storage bucket; `reserve_knowledge_source`, `claim_knowledge_source`, `match_chunks`, `consume_message`, `save_chat_turn` |

With the Supabase CLI (from the repo root):

```bash
npx supabase login
npx supabase link --project-ref <prod-project-ref>
npx supabase db push            # applies the 4 files above, in order
npx supabase migration list     # Local and Remote columns must both list the 4 versions
```

Or paste each file into the SQL editor in the order above. If you do that, the CLI's migration history stays empty, and a later `db push` would try to apply them again.

**Check:**
- Supabase → Database → Advisors → **Security**: no errors (warnings about the `extensions` schema are expected).
- Storage shows a private bucket called `knowledge`.
- Never copy data from dev (§4). Production starts empty.

---

## 3. Vercel Production environment variables

Vercel → askwell → Settings → **Environment Variables**. Set each one with only **Production** ticked. Preview and Development keep the dev values (§11).

`NEXT_PUBLIC_*` values are built into the browser bundle. After you add or change one, **redeploy** for it to take effect. The other variables are read at request time.

### 3a. The variables (every row of §11)

| Variable | Production value comes from | Secret? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **Prod** Supabase → Project Settings → API → Project URL | No (public) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | **Prod** Supabase → API Keys → publishable key (`sb_publishable_…`) | No (public; RLS is the boundary) |
| `SUPABASE_SECRET_KEY` | **Prod** Supabase → API Keys → secret key (`sb_secret_…`). Skips RLS: server only. | **Yes** |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk → the instance chosen in 3b → API Keys (`pk_test_…` or `pk_live_…`) | No (public) |
| `CLERK_SECRET_KEY` | Same Clerk instance → API Keys (`sk_test_…` or `sk_live_…`) | **Yes** |
| `CLERK_WEBHOOK_SIGNING_SECRET` | The **new production** webhook endpoint from step 4 (`whsec_…`). Not the dev one. | **Yes** |
| `OPENAI_API_KEY` | platform.openai.com → API keys. Embeddings only. A separate production key is best, so a dev leak can't spend it. | **Yes** |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API keys. Chat replies. Check the org has credits and a spend limit that fits (see the note below). | **Yes** |
| `ARCJET_KEY` | Step 6 | **Yes** |
| `NEXT_PUBLIC_POSTHOG_KEY` | Step 6 | No (public) |
| `NEXT_PUBLIC_POSTHOG_HOST` | Step 6 (e.g. `https://us.i.posthog.com` or `https://eu.i.posthog.com`, matching the project's region) | No (public) |
| `NEXT_PUBLIC_APP_URL` | The production URL, origin only, no trailing slash (e.g. `https://askwell.example.com`). The Install snippet and the landing widget use it. | No (public) |
| `LANDING_WIDGET_KEY` | Step 5. Leave it empty for the first deploy: the landing shows its static demo until it's set. | No (per-environment config) |

**Anthropic note (known, Phase 6):** previews returned chat 502s because the Anthropic key was refused (HTTP 429 `rate_limit_error`). Before launch, check credits, spend limit and rate limits for the org that owns the production `ANTHROPIC_API_KEY`.

### 3b. Decide: which Clerk instance does production use?

§9 says "Test keys only" and §3 says billing runs on the Clerk payment gateway in **test mode** with **no Stripe account**. Production has to pick one of these:

| Option | What it means | Trade-offs |
|---|---|---|
| **A. Keep the dev Clerk instance** (`pk_test_…` / `sk_test_…`) on the production URL | Follows §3 and §9 as written. Billing stays in test mode: test cards only, nobody really pays. | Clerk shows its development-mode banner. Dev instances have lower limits than production ones. Sign-ups on production land in the same user pool as dev. Fine for a demo or beta; not for real customers. |
| **B. Create a Clerk production instance** (`pk_live_…` / `sk_live_…`) | Real launch: real users, real payments. | Changes §3 and §9. Clerk production instances need a domain you own (with Clerk's DNS records), not a `*.vercel.app` URL. Real payments in Clerk Billing need a connected Stripe account. You'd recreate the `free`/`pro` plans in the new instance, and Supabase third-party auth (step 1.4) points at the new Clerk domain. |

Known: the repo works with either; only the env values differ. Guessed, so check Clerk's current docs: the exact dev-instance limits, and whether live Billing needs Stripe.

---

## 4. A separate Clerk webhook for production

1. Clerk dashboard → the instance from 3b → **Webhooks** → **Add endpoint**.
2. URL: `<NEXT_PUBLIC_APP_URL>/api/clerk/webhook` (e.g. `https://askwell.example.com/api/clerk/webhook`).
3. Subscribe to these events (`apps/web/app/api/clerk/webhook/route.ts` lists them):
   - `subscriptionItem.active`
   - `subscriptionItem.canceled`
   - `subscriptionItem.ended`
   - `subscriptionItem.expired`
4. Copy this endpoint's **Signing Secret** (`whsec_…`) into Vercel Production as `CLERK_WEBHOOK_SIGNING_SECRET`. It's different from the dev endpoint's secret. Every endpoint has its own.
5. If production uses the dev Clerk instance (option A): that instance then has **two** endpoints, dev and production. Both get every billing event, and each writes `accounts.plan` only in its own database. That's expected: a user who doesn't exist in that database is a no-op.

**The dev endpoint needs a stable URL.** It points at the preview alias of P5B-T03 (`docs/phase5-check.md`). If that preview is deleted, upgrades on dev stop changing `accounts.plan`. Point it at a URL that doesn't go away: for example the `main` branch alias (`askwell-git-main-…vercel.app`) or a custom domain on the Preview environment. Previews are protected, so the URL must pass Vercel's protection: add `?x-vercel-protection-bypass=<VERCEL_AUTOMATION_BYPASS_SECRET>` to the endpoint URL, or the deliveries get Vercel's 401.

**Check:** after step 7's upgrade, Clerk → Webhooks → production endpoint → Message attempts shows 200s. The Vercel Production logs show `[clerk/webhook] … sync → pro`.

---

## 5. `LANDING_WIDGET_KEY` for production

The key must belong to a project in the **prod** database: a dev key returns "Unknown key" in production. That means it's set after the first deploy:

1. After step 7.1 (promoted, landing shows the static demo), sign up on the production URL with the account that will own the Askwell demo.
2. Upgrade it to **Pro** (2,000 messages a month instead of 100; the landing gets all public traffic).
3. Create a project called e.g. "Askwell (landing page)". In Knowledge, upload `docs/askwell-knowledge.md` and wait for **Ready**.
4. Install tab → copy the `data-key` value (`pk_…`) from the script tag.
5. Vercel → Production → `LANDING_WIDGET_KEY` = that value. It's read per request, so no redeploy is needed (a redeploy doesn't hurt).

**Check:** reload the production landing page: the real chat button shows in the corner, and asking "How much is Pro?" gets an answer from the knowledge file.

---

## 6. Arcjet and PostHog

**Arcjet** (`ARCJET_KEY`):
- app.arcjet.com → create a **production** site (or reuse the existing one) → copy its key (`ajkey_…`).
- The rules (rate limit + prompt injection) are in code, `apps/web/lib/arcjet/index.ts`, in `LIVE` mode. Nothing to configure in the dashboard.
- It fails open: a bad or missing key lets requests through and logs it. So a typo doesn't break chat, but it does turn protection off. Check the Arcjet dashboard shows requests after launch.

**PostHog** (`NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`):
- Decide: a separate PostHog **project** for production (recommended, so dev and test traffic don't mix with real data), or the dev one.
- PostHog → Project settings → Project API key (`phc_…`) and the region host.
- Both are `NEXT_PUBLIC_*`: redeploy after setting them.

---

## 7. Promote, then run the core flow on production

1. Redeploy `main` in Production so the build picks up every `NEXT_PUBLIC_*` value. Then **Promote** it (Vercel → Deployments → … → Promote).
2. Do step 5 (`LANDING_WIDGET_KEY`).
3. Run the nine steps of `docs/project.md` §2 on the production URL. The same steps were rehearsed on a preview in `docs/phase6-core-flow-check.md`.

| # | Step | Pass when |
|---|---|---|
| 1 | Open the landing page | The real chat button is in the corner |
| 2 | Ask it a product question | It answers from `askwell-knowledge.md` |
| 3 | Sign up, create a project, upload a product PDF in Knowledge | The source shows **Ready** |
| 4 | Copy the script tag from Install into a plain HTML page on another site | The chat button appears |
| 5 | Ask a question on that page | The answer comes from the PDF |
| 6 | Open Conversations | The chat is there |
| 7 | Open Customize | Locked: "Customizing the widget is a Pro feature" |
| 8 | Billing → upgrade to Pro (test card `4242 4242 4242 4242` with option A) | Plan badge shows Pro within a minute; Customize unlocks |
| 9 | Change the button color, save, reload the HTML page | The new color shows |

4. After the check: delete the step 3 test account and its project if you don't want it in production data. Keep the step 5 demo account.

If a step fails, check the Vercel Production logs first. Each failure logs its step, e.g. `[widget/chat] answer failed …`.
