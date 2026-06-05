# Visibility Model — Product Design Considerations

## Purpose

This document captures the product and architectural considerations for the three-tier visibility model being introduced in the Open Beta (Netwerk milestone, P0). It informs — but does not replace — the technical design document.

The technical design will specify schema, query helpers, middleware, and migrations. This document specifies what the technical design must account for and why. Read before writing the technical design.

## The Model

A `visibility` enum is added to User profiles, Pages, Posts, and Events:

| Tier | Behavior |
|------|----------|
| **Public** | Shows in public Collections. Anyone, signed in or not, can see it. |
| **Unlisted** | Not in Collections. Accessible to anyone with a direct link. |
| **Private** | Restricted by relationship: followers (profiles), members (Pages), invitees (events). |

The same enum applies across all three entity types. Implementation should preserve this uniformity — one type, one set of values, one query helper — rather than three parallel systems.

Per-post visibility override (a specific post being more or less restrictive than its parent's tier) is deferred to 1.0. In Open Beta, posts ride on their parent entity's visibility.

## Why Visibility Is High-Stakes

Visibility bugs are a class of bug that doesn't behave like other bugs. Most bugs are visible — something looks wrong, breaks, or returns the wrong answer, and gets caught in testing or reported by users. Visibility bugs are silent leaks: the system appears to work, but content reaches eyes it shouldn't. The user whose content leaked usually doesn't know. The user who saw it doesn't realize they weren't supposed to. The bug is found when something embarrassing or harmful happens, not before.

For Project Library specifically, the stakes are higher than average. The user base includes grassroots organizers, mutual aid networks, and people doing community work in contexts where exposure of membership, attendance, or content can be a safety issue rather than a privacy preference. The blast radius of a visibility bug here is meaningful, and the technical design should reflect that.

### Risk categories

**The query-coverage problem.** Every query that returns Profiles, Pages, Events, or anything containing them must enforce visibility rules. Not just the obvious surfaces (feeds, search, Collections), but also: link unfurls and OG cards, notification bodies, mentions, email content, sitemaps and SEO crawlers, API responses, autocomplete suggestions, and error messages. Each is a separate enforcement point. Any one of them missed is a leak.

**The relationship-time problem.** Visibility is a function of (content, viewer, viewer's relationship, *time*). Relationships change. A Page goes from Public to Private. A member is removed. Content composed when visibility was X is read when visibility is Y. Notifications and emails are the worst offenders here — composed at one moment, read at another. The design must specify behavior for visibility-state changes that occur after content has been queued, cached, or sent.

**The existence-leak problem.** Even when content is correctly hidden, the *fact that it exists* can leak through side channels. Common leak surfaces include: 403 vs 404 distinctions (one admits existence, the other denies it), "username taken" on signup, comment counts on hidden posts, member counts on Private Pages, search autocomplete suggesting titles of unviewable content. Some of these leaks are intentional — Unlisted is *meant* to be findable by direct link. The design must enumerate which existence leaks are intentional and which are not, rather than letting that be decided by accident at each surface.

**The retrofit cost.** Features built before visibility ships will need to be revisited and audited. Features built after inherit visibility for free if the architecture is right. This is the practical reason visibility is P0: every week of delay multiplies the audit surface area for everything else.

## Design Principles

The following principles reduce the risk surface meaningfully. They should be baked into the technical design, not treated as code-review checklist items.

**Filter at the data layer, not the UI layer.** The default query helper or ORM layer should be viewer-aware. If a developer has to remember to apply a filter in each route handler, the filter will eventually be forgotten. Make the safe path the default path; make exposing content require explicit override rather than the reverse.

**Default to most-restrictive.** New models, new queries, and new features should default to maximum restriction. The question to ask when designing a new feature is "what is the minimum visibility this needs" rather than "what is the most we can show."

**Test with fixtures that have multiple visibility levels.** Tests must query as anonymous users, non-followers, non-members, and blocked users — not only as content owners or admins. A test that passes because the test user is privileged proves nothing about visibility behavior.

**Pick a 404-vs-403 policy and apply it consistently.** Private content returning 404 avoids the existence leak but degrades the "I have a link, why can't I see it" UX. Returning 403 admits existence. Most products mix the two, and that mix is the leak. Pick once, document the rationale, enforce across the codebase.

**Notifications render through the recipient's eyes.** When notifications are designed (Email + Notification Infrastructure ticket), they must render at the recipient's read-time, not the sender's write-time. A notification body should not embed quoted content; it should embed references that resolve to content visible to the recipient at render. If the recipient has lost access in the interim, the notification gracefully degrades ("a post you can no longer see") rather than leaking.

## Specific Design Decisions Required

The technical design must explicitly answer:

1. **Existence-leak policy.** For each tier and surface, which leaks are intentional? Spell out the 404/403 policy for Private entities. Spell out whether search autocomplete suggests Unlisted entities. Spell out whether OG cards render for Unlisted links.

2. **State-change behavior.** When a Page is flipped from Public to Private, what happens to existing followers (kept, or required to re-request)? Indexed search results (stale until reindex, or invalidated immediately)? Notifications already in send queues (sent, dropped, or rewritten)? Email digests already composed?

3. **Default visibility on creation.** What does a newly-created Profile, Page, and Event default to? Public is the conventional answer; whichever choice is made should be justified.

4. **Query enforcement architecture.** Middleware vs query helper vs ORM scope vs view-layer filter — the technical design must pick a primary mechanism and articulate why. The choice has implications for every future feature.

5. **Test fixture strategy.** Define the standard set of test users and relationships that visibility-touching tests must include, and how that fixture set is enforced across the test suite.

## Open Questions

Carried forward from the visibility ticket, to be resolved in the technical design:

- Does Unlisted suppress from search results, or only from Collections?
- When a Page is flipped Public → Private, do existing followers stay or re-request?
- Default visibility on creation for Profiles, Pages, and Events? Default to Private
- Are existence leaks at the 404/403 layer treated differently for Unlisted vs Private?
- Is anonymous (unauthenticated) viewing supported for Unlisted content, or does Unlisted require an account to view? Unauthed users can view unlisted content
- Second look at already existing Post and Event etc, to make sure visibility is taken into account and existing posts get assigned reasonable visibility (mostly test data)

## Out of Scope (Open Beta)

Explicitly deferred to 1.0 and not to influence the Open Beta technical design except to leave architectural room:

- Per-post visibility override (a specific post being more or less restrictive than its parent's tier)
- Per-comment visibility
- Time-bound visibility (e.g. "Public for 7 days then Private")
- Group-level visibility tiers beyond the existing Public / Unlisted / Private set