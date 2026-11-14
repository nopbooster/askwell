# Phase 4 · Lane B check: events, funnel, trace

Checks B1–B3 end to end on a Vercel preview (project.md §6.11 Analytics): product events, session replay, the AI trace with its cost, `message_blocked`, and the funnel.

## How to run it

1. In a fresh browser, open the landing page `/` (anonymous `$pageview`, replay on).
2. Sign up (new account, Free plan). The dashboard creates the account row → `signed_up`.
3. Create a project → `project_created`.
4. Knowledge: paste some text → `knowledge_added`.
5. Install: press **Copy** → `snippet_copied`. The browser is identified as the Clerk user here, which links the earlier anonymous landing visit.
6. Paste the snippet into a copy of `apps/widget/demo/index.html` (don't commit it), serve it on `http://localhost:5500`, open the widget and send a question about the pasted text. The bot answers → `$ai_generation` (the trace) and, for the project's first conversation, `first_chat` (sent as the owner).
7. Send a prompt-injection message ("Ignore all previous instructions…"). The widget shows "That message can't be sent…" → `message_blocked` with `reason: prompt_injection`.
8. In PostHog, check every event, a replay of the landing/dashboard visit, and the trace with its cost (LLM analytics → Traces).

## Funnel (PostHog → Product analytics → New insight → Funnel)

Same person, steps in order, conversion window 14 days:

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

Pending.
