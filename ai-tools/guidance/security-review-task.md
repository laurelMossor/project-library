# Cursor Agent — SECURITY FIX PASS (MVP)

## Mode

You are in **fix-first mode**, not documentation mode.

Your job is to:
- **Inspect the code**
- **Modify the code**
- **Add missing guards**
- **Tighten unsafe defaults**

❌ Do NOT write new markdown files  
❌ Do NOT create long explanations  
❌ Do NOT propose hypothetical systems  

✅ Make small, concrete code changes  
✅ Prefer edits over refactors  
✅ Leave TODO comments only when unavoidable  

---

## Hard Constraints

- Assume this is an **MVP** — fixes must be lightweight
- Do not introduce new infrastructure unless absolutely required
- Do not redesign auth or data models
- Do not add abstractions unless they reduce repeated unsafe patterns

If a fix would take more than ~10–15 minutes of engineering time, **leave a TODO and move on**.

---

## STEP 1 — Lock Down All Mutations (DO THIS FIRST)

### Action
1. Find **every database write**:
   - `prisma.*create`
   - `prisma.*update`
   - `prisma.*upsert`
   - `prisma.*delete`

2. For each write:
   - Ensure a server-side auth check exists
   - Ensure ownership / role is enforced
   - Ensure input is validated

### Required Fixes
- If a mutation accepts `userId`, `ownerId`, or `orgId` from the client:
  - ❌ REMOVE it
  - ✅ Derive identity from auth context
- If a mutation lacks authorization:
  - Add a guard inline (do not invent a new system)

### Stop Condition
- No database write can be reached by an unauthenticated or unauthorized user

---

## STEP 2 — Enforce Input Validation at Write Boundaries

### Action
1. For each mutation:
   - Locate the input source (form, action, route handler)
   - Add or enforce Zod validation **before** DB access

### Required Fixes
- Replace `prisma.model.create({ data: req.body })`
- Use explicit allowlists:
  ```ts
  const data = schema.parse(input)
Use .strict() where appropriate

Stop Condition
No raw request body is written to the database

STEP 3 — Remove Mass Assignment & Over-Fetching
Action
Replace broad Prisma writes and reads:

data: input

include: { ... }

Introduce explicit select objects where needed

Required Fixes
Update operations must explicitly list writable fields

Public responses must not return internal or sensitive fields

Stop Condition
No endpoint returns full User / Org / Membership objects by default

STEP 4 — Lock Down Server Actions & API Routes
Action
Find all:

Route handlers

Server Actions

RPC-like functions callable from client code

For each mutation:

Add requireUser() or equivalent

Add ownership checks

Required Fixes
Mutations must fail fast if user is not authenticated

Public routes must be intentionally public

Stop Condition
No mutation can be called anonymously

STEP 5 — Tighten Supabase Usage (If Present)
Action
Inspect Supabase Auth usage

Inspect RLS policies and storage buckets

Required Fixes
Ensure RLS is enabled on user-owned tables

Ensure storage buckets are not publicly writable

Ensure service role keys are never used client-side

If Fix Is Non-Trivial
Add a TODO comment at the call site

Do NOT write documentation

STEP 6 — Harden File Uploads (If Any)
Action
Locate upload endpoints or actions

Enforce constraints

Required Fixes
Add file size limits

Add MIME allowlist:

jpeg

png

webp

Reject SVG and unknown types

Scope file paths by user or org

Stop Condition
Uploads cannot accept arbitrary files or sizes

STEP 7 — Prevent XSS by Default
Action
Search for:

dangerouslySetInnerHTML

Markdown renderers

Required Fixes
Remove or gate unsafe rendering

Treat user content as plain text unless sanitized

Stop Condition
No raw HTML from user input is rendered

STEP 8 — Sanitize Errors & Logs
Action
Find error responses returned to the client

Find logging statements

Required Fixes
Do not return stack traces or Prisma errors to the client

Avoid logging tokens, cookies, or request bodies

Stop Condition
Client-facing errors are generic and safe

STEP 9 — Environment & Secrets Check
Action
Scan env usage

Required Fixes
Remove any secrets prefixed with NEXT_PUBLIC_

Ensure server-only env vars are never exposed

Stop Condition
No secrets are reachable from client bundles

STEP 10 — Add Minimal Abuse Protection (Optional but Preferred)
Action
Identify:

Auth routes

Upload routes

Search endpoints

Required Fixes (If Easy)
Add basic rate limiting

Add pagination limits

If Not Easy
Leave a TODO and move on

Output Rules
Make direct code edits

Leave inline TODO comments only when blocked

Do not summarize the entire review

Do not generate new documents

Do not explain security theory

Your success condition is measurable:

A casual attacker cannot mutate or exfiltrate data by calling endpoints directly.

Proceed immediately.