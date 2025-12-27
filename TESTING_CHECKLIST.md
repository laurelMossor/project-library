# Milestone H Testing Checklist

## Navigation & Layout
- [ ] Navigation bar displays correctly (Title, Info, Collections, User Home icons)
- [ ] Info icon opens About modal with mission and navigation links
- [ ] Collections icon links to `/collections`
- [ ] User Home icon links to `/u/[username]` when logged in, `/login` when not
- [ ] Root path `/` redirects to `/collections`

## Collections Page
- [ ] Collections page loads successfully
- [ ] Projects and events display correctly
- [ ] Filtering works (search, filter by type)
- [ ] Sorting works (date, title)
- [ ] View toggle works (grid, list, map)

## Project Entries
- [ ] Project detail page displays project entries (updates) if they exist
- [ ] Projects without entries don't show empty entries section
- [ ] Entries display in correct order (newest first)
- [ ] Entry title and content display correctly
- [ ] Entry timestamps display correctly

## Profile Pages
- [ ] `/profile` page loads for logged-in users (private profile)
- [ ] `/u/[username]` page loads for all users (public profile)
- [ ] User collection displays on both profile pages
- [ ] Edit profile link works on `/profile`
- [ ] "View public profile" link works

## Authentication
- [ ] Login works correctly
- [ ] Sign up works correctly
- [ ] Protected routes redirect to login when not authenticated
- [ ] Session persists after page refresh
- [ ] Logout works correctly (if implemented)

## About Modal
- [ ] About modal opens when clicking Info icon
- [ ] Modal displays mission text correctly
- [ ] Navigation links in modal work
- [ ] Modal can be closed by clicking outside or close button

## Build & Deployment Readiness
- [ ] `npm run build` completes successfully
- [ ] All environment variables documented in `.env.example`
- [ ] README includes deployment instructions
- [ ] No TypeScript errors
- [ ] No console errors in browser

## Data Display
- [ ] Seed data displays correctly (users, projects, events, entries)
- [ ] User avatars/initials display correctly
- [ ] Project images display correctly
- [ ] Event dates display correctly (no hydration errors)
- [ ] Tags display correctly

## Browser Compatibility
- [ ] Test in Chrome/Edge
- [ ] Test in Safari
- [ ] Test in Firefox (if available)
- [ ] Test responsive design on mobile viewport

## Edge Cases
- [ ] Projects without images display correctly
- [ ] Projects without tags display correctly
- [ ] Users without profile info display correctly
- [ ] Empty collections display appropriate message

