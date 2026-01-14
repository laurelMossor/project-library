# Security Review Plan — High-Level Priorities

## Overview

This plan outlines a systematic security review of the Project Library MVP, prioritizing high-impact vulnerabilities and following the review order specified in `security-review-task.md`. The focus is on **practical, MVP-appropriate fixes** that establish clear trust boundaries and prevent common security failure modes.

---

## Review Priority Tiers

### 🔴 **Tier 1: Critical (Block Launch)**
These issues must be addressed before production launch:
1. **Authentication & Authorization** — Trust boundaries and ownership checks
2. **Server Mutations** — All write operations properly guarded
3. **Input Validation** — Mass assignment and injection prevention
4. **Secrets & Environment Variables** — No exposed credentials

### 🟡 **Tier 2: High Priority (Address Soon)**
Important for production readiness but not blocking:
5. **Database Access & Prisma** — Field selection and ownership enforcement
6. **Supabase Configuration** — RLS policies and service role security
7. **File Uploads** — Size limits, MIME validation, path scoping
8. **Data Exposure** — Sensitive field leakage prevention

### 🟢 **Tier 3: Medium Priority (Post-Launch)**
Good practices to implement incrementally:
9. **XSS & Content Rendering** — User-generated content sanitization
10. **Rate Limiting** — Abuse prevention on public endpoints
11. **Logging & Error Handling** — Sanitized error responses
12. **Dependencies** — Supply chain security

---

## Detailed Review Plan

### **Phase 1: Authentication & Authorization** 🔴

**Goal:** Verify that user identity is derived server-side and authorization checks are consistent.

**Review Tasks:**
1. ✅ **Verify session handling**
   - Check all API routes use `await auth()` from `@/lib/auth`
   - Ensure no routes trust `userId` from request body
   - Verify session is checked before any mutations

2. ✅ **Audit authorization helpers**
   - Review `getActiveActor()`, `canActAsOrg()`, `getSessionUser()` in `src/lib/utils/server/actor-session.ts`
   - Check for centralized ownership verification functions:
     - `actorOwnsProject()` 
     - `actorOwnsEvent()`
     - `actorOwnsPost()`
   - Verify these are used consistently before mutations

3. ✅ **Check mutation endpoints**
   - Review all `PUT`, `POST`, `DELETE` routes in `src/app/api/`
   - Verify each mutation:
     - Checks authentication (`if (!session?.user?.id)`)
     - Performs ownership/authorization check
     - Never accepts `userId`, `ownerId`, or `actorId` from client

4. ✅ **Org role verification**
   - Verify `canActAsOrg()` is used when switching active org
   - Check org mutations verify user has appropriate role (OWNER/ADMIN)
   - Ensure FOLLOWER role cannot perform mutations

**Files to Review:**
- `src/lib/auth.ts` — NextAuth configuration
- `src/lib/utils/server/actor-session.ts` — Authorization helpers
- `src/lib/utils/server/actor.ts` — Ownership checks
- All files in `src/app/api/**/route.ts` — Mutation endpoints

**Expected Findings:**
- ✅ Good: Authorization checks appear to use `actorOwnsProject()` pattern
- ⚠️ Check: Verify all mutations follow this pattern consistently
- ⚠️ Check: Ensure org role checks are present for org mutations

---

### **Phase 2: Server Mutations (API Routes & Server Actions)** 🔴

**Goal:** Ensure all mutations require auth, perform authorization, and validate input.

**Review Tasks:**
1. ✅ **Audit all mutation endpoints**
   - List all `POST`, `PUT`, `PATCH`, `DELETE` routes
   - Verify each has authentication check
   - Verify each has authorization check
   - Verify each validates input before DB writes

2. ✅ **Check for "hidden" mutations**
   - Search for server actions exported to client components
   - Verify no mutations are callable without auth
   - Check for overly permissive GET endpoints that mutate state

3. ✅ **Review public endpoints**
   - Identify intentionally public endpoints (e.g., signup)
   - Verify they don't leak sensitive data
   - Ensure they have appropriate rate limiting (Phase 10)

**Files to Review:**
- `src/app/api/**/route.ts` — All API route handlers
- `src/app/**/actions.ts` or `**/*.server.ts` — Server actions (if any)
- `src/app/api/auth/signup/route.ts` — Public mutation endpoint

