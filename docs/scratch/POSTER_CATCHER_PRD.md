# Poster Catcher — PRD

**Status:** Aligned in discussion, ready to plan. No ticket yet.
**Milestone:** Post-Netwerk personal tooling (internal to my curation workflow).
**Created:** 2026-08-16 (reconciled live against `POST /api/events`, `src/lib/utils/server/event.ts`, and `prisma/schema.prisma`).

> A capture-and-extract utility that lets me forward event links and poster photos to a
> Telegram bot, which extracts structured event data and stages it for my review before it
> becomes a published event. This doc stays at the what/why/scope altitude; the file-by-file
> build sequence gets written separately once we're settled.

---

## Overview

Poster Catcher is a personal ingestion pipeline for community events. I forward a poster photo
(and/or a link, and/or a caption) to a Telegram bot from my phone. The bot **captures and
extracts** the event into a **staging record**, then tells me what it found. Later, from an
authenticated in-app review surface, I approve/edit/reject each one. Approving materializes it
into a real Project Library **Event** through the app's existing event-creation path.

The publish target is an **`Event`** hosted by the Project Library events page. Events already
carry everything we need: a photo via `Image`/`ImageAttachment`, title, content, `eventDateTime`,
`location`, `tags`, `contentVisibility`, and draft/published status.

## Problem

Finding community events means encountering them in the wild — a flyer on a pole, an Instagram
post, an Eventbrite link — in inconsistent formats. Manually transcribing each into Project
Library is tedious enough that events get missed. I want to capture in one gesture from my phone
and do lightweight curation later, in batch.

## Goals

- Capture event info from my phone with near-zero friction (forward and forget).
- Extract structured fields from heterogeneous inputs (image, caption text, link).
- Review/approve/edit before anything goes live.
- Build it so a future multi-organizer version is **additive** to what ships now.

## Scope (v1)

- Solo use: I am the only submitter and reviewer, gated as a `superadmin` operator.
- Every submission passes through my review before it publishes.
- One-off events (see Constraints).
- Extraction runs inline at capture; materialization runs on my approve click. A worker or cron can
  be added later, between those two seams.
- Push-based: the bot acts on what I forward it, using a hosted vision model.

## Users

- **v1:** Me (solo organizer), gated as a `superadmin` operator.
- **Future:** Trusted community organizers submitting to a shared queue, each mapped to a real
  Project Library user account.

---

## Architecture principle

**The bot captures and stages; my approval creates the event.** All inputs funnel into a dedicated
staging table (`EventSubmission`) that lives *upstream* of the event write path and is read only by
the review surface. An `Event` row is created when I approve a submission, and that approval runs in
my authenticated session through the existing `POST /api/events` route.

Two properties we worked through make this the right shape:

1. **A single write path.** Event creation stays entirely in the existing route; the bot reaches it
   the same way the app does — through my session on approve. This preserves the decision that
   retired the old shared draft-create util.
2. **Clean content tables.** The `events` table gains a row only on approve, so drafts stay
   deliberate. Rejected submissions are pruned cheaply from the staging table, which is designed to
   be transient.

The staging record is the seam that keeps a future multi-user version cheap.

---

## Functional requirements

### 1. Intake — Telegram bot (webhook)

- A Next.js route handler receives Telegram updates over a webhook, which suits serverless hosting.
- Verify the Telegram `secret_token` header **and** a sender allowlist; reject anything else.
- For each message: capture sender id + timestamp, download any photo and store it via the
  existing Supabase upload path (→ an `Image` row), and capture the accompanying caption text
  and/or link.
- Acknowledge fast (HTTP 200) so Telegram does not retry.

### 2. Extraction (inline, at intake)

- Runs as post-response work (Next.js `after()`), so intake stays fast.
- Reduce each input to **image + text**: the poster image, the forwarded caption text, and — for
  links — best-effort fetched page text (plain HTTP fetch). Login-walled sources (e.g. Instagram)
  are best-effort; the forwarded caption + screenshot are the fallback.
- One multimodal LLM call with a schema; force structured JSON output.
- Extract: `title`, `content`, `eventDate`, `location`, `tags`.
- Resolve **relative dates** ("this Friday") against the capture date + timezone passed into the
  prompt.
