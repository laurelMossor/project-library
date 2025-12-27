## This milestone encompasses the work left for a V1 MVP. Get ready for real user feedback.

* Layout refactor, no more sidebar
* Nav bar operates as the following: 
    - Title: Project Library → Links to home/collections
    - Info icon → Links to About page and navigation hub 
    - Collections icon → Links to collections
    Icon: 
    - User Home icon → Links to personal profile and collection (if logged in, if not: Log In which can navigate to Sign Up page)
    Icon: https://fontawesome.com/icons/house-user?f=classic&s=solid

* User Home Page is the public user profile with User Collection at the bottom
* Collections is the home/landing page
* Projects can have entries added. Need Project Entry Table with Project ID as FK. (Project entry component exsits, and should be inserted below the original project)
* Better DB seed. 9 initial users from three core interest profiles: Sewing, Tech, and Woodworking adjecent
    - 6 users have 2 Projects, 1 has 1, and 2 have 0 projects. 2 of the projects have an update 
    - (Can we seed the created date? I want some variety being posted throughout December if possible)

* Launch app through Vercel, determine DB needs

