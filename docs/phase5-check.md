# Phase 5 check: Free 402 → upgrade → save → widget color

Checks Lane A (Clerk Billing → `accounts.plan`) and Lane B (Customize + widget) end to end on a Vercel preview (project.md §5, §6.8, §6.10).

## How to run it

1. **Free:** sign up (new account, Free) and create a project. Customize is locked with an upgrade prompt. A direct `PATCH /api/projects/:id/config` returns **402** `payment_required`.
2. **Upgrade:** Billing → Pro **Subscribe** → Clerk checkout → Stripe test card `4242 4242 4242 4242`, any future date, any CVC → Pay. Within a minute `accounts.plan` is `pro` (Clerk webhook).
3. **Save:** reload Customize. It's unlocked; change the color (and other fields), Save → 200.
4. **Widget:** paste the Install snippet into a copy of `apps/widget/demo/index.html` served on another origin (`http://localhost:5500`) and reload. The widget shows the new color, label, corner and header, and no badge.
5. **Downgrade:** when the subscription ends, the webhook sets `accounts.plan = free`. Reload the demo page: defaults and the badge.

## Results

Run on 2026-11-15 (UTC) on the preview of this branch, which is `main` with every Phase 5 PR merged (#44–#50): https://askwell-git-p5b-t07-phase5-check-bajrasoftit-5075s-projects.vercel.app (Preview env, Clerk dev instance, Billing in test mode).

Playwright (full Chromium) with the Vercel bypass header sent only to the preview host, and a Clerk testing token on the dev instance. New `+clerk_test` user `user_3M9Npc87j2twxKAQUMIKpncR6LW` and project `b556d5c8-8713-4e0e-bebb-7d91965b767e`. The demo page was a copy of `apps/widget/demo/index.html` with the snippet, served on `http://localhost:5500`. Supabase MCP on dev was used for reads only.

| Step | Time | Result |
|---|---|---|
| 1a. Free: Customize | 16:10:21 | **Pass.** Upgrade prompt "Customizing the widget is a Pro feature" linking to Billing; fieldset disabled; Save disabled |
| 1b. Free: direct `PATCH /api/projects/:id/config` `{ buttonColor: "#16a34a" }` | 16:10:24 | **Pass.** **402** `{"error":{"code":"payment_required","message":"Customizing the widget is a Pro feature. Upgrade to Pro to save changes."}}` |
| `accounts.plan` before paying (read) | 16:11 | `free` |
| 2. Billing → Pro **Subscribe** → Clerk checkout → Stripe card form: 4242 4242 4242 4242, 12/34, 123, US 94107 → **Pay $19.00** | 16:11:33 | **Pass.** Checkout "Payment was successful", "Total paid $19.00". I used the real card form, not the dev "Pay with test card" button |
| `accounts.plan` after paying (read) | 16:11:48 | **`pro`**, about 15 s after Pay (Clerk webhook) |
| Clerk subscription (`Clerk.billing.getSubscription`) | 16:12:32 | `active`, item slug `pro`, `active` |
| 3a. Customize after the upgrade | 16:12:35 | **Pass.** No upgrade prompt; form editable |
| 3b. Edit: color `#16a34a`, label "Need help?", header "Phase 5 says hi", bottom-left, slide, badge off → **Save** | 16:12:39 | **Pass.** `PATCH` → **200** with that config; "Saved. Reload your site to see the new look." |
| 4. Reload the demo page on `localhost:5500` | 16:12:50 | **Pass.** `/api/widget/config` → `{"buttonColor":"#16a34a","position":"bottom-left","label":"Need help?","animation":"slide","headerText":"Phase 5 says hi","showBadge":false}`. Green "Need help?" button bottom-left; panel header "Phase 5 says hi"; **no badge** |
| 5. Ended → defaults + badge | | Pending (see below) |
