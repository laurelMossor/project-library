# Routes Refactor Implementation Plan

## Overview
This plan outlines the migration from the current profile structure (`/profile/*`) to a unified structure under `/u/` and `/o/` routes, with proper session-based org actor switching.

## Current Structure
```
/profile                    → Private user profile
/profile/edit              → Edit user profile
/profile/org/[slug]         → Private org profile
/u/[username]               → Public user profile
/u/[username]/collections   → User collections (to be removed)
/o/[slug]                   → Public org profile
```

## Target Structure
```
/u/profile                  → Private user profile (links to settings)
/u/profile/settings         → User settings (switch between user/org actors)
/u/profile/edit             → Edit user profile form
/u/[username]               → Public user profile (collections shown inline)

/o/profile                  → Private org profile (links to settings)
/o/profile/settings         → Org settings (switch between user/org actors)
/o/profile/edit             → Edit org profile form
/o/[slug]                   → Public org profile (collections shown inline)
```

---

## Implementation Steps

### Phase 1: Session Enhancement (Auth Foundation)
**Why:** We need to track which org a user is "acting as" in their session.

1. **Extend NextAuth session to include activeOrgId**
   - Modify `src/lib/auth.ts` JWT and session callbacks
   - Add `activeOrgId?: string` to session.user
   - Store in JWT token for persistence
   - **Security:** Always verify user has permission to act as that org on each request

2. **Create session utility functions**
   - `getActiveActor(session)` → returns User or Org based on activeOrgId
   - `canActAsOrg(userId, orgId)` → checks OrgMember role
   - `setActiveOrg(session, orgId)` → updates session (via API route)

3. **Create API route for org switching**
   - `POST /api/auth/switch-org` → validates permission, updates session
   - `POST /api/auth/switch-to-user` → clears activeOrgId

**Files to modify:**
- `src/lib/auth.ts` - extend session callbacks
- `src/lib/utils/server/actor.ts` - add actor utilities (or create new file)
- `src/app/api/auth/switch-org/route.ts` - new file
- `src/app/api/auth/switch-to-user/route.ts` - new file

---

### Phase 2: Create New Route Structure

#### 2.1 User Routes (`/u/`)

**Create `/u/profile/page.tsx`**
- Move content from `/profile/page.tsx`
- Update route constants
- Add link to `/u/profile/settings`

**Create `/u/profile/settings/page.tsx`**
- New page for actor switching
- Show list of orgs user belongs to
- Allow switching between user and org actors
- Links to edit pages for both user and org

**Create `/u/profile/edit/page.tsx`**
- Move content from `/profile/edit/page.tsx`
- Reuse existing form components
- Update route constants

**Update `/u/[username]/page.tsx`**
- Already shows collections inline (good!)
- Remove any links to `/u/[username]/collections`
- Ensure it works as-is

**Delete `/u/[username]/collections/page.tsx`**
- No longer needed (collections shown on public profile)

#### 2.2 Org Routes (`/o/`)

**Create `/o/profile/page.tsx`**
- Move content from `/profile/org/[slug]/page.tsx`
- Check session for activeOrgId
- If no activeOrgId, redirect to `/o/profile/settings`
- Verify user has permission to access this org

**Create `/o/profile/settings/page.tsx`**
- New page for org actor switching
- Show current active org (if any)
- List all orgs user belongs to
- Allow switching between user and org actors
- Links to edit pages

**Create `/o/profile/edit/page.tsx`**
- New page for editing org profile
- Reuse form components (similar to user edit)
- Check activeOrgId and permissions

**Update `/o/[slug]/page.tsx`**
- Already shows collections inline (good!)
- No changes needed

---

### Phase 3: Create Org Actor Banner Component

**Create `/src/lib/components/layout/OrgActorBanner.tsx`**
- Displays when user is acting as org
- Shows: "Acting as [Org Name]" with switch button
- Positioned below nav bar
- Only visible when `session.user.activeOrgId` is set

**Update `/src/app/layout.tsx`**
- Add OrgActorBanner component below NavigationBar
- Pass session to banner

---

### Phase 4: Update Route Constants

**Update `/src/lib/const/routes.ts`**
```typescript
// Remove:
PRIVATE_USER_PAGE = "/profile"
PROFILE_EDIT = "/profile/edit"
PRIVATE_ORG_PAGE = (slug: string) => `/profile/org/${slug}`
USER_COLLECTIONS = (username: string) => `/u/${username}/collections`

// Add:
PRIVATE_USER_PAGE = "/u/profile"
USER_PROFILE_SETTINGS = "/u/profile/settings"
USER_PROFILE_EDIT = "/u/profile/edit"
PRIVATE_ORG_PAGE = "/o/profile"
ORG_PROFILE_SETTINGS = "/o/profile/settings"
ORG_PROFILE_EDIT = "/o/profile/edit"
```

