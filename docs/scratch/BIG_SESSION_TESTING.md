# Big Session — Manual Testing Targets

Accumulated from orchestrator session dispatches. Test after merging each bundle's changes.

---

## Bundle G — N+1 Query Sweep

- [ ] Explore page loads without cascading network requests (check Network tab — one fetch per collection type, not per card)
- [ ] Profile pages (user + page) load posts/events without per-item API calls
- [ ] Post and event detail pages load related data in a single query (no sequential fetches visible in Network tab)
- [ ] No regressions: collection cards still show update counts, recent update previews, and author info

## Bundle D — Bug Sweep

- [ ] **Search filtering:** type a query in the explore page search bar — results actually filter down (not showing everything)
- [ ] **Empty message thread:** navigate to alice's inbox — no empty/orphan conversation with george
- [ ] **Empty posts:** try to save/publish a post with no title and no content — should be rejected

## Bundle B — RSVP Polish

- [x] Logged-in user sees name + email pre-filled on an event RSVP form
- [ ] Pre-filled fields are still editable
- [ ] Submit RSVP, navigate away, come back — form shows existing response (not blank)
- [ ] "Change response" updates the existing RSVP (doesn't create a duplicate)
- [ ] Non-logged-in user gets the standard blank form and can RSVP normally

## Bundle C — Microsite Finishers

- [ ] **About Page entry:** on own profile, "+ New element" dropdown shows "About Page" option; clicking it routes to `/[handle]/about` for editing
- [ ] "About Page" option hidden if about content already exists
- [ ] Visitors can reach existing About pages from the profile collection card
- [ ] **Settings avatar:** settings page headers show the active profile's avatar next to "User Settings" / "Page Settings"
- [x] **NavProfileTag fixed width:** desktop — trigger doesn't shift width when switching between profiles with short/long names
- [x] **NavProfileTag mobile:** at 375px, trigger collapses to avatar only; dropdown still opens normally
- [ ] **Photo captions:** on own post detail page, can add a caption below an image; caption persists on reload
- [ ] Editing an existing caption works; caption displays for visitors

## Bundle H — Admin Tools (Manage Admins + Connections View)

- [ ] **Connections — no "View" buttons:** clicking the ProfileTag itself navigates to the profile
- [ ] **Expandable actions:** each USER row has an icon; clicking it expands inline actions; clicking "x" or expanding another row collapses it
- [ ] **Followers tab:** "Remove Follower" removes the row
- [ ] **Following tab:** "Unfollow" removes the row
- [ ] **Membership tab (as user):** "Leave Group" removes the membership
- [ ] **Membership tab (as page admin):** "Remove from group" removes the member; last-admin removal shows inline error
- [ ] **Membership tab (as page admin):** "Add members" button shows `ProfileSearchDropdown`; selecting a user adds them and refreshes the list
- [ ] **Manage Admins (settings):** search dropdown finds users by partial name/handle; selecting adds as admin; already-admins excluded from results

## Bundle F — Map View Polish

- [ ] Map aspect ratio feels intentional and works responsively (not the current stretched rectangle)
- [ ] Controls bar above map: location input + radius selector (at least 3 options)
- [ ] Setting a location + radius filters markers — events outside radius are hidden
- [ ] Event count updates as you pan/zoom to reflect only visible markers
- [ ] Radius circle or visual boundary on the map matches the selected radius
- [ ] Design fits the app's existing palette and style
