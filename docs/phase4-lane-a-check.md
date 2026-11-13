# Phase 4 · Lane A check: chat → Conversations + usage

Checks A1–A3 end to end on a Vercel preview (project.md §6.7 Conversations, §6.12 Usage).

## How to run it

1. Sign up on the preview (account **A**, Free plan) and create a project.
2. **Usage:** note "used / limit" (a new project starts at 0).
3. **Install:** copy the snippet into a copy of `apps/widget/demo/index.html` (don't commit it) and open that page on `http://localhost:5500`.
4. Open the widget and send two messages. After each accepted message, reload **Usage**: the count goes up by one.
5. **Conversations:** press **Refresh**. The chat shows once, the preview is the first question, and the count is 4 messages (2 visitor + 2 bot). Open it: the thread shows the four messages in order, visitor right, bot left.
6. Sign up as account **B**. Open A's project URLs (Conversations and Usage pages, `GET /api/projects/:id/conversations`, `GET /api/conversations/:id`): each is a 404, and A's project isn't in B's project list.

## Results

Run on 2026-11-13 on the preview of this branch (latest `main` with A1 #36, A2 #38 and A3 #37): https://askwell-git-p4c-t04-lane-a-check-bajrasoftit-5075s-projects.vercel.app

Playwright (headless Chromium) with the Vercel bypass header and Clerk testing tokens. Two new `+clerk_test` users on the dev Clerk instance, both on Free. The demo page was served from a copy on `http://localhost:5500`. The new project has no knowledge, so the bot answers "I don't know…", which is expected here.

| Step | Result |
|---|---|
| 1. A signs up, creates a project | Pass (POST `/api/projects` → 201) |
| 2. Usage before the chat | Pass: 0 / 100 |
| 3. Install snippet → demo page → widget opens | Pass: snippet has the project's key; the `/embed` panel opens |
| 4a. Message 1 "Hello, do you ship to Canada? (a4 …)" | Pass: bot replied. **Usage 1 / 100** |
| 4b. Message 2 "What are your opening hours?" | Pass: bot replied. **Usage 2 / 100** |
| 5a. Conversations → Refresh | Pass: 1 row, preview "Hello, do you ship to Canada? (a4 …)", **4 messages**, time in UTC |
| 5b. Open the thread | Pass: visitor, bot, visitor, bot, in order; visitor right (black), bot left (glass) |
| 5c. A's `GET /api/projects/:id/conversations` | Pass: 200, `messageCount` 4, same preview |
| 6a. B: `GET /api/projects/<A's project>/conversations` | Pass: 404 `not_found` "Project not found." |
| 6b. B: `GET /api/conversations/<A's conversation>` | Pass: 404 `not_found` "Conversation not found." |
| 6c. B: A's Conversations, Usage and project pages | Pass: each shows "404 This page could not be found." No rows, no progress bar, none of A's text |
| 6d. B: own project list | Pass: 0 projects, A's isn't there |

### Notes

- **Soft 404 on pages.** For B, A's dashboard pages show the 404 page, but the HTTP status is 200. That's how Next.js streaming works: `loading.tsx` sends the 200 header before the layout's `notFound()` runs. No data leaks, and the API routes return a real 404. The same happens on every project page (Knowledge, Install), so it isn't new in Phase 4. No change made.
- **Small copy issue.** With one conversation the list header reads "Newest 1 shown, newest first." That's A2's file, outside this task's files. Not changed.
- **Usage counts accepted visitor messages:** 2 visitor messages → 2 used. The bot replies don't count.
