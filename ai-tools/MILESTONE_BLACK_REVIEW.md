# Milestone Black: Code Review & Cleanup Plan

**Objective:** Identify and document key areas for reducing redundancy, eliminating duplication, and establishing single sources of truth for patterns, types, and styling.

---

## Executive Summary

This review identifies critical areas where code duplication and redundancy create maintenance burden. The focus is on patterns that require multiple changes when the app evolves, violating DRY principles and increasing technical debt.

---

## 1. Profile Page Consolidation

### Current State
- **`/profile`** (private, editable): Shows `EditableProfile` component, user's collection via `UserCollectionSection`
- **`/u/[username]`** (public): Shows inline profile fields, action buttons, user's collection via `UserCollectionSection`

### Issues
1. **Nearly identical structure** - Both pages render user profile info and collections
2. **Duplicated profile display logic** - `/u/[username]` has inline JSX for profile fields that could be a shared component
3. **Inconsistent layout** - Profile page uses `max-w-md mx-auto` for profile section, public page uses `flex flex-col md:flex-row`
4. **Action button duplication** - Public page has conditional buttons (New Project/Event vs Send Message) that could be extracted

### Recommendations
1. **Create shared `ProfileHeader` component** that accepts:
   - `user: PublicUser`
   - `isOwnProfile: boolean`
   - `isEditable: boolean` (for inline editing vs separate edit page)
   - `session: Session | null` (for conditional actions)
2. **Consolidate profile display** - Extract profile field rendering into `ProfileDisplay` component
3. **Repurpose `/profile`** - Make it a "settings/private view" page with:
   - Link to public profile
   - Quick edit actions
   - Account settings (future)
   - Private collection view
4. **Standardize layout** - Use consistent container classes across both pages

### Files Affected
- `src/app/profile/page.tsx`
- `src/app/u/[username]/page.tsx`
- `src/lib/components/user/EditableProfile.tsx` (refactor)
- New: `src/lib/components/user/ProfileHeader.tsx`
- New: `src/lib/components/user/ProfileDisplay.tsx`

---

## 2. Collection Card Patterns

### Current State
- **`ProjectCard`**: Renders project with owner, images, entries, tags
- **`EventCard`**: Renders event with owner, images, entries, tags, date/location
- **`CollectionItemCard`**: Wrapper that conditionally renders ProjectCard or EventCard

### Issues
1. **Significant duplication** between `ProjectCard` and `EventCard`:
   - Both use `border rounded p-4 hover:shadow-lg transition-shadow flex flex-col`
   - Both render `ProfilePicPlaceholder`, title link, description, owner info, images, entries, tags
   - Only differences: EventCard has dateTime/location display, ProjectCard has different date formatting
2. **Inconsistent prop patterns** - `ProjectCard` uses `project`, `EventCard` uses `event`
3. **Repeated styling** - Card container styles duplicated
4. **Type-specific logic** - Could be unified with discriminator pattern

### Recommendations
1. **Create base `CollectionCard` component** that:
   - Accepts `CollectionItem` union type
   - Uses type guards to render type-specific sections
   - Extracts common card structure
2. **Extract shared sub-components**:
   - `CardHeader` (profile pic + title)
   - `CardDescription` (with truncation)
   - `CardMetadata` (owner + date)
   - `CardImages` (image carousel)
   - `CardEntries` (entries list)
   - `CardTags` (tags display)
3. **Type-specific sections** - Render event-specific fields (dateTime, location) conditionally
4. **Unified styling** - Single source of truth for card classes

### Files Affected
- `src/lib/components/project/ProjectCard.tsx` (refactor/remove)
- `src/lib/components/event/EventCard.tsx` (refactor/remove)
- `src/lib/components/collection/CollectionCard.tsx` (enhance)
- New: `src/lib/components/collection/CollectionCard.tsx` (unified)
- New: `src/lib/components/collection/CardHeader.tsx`
- New: `src/lib/components/collection/CardMetadata.tsx`

---

## 3. Collections Page Rendering

