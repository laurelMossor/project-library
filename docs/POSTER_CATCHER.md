# Poster Catcher

A personal event-ingestion pipeline. Forward a poster photo, a link, or a caption to a Telegram
bot; it captures and extracts the event into a **staging record**, then you review and approve it
into a real Project Library **Event** from an admin surface. Nothing touches the `events` table
until you approve.

> Product context lives in [`docs/scratch/POSTER_CATCHER_PRD.md`](scratch/POSTER_CATCHER_PRD.md).
> This doc is the implementation overview. `prisma/schema.prisma` and the source are the source of truth.

## Flow

**Core principle:** the bot *captures and stages*; your approval *creates* the event. Event creation
stays on the existing `POST /api/events` write path — the review page just calls it in your session,
so there is a single write path and no divergent event-creation logic.

## Pieces

| Concern | Where |
|---|---|
| Intake webhook | [`src/app/api/telegram/webhook/route.ts`](../src/app/api/telegram/webhook/route.ts) |
| Telegram client (auth, getFile/download/send, message parse) | [`src/lib/utils/server/telegram.ts`](../src/lib/utils/server/telegram.ts) |
| Extraction (LLM + link/OG fetch + status) | [`src/lib/utils/server/poster-extract.ts`](../src/lib/utils/server/poster-extract.ts) |
| Staging model | `EventSubmission` in [`prisma/schema.prisma`](../prisma/schema.prisma) |
| Submission queries | [`src/lib/utils/server/event-submission.ts`](../src/lib/utils/server/event-submission.ts) |
| Review API (superadmin) | [`src/app/api/admin/submissions/`](../src/app/api/admin/submissions/) |
| Review UI | [`src/app/admin/submissions/`](../src/app/admin/submissions/) + [`admin/layout.tsx`](../src/app/admin/layout.tsx) |
| Superadmin gate | [`src/lib/utils/server/superadmin.ts`](../src/lib/utils/server/superadmin.ts) |
| Shared image store/create | [`storage.ts`](../src/lib/utils/server/storage.ts) + [`image-attachment.ts`](../src/lib/utils/server/image-attachment.ts) |
| Webhook registration script | [`scripts/telegram-set-webhook.ts`](../scripts/telegram-set-webhook.ts) (`npm run telegram:webhook`) |

## Intake (webhook)

- A Next.js route handler receives Telegram updates. It verifies the `X-Telegram-Bot-Api-Secret-Token`
  header (constant-time) **and** a sender allowlist; anything else is acked-and-dropped so Telegram
  doesn't retry.
- It captures: sender id, the caption/text, any URL, and the largest photo (photos sent as an
  uncompressed *file/document* are also handled). A forwarded photo is downloaded and stored via the
  shared Supabase upload path (→ an `Image` row attributed to the Poster Catcher author account).
- It writes one `EventSubmission` (`PENDING`), returns `200` immediately, then runs extraction as
  post-response work via `after()`.

## Extraction

- One multimodal call through the **Vercel AI Gateway** (`generateObject` + a zod schema) returns
  `{ found, title, content, eventDate, eventTimezone, location, tags }`.
- Inputs reduced to **image + text**: the poster image, the forwarded caption, and best-effort
  fetched link data. For links we read **Open Graph** metadata (`og:title` / `og:description` /
  `og:image`) — this is how a public Instagram caption is read without login (the login wall is a JS
  modal over HTML whose `<head>` already holds the OG tags). Instagram is retried with a crawler
  user-agent, and its engagement chrome is stripped to recover the raw caption.
- Images are read at **high detail** (`imageDetail: "high"`) so small printed text (dates, addresses)
  is legible. A link's `og:image` is adopted as the poster when no photo was forwarded.
- **Relative dates** ("this Friday") resolve against the capture date. Recurring posters log the
  first occurrence.
- **Anti-hallucination:** the model must set `found=true` only for a real, specific event; and if
  there is no readable image, no fetched text, and only a bare-URL caption, the model is skipped
  entirely (marked `FAILED`) rather than allowed to invent one.
- Status is set from the date gate and the bot replies on Telegram with the outcome. If
  `AI_GATEWAY_API_KEY` is absent, extraction no-ops to `NEEDS_FIX` so intake still works.

## The validity contract

Submissions can be captured at any completeness. Materializing an Event requires **one hard gate: a
real, resolved, future date.** Everything else (title, content, location, tags) is soft and editable
before publish.

| Status | Meaning |
|---|---|
| `PENDING` | Captured; extraction not finished. |
| `READY` | Extraction produced a valid future date. Materializable. |
| `NEEDS_FIX` | Ran, but no resolvable date. Shown with a clear reason; add a date to make it `READY`. |
| `FAILED` | Extraction failed / nothing usable. Shows raw input for hand-fill. |
| `PUBLISHED` | Approved and materialized into an Event (terminal). |
| `REJECTED` | Discarded (terminal). |

