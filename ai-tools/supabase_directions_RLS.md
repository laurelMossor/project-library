Summarize the issue and suggest fixes for the following lint item: Title: RLS Disabled in Public Entity: public._prisma_migrations Schema: public Issue Details: Table public._prisma_migrations is public, but RLS has not been enabled. Description: Detects cases where row level security (RLS) has not been enabled on tables in schemas exposed to PostgREST



Answer:
I'll list the project's tables and extensions to gather context about the public schema and the prisma_migrations table. I'll call list_tables and list_extensions with no inputs.


Ran list_tables

Ran list_extensions

Reasoned
Summary of the issue
Table: public._prisma_migrations (schema: public)
Problem: The table lives in the public schema (exposed to PostgREST) but Row-Level Security (RLS) is not enabled.
Why this matters: When PostgREST or the anon/authenticated roles can access a schema, tables without RLS may expose rows to clients unintentionally. Supabase recommends enabling RLS on tables that are accessible by non-superuser roles and then adding explicit policies that define who can SELECT/INSERT/UPDATE/DELETE. Leaving RLS disabled is a security risk because access control will rely solely on role privileges rather than fine-grained row policies._
Recommended fixes (ordered, with the safest options first)
If the table should not be accessible by client roles at all (recommended for Prisma migration history)

Restrict role privileges so anonymous/authenticated roles cannot access the table:
REVOKE all privileges on public._prisma_migrations from anon, authenticated, public;
Ensure only the service_role (or db owner) can query/modify it.
This is safest for internal metadata like Prisma migrations, which normally do not need client access.
If the table must remain accessible through PostgREST (uncommon for migration tables)

Enable RLS and add explicit policies that tightly control access:
Enable RLS:
ALTER TABLE public._prisma_migrations ENABLE ROW LEVEL SECURITY;
Create minimal policies, for example:
CREATE POLICY "svc_read_only" ON public._prisma_migrations FOR SELECT TO service_role USING (true);
For app users, create policies only if a specific subset of rows should be visible; otherwise do NOT grant SELECT to anon/authenticated.
Prefer specifying TO clauses (e.g., TO authenticated) so policies don't unintentionally apply to PUBLIC.
If you need temporary access for maintenance

Use a short-lived service role connection or run queries as the DB owner rather than exposing the table to PostgREST.
Avoid disabling RLS globally or granting broad privileges to anon/authenticated._
Concrete SQL snippets
To remove client access (safe default):
SQL Query



REVOKE ALL ON public._prisma_migrations FROM anon, authenticated, public;

To enable RLS and create a restrictive policy (only service_role / owner can access):
SQL Query



ALTER TABLE public._prisma_migrations ENABLE ROW LEVEL SECURITY;

-- Deny everything by default (RLS implicit) and only allow explicit role(s) via policies.
-- Example: allow SELECT only for a specific DB role (if needed)
CREATE POLICY allow_service_role_select ON public._prisma_migrations
  FOR SELECT
  TO "service_role"
  USING (true);

Note: In Supabase, the service role bypasses RLS automatically; policies for service_role are often unnecessary, so focus policies on authenticated/anon if you must grant client access.
Additional considerations and best practices
Tables used only by server-side tooling (like Prisma migrations) should not be in a schema exposed to PostgREST or should have access revoked from client roles.
If you enable RLS on many tables, ensure columns used in policies (e.g., user_id, tenant_id) are indexed for performance.
Test behavior as both an authenticated user and as anon to confirm policies work as intended.
Avoid using overly permissive policies like USING (true) for authenticated unless you also lock down role privileges—combine policies and grants carefully.
If you want, I can:

Provide the exact SQL tailored to your needs (lockdown vs. RLS + policy) — tell me whether the table should be accessible to clients at all.
Check other tables in public for the same issue (I can attempt to list tables if you enable the data-sharing permission described in the assistant messages).