**Key Endpoints to Audit:**
- `/api/projects` — Create/update/delete projects
- `/api/projects/[id]` — Update/delete specific project
- `/api/projects/[id]/posts` — Create posts on projects
- `/api/events` — Create/update/delete events
- `/api/events/[id]` — Update/delete specific event
- `/api/events/[id]/posts` — Create posts on events
- `/api/orgs` — Create/update orgs
- `/api/me/**` — User profile mutations
- `/api/messages` — Send messages
- `/api/projects/upload` — File uploads

**Expected Findings:**
- ✅ Good: Most routes check `session?.user?.id`
- ⚠️ Check: Verify ownership checks are present for all update/delete operations
- ⚠️ Check: Ensure no mutations accept ownership fields from client

---

### **Phase 3: Input Validation & Mass Assignment** 🔴

**Goal:** Verify all external input is validated and mass assignment is prevented.

**Review Tasks:**
1. ✅ **Audit validation approach**
   - Check if using Zod (recommended) or custom validators
   - Review `src/lib/validations.ts` — current validation functions
   - Verify validation occurs **before** database writes
   - Check for `.strict()` schemas where appropriate

2. ✅ **Check for mass assignment**
   - Search for patterns like `data: req.body` or `data: request.json()`
   - Verify all update operations use explicit field allowlists
   - Check that sensitive fields (e.g., `passwordHash`, `role`) cannot be updated via API

3. ✅ **Review validation coverage**
   - Verify all mutation endpoints validate input
   - Check for missing validation on update routes
   - Ensure client-side validation is not the only validation

**Files to Review:**
- `src/lib/validations.ts` — Validation functions
- All mutation endpoints in `src/app/api/**/route.ts`
- Check for Zod schemas (if used)

**Expected Findings:**
- ✅ Good: Custom validation functions exist (`validateProjectData`, `validateEventData`, etc.)
- ⚠️ Check: Verify all mutations use these validators
- ⚠️ Check: Ensure update operations use explicit field allowlists (not `data: request.json()`)
- 💡 Recommendation: Consider migrating to Zod for better type safety and `.strict()` support

---

### **Phase 4: Prisma & Database Access** 🟡

**Goal:** Ensure no raw client input in Prisma calls and proper field selection.

**Review Tasks:**
1. ✅ **Check Prisma query patterns**
   - Verify no raw client input passed directly to Prisma
   - Check for use of `select` vs returning full models
   - Verify update operations use explicit field allowlists

2. ✅ **Review field selection**
   - Look for centralized `select` objects (e.g., `publicUserSelect`)
   - Verify sensitive fields are excluded from public responses
   - Check that `passwordHash` is never returned

3. ✅ **Verify ownership enforcement**
   - Check `where` clauses enforce ownership in queries
   - Verify update/delete operations include ownership checks in `where`

**Files to Review:**
- `src/lib/utils/server/**/*.ts` — Server utility functions
- All Prisma queries in API routes
- Check for `select` usage patterns

**Expected Findings:**
- ⚠️ Check: Verify `select` is used to limit returned fields
- ⚠️ Check: Ensure `passwordHash` is never selected
- ⚠️ Check: Verify ownership is enforced in `where` clauses

---

### **Phase 5: Supabase Configuration** 🟡

**Goal:** Verify RLS policies and service role key security.

**Review Tasks:**
1. ✅ **Check RLS status**
   - Review Prisma schema for RLS-related comments
   - Check if RLS is enabled on user/org-owned tables
   - Verify policies reflect ownership, not blanket access

2. ✅ **Audit service role usage**
   - Search for `SUPABASE_SERVICE_ROLE_KEY` usage
   - Verify it's never exposed to client (not `NEXT_PUBLIC_`)
   - Check that service role is only used server-side

3. ✅ **Review storage bucket configuration**
   - Check bucket policies (public read vs private)
   - Verify upload paths are scoped by user/org
   - Ensure buckets are not publicly writable

**Files to Review:**
- `src/lib/utils/server/supabase.ts` — Supabase client configuration
- `src/lib/utils/server/storage.ts` — Storage utilities
- `src/app/api/projects/upload/route.ts` — File upload endpoint
- Prisma schema for RLS documentation

**Expected Findings:**
- ⚠️ Check: Verify RLS policies are documented or implemented
- ✅ Good: `NEXT_PUBLIC_SUPABASE_URL` is appropriate (public URL)
- ⚠️ Check: Ensure service role key is server-only

---

### **Phase 6: File Uploads & Storage** 🟡

**Goal:** Verify file size limits, MIME validation, and path scoping.

