# Release Notes

High-level summary of releases for The Project Library. Bullets are intentionally coarse — see `docs/guidance/JOURNAL.md` for the per-session detail and the git history for specifics.

> **Bullet style:** a short bold headline, then one tight clause naming the concrete pieces (semicolon-separated) — one scannable line, no meta-commentary. Example:
> *Transactional email — email verification + password reset via a swappable Resend sender; verification enforced at login.*

> Most recent work is at the top. Dates and contents are correlated from git tags and the journal. `v0.2.0`+ map to real git tags; `v0.1.0` is a retroactive label for the early pre-tag scaffolding (split out at the schema-v0.4 rewrite, the clean architectural break). Later releases are short, incremental polish-and-fix passes.

---

## v0.4.0 — "Netwerk" (2026-07-25)

The Netwerk release: privacy/visibility, membership, notifications, transactional email, and release safety. Shipped to prod 2026-07-25 — the project's first major prod schema migration.

- **Two-field visibility** — profile (Public / Private) and content (Listed / Unlisted / Private) visibility; centralized enforcement, cascade-sync, identity-scoped messaging.
- **Membership & access requests** — page members (add / remove / role-change, self-leave); Request-to-Follow / Request-to-Join approval flow; private-profile locked preview; self-service Join behind a beta flag.
- **Comments** — comment on posts and events; compose / edit / delete; comment as a page.
- **Notifications** — in-app activity bell (Activity-Streams dispatcher, per-recipient fan-out) and a coalescing email digest; per-context preferences; one-click unsubscribe.
- **Transactional email** — email verification + password reset via a swappable Resend sender; verification enforced at login.
- **Post photos & captions** — carousel photo add/edit for posts on a shared upload/modal helper.
- **Schema-invariant hardening** — DB CHECK constraints; guarded post creation; closed an ownership-reassignment hole.
- **CI, uptime & release safety** — `validate` PR gate; `/api/health` + scheduled prod ping; `migrate deploy` on build; `proxy.ts` maintenance-mode gate for destructive cutovers.
- **Bug-fix & inline-edit rounds** — shared profile-update executor (silent data-loss fix); `session.dirtyFields`-driven inline fields; BUGS epic (connections refresh, deep-links, stale-session).
- **Tooling** — `/prolib-qa`, `/prolib-review`, `/prolib-pm` skills; Playwright E2E efficacy pass.

---

## v0.3.2 — Bug fixes (2026-05-09)

- **Production sync** — applied the final pending migration to prod Supabase, reseeded, uploaded missing images.
- **Fixes** — stale `/profile` route references in E2E tests; page-owned events no longer leaking onto the creator's personal profile.

## v0.3.1 — "Beta ready as I'll ever be" (2026-05-09)

The beta-prep polish push.

- **Map view polish** — controls bar, radius filtering, viewport-aware counts, iOS Safari sizing fix; shared Leaflet/location-search components.
- **Beta UX layer** — global profile search page, welcome banner, landing headers, early-beta messaging.
- **Settings/profile rework** — `/profile` consolidated into `/settings`; expanded personal-info form; edit/preview reversal.
- **Event timezone support** — human-readable seed format and timezone-aware display.
- **M4 polish** — custom 404, `/about` and `/guidelines` pages, footer/banner cleanup; shared delete-confirm, publish hints, image auto-compression.

## v0.3.0 — Seed rewrite & many minor fixes (2026-05-07)

- **Seed system rewritten** — self-contained per-user / per-page JSON packets; tests auto-seed a fresh DB.
- **Profile UX overhaul** — consolidated user/page edit into one `ProfileEditClient`; WYSIWYG inline elements (links + text).
- **Microsite & profile polish** — About Page entry point, settings avatar, photo captions, RSVP autofill, profile search dropdown.
- **Performance** — N+1 query sweep across page events/posts routes; dead code removal.
- **Bug fixes** — page posts no longer defaulting to draft; explore sorting so events stop dominating the feed.

## v0.2.0 — First official version (2026-05-05)

The cumulative baseline. The app was rebuilt onto the unified **Page** model (schema v0.4) and most of its core features landed before this tag, mid-way through the Spats launch.

- **Schema v0.4** — eliminated Owner/Org/Project; unified everything onto a single **Page** concept with a role-based **Permission** table (ADMIN/EDITOR/MEMBER).
- **Profile switching** — act as yourself or as any Page you manage, via `ActiveProfileContext`, with server-enforced permissions.
- **Conversation-based messaging** — polymorphic participants (User or Page), shared Page inboxes, unread notifications, inline tabbed message view.
- **Authoring & inline editing** — batched `InlineEditSession` save model, draft/published post lifecycle, inline-editable profiles, posts, and events.
- **URL flattening** — unified `/[handle]` routes backed by a single `Handle` table; old `/u/`, `/p/`, `/o/` trees removed.
- **Invite-gated signup** — single-use email invites, with a dev bypass for local/test.
- **Explore & collections** — filtering, sorting, grid/list/map views (Leaflet), pinned posts, profile pictures, image captions.
- **Foundations** — Playwright E2E suite, basic observability/logging, Vercel analytics.

## v0.1.0 — Early scaffolding (pre-release)

Initial build on the original Owner/Org/Project schema (the v0.3 data model). Pre-tag; "just hacking away."

- **Owner/Org/Project data model** — v0.3 schema initialized and deployed to production Supabase.
- **Profile & settings** — user and org profile settings pages, inline profile editing, org switching with session-owner permission checks.
- **Filtering UI** — reusable view-toggle (grid/list/map) components.
