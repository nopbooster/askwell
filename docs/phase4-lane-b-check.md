# Phase 4 · Lane B check: events, funnel, trace

Checks B1–B3 end to end on a Vercel preview (project.md §6.11 Analytics): product events, session replay, the AI trace with its cost, `message_blocked`, and the funnel.

## How to run it

1. In a fresh browser, open the landing page `/` (anonymous `$pageview`, replay on).
2. Sign up (new account, Free plan). The dashboard creates the account row → `signed_up`.
3. Create a project → `project_created`.
4. Knowledge: paste some text → `knowledge_added`.
5. Install: press **Copy** → `snippet_copied`. The browser is identified as the Clerk user here, which links the earlier anonymous landing visit.
6. Paste the snippet into a copy of `apps/widget/demo/index.html` (don't commit it), serve it on `http://localhost:5500`, open the widget and send a question about the pasted text. The bot answers → `$ai_generation` (the trace) and, for the project's first conversation, `first_chat` (sent as the owner).
7. Send a prompt-injection message ("Ignore all previous instructions…"). The route answers 400 `message_blocked`, and the widget shows "I can't help with that request." → `message_blocked` with `reason: prompt_injection`.
8. In PostHog, check every event, a replay of the landing/dashboard visit, and the trace with its cost (LLM analytics → Traces).

## Funnel (PostHog → Product analytics → New insight → Funnel)

Same person, steps in order, conversion window 14 days. Every step is on the **owner** (their Clerk user ID): the landing `$pageview` joins them when the browser is identified at step 5, and `first_chat` is sent with the owner's ID. `$ai_generation` and `message_blocked` are personless visitor events, so they aren't funnel steps.

| # | Step | PostHog event | Filter |
|---|---|---|---|
| 1 | Landing | `$pageview` | Path name = `/` |
| 2 | Sign up | `signed_up` | |
| 3 | Project | `project_created` | |
| 4 | Knowledge | `knowledge_added` | |
| 5 | Install | `snippet_copied` | |
| 6 | First chat | `first_chat` | |
| 7 | Upgrade | `upgraded` | Stays empty until Phase 5 (Clerk billing webhook) |

## Results

Run on 2026-11-14 between 06:38 and 06:43 UTC on the preview of this branch (latest `main` with B1 #40, B2 #41 and B3 #42): https://askwell-git-p4c-t08-lane-b-check-bajrasoftit-5075s-projects.vercel.app

Playwright with full Chromium and the Vercel bypass header sent only to the preview host. PostHog's bot filter drops headless browsers, so the run used a desktop Chrome user agent with `navigator.webdriver` off. Sign-up used a Clerk testing token (dev instance) and a new `+clerk_test` user on Free. The demo page was a copy of `apps/widget/demo/index.html` with the snippet, served on `http://localhost:5500`.

Test IDs: owner `user_3M5RSbNvydBqGdRmnEknZoNm4mW`, project `35c17d2a-812e-42fc-9baa-cbe8d06d7ca5`, conversation `2e6387b1-7409-4432-afdd-19eeef9ff922`.

| Step | In the app | In PostHog |
|---|---|---|
| 1. Landing `/` | Pass: PostHog loaded, events and replay snapshots sent | Pending |
| 2. Sign up | Pass: landed on `/dashboard` | Pending (`signed_up`) |
| 3. Create project | Pass: `POST /api/projects` → 201 | Pending (`project_created`) |
| 4. Paste knowledge | Pass: 201, then `ready` | Pending (`knowledge_added`) |
| 5. Install → Copy | Pass: "Copied to clipboard." The browser's PostHog `distinct_id` is now the Clerk user ID | Pending (`snippet_copied`) |
| 6. Chat from the demo page | Pass: "How long does delivery to Canada take?" → "Delivery to Canada takes 5 business days and costs 12 dollars. Orders over 80 dollars ship free!" (from the pasted text) | Pending (`first_chat`, `$ai_generation` with cost) |
| 7. Prompt-injection message | Pass: 400 `message_blocked`, the widget shows "I can't help with that request." | Pending (`message_blocked`, `reason: prompt_injection`) |
| Replay | Landing, sign-up and dashboard recorded (`/s/` uploads) | Pending |
| Funnel steps 1–6 | | Pending (product owner builds it) |

### Notes

- **Two script fixes, no app changes.** The first sign-up typed the email code before Clerk had sent it (the script now waits and retries). The first chat attempt timed out on the widget's Send button, and a rerun of the chat part on the same project worked. Neither run sent a chat, so the conversation above is the project's first.
- **Blocked-message copy differs.** The API's message is "That message can't be sent. Try rephrasing your question.", but the widget shows its own "I can't help with that request." Both are fine. The visitor's text stays in the input.