### Current State
Three separate implementations for rendering collections:
1. **`/collections`** - Client component fetching all projects/events, using `CollectionPage`
2. **`/u/[username]`** - Server component using `UserCollectionSection` (which uses `CollectionPage`)
3. **`/u/[username]/collections`** - Client component fetching user's projects/events, using `CollectionPage`
4. **`/profile`** - Server component using `UserCollectionSection` (which uses `CollectionPage`)

### Issues
1. **Multiple data fetching patterns**:
   - Server-side: `getProjectsByUser()`, `getEventsByUser()`
   - Client-side: `fetchProjects()`, `fetchEvents()`, custom fetch for user collections
2. **Duplicated search/filter logic**:
   - `UserCollectionSection` has client-side search filtering
   - `/collections` has debounced search with API calls
   - `/u/[username]/collections` has client-side search filtering
3. **Inconsistent empty states** - Each implementation has different empty messages
4. **Repeated filter hook usage** - Same `useFilter` hook used in multiple places with similar patterns

### Recommendations
1. **Create unified `CollectionContainer` component** that:
   - Handles both server and client data fetching
   - Accepts `dataSource` prop: `"all" | "user" | { userId: string }`
   - Handles loading/error states consistently
   - Provides unified search/filter interface
2. **Standardize data fetching**:
   - Server components: Use server utilities directly
   - Client components: Use client utilities consistently
   - Create `useCollectionData` hook for client-side fetching
3. **Extract search logic** - Create `useCollectionSearch` hook for debounced search
4. **Unified empty states** - Single component with configurable messages

### Files Affected
- `src/app/collections/page.tsx` (refactor)
- `src/app/u/[username]/collections/page.tsx` (refactor)
- `src/lib/components/collection/UserCollectionSection.tsx` (refactor)
- `src/lib/components/collection/CollectionPage.tsx` (keep as presentational)
- New: `src/lib/components/collection/CollectionContainer.tsx`
- New: `src/lib/hooks/useCollectionData.ts`
- New: `src/lib/hooks/useCollectionSearch.ts`

---

## 4. Button & Styling Patterns

### Current State
Button styles repeated across 18+ locations:
- Primary buttons: `px-4 py-2 bg-black text-white rounded hover:bg-gray-800 transition-colors`
- Variations: `disabled:opacity-50`, `text-center`, `w-full`
- Secondary buttons: `px-4 py-2 border rounded`
- Form buttons: `w-full bg-black text-white p-2 rounded`

### Issues
1. **No single source of truth** - Button styles duplicated everywhere
2. **Inconsistent variations** - Some use `hover:bg-gray-800`, others `hover:bg-gray-900`
3. **Hard to maintain** - Changing button style requires updating 18+ files
4. **No semantic meaning** - Can't distinguish primary/secondary/tertiary buttons

### Recommendations
1. **Create `Button` component** with variants:
   - `primary`, `secondary`, `tertiary`, `danger`
   - `size`: `sm`, `md`, `lg`
   - `fullWidth`: boolean
   - `disabled`, `loading` states
2. **Use Tailwind theme** - Define button styles in `globals.css` or Tailwind config
3. **Create style constants** - Export reusable class strings for edge cases
4. **Replace all instances** - Refactor all button usages to use component

### Files Affected
- New: `src/lib/components/ui/Button.tsx`
- New: `src/lib/components/ui/button-styles.ts` (constants)
- All files with button elements (18+ files)

---

## 5. Form Patterns

### Current State
Multiple form implementations with similar patterns:
- `EditProjectForm` - Create/edit projects
- `EditEventForm` - Create/edit events
- `EditableProfile` - Inline profile editing
- `/profile/edit` - Separate profile edit page
- `/projects/[id]/entries/new` - Project entry form

### Issues
1. **Duplicated form structure**:
   - Label + input patterns repeated
   - Error handling duplicated
   - Submit/loading states handled similarly
   - Validation patterns repeated
2. **Inconsistent styling**:
   - Some forms use `w-full border p-2 rounded`
   - Others use `w-full rounded border border-gray-300 px-3 py-2`
   - Inconsistent focus states
