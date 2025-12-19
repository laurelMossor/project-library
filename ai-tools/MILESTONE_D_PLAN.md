# Milestone D MVP Plan - Matching
TBD: This is proposal only. It may not fit the MVP.
## Overview

Implement the Matching feature to help users discover potential collaborators based on shared interests. This milestone builds on the authentication, profile, and projects systems from previous milestones. The matching algorithm uses simple overlap-based logic (no ML) to find users with similar interests.

## MVP Goals (Simplified)

- Authenticated users can view their matches (other users with overlapping interests)
- Simple matching algorithm based on interests overlap
- Matches sorted by relevancy (number of shared interests)
- Display match score/percentage to show compatibility
- Link to matched user's profile page

**Out of Scope for MVP:**
- Two-way matching or mutual interest requirements
- Project-based matching (matching users to projects)
- Location-based filtering
- Advanced filtering or search within matches
- Match history or saved matches
- Messaging integration (that's a future milestone)
- ML-based recommendations

## Matching Algorithm

### Simple Overlap-Based Matching

**Core Logic:**
1. Get current user's interests array
2. For each other user, calculate overlap:
   - Find common interests (case-insensitive comparison)
   - Count shared interests
   - Calculate match score: `(shared interests / total unique interests) * 100`
   - Total unique interests = union of both users' interests
3. Sort matches by:
   - Primary: Number of shared interests (descending)
   - Secondary: Total match score (descending)
   - Tertiary: Username (alphabetical, for consistency)

**Edge Cases:**
- User with no interests: return empty matches or show message
- Users with identical interests: 100% match
- Users with no overlap: exclude from results (or show with 0% match)

**Example:**
- User A interests: `["React", "TypeScript", "Node.js"]`
- User B interests: `["React", "Python", "TypeScript"]`
- Shared: `["React", "TypeScript"]` (2 interests)
- Total unique: `["React", "TypeScript", "Node.js", "Python"]` (4 interests)
- Match score: `2/4 = 50%`

## Backend Implementation

### 1. Create Matching Utility Functions

**File:** `src/lib/matching.ts` (new file)

Create reusable matching functions following the pattern from `src/lib/user.ts` and `src/lib/project.ts`:

- `getUserMatches(userId: string)` - Get all matches for a user with match scores
  - Fetch current user's interests
  - Fetch all other users (exclude current user)
  - Calculate match scores for each user
  - Filter out users with 0% match (or include with 0% for MVP)
  - Sort by relevancy
  - Return array of matches with user info and match score

**Match Result Interface:**
```typescript
export interface MatchResult {
	user: {
		id: string;
		username: string;
		name: string | null;
		headline: string | null;
		bio: string | null;
		interests: string[];
		location: string | null;
	};
	sharedInterests: string[];
	matchScore: number; // 0-100 percentage
	sharedCount: number; // number of shared interests
}
```

**Helper Functions:**
- `calculateMatchScore(userInterests: string[], otherInterests: string[]): { sharedInterests: string[]; matchScore: number; sharedCount: number }`
  - Normalize interests to lowercase for comparison
  - Find intersection (shared interests)
  - Calculate union (total unique interests)
  - Return match data

### 2. Create Matches API Route

**File:** `src/app/api/matches/route.ts` (new file)

**GET /api/matches**
- Protected endpoint (requires authentication)
- Returns list of matches for the current user
- Each match includes:
  - User profile info (public fields only)
  - Shared interests array
  - Match score (0-100)
  - Shared count
- Sorted by relevancy (highest match first)
- Use `getUserMatches()` utility
- Return empty array if user has no interests

**Error Handling:**
- Return 401 if not authenticated
- Return empty array if user has no interests (not an error)
- Handle database errors gracefully

## Frontend Implementation

### 3. Create Matches List Page

**File:** `src/app/matches/page.tsx` (new file)

- Protected page (redirect to login if not authenticated)
- Fetch matches from GET `/api/matches`
- Display list of matches with:
  - User name/username (link to profile)
  - Headline (if available)
  - Match score (e.g., "85% match" or "3 shared interests")
  - Shared interests displayed as tags/badges
  - Link to user's profile page (`/u/[username]`)
- Loading and error states
- Empty state when no matches found (or user has no interests)
- Simple, clean UI following existing design patterns

**Match Card Display:**
- User name/username (prominent)
- Match percentage or "X shared interests"
- List of shared interests as tags
- User headline (if available)
- "View Profile" link/button

### 4. Update Navigation

**Files:** `src/app/page.tsx` or navigation component

- Add "Matches" link to main navigation (only visible when logged in)
- Can be added to the home page alongside "New Project" and "Profile"

## Testing & Validation

### 5. Manual Testing Checklist

- [ ] View matches as authenticated user with interests
- [ ] Matches are sorted by relevancy (highest first)
- [ ] Match scores are calculated correctly
- [ ] Shared interests are displayed correctly
- [ ] Links to matched user profiles work
- [ ] Empty state shows when user has no interests
- [ ] Empty state shows when no matches found
- [ ] Cannot access matches page when not logged in (redirects to login)
- [ ] Users with identical interests show 100% match
- [ ] Users with no overlap are excluded (or show 0% match)
- [ ] Case-insensitive interest matching works correctly

## Implementation Order

1. **Backend Utilities** (Task 1)
   - Create `src/lib/matching.ts` with matching algorithm
   - Implement `calculateMatchScore()` helper
   - Implement `getUserMatches()` function
   - Test matching logic with sample data

2. **API Route** (Task 2)
   - Create GET `/api/matches` route
   - Integrate with `getUserMatches()` utility
   - Test API endpoint with authenticated requests
   - Verify error handling

3. **Frontend Page** (Task 3)
   - Create `/matches` page
   - Fetch and display matches
   - Implement loading/error/empty states
   - Style match cards following existing UI patterns

4. **Navigation** (Task 4)
   - Add Matches link to navigation/home page
   - Test navigation flow

5. **Testing** (Task 5)
   - Manual testing of all scenarios
   - Verify edge cases (no interests, no matches, etc.)
   - Fix any bugs
   - Verify MVP requirements met

## Notes

- Follow existing code patterns from Milestones A, B, & C
- Use standardized error helpers from `src/lib/errors.ts`
- Keep matching algorithm simple and readable (no premature optimization)
- Match scores are calculated on-the-fly (no caching needed for MVP)
- All user data returned should use public profile fields (exclude email)
- Matching is one-way: User A sees matches, but User B might not see User A (unless they also have matching interests)
- **MVP Focus:** Simple interest overlap. No complex algorithms, ML, or advanced features needed to demonstrate the concept.
- Consider normalizing interests to lowercase for comparison to handle case variations
- Empty interests array = no matches (or show message encouraging user to add interests)

