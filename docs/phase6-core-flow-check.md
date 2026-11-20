# Phase 6 · Core-flow rehearsal (P6H-T08)

**Result: all nine steps of `docs/project.md` §2 pass** on a Vercel preview of the merged code (`main` at `d4646ca` + this PR's docs-only commits).

| | |
|---|---|
| Preview | `https://askwell-git-p6h-t08-core-flow-5a3050-bajrasoftit-5075s-projects.vercel.app` (build of `9ac3ac8`, 2026-11-20 06:23:07 UTC: built **after** the Anthropic key fix) |
| Environment | Vercel Preview env, Supabase **dev**, Clerk **dev** instance (Billing on the Clerk development gateway) |
| Browser | Headless Chromium 158 (Playwright), 1280×900, driving the real UI. Every preview request sent `x-vercel-protection-bypass`. |
| "Another origin" | A plain HTML page served from `http://localhost:8765` (Python `http.server`), not the preview's origin |
| Product PDF | `zephyr-kettle-guide.pdf`, a one-page text PDF about a made-up kettle: boils 1 L in **94 s**, **3-year** warranty, 1.7 L, three colors, keep-warm 80 °C. These facts exist only in the PDF, so a correct answer proves retrieval from it. |
| Test account | `jim-p6h-t08+clerk_test@example.com` (Clerk test email; code `424242`), Clerk user `user_3MMLwXDMV0uEoxI9YG5RrdKyVIR` |

Times are UTC on 2026-11-20. Screenshots were taken at every step. I can't attach images from my sandbox, so each row says what the screenshot shows.

## Setup found on the Preview environment

| Item | Expected (task) | Found | Evidence |
|---|---|---|---|
| `LANDING_WIDGET_KEY` on Preview | Set | **Set**: `pk_U51_Co8Y_7hC6fI03R03g34W` | Landing HTML on the preview has `<script id="askwell-landing-widget" src=".../widget.js" data-key="pk_U51_…">`; `/api/widget/config` answers 200 |
| Demo project | An "Askwell" project | "Askwell (landing page, dev)" | dev DB `projects.public_key` |
| Demo owner's plan | **Pro** | **Free** (100 messages/month, default black button) | dev DB `accounts.plan` |
| Demo knowledge | `docs/askwell-knowledge.md` uploaded | 3 pasted-text sources from 2026-11-15 ("What Askwell is", "Plans and pricing", "Installing and customizing the widget"), all Ready. **Not** the merged knowledge file (#57). | dev DB `knowledge_sources` |

The two gaps don't fail step 1 or 2: the widget shows and answers correctly. They're listed under Findings (F1, F2) for the product owner.

## The nine steps

| # | Step (§2) | When | Result | Evidence |
|---|---|---|---|---|
| 1 | Open the landing page. The app's own widget is in the corner. | 06:23:48 | **Pass** | `GET /api/widget/config` for `pk_U51_…` → 200. Screenshot: dark landing page, "Ask us" button bottom right. |
| 2 | Ask it a product question. It answers from its knowledge. | 06:23:57 | **Pass** | Asked "How much does the Pro plan cost, and how many messages does it include?" → `POST /api/widget/chat` 200: *"The Pro plan costs $19 per month. It includes 5 projects, 2,000 messages per month per project, and 25 knowledge sources per project."* Matches `PLAN_LIMITS` and the knowledge. Screenshot: open panel "Ask us anything" with the Q&A and "Powered by Askwell". |
| 3a | Sign up. | 06:22:15 | **Pass** | `/sign-up` → email + password → Continue → `/sign-up/verify-email-address` → code `424242` → lands on `/dashboard` (Projects, "0 of 1 project on Free", plan badge Free). See note N1 on Clerk bot protection. |
| 3b | Create a project. | 06:22:32 | **Pass** | Project name "Zephyr Kettle shop" → Create project → redirected to `/dashboard/p/f8306be1-…/knowledge`. |
| 3c | Upload a product PDF in Knowledge. | 06:22:46 | **Pass** | Choose file → `zephyr-kettle-guide.pdf` → status **Ready** after 13.6 s. Screenshot: "1 of 3 sources on Free", row "zephyr-kettle-guide · PDF · Nov 20, 2026 · Ready". |
| 4 | Copy the script tag from Install. Paste it into a plain HTML page. The widget appears. | 06:23:02 | **Pass** | Install shows `<script src="https://askwell-git-p6h-t08-…vercel.app/widget.js" data-key="pk_TkuEIqJi9lRNGpAyKtJaCkvL" async></script>`. Pasted into `index.html` on `http://localhost:8765`. Config 200: `{"buttonColor":"#0a0a0a","position":"bottom-right","label":"Ask us","animation":"fade","headerText":"Ask us anything","showBadge":true}` (Free defaults). Screenshot: black "Ask us" button bottom right. |
| 5 | Ask a question on that page. The answer comes from the PDF. | 06:24:18 | **Pass** | Asked "How long is the warranty on the kettle, and how fast does it boil a litre?" → 200: *"The Zephyr Kettle Pro comes with a 3-year warranty from the date of purchase. It boils one litre of water in 94 seconds."* Both facts are only in the PDF. |
| 6 | Open Conversations. The chat is there. | 06:24:31 | **Pass** | The list shows "How long is the warranty… · 2 messages · Nov 20, 2026, 06:24 UTC" (and my earlier curl "ping", see N3). Opening it shows Visitor → Bot with the exact texts from step 5. |
| 7 | Open Customize. Paywall. | 06:23:17 | **Pass** | "Customizing the widget is a Pro feature · On Free, your widget uses the default look and shows the badge. Upgrade to change it. · Upgrade to Pro". Fields fieldset `disabled`, Save disabled. |
| 8 | Upgrade to Pro with a Clerk Billing test card. Customize unlocks. | 06:25:11 | **Pass** | Billing → Pro **Subscribe** → Clerk checkout ("Development mode", Pro $19.00) → Card `4242 4242 4242 4242`, `12/34`, `123` → **Pay $19.00** → "Payment was successful". `accounts.plan` = **`pro`** at 06:25:17 (≤ 6 s, Clerk webhook). Customize at 06:25:36: no locked notice, fieldset enabled. |
| 9 | Change the button color. Reload the HTML page. The new color shows. | 06:25:44 | **Pass** | Button color `#e5484d` → Save → `PATCH /api/projects/…/config` 200 → "Saved. Reload your site to see the new look." Reloaded `http://localhost:8765`: config now has `"buttonColor":"#e5484d"`. The screenshot pixel at the button is `rgb(229, 72, 77)` = `#e5484d`. Screenshot: red "Ask us" button. |

## Findings

| # | Finding | Severity | Owner / fix |
|---|---|---|---|
| F1 | The landing demo project's owner is on **Free**, not Pro. 100 messages a month for all landing traffic. The button is the default near-black `#0a0a0a`, which is hard to see on the dark landing page. | Medium (demo quality, quota) | Product owner: upgrade the demo owner to Pro, then in Customize pick a light button color (e.g. white). No code change. Reported to the lead. |
| F2 | The demo project's knowledge is 3 pasted texts from 2026-11-15, not `docs/askwell-knowledge.md` (merged in #57). Answers were right for pricing, but the newer file has more. | Low | Product owner: upload `docs/askwell-knowledge.md` to the demo project (and delete the 3 old sources if they repeat it). Reported to the lead. |
| F3 | Chat returned 502 on previews built before the Anthropic key fix (diagnosed earlier: Anthropic 429 `rate_limit_error`). Fixed by the product owner. This preview (built 06:23:07) answers. My **sandbox** `ANTHROPIC_API_KEY` still gets 429 at 06:21, but that key only matters for agents' direct checks, not the app. | Resolved for previews | Product owner (action item `aimwokpfqe4`). For production: launch checklist §3a "Anthropic note". |
| F4 | The dev Clerk webhook still points at the P5B-T03 preview alias. It worked here (plan flipped in ≤ 6 s), but it breaks if that preview is deleted. | Low (dev only) | Product owner: launch checklist §4 "The dev endpoint needs a stable URL". |

No code bugs were found in the core flow.

## Notes

- **N1. Clerk bot protection.** The first automated sign-up stopped at `/sign-up/protect-check` (Cloudflare Turnstile, Clerk dev-instance bot protection). I didn't try to solve the captcha. I used a Clerk **testing token** (`POST /v1/testing_tokens`, the mechanism `@clerk/testing` uses for automated tests) on Clerk's own API requests only. A person signing up sees the captcha and passes it normally. The app's sign-up code isn't involved.
- **N2.** Stripe's checkout loaded an invisible hCaptcha; payment went through without any challenge.
- **N3.** Before the UI run I sent one `POST /api/widget/chat` "ping" by curl to each project, to check the fresh build. That's why the Zephyr project's Conversations list has a second "ping" chat, and the demo project has one extra message.
- **Test data left on dev** (throwaway): the Clerk user above with an active test Pro subscription, project "Zephyr Kettle shop" (`f8306be1-40fa-48f0-8afb-d573d4dd3199`) with the PDF and 2 conversations, and 2 extra conversations on the landing demo project.