3. **Repeated validation logic** - Client-side validation duplicated
4. **No shared form components** - Each form builds from scratch

### Recommendations
1. **Create form component library**:
   - `FormField` - Wrapper for label + input/textarea
   - `FormInput` - Text input with consistent styling
   - `FormTextarea` - Textarea with consistent styling
   - `FormSelect` - Select dropdown
   - `FormError` - Error message display
   - `FormActions` - Submit/cancel button group
2. **Extract common form logic**:
   - `useFormState` hook for form state management
   - `useFormValidation` hook for validation
   - `useFormSubmit` hook for submission handling
3. **Standardize form styling** - Single source of truth for form field classes
4. **Create form templates** - Base templates for create/edit forms

### Files Affected
- New: `src/lib/components/forms/FormField.tsx`
- New: `src/lib/components/forms/FormInput.tsx`
- New: `src/lib/components/forms/FormTextarea.tsx`
- New: `src/lib/components/forms/FormError.tsx`
- New: `src/lib/components/forms/FormActions.tsx`
- New: `src/lib/hooks/useFormState.ts`
- New: `src/lib/hooks/useFormValidation.ts`
- `src/lib/components/project/EditProjectForm.tsx` (refactor)
- `src/lib/components/event/EditEventForm.tsx` (refactor)
- `src/lib/components/user/EditableProfile.tsx` (refactor)
- `src/app/profile/edit/page.tsx` (refactor)

---

## 6. Layout Patterns

### Current State
Repeated layout classes across pages:
- `flex min-h-screen flex-col items-center justify-center p-8` (profile, public profile, about, project detail)
- `flex min-h-screen flex-col p-8` (collections, messages, user collections)
- `flex min-h-screen items-center justify-center p-4` (forms)

### Issues
1. **Layout classes duplicated** - Same patterns repeated across 9+ pages
2. **Inconsistent spacing** - Some use `p-8`, others `p-4`
3. **No semantic layout components** - Can't easily change global layout patterns

### Recommendations
1. **Create layout components**:
   - `PageLayout` - Base page wrapper with consistent spacing
   - `CenteredLayout` - Centered content layout
   - `FullWidthLayout` - Full-width content layout
   - `FormLayout` - Form-specific layout
2. **Extract layout constants** - Define spacing, max-widths in constants
3. **Standardize container classes** - Use consistent `max-w-*` classes

### Files Affected
- New: `src/lib/components/layout/PageLayout.tsx`
- New: `src/lib/components/layout/CenteredLayout.tsx`
- New: `src/lib/components/layout/FormLayout.tsx`
- All page components (9+ files)

---

## 7. Type System & Core Types

### Current State
- Good foundation with `BaseCollectionItem`, `CollectionItem` union
- `PublicUser` type used consistently
- Type guards implemented (`isProject`, `isEvent`)

### Issues
1. **Inconsistent type usage** - Some components accept specific types when they could use `CollectionItem`
2. **Missing type utilities** - No helpers for extracting common fields
3. **Type assertions** - Some places use `as` when type guards would be safer

### Recommendations
1. **Audit type usage** - Ensure all collection-related components accept `CollectionItem` where possible
2. **Create type utilities**:
   - `getCollectionItemOwner(item)` - Extract owner
   - `getCollectionItemDate(item)` - Already exists, ensure usage
   - `getCollectionItemUrl(item)` - Generate detail URL
3. **Strengthen type guards** - Use discriminated unions more consistently
4. **Document type patterns** - Add JSDoc comments explaining type system

### Files Affected
- `src/lib/types/collection.ts` (enhance)
- `src/lib/utils/collection.ts` (add utilities)
- Components using collection types (audit all)

---

## 8. Image Handling Patterns

### Current State
- `ImageCarousel` component used in both `ProjectCard` and `EventCard`
- Image upload logic duplicated in `EditProjectForm` and `EditEventForm`

### Issues
1. **Image upload duplication** - Same file validation, preview logic in multiple forms
2. **No shared image utilities** - File validation, preview creation repeated

