# API Routes Cleanup Plan

## Current Issues

1. **Inconsistent naming:**
   - `/api/profile` (user profile)
   - `/api/org/profile` (org profile)
   - Should be consistent: `/api/users/me` and `/api/orgs/me`

2. **Actor switching routes:**
   - `/api/auth/switch-org`
   - `/api/auth/switch-to-user`
   - Could be unified under `/api/me/actor` or `/api/actors/me`

3. **Missing route constants:**
   - New API routes not in `routes.ts`

## Proposed Clean Structure

### User Profile Routes
```
/api/users/me          → GET/PUT current user's profile (replaces /api/profile)
/api/users/me/orgs     → GET user's orgs (already exists, good!)
```

### Org Profile Routes
```
/api/orgs/me           → GET/PUT current active org's profile (replaces /api/org/profile)
```

### Actor Management Routes
```
/api/me/actor          → GET current actor, PUT to switch actor
```

### Public User Routes (keep as-is)
```
/api/users/[username]/projects  → GET public user projects
/api/users/[username]/events   → GET public user events
```

## Migration Strategy

1. **Create new routes** alongside old ones
2. **Update route constants** in `routes.ts`
3. **Update all references** in components
4. **Delete old routes** once migration complete

## Benefits

- More RESTful and consistent
- Follows `/api/users/me` pattern already established
- Clearer separation of concerns
- Easier to extend in future
