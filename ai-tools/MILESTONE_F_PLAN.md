# Milestone F MVP Plan - Events and Maps, Collections

## Overview

Implement Events as a new post type alongside Projects, with location data and map integration. Transform the Projects page into a unified "Collections" page that displays both Projects and Events. Add user-specific collections pages for individual user content.

## MVP Goals (Simplified)

- Users can create and view Events with location information
- Interactive maps show event locations
- Unified Collections page displays Projects and Events together
- Collections page becomes the new home page
- User profiles have dedicated collections pages showing only their posts

**Out of Scope for MVP:**
- RSVP functionality or attendee management
- Event calendar views or scheduling features
- Advanced map features (directions, multiple markers, etc.)
- Event categories beyond basic tags
- Social features (event sharing, invitations)
- Location-based search/filtering beyond map display
- Real-time event updates or notifications

## Event Data Model

### Core Event Fields

- **Title**: Event name (required, 100 char limit)
- **Description**: Event details and information (required, 1000 char limit)
- **Date and Time**: When the event occurs (required, future dates only)
- **Location**: Address and coordinates (required for map display)
- **Tags**: Categories or topics (optional, array of strings)
- **Created Date**: Auto-generated timestamp
- **Last Updated Date**: Auto-generated timestamp
- **ImageUrls**: List of image urls
- **Owner**: Reference to user who created the event

### Optional Future Fields (Not in MVP)
- Maximum attendees
- RSVP functionality
- Recurring event settings

## Map Integration

### Simple Map Display
- Use OpenStreetMap (free, open-source) or Google Maps
- Display single event location on map
- Basic marker with event title popup
- Link to external maps for directions

**MVP Scope:** Static map display only. No advanced features like:
- Multiple markers
- Route planning
- Interactive map controls beyond zoom/pan

## Backend Implementation

### 1. Database Schema Updates

**File:** `prisma/schema.prisma` (update existing)

Add Event model following existing patterns:

```prisma
model Event {
  id          String   @id @default(cuid())
  title       String   @db.VarChar(100)
  description String   @db.Text
  dateTime    DateTime
  location    String   @db.VarChar(255)
  latitude    Float?
  longitude   Float?
  tags        String[] // Array of tag strings
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Relations
  ownerId     String
  owner       User     @relation(fields: [ownerId], references: [id], onDelete: Cascade)

  @@map("events")
}
```

Update User model to include Event relation:
```prisma
model User {
  // ... existing fields ...
  events      Event[]
}
```

### 2. Create Event Utility Functions

**File:** `src/lib/event.ts` (new file)

Following patterns from `src/lib/project.ts`:

- `createEvent(data: EventCreateInput)` - Create new event
- `getEventById(id: string)` - Get single event with owner info
- `getEventsByUser(userId: string)` - Get user's events
- `getAllEvents()` - Get all events for collections page
- `updateEvent(id: string, data: EventUpdateInput)` - Update event
- `deleteEvent(id: string)` - Delete event

**Event Interfaces:**
```typescript
export interface EventCreateInput {
  title: string;
  description: string;
  dateTime: Date;
  location: string;
  latitude?: number;
  longitude?: number;
  tags?: string[];
}

export interface EventWithOwner extends Event {
  owner: {
    id: string;
    username: string;
    name: string | null;
  };
}
```

### 3. Create Events API Routes

**File:** `src/app/api/events/route.ts` (new file)

**GET /api/events**
- Public endpoint (no auth required)
- Returns all events for collections page
- Include owner information
- Sorted by creation date (newest first)
- Optional query params: `limit`, `offset` for pagination

**POST /api/events**
- Protected endpoint (requires authentication)
- Create new event
- Validate required fields and future dates
- Return created event

**File:** `src/app/api/events/[id]/route.ts` (new file)

**GET /api/events/[id]**
- Public endpoint
- Get single event by ID with owner info
- Return 404 if not found

**PUT /api/events/[id]**
- Protected endpoint
- Only event owner can update
- Validate ownership and data
- Return updated event

**DELETE /api/events/[id]**
- Protected endpoint
- Only event owner can delete
- Return success confirmation

## Frontend Implementation

### 4. Create Event Creation Form

**File:** `src/app/events/new/page.tsx` (new file)

- Protected page (redirect to login if not authenticated)
- Form with fields:
  - Title (required, text input)
  - Description (required, textarea)
  - Date and Time (required, datetime picker)
  - Location (required, text input + optional coordinates)
  - Tags (optional, tag input)
- Form validation (required fields, future dates)
- Submit creates event and redirects to event detail
- Cancel returns to collections page