### Recommendations
1. **Extract image upload logic**:
   - `useImageUpload` hook for file handling, validation, preview
   - `ImageUploadField` component for form integration
2. **Create image utilities**:
   - `validateImageFile(file)` - File validation
   - `createImagePreview(file)` - Preview creation
   - `formatImageSize(bytes)` - Size formatting

### Files Affected
- New: `src/lib/hooks/useImageUpload.ts`
- New: `src/lib/components/forms/ImageUploadField.tsx`
- New: `src/lib/utils/image.ts`
- `src/lib/components/project/EditProjectForm.tsx` (refactor)
- `src/lib/components/event/EditEventForm.tsx` (refactor)

---

## 9. API Route Patterns

### Current State
- Consistent error handling via `src/lib/errors.ts`
- Similar patterns for GET/POST/PUT/DELETE

### Issues
1. **Repeated validation** - Similar validation logic across routes
2. **Inconsistent response formats** - Some return `{ error }`, others `{ message }`
3. **Repeated auth checks** - Session verification duplicated

### Recommendations
1. **Create API route utilities**:
   - `requireAuth()` - Session verification helper
   - `validateRequest()` - Request validation helper
   - `handleApiError()` - Consistent error response
2. **Standardize response formats** - Use consistent shape for success/error
3. **Extract common middleware** - Auth, validation, error handling

### Files Affected
- New: `src/lib/utils/server/api-helpers.ts`
- All API route files (audit and refactor)

---

## 10. Styling Source of Truth

### Current State
- Colors defined in `globals.css` via `@theme` directive
- Some components use hardcoded colors (`bg-black`, `text-white`, `bg-gray-800`)

### Issues
1. **Hardcoded colors** - Not using theme colors consistently
2. **No spacing constants** - Spacing values repeated (p-4, p-8, gap-4, etc.)
3. **Inconsistent border styles** - Some use `border`, others `border border-gray-300`

### Recommendations
1. **Use theme colors consistently** - Replace hardcoded colors with theme colors
2. **Create spacing constants** - Define standard spacing values // Don't do this
3. **Document color usage** - Add comments about when to use which colors // Don't do this
4. **Create style guide** - Document design system patterns // Don't do this

### Files Affected
- `src/app/globals.css` (enhance with comments)
- All components using hardcoded colors (audit all)
- New: `src/lib/const/styles.ts`

---

## Priority Recommendations

### High Priority (Do First)
1. **Button component** - Most duplicated pattern, affects 18+ files
2. **Profile page consolidation** - Clear user confusion, reduces duplication
3. **Collection card unification** - Core UI component, high visibility

### Medium Priority
4. **Form component library** - Reduces duplication in 5+ forms
5. **Collections rendering consolidation** - Multiple implementations need unification
6. **Layout components** - Affects all pages, but lower impact

### Low Priority (Nice to Have)
7. **Type system enhancements** - Already good foundation
8. **Image upload utilities** - Only affects 2 forms
9. **API route utilities** - Patterns are already consistent
10. **Styling constants** - Incremental improvement

---

## Implementation Strategy

1. **Start with high-impact, low-risk changes** - Button component first
2. **Create components incrementally** - Don't refactor everything at once
3. **Maintain backward compatibility** - Keep old components until new ones are proven
4. **Test thoroughly** - Each refactor should include testing
5. **Document as you go** - Update this doc with implementation notes

---

## Success Metrics

- **Reduced duplication**: Fewer than 3 instances of any repeated pattern
- **Single source of truth**: All styling/patterns come from shared components/constants
- **Easier maintenance**: Changes to patterns require changes in 1-2 places max
- **Type safety**: Consistent use of core types throughout
- **Developer experience**: New features easier to build using shared components

---

## Notes

- This review focuses on patterns that require multiple changes as the app grows
- Some duplication is acceptable if it provides clarity (e.g., type-specific components)
- Balance between DRY and over-abstraction - don't create unnecessary layers
- Consider performance implications of component abstractions
- Maintain readability - sometimes a bit of duplication is clearer than deep abstraction