---

### Phase 5: Update All References

1. **Search and replace route constants** throughout codebase
2. **Update navigation components** to use new routes
3. **Update API routes** that reference old paths
4. **Update redirects** in auth flows

---

### Phase 6: Cleanup

1. **Delete old files:**
   - `/src/app/profile/page.tsx`
   - `/src/app/profile/edit/page.tsx`
   - `/src/app/profile/org/[slug]/page.tsx`
   - `/src/app/u/[username]/collections/page.tsx`

2. **Update any remaining references** to old routes

---

## Critical Auth & Scaling Considerations

### ⚠️ **AUTH ISSUES IDENTIFIED:**

1. **Session Storage for Org Context**
   - **Issue:** NextAuth JWT tokens have size limits (~4KB)
   - **Solution:** Store `activeOrgId` in JWT (just an ID, minimal size)
   - **Alternative:** Use cookies or database session store if needed later
   - **MVP:** JWT is fine for now

2. **Permission Verification**
   - **Issue:** Must verify user has permission to act as org on EVERY request
   - **Solution:** Create middleware or utility that checks `getUserOrgRole(userId, activeOrgId)` 
   - **Performance:** Cache org memberships in session if needed (but verify on sensitive actions)
   - **Security:** Never trust session alone - always verify against DB for write operations

3. **Session Expiration**
   - **Issue:** If user loses org membership, session still has activeOrgId
   - **Solution:** On org profile access, verify membership and clear activeOrgId if invalid
   - **Better:** Add middleware that validates activeOrgId on protected routes

4. **Multiple Org Access**
   - **Issue:** User belongs to multiple orgs - how to switch?
   - **Solution:** Settings page shows all orgs, user selects one
   - **UX:** Clear indication of which org is active

### ⚠️ **SCALING CONSIDERATIONS:**

1. **Database Queries**
   - **Current:** Each page load checks `getUserOrgRole()` 
   - **Optimization:** Cache org memberships in session (but refresh periodically)
   - **MVP:** Current approach is fine, optimize later if needed

2. **Session Size**
   - **Current:** Session stores minimal data (userId, email, activeOrgId)
   - **Future:** If adding more session data, consider database sessions
   - **MVP:** JWT is sufficient

3. **Route Protection**
   - **Current:** Uses `proxy.ts` for basic auth checks, pages verify permissions individually
   - **Better:** Update `proxy.ts` to protect `/u/profile/*` and `/o/profile/*` routes
   - **MVP:** Update proxy.ts to include new protected routes

4. **Actor Context Propagation**
   - **Issue:** Need to pass active actor to many components
   - **Solution:** Create React context that derives actor from session (YES, DO THIS)
   - **MVP:** Create `ActorContext` provider that wraps app and provides active actor

---

## Recommended Proxy Enhancement

**Update `/src/proxy.ts`:**
- Add `/u/profile/*` and `/o/profile/*` to protectedRoutes
- Note: Full permission verification (org membership) still happens in pages for security
- Proxy only checks for session cookie existence

This will:
- Protect private profile routes at the proxy level
- Pages still verify org permissions individually (more secure)
- Reduce redirects for unauthenticated users

**MVP Decision:** Update proxy.ts to include new routes. Page-level permission checks remain.

---

## Migration Strategy

1. **Parallel Implementation:** Create new routes alongside old ones
2. **Gradual Migration:** Update links incrementally
3. **Final Cutover:** Once all references updated, delete old routes
4. **Testing:** Test org switching, permissions, and route access

---

## Testing Checklist

- [ ] User can access `/u/profile` when logged in
- [ ] User can switch to org actor via settings
- [ ] Org actor banner appears when active
- [ ] User can switch back to user actor
- [ ] `/o/profile` requires activeOrgId
- [ ] `/o/profile` verifies user has org permission
- [ ] Public routes (`/u/[username]`, `/o/[slug]`) work without auth
- [ ] Edit forms work for both user and org
- [ ] Old routes redirect or 404 appropriately
- [ ] Collections no longer accessible at `/u/[username]/collections`
- [ ] All navigation links updated

---

## Estimated Effort

- **Phase 1 (Session):** 2-3 hours
- **Phase 2 (Routes):** 4-5 hours
- **Phase 3 (Banner):** 1 hour
- **Phase 4 (Constants):** 30 minutes
- **Phase 5 (References):** 2-3 hours
- **Phase 6 (Cleanup):** 1 hour

**Total:** ~10-13 hours

---

## Notes

- Keep existing components (EditableProfile, etc.) - just reuse them
- Settings pages are new - create simple MVP versions
- Org edit form can reuse user edit form structure
- Consider creating shared form components if patterns emerge
