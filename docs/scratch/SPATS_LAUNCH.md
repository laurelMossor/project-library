Task 1 - Page Roles
Open questions:
- Does the Page have an Owner? Right now, Admin can add admins and post/message, Editors can post and message, and Members have only a simple association. Is there need for an ultimate owner, one who can like delete the page, and ownership would pass to an Admin? Perhaps I don't need to focus on that right now?

Task 2 - Page microsite features
See PAGE_MICROSITE_PRD for details
Need to make a technical plan
Open Questions: 
- This is a huge refactor, need to determine and good-enough way to enter these composable profile elements, and how/where to render them on the profile (profile body in the custom Page information?)


Task 2a - About subpage
Goal: Page's can have a distinct About page beyond the profile main view
Open Questions:
- Should the Page-specific About page be a Post in disguise? Or it's own distinction? If it were a distinct post/page type, would it appear in the Page's collection? Can it be linked to from the profile body easily?

Task 3 - Pinned posts
Goal: The CollectionCard would have a pin icon and ability to pin to the top of the collection view 
Open Questions:
- How would the schema be affected by the addition of pinning? 
Details: Need to think how to future proof this as the styles are not set and things aren't cohesive, don't want to make big design decisions right now

Task 4 - Profile pictures
Goal: Be able to upload, change, delete their profile picture via their profile editing
- Add a rich brown boarder around the profilepicture 
Details: From your profile view, as the personal profile active user, you can click on the profilepicture element to spawn the photo editor modal. On it, you see the photo at a larger scale in its original form (e.g. square) along with the options. User will have the option to 'upload a photo' or 'remove photo'.

Task 5 - Captions
Goal: Photos have captions 
Details: the captions appear as opaque text on a semi-transparent banner on the bottom edge of the photos when viewed from the full page post or event, not the card.

Task 6 - Map view
Goal: Enable Map view on collections views 
Details: The collections view has a 'Map' option along with the Grid and List, but it's not hooked up. Have it filter to only the posts with a location, centered around the posting that would have been at the top of the sort. It should extend on the existing map element. Take care with this central element of a platform site, it's maps and embedding the maps in pages. Consider 