The profile pages need some attention. It looks like the Page profile and User profile are not using the same base and use separate components when they can be more in alignment. Take care to examine the current state, available components, and the similarities and difference between User and Page that will need to be accounted for in the profile page designs. 

The goal is they both should align on the following elements:
Component 1 - ProfileHeader
- the ProfilePicture at the top left of the page
- the name or page name as the header, and the @ username/slug in small letters under that in a similar way as the profile tag
- Uses the largest version of the profile picture

Component 2 - ProfileButtons
- The profile buttons will now be the same between User and Page, using the TransparentCTAButtons: Follow and Message, one on top of the other.
- These buttons are greyed/disabled when your active profile is the same as what you're looking at (rn, there is an 'Options' button, this can be removed)

Component 3 - ProfileBody
- This is a container for this section since the most different elements are what fields Users and Pages have
- Inside, then there will be differences mounted inside the profile body

ProfileCollectionSection - Already exsists
- This can remain as is, unless you encounter elements that need updated in this process.

I have attatched some of the relevant components for you to reference. Create a claude plan for the work as described