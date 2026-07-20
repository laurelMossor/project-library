# Release Notes

High-level summary of releases for The Project Library. Bullets are intentionally coarse — see `docs/guidance/JOURNAL.md` for the per-session detail and the git history for specifics.

> Most recent work is at the top. Dates and contents are correlated from git tags and the journal. `v0.2.0`+ map to real git tags; `v0.1.0` is a retroactive label for the early pre-tag scaffolding (split out at the schema-v0.4 rewrite, the clean architectural break). Later releases are short, incremental polish-and-fix passes.

---

## [Unreleased] — v0.4.0 "Netwerk" (in progress)

The Netwerk release: privacy/visibility, membership, transactional email, and release safety. Work landing on `develop`; not yet tagged.

- **Two-field visibility model** — split into `profileVisibility` (Public / Private — the profile page) and `contentVisibility` (Listed / Unlisted / Private — where posts and events surface), replacing the earlier single `Visibility` enum. Centralized in `visibility.ts` with cascade-sync so children re-derive when a parent flips, and a guard that a Private profile can't hold Listed content.
- **Visibility enforcement hardening** — closed a leak class where JSON API detail/relationship routes didn't gate private/unlisted content the way SSR pages did; draft/view gating centralized into `requireViewable*` helpers (re-parenting re-derives, co-managers see drafts, unviewable content 404s); messaging scoped to the active identity so a page admin's personal inbox can't leak page threads.
- **Membership & access requests** — activated the MEMBER role: pages have members who can be added / removed / role-changed, with a shared last-admin guard and self-leave for any role. Request-to-Follow / Request-to-Join approval flow on a new `AccessRequest` model (approval is ADMIN-only); Private profiles show a locked preview to logged-in viewers instead of a 404.
- **Transactional email** — email verification + password reset via a swappable Resend sender with React Email templates; account verification enforced at login; no-enumeration, constant-time auth responses.
- **Schema-invariant hardening** — added the DB CHECK constraints that several "invariant" comments had only assumed; converged post creation onto one guarded `createPost`; closed a hole where a profile-element update could reassign ownership.
- **CI, uptime & release safety** — GitHub Actions `validate` gate (lint, typecheck, unit, E2E, build) on every PR with branch protection, so a red branch is now un-mergeable; `GET /api/health` exercises real Post/Event/User read paths (catches schema drift, not just dead connections) with a scheduled prod ping; the build runs `prisma migrate deploy` before serving. Hardened expand/contract deployment runbook.
- **Bug-fix & inline-edit rounds** — converged profile-update routes onto one shared executor (fixed silent data-loss on avatar/cover/visibility saves); made `session.dirtyFields` the single source of truth for inline fields.
- **Tooling** — `/prolib-qa` and `/prolib-review` skills; Playwright E2E suite efficacy pass (faster, fewer flaky tests).

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
