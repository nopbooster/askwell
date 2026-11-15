# Phase 5 check: Free 402 → upgrade → save → widget color

Checks Lane A (Clerk Billing → `accounts.plan`) and Lane B (Customize + widget) end to end on a Vercel preview (project.md §5, §6.8, §6.10).

## How to run it

1. **Free:** sign up (new account, Free) and create a project. Customize is locked with an upgrade prompt. A direct `PATCH /api/projects/:id/config` returns **402** `payment_required`.
2. **Upgrade:** Billing → Pro **Subscribe** → Clerk checkout → Stripe test card `4242 4242 4242 4242`, any future date, any CVC → Pay. Within a minute `accounts.plan` is `pro` (Clerk webhook).
3. **Save:** reload Customize. It's unlocked; change the color (and other fields), Save → 200.
4. **Widget:** paste the Install snippet into a copy of `apps/widget/demo/index.html` served on another origin (`http://localhost:5500`) and reload. The widget shows the new color, label, corner and header, and no badge.
5. **Downgrade:** when the subscription ends, the webhook sets `accounts.plan = free`. Reload the demo page: defaults and the badge.

## Results

Pending.
