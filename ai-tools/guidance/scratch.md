
Store all ancestor/descendant pairs in a separate table. Source of truth is still parentId; closure table is derived and can be rebuilt.

Schema conceptually:

Topic(id, label, parentId, ...)

TopicClosure(ancestorId, descendantId, depth)

Then:

all descendants of X = where ancestorId = X

all ancestors of Y = where descendantId = Y