**Review Tasks:**
1. ✅ **Check file upload endpoint**
   - Review `src/app/api/projects/upload/route.ts`
   - Verify file size limits are enforced
   - Check MIME type allowlisting (jpeg/png/webp)
   - Verify SVG and executable formats are rejected

2. ✅ **Review upload path scoping**
   - Check that upload paths include user/org ID
   - Verify files are stored in user/org-specific directories
   - Ensure no path traversal vulnerabilities

3. ✅ **Check storage bucket security**
   - Verify buckets are not publicly writable
   - Check that metadata is stored in DB, files in object storage
   - Review access control on uploaded files

**Files to Review:**
- `src/app/api/projects/upload/route.ts` — Upload endpoint
- `src/lib/utils/server/storage.ts` — Storage utilities
- Check for other upload endpoints (events, avatars, etc.)

**Expected Findings:**
- ⚠️ Check: Verify file size limits are enforced
- ⚠️ Check: Ensure MIME type validation is present
- ⚠️ Check: Verify upload paths are scoped by user/org

---

### **Phase 7: Data Exposure & Serialization** 🟡

**Goal:** Ensure APIs return only necessary fields and don't leak sensitive data.

**Review Tasks:**
1. ✅ **Review API response types**
   - Check for DTOs or `PublicUser`, `PublicOrg` types
   - Verify internal IDs, roles, emails are not leaked unnecessarily
   - Check that `passwordHash` is never in responses

2. ✅ **Audit GET endpoints**
   - Review all GET routes for data exposure
   - Verify user/org profiles don't leak sensitive fields
   - Check that admin/role information is not exposed unintentionally

3. ✅ **Check serialization boundaries**
   - Verify explicit serialization (not returning full Prisma models)
   - Check for `select` usage in queries
   - Review type definitions for public vs internal types

**Files to Review:**
- `src/lib/types/**/*.ts` — Type definitions (PublicUser, PublicOrg, etc.)
- All GET endpoints in `src/app/api/**/route.ts`
- Server utility functions that return data

**Expected Findings:**
- ✅ Good: `PublicUser` and `PublicOrg` types suggest separation
- ⚠️ Check: Verify these types are used consistently
- ⚠️ Check: Ensure no internal fields leak in responses

---

### **Phase 8: XSS & Content Rendering** 🟢

**Goal:** Verify user-generated content is sanitized or treated as plain text.

**Review Tasks:**
1. ✅ **Check content rendering**
   - Search for `dangerouslySetInnerHTML` usage
   - Review markdown rendering pipelines (if any)
   - Check for sanitization libraries

2. ✅ **Review user input display**
   - Check how project descriptions, posts, bios are rendered
   - Verify HTML is escaped or sanitized
   - Check for markdown rendering with proper sanitization

**Files to Review:**
- React components that render user content
- Markdown rendering components (if any)
- Search for `dangerouslySetInnerHTML`

**Expected Findings:**
- ⚠️ Check: Verify user content is escaped or sanitized
- 💡 Recommendation: Use a markdown library with XSS protection if rendering markdown

---

### **Phase 9: Secrets & Environment Variables** 🔴

**Goal:** Verify secrets are never exposed to client and env vars are validated.

**Review Tasks:**
1. ✅ **Audit environment variable usage**
   - Search for `NEXT_PUBLIC_` prefix usage
   - Verify secrets are never prefixed with `NEXT_PUBLIC_`
   - Check for hardcoded secrets

2. ✅ **Check env var validation**
   - Look for `env.ts` or similar validation file
   - Verify critical env vars are validated at runtime
   - Check for proper error messages when env vars are missing

3. ✅ **Review logging**
   - Search for `console.log` or logging that might expose secrets
   - Verify env values are not logged
   - Check error responses don't leak secrets

**Files to Review:**
- All files using `process.env`
- Check for `env.ts` or validation files
- Logging utilities

**Expected Findings:**
- ✅ Good: `NEXT_PUBLIC_SUPABASE_URL` is appropriate (public URL)
- ⚠️ Check: Verify `AUTH_SECRET`, `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` are not `NEXT_PUBLIC_`
- ⚠️ Check: Ensure env vars are validated at startup

---

### **Phase 10: Rate Limiting & Abuse Controls** 🟢

**Goal:** Verify public/expensive endpoints have basic rate limiting.

**Review Tasks:**
1. ✅ **Identify public endpoints**
   - List all public endpoints (signup, login, etc.)
   - Identify expensive endpoints (search, uploads, etc.)

