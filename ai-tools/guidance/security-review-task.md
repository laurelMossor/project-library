# Cursor Agent — Security Review Directions (MVP)

## Purpose

Perform a **security-minded codebase review** appropriate for an MVP built with:
- Next.js (App Router)
- React
- Prisma
- Supabase
- Vercel

The goal is **not perfection**, but to verify that the codebase demonstrates:
- Clear trust boundaries
- Consistent authorization
- Sensible defaults
- Awareness of common security failure modes

When issues are found:
- Prefer **low-complexity, high-impact fixes**
- Call out **intentional gaps** vs **accidental vulnerabilities**
- Avoid over-engineering recommendations

---

## Review Order (Follow This Sequence)

1. Authentication & authorization
2. Server mutations (API routes / server actions)
3. Database access & Prisma usage
4. Input validation & mass assignment
5. Supabase configuration (Auth, RLS, Storage)
6. File uploads
7. Data exposure & serialization
8. XSS & content rendering
9. Secrets & environment variables
10. Rate limiting & abuse controls
11. Logging & error handling
12. Dependencies & supply chain

---

## 1. Authentication & Authorization

### Verify:
- User identity is **derived server-side**, never trusted from client input
- No mutation accepts `userId`, `ownerId`, or `orgId` from the client without verification
- Authorization logic exists beyond “user is logged in”

### Look for:
- Centralized helpers such as:
  - `requireUser()`
  - `requireOrgRole()`
  - `canEditProject(user, project)`
- Consistent use of these helpers before **every** write operation

### Flag as issues:
- Auth checks duplicated inconsistently
- Mutations guarded only by `if (!session)` without ownership checks

---

## 2. Server Actions & API Routes

### Verify:
- All mutations:
  - Require authentication
  - Perform authorization checks
  - Validate input before DB writes
- Public endpoints are **intentionally public**

### Look for:
- Server Actions exported into client components
- Route handlers that mutate state without guards

### Flag as issues:
- “Hidden” mutations that are callable without auth
- Overly permissive GET endpoints returning sensitive data

---

## 3. Prisma & Database Access

### Verify:
- No raw client input is passed directly into Prisma calls
- `select` is preferred over returning full models
- Update operations use explicit field allowlists

### Look for:
- Centralized `select` objects (e.g. `publicUserSelect`)
- Explicit `where` clauses enforcing ownership

### Flag as issues:
- Mass assignment via `data: req.body`
- Returning internal or sensitive fields by default

---

## 4. Input Validation & Trust Boundaries

### Verify:
- All external input is validated using Zod (or equivalent)
- Validation occurs **before** database writes
- `.strict()` schemas are used where appropriate

### Look for:
- `safeParse` usage
- Schemas colocated with routes or actions

### Flag as issues:
- Missing validation on update routes
- Reusing client-side schemas without server enforcement

---

## 5. Supabase (Auth, RLS, Storage)

### Verify:
- Row Level Security (RLS) is enabled for user/org-owned tables
- Policies reflect ownership or membership, not blanket access
- Supabase service role key is never exposed to the client

### Look for:
- Clear separation between app-layer authz and DB-layer RLS
- Intentional documentation of RLS usage

### Flag as issues:
- Tables with RLS disabled unintentionally
- Policies using `using (true)` or equivalent

---

## 6. File Uploads & Storage

### Verify:
- File size limits are enforced
- MIME types are allowlisted (e.g. jpeg/png/webp)
- Upload paths are scoped by user or org
- Buckets are not publicly writable

### Look for:
- Rejection of SVG and executable formats
- Metadata stored in DB, files stored in object storage

### Flag as issues:
- Open upload endpoints
- Public write access to storage buckets

---

## 7. Data Exposure & Serialization

### Verify:
- APIs return only fields needed by the client
- Internal IDs, roles, and emails are not leaked unnecessarily

### Look for:
- DTOs or select objects
- Explicit serialization boundaries

### Flag as issues:
- Returning full User / Org models to the client
- Leaking admin or role information unintentionally

---

## 8. XSS & Content Rendering

### Verify:
- User-generated content is treated as plain text OR sanitized
- `dangerouslySetInnerHTML` is avoided or justified

### Look for:
- Markdown rendering pipelines
- Sanitization libraries where HTML is allowed

### Flag as issues:
- Rendering raw HTML from user input
- Unsanitized markdown rendering

---

## 9. Secrets & Environment Variables

### Verify:
- Secrets are never prefixed with `NEXT_PUBLIC_`
- Env vars are validated at runtime (e.g. Zod `env.ts`)
- No secrets are logged or returned in errors

### Look for:
- Clear separation of server vs client env vars
- Distinct dev/staging/prod configuration

### Flag as issues:
- Hardcoded secrets
- Logging env values

---

## 10. Rate Limiting & Abuse Controls

### Verify:
- Public or expensive endpoints have basic rate limiting
- Upload, auth, and search routes are protected

### Look for:
- IP-based or user-based throttling
- Pagination limits

### Flag as issues:
- Unbounded queries
- No protection on signup or upload flows

---

## 11. Logging & Error Handling

### Verify:
- Errors returned to clients are sanitized
- Stack traces are not exposed in production
- Logs avoid PII and credentials

### Look for:
- Centralized error handling
- Structured logging

### Flag as issues:
- Returning raw Prisma or stack errors to the client

---

## 12. Dependencies & Supply Chain

### Verify:
- Lockfile is present and committed
- Known vulnerabilities are addressed
- Dependency updates are tracked

### Look for:
- Dependabot or equivalent tooling
- Minimal dependency surface area

### Flag as issues:
- Abandoned or high-risk packages
- Ignored audit warnings

---

## Output Expectations

For each finding:
- Classify as one of:
  - 🔴 Vulnerability
  - 🟡 Risk / MVP tradeoff
  - 🟢 Good practice already in place
- Provide:
  - Short explanation
  - Recommended fix (MVP-appropriate)
  - Whether it should block launch or not

Avoid:
- Enterprise-only recommendations
- “Rewrite the auth system” suggestions
- Overly theoretical security commentary

Focus on **practical, incremental improvement**.
