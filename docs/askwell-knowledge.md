<!--
==========================================================================
SETUP FOR THE PRODUCT OWNER: NOT PART OF THE UPLOADED KNOWLEDGE
==========================================================================
-->

> **Setup for the product owner (do not upload this box).**
> Everything above the `UPLOAD STARTS HERE` line is for you. Delete it before you upload, or the bot may quote it to visitors.
>
> 1. Sign in to Askwell and upgrade the account to **Pro** (Billing page). Pro allows 2,000 messages a month and hides the "Powered by" badge.
> 2. Create a project named **Askwell**.
> 3. Save a copy of this file with everything above `UPLOAD STARTS HERE` removed. Upload it in the project's **Knowledge** page. Wait until its status is ready.
> 4. Open **Install** and copy the public key (`pk_...`) from the script tag.
> 5. In Vercel, set `LANDING_WIDGET_KEY` to that key: **Preview** now, **Production** at launch. Redeploy, because Vercel applies env changes only to new deployments.
> 6. Open the landing page and ask "Is there a free plan?". The widget should answer.

---

<!-- ======================= UPLOAD STARTS HERE ======================= -->

# Askwell: questions and answers

## What is Askwell?

Askwell is an AI support chat widget for any website. You add your product info as text or files. You copy one script tag into your site. Your visitors get a chat bot that answers their questions from that info.

## Who is Askwell for?

Askwell is for businesses that want to answer visitor questions on their website. The business owner sets it up in the Askwell dashboard. Visitors chat with the bot on the owner's website.

## How does it work?

It takes three steps:

1. **Create a project.** Sign up and create a project in the dashboard.
2. **Add knowledge.** Upload files or paste text about your product.
3. **Paste the script tag.** Copy the script tag from the Install page into your website. The chat button appears.

## How do I sign up?

Click "Start free" on the landing page. You can sign up with email and password, or with Google. New accounts start on the Free plan.

## Is there a free plan?

Yes. The Free plan costs nothing. It includes:

- 1 project
- 100 messages per month, per project
- 3 knowledge sources per project
- The default widget look, with the "Powered by Askwell" badge shown

## How much does Pro cost?

Pro costs $19 per month.

## What does Pro include?

- 5 projects
- 2,000 messages per month, per project
- 25 knowledge sources per project
- Full widget customization: button color, button position, button label, open animation, header text
- The option to hide the "Powered by" badge

## What is the difference between Free and Pro?

| | Free | Pro |
|---|---|---|
| Price | $0 | $19 / month |
| Projects | 1 | 5 |
| Messages per month (per project) | 100 | 2,000 |
| Knowledge sources (per project) | 3 | 25 |
| Button color | Default | Any |
| Button position | Bottom right | Any corner |
| Button label | Default | Custom |
| Open animation | Fade | Fade, slide or scale |
| Header text | Default | Custom |
| "Powered by" badge | Shown | Can be hidden |

## How do I upgrade to Pro?

Open the Billing page in the dashboard and choose Pro in the pricing table. Payments are handled by Clerk Billing. Customize unlocks once the payment goes through.

## How do I manage or cancel my subscription?

Click "Manage subscription" on the Billing page. It opens the account portal, where you can manage or cancel your plan. If you cancel, you keep Pro until the end of the period you paid for. Then the account goes back to Free.

## What is a project?

A project is one chat bot. It has its own knowledge, its own widget settings, its own conversations and its own public key. You can rename or delete a project in the dashboard.

## What can I upload as knowledge?

- **PDF** files
- **Markdown** files (`.md`)
- **Text** files (`.txt`)
- **Pasted text**, with a title

Each file can be up to 10 MB. Files and pasted texts count toward the same knowledge source limit: 3 per project on Free, 25 on Pro.

## Can I upload Word documents or spreadsheets?

No. Askwell does not accept DOCX or spreadsheet files. Save the content as PDF, Markdown or plain text, or paste it as text.

## Can Askwell read my website automatically?

No. Askwell does not scrape websites. Add your info by uploading files or pasting text.

## What happens after I upload a file?

Askwell reads the text in the file, splits it into small parts, and indexes them so the bot can search them. The file shows as "processing" until it is ready. On the Knowledge page you can see every source and its status. Deleting a source also deletes its file and everything the bot learned from it.

## How do I add the widget to my site?

Open the Install page of your project. It shows a script tag with your project's public key, a copy button and short steps. Paste the script tag into your website's HTML. The chat button appears on your page.

The script tag looks like this:

```html
<script src=".../widget.js" data-key="pk_..."></script>
```

## Does the widget affect my website's design?

No. The widget loader is a small script, under 5 kb. The chat button lives in its own isolated area (a shadow root) and adds no global CSS. The chat itself opens in a separate frame. Nothing else on your page is touched.

## How does the bot answer questions?

When a visitor asks a question, Askwell finds the 5 parts of your knowledge that match it best. The bot answers only from those parts. If the answer is not in your knowledge, the bot says it doesn't know instead of guessing.

## Which AI does Askwell use?

Chat replies come from Claude, by Anthropic. Knowledge search uses OpenAI embeddings. Askwell uses one chat model; you can't choose a different AI provider.

## Is there a limit on visitor messages?

Yes:

- Each message can be up to 1,000 characters.
- Each visitor can send up to 20 messages per minute.
- Each project has a monthly message limit: 100 on Free, 2,000 on Pro.

When a limit is reached, the widget shows a friendly message instead of an answer. The monthly count resets every month.

## Where do I see my usage?

The dashboard shows messages used this month against your limit, for each project.

## Where do I see conversations?

Open Conversations in your project. The list shows the newest chats first, with a preview of the first message, the number of messages and the time. Open a conversation to see the full history, visitor and bot. Click refresh to load new chats; the view does not update live.

## What can I customize?

On Pro, the Customize page lets you change:

- Button color
- Button position (any corner)
- Button label
- Open animation (fade, slide or scale)
- Header text
- The "Powered by" badge (show or hide)

A live preview shows your changes. Save, then reload your website to see the new look. On Free, the Customize page is visible but locked, with an option to upgrade.

## What is the "Powered by" badge?

It is a small "Powered by Askwell" note in the chat panel. It is always shown on Free. On Pro, you can hide it.

## Is my data safe? Can visitors see other projects' data?

No visitor can see another project's data. Each chat only searches the knowledge of its own project. The public key in the script tag only identifies your project; it gives no access to your account. Uploaded files are kept in private storage. In the dashboard, owners only see their own projects.

## Can visitors trick the bot?

Askwell checks visitor messages for prompt injection before they reach the AI. The bot is told to treat your documents as information, never as instructions, and to stay on topic. It never reveals its instructions or other projects' data. Visitor messages and bot replies are always shown as plain text.

## Does the widget remember visitors?

The widget keeps a random visitor ID in the visitor's browser, so a returning visitor is recognized as the same visitor. It is not tied to their name or email.

## Can a human agent take over a chat?

No. Askwell does not offer human takeover. The bot answers every message.

## Can I add team members to my account?

No. Each account has one owner. Teams and multiple members per account are not offered.

## Are conversations updated in real time in the dashboard?

No. Use the refresh button on the Conversations page to load new chats.

## Does Askwell score leads or detect buying intent?

No. Askwell does not offer buying-intent scoring.

## What does Askwell not offer?

- DOCX and spreadsheet uploads
- Website scraping
- Buying-intent scoring
- A real-time conversation view
- Human takeover of chats
- A choice of AI providers
- Teams or multiple members per account
