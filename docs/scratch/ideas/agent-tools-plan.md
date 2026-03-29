# Agent Tools Repo Plan

A private repo for personal workflow scripts that interact with your projects — separate from any app repo, low ceremony, easy to extend.

---

## Why a Separate Repo

These scripts are personal workflow tools, not part of any product. Keeping them separate means:

- **Credentials stay isolated.** Service account JSONs, Notion keys, and Anthropic keys have no business near an app repo. A dedicated repo with its own `.env` and gitignores is the right home.
- **Different lifecycle.** Your app has deploys, CI, collaborators. These scripts have none of that — they live and change on your own schedule.
- **No noise in your app repo.** No `scripts/` folder creeping into PRs, no confusion about what's part of the product.

---

## Repo Structure

```
agent-tools/
  .env                    # all API keys and config — never committed
  .env.example            # committed; documents what vars are needed
  .gitignore
  README.md
  credentials.json        # Google service account — gitignored
  package.json

  update-doc.js           # reads project plan doc, applies Claude edits
  notion-tickets.js       # pulls tickets from Notion
  # add more scripts here as needed

  shared/
    anthropic.js          # shared Anthropic client setup
    notion.js             # shared Notion client setup
    google.js             # shared Google auth setup
```

### `.env`
```
ANTHROPIC_API_KEY=...
NOTION_API_KEY=...
NOTION_DATABASE_ID=...
GOOGLE_DOC_ID=...
GOOGLE_CREDENTIALS_PATH=./credentials.json
```

### `.env.example` (committed)
```
ANTHROPIC_API_KEY=
NOTION_API_KEY=
NOTION_DATABASE_ID=
GOOGLE_DOC_ID=
GOOGLE_CREDENTIALS_PATH=./credentials.json
```

### `.gitignore`
```
.env
credentials.json
node_modules/
```

---

## How It Plays Well With Your App Repos

The agent tools repo is fully standalone — it reads from and writes to external services (Notion, Google Docs) that your app repos also happen to use. There's no direct dependency between them.

```
agent-tools/          →   Notion API   ←   Project Library app
                      →   Google Docs
                      →   Claude API
```

A few patterns that work well:

**Notion as the shared source of truth.** Your Notion tickets are the canonical project state. The `notion-tickets.js` script reads them; your app (if it ever surfaces any of that data) reads them too. Neither repo knows about the other — Notion is the bridge.

**Scripts don't touch app code.** `update-doc.js` edits a Google Doc. It never reads, writes, or depends on anything in your app repo. Clean separation.

**Local only.** You run these from your machine with `node update-doc.js "..."`. No deployment, no server, no CI. If you ever want to automate one (e.g. a cron that syncs Notion tickets somewhere), that's a small addition later — not something to design for now.

---

## Running a Script

```bash
cd agent-tools
node update-doc.js "mark the events pipeline as complete and reprioritize milestones"
```

Scripts pick up all config from `.env` automatically via `dotenv`. No arguments needed for keys or IDs.

---

## Adding a New Tool

1. Create a new `.js` file in the root
2. Import shared clients from `shared/` as needed
3. Add any new env vars to `.env` and `.env.example`
4. Add a one-liner to `README.md` describing what it does

That's it. No install step, no version bump, no publish.

---

## README Minimum

The `README.md` should at minimum list:

- What each script does (one line each)
- Prerequisites (Node version, `npm install`)
- How to set up `.env` (point to `.env.example`)
- How to get the Google credentials JSON
- How to run each script

This is for future-you in 3 months who has forgotten all of this.