### 5. Create Event Detail Page

**File:** `src/app/events/[id]/page.tsx` (new file)

- Public page (no auth required)
- Display event information
- Show map with event location
- Display owner info with link to profile
- Show event date/time, description, tags
- If user owns event, show edit/delete buttons
- Loading and error states

### 6. Update Collections Page

**File:** `src/app/collections/page.tsx` (new file, rename from projects)

- Public page (no auth required)
- Unified view of Projects and Events
- Filter tabs: All, Projects, Events
- Search bar across both content types
- Sort options: Newest, Oldest, Relevance
- Map view toggle (shows events with locations)
- Grid/list view for content cards
- Pagination for large result sets

**Content Cards:**
- Unified design for both Projects and Events
- Type indicator (Project/Event badge)
- Title, description preview, date
- Owner info with link
- For Events: Map thumbnail or location indicator

### 7. Create User Collections Page

**File:** `src/app/u/[username]/collections/page.tsx` (new file)

- Public page for viewing user's content
- Show both Projects and Events by this user
- Filter tabs: All, Projects, Events
- Same card design as main collections page
- Link back to main profile page

### 8. Update Navigation and Home Page

**Files:** Main navigation component and `src/app/page.tsx`

- Update main navigation to link to `/collections` instead of `/projects`
- Make Collections the primary content page
- Add "Create Event" option alongside "New Project"
- Update any existing project links to point to collections

## Map Implementation

### 9. Map Component

**File:** `src/lib/components/map/EventMap.tsx` (new file)

- Accept location coordinates and title as props
- Use Leaflet (OpenStreetMap) or Google Maps React
- Display single marker at event location
- Popup shows event title and link to event page
- Simple, lightweight implementation

**MVP Constraints:**
- Static display only
- No user interaction beyond zoom/pan
- Single marker per map
- Link to external maps for directions

## Testing & Validation

### 10. Manual Testing Checklist

- [ ] Create event with valid data (all required fields)
- [ ] Event displays correctly on collections page
- [ ] Event detail page shows all information and map
- [ ] Map displays event location correctly
- [ ] Filter collections by Projects/Events/All
- [ ] Search works across both content types
- [ ] User collections page shows only user's content
- [ ] Edit/delete events (owner only)
- [ ] Validation prevents past dates and missing required fields
- [ ] Public access to event pages (no auth required)
- [ ] Protected event creation (requires login)
- [ ] Navigation updated to use collections instead of projects

## Implementation Order

1. **Database Schema** (Task 1)
   - Add Event model to Prisma schema
   - Run database migration
   - Test schema with Prisma Studio

2. **Backend Utilities** (Task 2)
   - Create `src/lib/event.ts` with CRUD functions
   - Implement event interfaces and types
   - Test utility functions with sample data

3. **API Routes** (Task 3)
   - Create `/api/events` and `/api/events/[id]` routes
   - Implement GET, POST, PUT, DELETE operations
   - Test API endpoints with various scenarios

4. **Event Creation Form** (Task 4)
   - Create `/events/new` page with form
   - Implement validation and error handling
   - Test event creation flow

5. **Event Detail Page** (Task 5)
   - Create `/events/[id]` page
   - Display event data and basic map
   - Test with different events and ownership states

6. **Map Component** (Task 6)
   - Implement basic map display
   - Integrate with event detail page
   - Test location display accuracy

7. **Collections Page** (Task 7)
   - Create unified `/collections` page
   - Implement filtering and search
   - Display both Projects and Events
   - Test sorting and pagination

8. **User Collections** (Task 8)
   - Create `/u/[username]/collections` page
   - Filter content by user ownership
   - Test with different user profiles

9. **Navigation Updates** (Task 9)
   - Update links from projects to collections
   - Add event creation options
   - Test navigation flow throughout app

10. **Testing** (Task 10)
    - Manual testing of all features
    - Verify edge cases (no events, no projects, etc.)
    - Test map integration
    - Fix any bugs and polish UI

## Notes

- Follow existing code patterns from Milestones A-E
- Use standardized error helpers from `src/lib/errors.ts`
- Keep map implementation simple (OpenStreetMap preferred for cost)
- Event validation should prevent past dates and require future events
- Collections page should gracefully handle empty states
- Consider adding event count badges to user profiles
- Map coordinates can be optional for MVP (address-only events)
- Future enhancement: Geocoding service to convert addresses to coordinates
- Maintain backward compatibility with existing Project system
- **MVP Focus:** Basic event creation and unified display. Advanced features like RSVPs, calendars, and social features are future milestones.
