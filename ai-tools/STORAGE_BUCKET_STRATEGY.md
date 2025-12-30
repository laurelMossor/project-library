# Storage Bucket Strategy: Per-User vs Single Bucket

## Question
Should each user have their own bucket, or is a single bucket with folder structure sufficient?

## Recommendation: **Single Bucket with Folder Structure** ✅

For an MVP, a single bucket with organized folder structure is the better choice. Here's why:

### Single Bucket Approach (Recommended)

**Structure:**
```
uploads/
  ├── projects/
  │   ├── {projectId}/
  │   │   ├── {timestamp}-{random}.jpg
  │   │   └── {timestamp}-{random}.png
  ├── events/
  │   ├── {eventId}/
  │   │   └── {timestamp}-{random}.jpg
  └── profiles/
      ├── {userId}/
      │   └── avatar.jpg
```

**Pros:**
- ✅ **Simpler to manage**: One bucket, one set of permissions
- ✅ **Easier to query**: Can list all images across users/projects
- ✅ **Cost-effective**: No overhead from multiple buckets
- ✅ **Flexible**: Easy to reorganize or add new folder types
- ✅ **Standard practice**: Most apps use folder structure, not per-user buckets
- ✅ **Easier debugging**: All images in one place
- ✅ **Better for analytics**: Can analyze storage usage across the app

**Cons:**
- ⚠️ **Less isolation**: All images in one bucket (but folder structure provides organization)
- ⚠️ **Permission complexity**: Need to ensure users can only access their own folders (handled by application logic)

### Per-User Bucket Approach

**Structure:**
```
user-{userId}-uploads/
  ├── projects/
  │   └── {timestamp}-{random}.jpg
  └── events/
      └── {timestamp}-{random}.jpg
```

**Pros:**
- ✅ **Strong isolation**: Each user's data is completely separate
- ✅ **Easier to delete**: Delete bucket = delete all user data
- ✅ **Compliance**: Better for strict data residency requirements

**Cons:**
- ❌ **Complex management**: Need to create/delete buckets dynamically
- ❌ **Harder to query**: Can't easily list all images across users
- ❌ **More overhead**: Each bucket has its own configuration, policies
- ❌ **Scaling issues**: Many buckets can be harder to manage
- ❌ **Overkill for MVP**: Unnecessary complexity for most use cases

## Current Implementation

Your current setup uses a **single bucket** (`uploads`) with files at the root level:

```typescript
// Current: uploads to bucket root
const result = await uploadImage(file, "");
// Creates: {timestamp}-{random}.jpg
```

## Recommended Folder Structure

Update your upload logic to use folders:

```typescript
// For projects
const result = await uploadImage(file, `projects/${projectId}`);

// For events  
const result = await uploadImage(file, `events/${eventId}`);

// For user profiles (future)
const result = await uploadImage(file, `profiles/${userId}`);
```

**Benefits:**
- Organized by collection type
- Easy to find images for a specific project/event
- Can set folder-level permissions if needed
- Clear separation of concerns

## When to Use Per-User Buckets

Consider per-user buckets only if:
- **Compliance requirements**: Need strict data isolation (GDPR, HIPAA, etc.)
- **Multi-tenant SaaS**: Each tenant needs complete data separation
- **Enterprise features**: Users need to manage their own storage quotas
- **Legal requirements**: Different jurisdictions require separate storage

For a community project library MVP, this is **overkill**.

## Security Considerations

With a single bucket, ensure:
1. **Application-level access control**: Users can only upload to their own projects
2. **File naming**: Use unique, unpredictable filenames (timestamp + random)
3. **Bucket permissions**: Keep bucket public for reads, but control writes via service role key
4. **Validation**: Verify ownership before allowing uploads/deletes

Your current implementation already handles this correctly:
- ✅ Uploads require authentication
- ✅ Service role key used for server-side operations
- ✅ Unique filenames prevent collisions

## Migration Path

If you later need per-user buckets:
1. Create migration script to move files
2. Update upload logic to create buckets dynamically
3. Update delete logic to handle bucket deletion
4. More complex, but doable if needed

## Conclusion

**For MVP: Use single bucket with folder structure.**

This gives you:
- Simplicity
- Flexibility
- Easy maintenance
- Standard practice

You can always migrate to per-user buckets later if requirements change, but starting with a single bucket is the right choice for an MVP.