## Review + materialize (`/admin/submissions`)

- Superadmin-only surface (first `admin/` route). Gated by `isSuperAdmin` in the server layout **and**
  re-checked in every submission API route.
- Lists open submissions with the extracted fields + poster. Per item: **edit**, **approve (publish
  or save as draft)**, or **reject**.
- **Disclaimer + source line:** extraction bakes a community-share disclaimer into the editable
  `content` (always), plus an `Original source: {url}` line when a `sourceUrl` exists. Both are
  visible/adjustable and publish as shown. No contact email is included; the source line points
  at the real organizer.
- **Approve** runs in your session and reuses the app's normal write path: `createEvent` →
  `POST /api/events` (hosted by the "PL Events" page), then attach the stored poster via
  `POST /api/image-attachments`, then `PATCH` the submission to `PUBLISHED`. (The poster `Image` is
  owned by the author account, so approve must run while logged in as that account.)

## Environment variables

Server-side only (local `.env` + Vercel). See [`docs/DEPLOYMENT.md`](DEPLOYMENT.md) for the annotated list.

| Var | Purpose |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Bot token from BotFather. |
| `TELEGRAM_WEBHOOK_SECRET` | Secret Telegram echoes back; the webhook verifies it. Must match the value used to register. |
| `TELEGRAM_ALLOWED_SENDER_IDS` | Comma-separated Telegram user ids allowed to submit. |
| `SUPERADMIN_USER_IDS` | Comma-separated app user ids that may open `/admin/*`. |
| `POSTER_CATCHER_AUTHOR_USER_ID` | App user the bot attributes captured posters to (and you approve as). |
| `POSTER_CATCHER_PAGE_ID` | The "PL Events" page approved events are hosted by. |
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway key. Absent → extraction skipped (manual fill). |
| `POSTER_CATCHER_MODEL` | Optional vision model id (default `openai/gpt-4o-mini`; `openai/gpt-4o` reads posters more reliably). |

**Setup:** register the webhook once after deploy — `npm run telegram:webhook -- https://<app-url>`.

## Known limitations

- **Instagram link-only is partial.** Instagram serves anonymous requests only a **center-cropped
  640px preview** of a post (the transform is signed, so it can't be un-cropped), and gates the
  full-resolution image behind login. Poster edge details (often the venue/time) can be cropped out.
  The reliable inputs for IG are a **forwarded screenshot** of the poster (full resolution → OCR
  works) or the **linked ticket page** (e.g. Eventbrite extracts cleanly). See Future Scope.
- **Vision OCR quality varies with the model.** `gpt-4o-mini` is inconsistent on dense posters;
  `openai/gpt-4o` is markedly more reliable (set `POSTER_CATCHER_MODEL`).
- **Solo v1.** One submitter/reviewer; the staging table is the seam for a future multi-user version.

## Future scope

### Apify (or similar) for full-resolution Instagram

The Instagram limitation above is Instagram's, not ours — a plain server fetch can't get the
uncropped image without a login. An **Apify integration** would close that gap: Apify's Instagram
scrapers run with real sessions/proxies server-side and return a public post's **full-resolution
`displayUrl`** (uncropped) plus the **complete caption** — exactly what IG withholds anonymously.

Sketch of the integration (additive, env-gated, with fallback):

- Add an `APIFY_TOKEN` env var.
- In `poster-extract.ts`, when the `sourceUrl` host is Instagram, call the Apify actor's run-sync API,
  take `displayUrl` + `caption`, download that image via the existing `downloadImage` path, and feed
  the full-resolution poster to the model.
- If the token is unset or the run fails, fall back to today's OG-image path — so it never breaks the
  working Eventbrite / forwarded-photo cases.

Tradeoffs to weigh before adopting: it's a **metered paid dependency** (counter to the current
keep-it-free goal), adds **latency** (actor runs take seconds), and is still **scraping** (can break
when Instagram changes). Cheaper single-purpose alternatives exist (RapidAPI Instagram endpoints,
ScrapingBee, Bright Data). For a solo tool, forwarding a screenshot achieves the same result for free;
Apify becomes worth it only if "forward the IG link and it just works" becomes a relied-on workflow.

### Other deferred work

- **Multi-user.** Sender id is already captured; add a submitter→account mapping and a shared queue.
  A background worker/cron can later sit *between* the extract and materialize seams and reuse them.
- **Supported-tags vocabulary.** Move from free-form inferred tags to a site-wide vocabulary (likely
  on the `Topic` model). Filed as a ticket.
- **Duplicate detection / richer retry.** A "possible duplicate" flag at review; a re-extract action
  on `FAILED`/`NEEDS_FIX` items.
