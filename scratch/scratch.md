Next Task:
Unify the ProfilePicture component, the standard sizes, and their use in the new ProfileTag
Used anywhere a user is listed. It might grow depending on the options, like 'remove' from memberships from a Page

ProfileTag:
- Connections View (The ProfileTag should display like it does stretching the width, with a badge if relevant, and any buttons like 'remove' or 'view')
- Under "Page Settings", listing the pages 
- Event page, where the author is listed

Avatar (Profile Picture):
- ProfileTag
- On the Collections card

All of these should have alignment and take in a page or user and be able to render the profile picture and either Name and username or Page name and slug, depending on context.

The new component will be used in a new place. In the nav bar next to the hamburger menu, a medium sized version of the ProfilTag that when selected, will span the same menu component as the hamburger menu with just one option 'View Profile'
