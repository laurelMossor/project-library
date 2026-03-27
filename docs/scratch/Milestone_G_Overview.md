# Project Library – Topics & Taxonomy (AI Instructions)

## Purpose

The Project Library uses **Topics** as a structured, browseable way to connect people, projects, posts, and events around shared interests. Topics are *not* freeform tags; they are a controlled taxonomy that supports discovery, filtering, and long-term maintenance.

Projects may still have **user-defined tags** for expressive or ad‑hoc labeling, but those tags are not part of the taxonomy and are not used for hierarchical browsing.

This document defines how Topics work, how they are stored, and how they should be used.

---

## Core Concepts

### Topics

* Topics are **first-class entities** in the system.
* Each Topic has:

  * a single parent (tree structure)
  * unlimited children
  * a stable identity (ID)
* Topics are used to tag:

  * Projects
  * Posts
  * Events

Topics power:

* browsing by interest
* topic pages
* hierarchical filtering (parent → descendants)

### User Tags (Existing `tags` field on Project)

* User tags are **freeform strings** supplied by the project creator.
* They are optional and expressive (e.g. "quilting circle", "beginner", "local group").
* They are **not hierarchical**.
* They are **not moderated or merged**.
* They are **not used** for taxonomy browsing.

Topics and user tags serve different purposes and must not be conflated.

---

## Taxonomy Rules

### Structure

* The Topic system is a **tree** (one parent per Topic).
* Cycles are not allowed.
* Topics may only have **one ancestor path**.

Example:

```
Craft
└─ Fiber Art
   └─ Sewing
      └─ Quilting
```

### Slugs

* Topics have a unique, URL-safe `slug`.
* Slugs are lowercase and hyphenated.
* Slugs are stable; renames should be handled via aliases when possible.

### Status

* Topics can be:

  * `ACTIVE`: usable and visible
  * `DEPRECATED`: no longer selectable, but kept for redirects and history

---

## Data Model Overview (Conceptual)

### Topic

* `id`
* `name`
* `slug`
* `description`
* `parentId` (nullable)
* `path` (materialized path, e.g. `/craft/fiber-art/sewing`)
* `depth`
* `status`

### TopicAlias

* Maps old or alternate slugs to a canonical Topic
* Used for renames, synonyms, and redirects

### ProjectTopic (Join Table)

* Associates Projects with Topics by ID
* Enables efficient querying, renames, merges, and browsing

---

## Materialized Path

Each Topic stores its full ancestry path as a string.

Examples:

* Craft → `/craft`
* Fiber Art → `/craft/fiber-art`
* Sewing → `/craft/fiber-art/sewing`

### Why this exists

* Fast descendant queries
* Simple "show everything under this Topic" logic
* Easy breadcrumb generation

### Rules

* `path` is derived from the parent at creation time
* Moving or renaming Topics requires updating descendant paths
* Topic moves are restricted to admin tools

---

## Topic Usage Rules

### When creating or editing a Project

* Users select Topics from the controlled Topic list
* Users may also add freeform user tags via the existing `tags` field

### Topic selection guidelines

* Prefer **specific** Topics over broad ones
* Avoid tagging both a Topic and its direct ancestor unless necessary

Example (good):

* Quilting
* Social

Example (avoid):

* Craft
* Fiber Art
* Sewing

---

## Topic Pages

Each Topic has a dedicated page that includes:

* breadcrumb (ancestors)
* description
* child Topics
* associated content (Projects, Posts, Events)

By default, content includes items tagged with:

* the Topic itself
* all descendant Topics

---

## Admin / Moderation Rules

### Creating Topics

* New Topics must:

  * have a clear parent
  * have a concise, singular name
  * avoid duplicates of existing Topics

### Merging Topics

Used when two Topics represent the same concept.

Merge behavior:

* All content tagged with the source Topic is re-tagged to the target Topic
* Source Topic is deprecated
* Source slug becomes an alias of the target

### Renaming Topics

* Prefer renaming `name` while keeping `slug`
* If slug must change:

  * create an alias from old slug → new Topic

### Deprecation

* Deprecated Topics:

  * cannot be selected for new content
  * remain valid for old content
  * redirect to a canonical Topic if applicable

---

