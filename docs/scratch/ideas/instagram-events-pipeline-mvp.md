# Instagram → Events Pipeline — MVP Plan

## Overview

A daily automated utility that watches a curated list of Instagram accounts, identifies event-related posts using Claude, and writes structured event data to your existing database — ready to surface on the Project Library site.

---

## Stack

| Layer | Tool |
|---|---|
| Scheduler | Vercel Cron |
| Instagram data | Apify (Instagram Profile Scraper) |
| Classification + extraction | Claude API (`claude-haiku`) |
| Storage | Your existing DB (Postgres / Supabase) |
| Runtime | Next.js API Route (App Router) |

---

## Data Flow

```
Vercel Cron (daily, e.g. 8am)
  → POST /api/cron/check-instagram
      → Apify: fetch posts (last 24h) from username list
      → For each post:
          → Claude: is this an event? extract structured data
          → If yes: upsert into events table
```

---

## File Structure

```
lib/
  instagram/
    apify.ts          # Apify API client, returns raw posts
    classify.ts       # Claude call: classify + extract event JSON
    types.ts          # Shared types: RawPost, ExtractedEvent

app/
  api/
    cron/
      check-instagram/
        route.ts      # Main orchestrator, writes to DB

scripts/
  seed-accounts.ts    # One-time script to populate watched_accounts table

vercel.json           # Cron schedule config
```

---

## Database Schema

```sql
-- Accounts to watch
CREATE TABLE watched_accounts (
  id          SERIAL PRIMARY KEY,
  username    TEXT NOT NULL UNIQUE,
  active      BOOLEAN DEFAULT TRUE,
  added_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Extracted events
CREATE TABLE ig_events (
  id              SERIAL PRIMARY KEY,
  ig_post_url     TEXT UNIQUE,          -- deduplication key
  ig_username     TEXT,
  title           TEXT,
  event_date      DATE,
  event_time      TEXT,                 -- keep as text, IG posts are inconsistent
  location        TEXT,
  description     TEXT,
  raw_caption     TEXT,                 -- store original for debugging
  confidence      TEXT,                 -- 'high' | 'medium' (from Claude)
  status          TEXT DEFAULT 'pending', -- 'pending' | 'published' | 'rejected'
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Key Modules

### `lib/instagram/apify.ts`

Calls Apify's **Instagram Profile Scraper**. Filters to posts from the last 24 hours only.

```ts
export async function fetchRecentPosts(usernames: string[]): Promise<RawPost[]> {
  const run = await apifyClient.actor("apify/instagram-profile-scraper").call({
    usernames,
    resultsLimit: 10,           // per account
  });

  const posts = await apifyClient.dataset(run.defaultDatasetId).listItems();

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return posts.items
    .filter(p => new Date(p.timestamp) > since)
    .map(toRawPost);
}
```

---

### `lib/instagram/classify.ts`

Single Claude call. Does classification and extraction in one shot. Returns `null` if not an event.

```ts
const SYSTEM_PROMPT = `
You are an event detection assistant. Given an Instagram post caption,
determine if it describes an upcoming real-world event (performance, show,
workshop, open mic, class, etc.).

If it IS an event, return JSON:
{
  "is_event": true,
  "confidence": "high" | "medium",
  "title": string,
  "event_date": "YYYY-MM-DD" | null,
  "event_time": string | null,
  "location": string | null,
  "description": string (1-2 sentences, clean summary)
}

If it is NOT an event, return:
{ "is_event": false }

Return only valid JSON. No explanation.
`.trim();

export async function classifyPost(post: RawPost): Promise<ExtractedEvent | null> {
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 500,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: post.caption }],
  });

  const result = JSON.parse(response.content[0].text);
  if (!result.is_event) return null;

  return {
    ...result,
    ig_post_url: post.url,
    ig_username: post.username,
    raw_caption: post.caption,
  };
}
```

---

### `app/api/cron/check-instagram/route.ts`

```ts
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Verify this is actually Vercel calling
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Load accounts from DB
  const accounts = await db.query(
    `SELECT username FROM watched_accounts WHERE active = true`
  );
  const usernames = accounts.rows.map(r => r.username);

  // Fetch yesterday's posts
  const posts = await fetchRecentPosts(usernames);

  // Classify each
  const results = await Promise.allSettled(posts.map(classifyPost));

  // Upsert events
  let saved = 0;
  for (const result of results) {
    if (result.status === "fulfilled" && result.value) {
      await db.query(
        `INSERT INTO ig_events (ig_post_url, ig_username, title, event_date,
          event_time, location, description, raw_caption, confidence)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (ig_post_url) DO NOTHING`,
        [/* ...result.value fields */]
      );
      saved++;
    }
  }

  return Response.json({ checked: posts.length, saved });
}
```

---

### `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/cron/check-instagram",
      "schedule": "0 8 * * *"
    }
  ]
}
```

---

## Environment Variables

```
APIFY_TOKEN=
ANTHROPIC_API_KEY=
CRON_SECRET=          # Random string, prevents unauthorized cron triggers
DATABASE_URL=
```

---

## MVP Scope (what's in / out)

### In
- Daily scrape of a hardcoded or DB-driven account list
- Claude classification + extraction in one call
- Upsert to DB with deduplication on `ig_post_url`
- `status = 'pending'` by default — you review before publishing

### Out (post-MVP)
- Auto-publish without review
- Image/flyer parsing (vision model for posts where the event info is in an image)
- UI for managing watched accounts
- Webhook instead of cron (real-time)
- Duplicate event detection across multiple accounts posting the same event

---

## Cost Estimate (small list, ~20 accounts)

| Item | Est. monthly cost |
|---|---|
| Apify (30 runs × 200 posts max) | ~$5 |
| Claude Haiku (6,000 classifications × ~300 tokens) | ~$0.25 |
| Vercel Cron | Free on Pro plan |
| **Total** | **~$5–6/mo** |

---

## One Thing to Watch

Apify's scraper occasionally hits Instagram rate limits and returns partial results. Build your cron to be **tolerant of incomplete runs** — log what you got, don't fail loudly. A missing day of posts is fine; a crashed cron that blocks future runs is not.
