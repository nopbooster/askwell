# Phase 6 · UI check (P6H-T07, B3)

Walked every screen at **375 px, 768 px and 1280 px** on the PR #58 Vercel preview (2026-11-20), against `project.md` §13.

**How:** Playwright scripts with a throwaway `+clerk_test` user (and a second one upgraded to Pro with Clerk's test card). On every screen, at every width, the script:

- checks `scrollWidth` against `clientWidth` (horizontal scroll), and lists any element whose right edge is past the viewport;
- lists every visible link, button or field smaller than 24 × 24 px;
- takes a full-page screenshot. I looked at the 375 px shots of every fixed screen.

The preview's chat route answered 502 for every message (reported to the lead; not in this task). So Conversations "with data" was checked with mocked list and thread answers in the browser. The worst case is a preview and messages with a long unbroken URL. Error and loading states were forced the same way.

## Results

Pass = no horizontal scroll, tap targets usable, tokens and `components/ui` used. "Light" means the dashboard in light mode. "Dark" means the dashboard's dark theme, or the landing (always dark).

| Screen | State | 375 | 768 | 1280 | Light / dark | Notes |
|---|---|---|---|---|---|---|
| Landing | – | Pass after fix 1 | Pass after fix 1 | Pass after fix 1 | Dark | Was rendering **light** (fix 1). Footer "Sign in" link was 43 × 20 (fix 4). |
| Sign-in / sign-up | – | Pass | Pass | Pass | Clerk default | Clerk's footer links are 18 px tall. Left as is: §13 says Clerk's default look. |
| /dashboard | No projects | Pass after fix 3 | Pass after fix 3 | Pass after fix 3 | Light | Create form: centered label over a left-aligned field (fix 3). |
| /dashboard | Mobile menu open | Pass | – | – | Light | |
| /dashboard | One project = Free limit | Pass | Pass | Pass | Light + dark | Upgrade prompt instead of the form. A long project name wraps. |
| /dashboard | Pro, one project | Pass | Pass | Pass | Light | Create form shown. The project-name link is 21 px tall, but it's inline text in a heading (WCAG inline exception). |
| Knowledge | Empty | Pass | Pass | Pass | Light + dark (375) | Empty state |
| Knowledge | With a source | Pass | Pass | Pass | Light + dark | |
| Install | – | Pass | Pass | Pass | Light + dark | The snippet scrolls inside its own box. |
| Customize | Free, locked | Pass | Pass | Pass | Light + dark | Upgrade link had no focus ring (fix 4). The badge checkbox is 16 px, but its whole 40 px label row is clickable. |
| Customize | Pro | Pass | Pass | Pass | Light + dark | "Replay the open animation" was about 20 px tall (fix 4). |
| Conversations | Empty | Pass | Pass | Pass | Light + dark (375) | Empty state with Refresh |
| Conversations | With data (list) | Pass after fix 2 | Pass after fix 2 | Pass | Light + dark | **Before:** page 524 px wide at 375, 804 px at 768 (fix 2). |
| Conversations | Thread open | Pass after fix 2 | Pass after fix 2 | Pass | Light + dark | **Before:** 520 px at 375, 800 px at 768. **After:** long URLs wrap inside the bubbles. |
| Conversations | Thread loading / error, refresh error | Pass | – | – | Light | Skeleton; "Couldn't load this conversation" with Retry; "Couldn't refresh" |
| Usage | 0 used / some used | Pass | Pass | Pass | Light + dark | |
| Billing | Free / Pro | Pass | Pass | Pass | Light + dark | Clerk pricing table follows the theme. |
| /embed | Valid key / unknown key | Pass | Pass | Pass | Light (always) | Full-height panel. "Unavailable" for an unknown key. |

**Error and loading states, all screens:** every dashboard route has its own `loading.tsx` (`LoadingState`) and `error.tsx` (`ErrorState` with Retry). Each page also shows an inline `ErrorState` when its plan or data read fails. Client fetches (Knowledge polling, Conversations thread and refresh, the Billing pricing table) have their own error UI.

## Fixes

1. **Landing rendered light instead of dark** (`app/globals.css`). Found by Jim.
   - **Cause:** `@theme { --color-canvas: var(--canvas) … }` resolves at `:root`, so the landing's nested `.dark` wrapper never changed `bg-canvas`, `text-fg` and the rest.
   - **Fix:** the semantic colors, radius and shadows move to `@theme inline`, so utilities read `var(--canvas)` where they are used. `body` and `.glass` use the raw variables.
   - **Before:** light grey page with black text. **After:** dark page, glass panels, white primary buttons, at all three widths.
   - The dashboard's dark mode is unchanged: `dark` is on `<html>` there.
2. **Conversations scrolled sideways below `lg`** (`conversations/conversations-view.tsx`, `conversation-list.tsx`, `thread-view.tsx`).
   - **Cause:** the single-column grid used an `auto` track, so a long unbroken URL set its minimum width. `break-words` doesn't lower min-content.
   - **Fix:** `grid-cols-1` (`minmax(0, 1fr)`), plus `overflow-wrap: anywhere` on list previews and message bubbles.
   - **Before:** 524 / 804 px wide pages. **After:** 375 / 768.
3. **Empty dashboard form looked misaligned** (`ui/empty-state.tsx`). The action now sits in a left-aligned `max-w-md` block under the centered title. **Before:** centered label over a left-aligned field and button. **After:** label, field and button line up on the left. Jim's suggestion.
4. **Tap targets and consistent buttons:**
   - `ui/button.tsx` exports `buttonClasses()`. The three "Upgrade to Pro" links (projects, knowledge, customize) use it instead of hand-copied classes. Two of them had no focus ring.
   - "Replay the open animation" (`customize/preview.tsx`) and the landing footer's "Sign in" link (`landing/footer.tsx`) are now at least 40 px tall.

No behavior, route, API type or test changed. `next.config.ts`, `apps/widget`, the landing Demo section and the pricing/auth logic were not touched.
