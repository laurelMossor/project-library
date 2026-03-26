# Events — Product Outline

**Product:** Project Library  
**Feature:** Events  
**Last updated:** March 2026  
**Status:** Discovery

---

## Problem

Community organizers rely on a patchwork of tools to run events — one for the invite page, another for RSVPs, another for updates, another for volunteer coordination. Each tool owns a piece of the picture but none of them live where the organizer already does their work. The result is fragmented data, duplicated effort, and lost context.

Partiful solved the *social invite* well for casual personal events, but it wasn't designed for organizers who run recurring programming, coordinate volunteers, or need to communicate logistics to attendees after the RSVP. There's a gap between "party invite" and "full event platform" that community organizers fall into.

## Opportunity

Events is a natural extension of the Project Library. Organizers are already using the platform to document and share their work. Events gives them a reason to bring people *into* that work — turning the Project Library from a publishing tool into a coordination tool.

## Target user

Grassroots community organizers running small-to-medium events (5–200 attendees): neighborhood cleanups, mutual aid distributions, workshops, town halls, cultural events, recurring meetings. They are typically:

- Working without institutional support or dedicated event staff
- Mobile-first (planning and managing from their phone, often on-site)
- Coordinating a mix of committed volunteers and casual attendees
- Sensitive to tools that feel corporate, extractive, or overly complex

## Design principles

1. **60-second event creation.** The minimum viable event is a title, a time, and a place. Everything else is optional. An organizer should be able to go from "I need to put this out there" to "here's the link" in under a minute.

2. **No walls for attendees.** Viewing an event page and RSVPing should never require account creation. The organizer has an account; the attendee has an invitation.

3. **Communication lives with the event.** Updates, reminders, and logistics messages are tied to the event they belong to — not scattered across email threads and group chats.

4. **Progressive complexity.** A one-off movie night and a 6-person volunteer shift at a food bank are both "events." The interface serves both by revealing coordination features only when the organizer opts into them.

5. **Mobile-first, offline-tolerant.** Key information (attendee list, event details, schedule) should be accessible in low-connectivity environments.

---

## Feature overview

### Event creation & page

The atomic unit. An organizer creates an event; the system generates a shareable public page.

**Required fields:**
- Title
- Date and time (with timezone)
- Location (freeform text, optional map pin)

**Optional fields:**
- Cover image or color/pattern
- Description (rich text, short-form)
- Category or tags
- Co-hosts (other organizers who can edit and manage)
- Visibility: public (discoverable) or unlisted (link-only)

**The event page itself:**
- Mobile-first, fast-loading, no-login shareable link
- Designed to feel like a poster — visual, scannable, warm
- Prominent RSVP action
- Location with tap-to-navigate (opens native maps)
- "Add to calendar" (.ics download)

### RSVP

The conversion moment. This must be as frictionless as possible.

**Attendee-facing:**
- Response options: Going / Maybe / Can't make it
- Required: name
- Optional (organizer-configured): email, phone, +1 count, a single custom question (e.g., "Any dietary restrictions?" or "How did you hear about this?")
- No account creation required — ever

