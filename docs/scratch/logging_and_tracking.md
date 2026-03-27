# Logging & Traffic Tracking

Added basic observability to understand site traffic and core user actions. No external paid services, no new DB tables.

---

## What Was Added

### 1. Vercel Analytics (`src/app/layout.tsx`)
- Installed `@vercel/analytics`
- Added `<Analytics />` component to the root layout
- Automatically tracks page views, referrers, countries, and browsers
- Visible in the Vercel dashboard under the **Analytics** tab

### 2. Request Logging (`src/proxy.ts`)
- Added a structured `console.log` to the existing `proxy.ts` (Next.js 16's replacement for `middleware.ts`)
- Logs every page-level request as a JSON line to stdout
- Captured by Vercel's function logs
- Note: API routes are excluded from the proxy matcher, so they aren't logged here — core actions cover that side

Format:
```json
{ "type": "request", "method": "GET", "path": "/explore", "ip": "1.2.3.4", "referer": null, "ua": "Mozilla/5.0...", "ts": "2026-03-26T18:00:00.000Z" }
```

### 3. Action Logger (`src/lib/utils/server/log.ts`)
- Small `logAction(action, userId?, meta?)` helper that emits structured JSON to stdout
- Server-only, no external dependencies, never throws

### 4. Core Action Call Sites
`logAction` is called after each successful write in:

| File | Action logged |
|---|---|
| `src/lib/auth.ts` | `user.login` |
| `src/app/api/auth/signup/route.ts` | `user.signup` |
| `src/app/api/posts/route.ts` | `post.created` |
| `src/app/api/events/route.ts` | `event.created` (draft + published) |
| `src/app/api/pages/route.ts` | `page.created` |
| `src/app/api/follows/route.ts` | `follow.created` (user + page) |
| `src/app/api/messages/route.ts` | `message.sent` |

Format:
```json
{ "type": "action", "action": "post.created", "userId": "clxxx...", "meta": { "postId": "clyyy...", "pageId": null, "isReply": false }, "ts": "2026-03-26T18:00:00.000Z" }
```

---

## How to Access the Logs

### Vercel Analytics (page views)
Vercel dashboard → your project → **Analytics** tab.
Shows top pages, referrers, countries, and unique visitors. No setup needed after deploy.

### Vercel Function Logs (requests + actions)
Vercel dashboard → your project → **Logs** tab.
Use the search box to filter:
- `"type":"request"` — all page visits
- `"type":"action"` — all core actions
- `"user.signup"` — just signups
- `"post.created"` — just posts created

### Vercel CLI (bulk analysis)
```bash
# Install once
npm i -g vercel

# Stream live
vercel logs <your-app-url> --follow

# Count actions by type
vercel logs <your-app-url> \
  | grep '"type":"action"' \
  | jq -r '.action' \
  | sort | uniq -c | sort -rn

# Most visited pages
vercel logs <your-app-url> \
  | grep '"type":"request"' \
  | jq -r '.path' \
  | sort | uniq -c | sort -rn

# Unique IPs (spot bots)
vercel logs <your-app-url> \
  | grep '"type":"request"' \
  | jq -r '.ip' \
  | sort | uniq -c | sort -rn
```
> Requires `jq`: `brew install jq`

---

## Limitations & Next Steps

- **Log retention:** Vercel keeps function logs for 30 days on the hobby plan
- **API traffic not captured in request logs** — only page-level requests go through `proxy.ts`. Core actions are covered by `logAction` instead.
- **No dashboard on-site yet** — to build one, the next step is an `AppEvent` DB table so logs are queryable from within the app (the `/dev` route would be a good home for this)