2. ✅ **Check for rate limiting**
   - Search for rate limiting middleware or libraries
   - Verify signup/login endpoints are protected
   - Check upload endpoints have limits

3. ✅ **Review pagination**
   - Check for unbounded queries
   - Verify list endpoints have pagination
   - Check for reasonable page size limits

**Files to Review:**
- Public API routes
- Upload endpoints
- Search/list endpoints

**Expected Findings:**
- ⚠️ Check: Rate limiting may not be implemented (MVP acceptable)
- 💡 Recommendation: Add basic rate limiting for signup/login/upload

---

### **Phase 11: Logging & Error Handling** 🟢

**Goal:** Verify errors are sanitized and logs avoid PII.

**Review Tasks:**
1. ✅ **Review error handling**
   - Check centralized error handling utilities
   - Verify errors returned to clients are sanitized
   - Check that stack traces are not exposed in production

2. ✅ **Audit logging**
   - Check for structured logging
   - Verify PII and credentials are not logged
   - Check error logging doesn't leak sensitive data

**Files to Review:**
- `src/lib/utils/errors.ts` — Error utilities
- Error handling in API routes
- Logging statements

**Expected Findings:**
- ✅ Good: Centralized error utilities exist
- ⚠️ Check: Verify stack traces are not exposed in production
- ⚠️ Check: Ensure PII is not logged

---

### **Phase 12: Dependencies & Supply Chain** 🟢

**Goal:** Verify lockfile is present and vulnerabilities are addressed.

**Review Tasks:**
1. ✅ **Check dependency management**
   - Verify `package-lock.json` is present and committed
   - Check for known vulnerabilities (`npm audit`)
   - Review for abandoned or high-risk packages

2. ✅ **Check update tracking**
   - Look for Dependabot or similar tooling
   - Verify dependency updates are tracked
   - Check for minimal dependency surface area

**Files to Review:**
- `package.json` and `package-lock.json`
- Check for `.github/dependabot.yml` or similar

**Expected Findings:**
- ✅ Good: `package-lock.json` should be present
- ⚠️ Check: Run `npm audit` to identify vulnerabilities
- 💡 Recommendation: Set up Dependabot for automated updates

---

## Execution Strategy

### Step 1: Initial Assessment (30 min)
1. Run automated checks:
   - `npm audit` for dependency vulnerabilities
   - Search codebase for common patterns (mass assignment, `NEXT_PUBLIC_`, etc.)
   - List all mutation endpoints

### Step 2: Tier 1 Review (2-3 hours)
Focus on Phases 1-4 and 9 (Critical issues):
- Authentication & Authorization
- Server Mutations
- Input Validation
- Secrets & Environment Variables

### Step 3: Tier 2 Review (2-3 hours)
Focus on Phases 5-7 (High priority):
- Database Access & Prisma
- Supabase Configuration
- File Uploads
- Data Exposure

### Step 4: Tier 3 Review (1-2 hours)
Focus on Phases 8, 10-12 (Medium priority):
- XSS & Content Rendering
- Rate Limiting
- Logging & Error Handling
- Dependencies

### Step 5: Documentation & Recommendations (1 hour)
- Document all findings with classifications (🔴/🟡/🟢)
- Provide MVP-appropriate fix recommendations
- Identify blocking vs non-blocking issues

---

## Output Format

For each finding, document:

```markdown
### [Finding Title]

**Classification:** 🔴 Vulnerability | 🟡 Risk/MVP tradeoff | 🟢 Good practice

**Location:** `path/to/file.ts:line`

**Description:** Brief explanation of the issue

**Impact:** What could go wrong if not addressed

**Recommendation:** MVP-appropriate fix

**Blocks Launch:** Yes/No

**Priority:** High/Medium/Low
```

---

## Success Criteria

The security review is complete when:
- ✅ All Tier 1 (Critical) issues are identified and documented
- ✅ All blocking issues have clear fix recommendations
- ✅ Intentional gaps are documented vs accidental vulnerabilities
- ✅ Recommendations are MVP-appropriate (not over-engineered)
- ✅ Findings are prioritized and actionable

---

## Notes

- **Focus on practical fixes** — Avoid enterprise-only recommendations
- **Respect MVP constraints** — Don't suggest rewriting entire systems
- **Document intentional gaps** — Some security features may be deferred for MVP
- **Prioritize high-impact, low-complexity fixes** — Quick wins that significantly improve security posture
