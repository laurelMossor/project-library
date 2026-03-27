It's time to refactor the switchToPage and canPostAsPage functionality, but I want to come at it with FRESH eyes and not take these pattners to be inherently good just because they are the ones we're using. Take a critical perspective in order to create the framework for this core website utility. 

As you read in the PROJECT_GUIDELINES, being able to act as a Page is a core aspect of the Project Library. Throughout recent refactors, this behavior became broke. If you're curious to see that history, you can read back to #### Entry: Sat 03/21/2026 15:32 PDT, but it's NOT critical to your understanding for this task.

Product description: 
Currently, the NavProfileTag just has the option to View Profile. Now, it will become a way to switch the default profile easily and on every page. There will be another option for "Switch Profile". This option will expand the dropdown menu with the other Pages this user has ADMIN or EDITOR role. It lists their role badge on the tag, just like the other uses of ProfileTag, and 'view' (like the connectionsView component usage)

The Post and Event authorship will be conrolled in a SIMILAR way, where you can click that profiletag and have a dropdown with the other pages available for authorship. Only chnage this for the Event form for now. Ensure your design includes sensibly refacting the related components with organization and extensibility in mind. 

Use the interface-design skill to make your plan, and include a critical assessment and suggestion for the BE implementation for this design, keeping security and validation in mind. 