**Organizer-facing:**
- RSVP count summary (going / maybe / can't make it)
- Attendee list with contact info and any custom question responses
- Export to CSV
- Ability to manually add attendees (for people who RSVP'd in person or via text)

### Attendee communication

One-directional, event-scoped messaging from organizer to attendees.

- Send an update to all RSVPs, or filter by response type (e.g., only "Going")
- Delivery channel matches what the attendee provided (email or SMS)
- Use cases: parking updates, time changes, cancellations, day-of reminders, post-event thank-you
- Updates also appear on the event page as a timeline/feed so latecomers can catch up
- Automatic reminder option: organizer can toggle a reminder sent 24 hours before the event

### Roles & volunteer coordination

Optional layer — hidden until the organizer enables it for a given event.

- Organizer defines named roles (e.g., "Setup crew," "Registration table," "Speaker")
- Each role has: name, description, time slot (optional), capacity (number of slots)
- Organizer can also assign people directly
- Dashboard view: which roles are filled, which still need people

### Event notes

Lightweight private note section, attached to the event record.

- Private to the organizer (and co-hosts)
- Freeform text: Notes about what worked, To Dos
- Attendance reality check: actual turnout vs. RSVP count (manual entry, single number)
- Optional: attach a few photos

---

## Information architecture

```
Project Library
└── [User profile or Page]
    └── Events
        ├── Upcoming
        │   └── Event page
        │       ├── Details
        │       ├── RSVP
        │       ├── Updates (timeline)
        ├── Past
        │   └── Event page (read-only, with post-event notes)
```

Events are authored by an organizer and live within their profile or organization page. They are *not* nested under posts — they are a peer content type. However, an organizer can reference or embed an event in a post (e.g., a recap post that links to the event record).

## Event creation flow — detailed spec

### Core design philosophy

The event page *is* the creation surface. There is no separate form that produces an event page as output. The organizer builds the event by editing the page directly — typing the title where the title will appear, picking a time that slots into place where attendees will see it. The creation flow and the finished artifact are the same thing. This eliminates the cognitive gap between "what am I filling in" and "what will people see."

After creation, editing works the same way. Tap the title, change it. Tap the time, adjust it. There is no "edit event" button that routes to a different form view. The event page is always the source of truth, always directly manipulable by its organizer.

### The creation entry point

The organizer taps "New event." Instead of routing to a form page, they land on a *live event page in draft state*. It already looks like a real event — it has a generated cover (color, gradient, or pattern — something that looks intentional, not like an empty placeholder), placeholder text in the correct typography, and a visual layout identical to what attendees will see.

A subtle banner or badge indicates draft status: "Draft — only you can see this."

### What the organizer sees on first load

The page is pre-populated with sensible defaults and guiding placeholder text:

- **Cover area:** A generated color/gradient fill. Tappable to upload a photo, choose from curated illustrations/patterns, or pick a different color. The default should already look good enough that an organizer could publish without changing it.
- **Title:** Large, prominent placeholder text — *"Event name"* — rendered in the final display typography. Tapping it opens inline editing. This is the only field that must be filled before publishing.
- **Date & time:** Defaults to the upcoming Saturday at a reasonable time (e.g., next Saturday, 2:00 PM, in the organizer's local timezone). Displayed as it will appear to attendees. Tapping opens a date/time picker. The default means the organizer only adjusts rather than starting from zero.
- **Location:** Placeholder text — *"Add a location"* — tappable. Accepts freeform text. Optional map pin via search/autocomplete, but plain text is fine ("Maria's backyard," "the park on 5th and Oak"). Not required — some events legitimately don't have a confirmed location yet.
- **Description:** Placeholder — *"What should people know?"* — rendered in the body text style of the final page. Tappable to edit inline. Rich text (bold, italic, links) but no complex formatting. Not required.

### Progressive disclosure of optional features

Below the core fields, additional options are available but collapsed or visually de-emphasized. They do not clutter the initial creation surface. The organizer can expand them if relevant:

- **Co-hosts** — add other organizers who can edit and manage
- **RSVP settings** — configure what info to collect (name, email, phone, custom question, +1 count), toggle whether RSVP is enabled at all
- **Visibility** — public (discoverable) vs. unlisted (link-only) (V3)

These options should feel like *enrichments* the organizer can add, not *steps* they must consider. The default configuration (RSVP on, collect name + email, unlisted) should be correct for 80% of events.

### The publish moment

A persistent "Publish" button is visible throughout the creation flow. It becomes active once the minimum publishable event exists: a title and a date/time. Location and description are encouraged (gentle visual indicators like incomplete dots or a "your event is stronger with a description" nudge) but not gating.

When the organizer taps Publish:

1. A brief confirmation appears — not a modal interrupting the flow, but a state change on the page itself. The draft banner transitions to a "Live" state.
2. The **shareable link is front and center**, with a prominent "Copy link" button as the primary action. The organizer's immediate next move is almost always sharing the link somewhere (a group chat, social media, a text thread), so that action should be one tap away.
3. Secondary actions: "Share to..." (native share sheet on mobile), "View as attendee" (preview the public-facing version).

This moment should feel like a small celebration — not a form submission. The organizer just made something real.

### Inline editing after publish

Once live, the organizer can return to the event page at any time and edit it directly. Tapping any content area (title, time, location, description, cover) enters an inline editing state for that element. Changes save automatically or with a subtle "Save" confirmation. No separate edit mode, no form page, no route change.

The attendee-facing page and the organizer's editing surface are the same page with different permissions. The organizer sees edit affordances (tap targets, hover states, an "edit" icon on each section); attendees see the finished result.

### Mobile-first considerations

- The creation surface must work well on a phone screen. All tap targets are generously sized. The date/time picker is a native or well-designed mobile component, not a desktop-style calendar widget.
- Cover image upload should support taking a photo directly from the camera, not just selecting from the library.
- The flow should work on spotty connectivity. If the organizer starts creating an event and loses signal, their work should be preserved locally and synced when connectivity returns.

### Visual and tonal direction

The event page should feel like a **poster or invitation**, not a form or a database record. Warm, expressive, slightly playful. Typography should be confident and readable. The cover area should be generous — it sets the emotional tone. The overall impression should be "someone made this for you," not "someone filled out a form."

Avoid: grey form inputs, visible field labels above each element, "required" asterisks, corporate UI patterns. Aim for the feeling of composing an invitation by hand — intentional, personal, crafted.

---

## Key screens

1. **Event page (draft / creation)** — the creation surface described above. A live preview of the event page in draft state, with inline editing on all fields, a generated default cover, and a persistent Publish button. Indistinguishable from the published event page except for a draft indicator and the publish action.

2. **Event page (published / public)** — the shareable link. Visually identical to the draft version, minus editing affordances. Mobile-optimized. Info → RSVP → Updates (V2) → Roles (V2).

3. **Event page (published / organizer view)** — the same page, but with inline edit affordances visible and an organizer toolbar or panel for management actions: view RSVPs, send update, copy link, duplicate, delete.

4. **Events list** — organizer's view of all their upcoming and past events. Card-based, sorted by date. Quick actions: duplicate, edit, share link.

5. **RSVP confirmation (attendee)** — not a full screen, just a clear confirmation state on the event page. "You're going. We'll send a reminder 24 hours before." With an option to change response or add to calendar.

## Scoping & sequencing

**P0 — Core loop:**
- Event creation (required fields + description + cover image)
- Public event page with shareable link
- RSVP (going/maybe/can't, name + email)
- Attendee list

**P1 — Communication & coordination:**
- Attendee messaging (email)
- Add to calendar (.ics)
- Automatic 24-hour reminder
- Co-hosts (Someone granted 'Editor' role on the event resource)

**P3 — Depth:**
- SMS delivery channel
- Event notes and photos
- Custom RSVP question
- Public/unlisted visibility toggle

## Notes
Discovery: Events appear on the explore page if they are public
Identity: For the closed beta of Project Library, I will not be considering privacy related features like tracking attendance
Notifications: Implicit in your RSVP is that in order to recieve information or updates to the event, they'll need to leave an phone number or email, or create an account/login. There is no opt-out at this stage. 
Customization: Users should be able to use a small preset of cover images or upload their own. More options can be included later. 