- Set the submission status (`READY` / `NEEDS_FIX` / `FAILED`) and reply on Telegram with the
  result (e.g. "got it — *Improv Jam, Fri Aug 22* ✅" or "⚠️ couldn't find a date — added to
  review").

### 3. Staging store (`EventSubmission`)

- Every capture writes one row into a dedicated table, separate from `Event`.
- Holds the raw input references, the extracted fields, a status, and an error note.
- Prunable, and read only by the review surface.

### 4. Review + materialize — `/admin/submissions`

- A new authenticated surface at **`/admin/submissions`** — the first `admin/` route in the app.
- Gated to me via a `superadmin` operator check (see Constraints).
- Lists non-terminal submissions with extracted fields shown; per item: **approve / edit /
  reject**.
- **Near-misses** (`NEEDS_FIX`) show a plain error ("No date found — add one to publish"); I fill
  the missing field, which moves it to `READY`.
- **Approve** materializes the submission into an `Event` via the existing `POST /api/events`
  route, in my session, hosted by the Project Library events page. (Publish directly, or create as
  a normal draft to fine-tune in the standard editor.)
- **Reject** marks the submission terminal and closes it out.

---

## The validity contract — what makes a submission valid

Submissions can be stored at any level of completeness. Creating an `Event` requires one thing.

**Hard gate: a real, resolved event date.** Everything else (title, content, location, tags) is
*soft* — editable before publish.

Statuses:

| Status | Meaning |
|---|---|
| `PENDING` | Captured; extraction not finished yet. |
| `READY` | Extraction produced a valid date. Materializable (still editable). |
| `NEEDS_FIX` | Extraction ran, but the date couldn't be resolved (near-miss). Shown with a clear error; I add the date to make it `READY`. |
| `FAILED` | Extraction itself failed (unreadable image / unfetchable link). Shows raw input for hand-fill or re-extract. |
| `PUBLISHED` | Approved and materialized into an `Event`. |
| `REJECTED` | Discarded before materializing. |

Because a near-miss can be approved only once it has a date, the existing route always receives a
real date from this pipeline, so the date it stores is always the one on the poster. (The route's
current 7-day-default behavior is questionable but orthogonal; see Deferred work.)

---

## Data model (draft — high level)

A new `EventSubmission` model, roughly:

- `id`, `status`, `submitterTelegramId`, `submittedAt`
- Raw input: `sourceUrl?`, `rawCaption?`, `rawImageId?` (FK to the existing `Image`)
- Extracted: `title?`, `content?`, `eventDate?`, `eventTimezone?`, `location?`, `tags[]`
- `errorNote?`, `reviewedAt?`, `publishedEventId?`

Final field/enum shapes are decided at build time; `prisma/schema.prisma` remains the source of
truth.

---

## Constraints & decisions

- **One-off events (v1).** Project Library events are single-occurrence. For a recurring poster
  ("every Friday at 7", "Fri–Sun 12–2"), the bot's extraction instructions log the date of the
  **first valid occurrence**. Recurring support is a later, separate concern.
- **Hard gate = date only.** Location and all other fields are soft.
- **Tags = 1–3 reasonable inferred tags.** The LLM infers a small number of sensible tags per
  event, free-form for now. I'll observe results and adjust as the site-wide supported-tags
  vocabulary lands (see Deferred work).
- **Caption + links are P1.** The caption text is important content in its own right. Use the
  forwarded Telegram caption (zero auth) plus best-effort fetch of public links. Login-walled
  sources (Instagram auth) are a later investigation.
- **`superadmin` is an env-based operator identity** for me, sitting alongside the page-scoped
  `PermissionRole.ADMIN` as its own capability. The review surface is gated on it, because
  submissions are a global ingestion queue rather than a page-scoped resource.
- **Model provider = Vercel AI Gateway + a vision-capable model.** The deployed app needs its own
  server-side model access (an API key / Gateway config); the models available in Cursor serve the
  coding assistant.

---

## Extensibility (future-facing)

Multi-user is mostly a governance layer over the same plumbing, because the staging table is the
seam:

- Sender id is already captured; add an allowlist of permitted submitters.
- Each future submitter maps to a **real Project Library user account** (author identity).
- Decide the trust model: all submissions still route through my approval, or trusted organizers
  publish directly.
- A background **worker/cron** can later sit *between* the two existing function seams (extract →
  materialize) and reuse them as-is — e.g. to batch-extract or auto-materialize at scale.

---

## Open questions & deferred work

- **[Side ticket] The 7-day fabricated-date default** in `POST /api/events` draft creation is
  questionable (a leftover from the retired inline-edit flow). It doesn't block us — file a ticket
  to reconsider it independently.
- **[Side ticket] Site-wide supported-tags vocabulary DB** (likely built on the existing `Topic`
  model — worth deciding). Until it exists, the bot uses free-form inferred tags.
- **[Open] Duplicate handling** — same event submitted twice. Lean toward a cheap "possible
  duplicate" flag at review rather than auto-dedupe; confirm at build.
- **[Open] Failure/retry depth** — v1 shows `FAILED` with the raw input; a richer retry/hand-fill
  affordance on `/admin/submissions` is a nice-to-have that the two seams make additive.
- **[Open] Cost envelope** — one vision call per submission; trivial solo, worth revisiting for
  multi-user.
- **[Open] Accuracy bar** — what counts as "good enough" extraction is currently undefined.

---

## Human steps required

These are the out-of-band setup tasks a person (me) must do — they can't be fully automated in the
codebase:

1. **Create the Telegram bot** via BotFather; capture the bot token. (Done: user name PLEvents_bot)
2. **Confirm the target Project Library events page** (it exists under a different name) — its id /
   handle — and the Project Library **user account** the bot authors events as. (Done: Page name 'PL Events')
3. **Set environment variables** (local `.env` + Vercel), roughly:
   - `TELEGRAM_BOT_TOKEN` (Done)
   - `TELEGRAM_WEBHOOK_SECRET` (the header secret the webhook verifies)
   - allowed Telegram sender id(s) (Where do I find this?)
   - `superadmin` operator user id(s) (Just me, its set up on my user account as I am the superadmin)
   - Vercel AI Gateway key / provider config
4. **Set up the model provider** (Vercel AI Gateway + a vision-capable model). (I'll need some more info about this when we get to that step)
5. **Register the Telegram webhook** after deploy (`setWebhook` with the deployed URL +
   `secret_token`). One-time; can be a small `npm run` script or a single curl.
6. **File the two side-tickets**: the 7-day-default reconsideration, and the supported-tags
   vocabulary DB. (Planning agent can do this)

---

## Success criteria (draft)

- I can forward a poster and have a correctly-extracted, review-ready submission waiting, without
  manual transcription.
- Near-misses (no valid date) surface with a clear reason and are trivially fixable before publish.
- Approving a submission produces a real Project Library event through the existing route, with the
  poster image attached.
- Extraction is accurate enough that most items need little or no editing (bar TBD).
