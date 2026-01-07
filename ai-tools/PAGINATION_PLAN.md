# Pagination Implementation Plan (MVP)

## Overview
Implement simple frontend-only pagination across Collections pages. This is a lightweight MVP solution that paginates already-fetched data on the client side. No backend changes needed.

## Current State

### Collections Pages
1. **`/collections`** - Main collections page
   - Fetches all projects and events, then filters/sorts client-side
   - Uses `useFilter` hook

2. **`/u/[username]/collections`** - User-specific collections page
   - Fetches user's projects and events, then filters client-side
   - Uses `useFilter` hook

### Current Architecture
- All data is fetched upfront and stored in state
- `useFilter` hook handles filtering, sorting, and view state
- `filteredItems` array contains all items to display
- No pagination - all items are rendered at once

## Implementation Plan

### Phase 1: Create `usePagination` Hook
**File**: `src/lib/hooks/usePagination.ts`

Simple hook that takes an array of items and returns:
- Paginated slice of items for current page
- Current page number
- Total pages
- Navigation functions: `nextPage()`, `previousPage()`, `goToPage(page)`
- Reset function to go back to page 1

**Signature**:
```typescript
function usePagination<T>(items: T[], itemsPerPage: number = 20)
```

**Returns**:
```typescript
{
  paginatedItems: T[];  // Items for current page
  currentPage: number;
  totalPages: number;
  totalItems: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  nextPage: () => void;
  previousPage: () => void;
  goToPage: (page: number) => void;
  reset: () => void;  // Reset to page 1
}
```

**Implementation**:
- Use `useMemo` to slice items array based on current page
- Reset to page 1 when items array changes (via `useEffect`)

### Phase 2: Create PaginationControls Component
**File**: `src/lib/components/collection/PaginationControls.tsx`

Simple UI component with:
- Previous/Next buttons
- Current page indicator (e.g., "Page 1 of 5")
- Only render if `totalPages > 1`

**Props**:
```typescript
{
  currentPage: number;
  totalPages: number;
  onPrevious: () => void;
  onNext: () => void;
  onPageChange?: (page: number) => void;  // Optional for direct page navigation
}
```

**Design**:
- Simple, clean buttons
- Use colors from `globals.css`
- Mobile-friendly
- Disable Previous on page 1, Next on last page

### Phase 3: Update CollectionPage Component
**File**: `src/lib/components/collection/CollectionPage.tsx`

- Accept pagination props (or compute internally from `filteredItems`)
- Pass `paginatedItems` to `FilteredCollection` instead of `filteredItems`
- Add `PaginationControls` at bottom of content
- Only show pagination when `totalPages > 1`

**Option A**: Accept pagination as props (more flexible)
**Option B**: Accept `filteredItems` and `itemsPerPage`, compute pagination internally (simpler)

**Recommended**: Option B for MVP simplicity

### Phase 4: Update Collections Pages

#### 4.1 Main Collections Page (`/collections/page.tsx`)
- Use `usePagination` hook with `filteredItems` from `useFilter`
- Pass `paginatedItems` and pagination props to `CollectionPage`
- Reset pagination when search/filter changes (hook should handle this)

#### 4.2 User Collections Page (`/u/[username]/collections/page.tsx`)
- Use `usePagination` hook with `filteredItems` from `useFilter`
- Pass `paginatedItems` and pagination props to `CollectionPage`
- Reset pagination when search changes

## Implementation Order

1. **Phase 1**: Create `usePagination` hook
2. **Phase 2**: Create `PaginationControls` component
3. **Phase 3**: Update `CollectionPage` component
4. **Phase 4**: Update Collections pages

## Configuration

**Default Items Per Page**: 20 items
- Can be made configurable later if needed

## Notes

- This is frontend-only pagination - all data is still fetched upfront
- Pagination resets to page 1 when filters/search change (automatic via hook)
- Simple MVP approach - can be enhanced later with backend pagination if needed
- No API or server changes required

