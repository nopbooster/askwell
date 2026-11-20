# Phase 6 · Core-flow rehearsal (P6H-T08)

In progress. Results are added as each step runs.

## Setup found on the Preview environment

| Item | Expected (task) | Found | Evidence |
|---|---|---|---|
| `LANDING_WIDGET_KEY` on Preview | Set | **Set**: `pk_U51_Co8Y_7hC6fI03R03g34W` | Landing HTML on the preview has `<script id="askwell-landing-widget" src=".../widget.js" data-key="pk_U51_…">` |
| Demo project | "Askwell" project | "Askwell (landing page, dev)" | dev DB `projects.public_key` |
| Demo owner's plan | Pro | **Free** (100 messages/month) | dev DB `accounts.plan` |
| Demo knowledge | `docs/askwell-knowledge.md` uploaded | 3 pasted-text sources from 2026-11-15 ("What Askwell is", "Plans and pricing", "Installing and customizing the widget"), all Ready. Not the merged knowledge file. | dev DB `knowledge_sources` |