## Explicit Non-Goals (for now)

The system does **not** support:

* multiple parents per Topic
* user-created Topics without review
* arbitrary graph relationships between Topics
* auto-generated Topics from tags

These may be added later but are intentionally excluded from the MVP.

---

## Design Philosophy

* Topics are about **shared understanding**, not personal expression
* The taxonomy should feel:

  * transparent
  * navigable
  * stable over time
* Complexity is deferred until real usage demands it

This system is designed to evolve, but only after observing real behavior and needs.

# Project Library – Topics & Taxonomy Schemas (Prisma)

This document defines the **database schemas related to Topics and taxonomy** for the Project Library platform.

It is intended for use by developers and AI systems working on the codebase.

Assumptions:

* The `Project` model already exists and should not be redefined here.
* Prisma is used as the ORM.
* PostgreSQL is the backing database.
* Topics use a **single-parent tree structure** with a materialized path.

---

## Design Overview

* Topics are stored as first-class records.
* Each Topic has **one optional parent** and many children.
* A materialized `path` field enables efficient descendant queries.
* Projects are associated with Topics via a join table.
* Freeform user tags live elsewhere (e.g. `Project.tags`) and are not included here.

---

## Prisma Models

### Topic

```prisma
model Topic {
  id          String   @id @default(cuid())
  name        String
  slug        String   @unique
  description String?

  status      TopicStatus @default(ACTIVE)

  parentId    String?
  parent      Topic?   @relation("TopicParent", fields: [parentId], references: [id], onDelete: Restrict)
  children    Topic[]  @relation("TopicParent")

  /// Materialized path, e.g. "/craft/fiber-art/sewing"
  path        String

  /// Depth in the tree (root = 0)
  depth       Int      @default(0)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  projectTopics ProjectTopic[]

  @@index([parentId])
  @@index([path])
  @@index([depth])
}
```

---

### TopicStatus

```prisma
enum TopicStatus {
  ACTIVE
  DEPRECATED
}
```

---

### TopicAlias

Topic aliases map alternate or deprecated slugs to a canonical Topic.

Used for:

* renames
* synonyms
* backward-compatible URLs

```prisma
model TopicAlias {
  id        String   @id @default(cuid())
  aliasSlug String   @unique

  topicId   String
  topic     Topic    @relation(fields: [topicId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
}
```

---

### ProjectTopic (Join Table)

Associates Projects with Topics using IDs.

This enables:

* hierarchical browsing
* topic renames and merges
* efficient querying

```prisma
model ProjectTopic {
  projectId String
  topicId   String

  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  topic     Topic   @relation(fields: [topicId], references: [id], onDelete: Cascade)

  @@id([projectId, topicId])
  @@index([topicId])
}
```

---

## Materialized Path Rules

### Path Format

* Root topic: `/slug`
* Child topic: `parent.path + '/' + slug`

Examples:

* Craft → `/craft`
* Fiber Art → `/craft/fiber-art`
* Sewing → `/craft/fiber-art/sewing`

### Path Responsibilities

* `path` is set at Topic creation time
* `path` must always reflect the current ancestry
* Moving or renaming a Topic requires updating all descendant paths

Path updates are restricted to admin-only operations.

---

## Constraints and Invariants

* A Topic may have **only one parent**
* A Topic may not be its own parent
* Cycles are forbidden
* `slug` and `aliasSlug` must be globally unique
* Deprecated Topics:

  * remain valid for existing content
  * cannot be selected for new content

---

## Query Patterns (Conceptual)

### Descendant Topics

Descendants of a Topic are identified by prefix-matching on `path`.

Conceptual logic:

```
path == topic.path
OR
path startsWith topic.path + '/'
```

### Projects under a Topic

A Project belongs to a Topic if it is tagged with:

* the Topic itself, or
* any descendant Topic

---

## Intentional Omissions

This schema does **not** include:

* multiple parents per Topic
* graph or "related topic" edges
* user-generated Topics without review
* automatic Topic creation from tags

These are deferred until validated by real usage.

---

## Summary

This schema establishes a stable, maintainable foundation for:

* interest-based discovery
* transparent browsing
* long-term taxonomy evolution

It favors clarity and control over premature flexibility.
