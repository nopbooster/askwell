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

_Pending: the run on the preview._
