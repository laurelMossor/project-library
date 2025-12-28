# Client/Server Code Boundaries in Next.js

## The Problem

When you import server-only code (like `prisma`, database clients, Node.js modules) into files that are used by client components, Next.js tries to bundle that code for the browser, which fails because browsers can't run Node.js code.

## How to Identify What's Safe Where

### 🚫 **SERVER-ONLY CODE** (Never import in client components):

1. **Database/ORM code:**
   - `prisma.ts` and anything that imports it
   - Any file that imports `@prisma/client`
   - Any file that imports `pg`, `mysql`, etc.

2. **Node.js built-in modules:**
   - `fs`, `path`, `crypto`, `dns`, `net`, `tls`, `http`, etc.
   - These will show errors like "Can't resolve 'fs'"

3. **Environment variables:**
   - Direct access to `process.env` (use `"use server"` or API routes)

4. **NextAuth server functions:**
   - `auth()` function (but `useSession()` is fine for client)

### ✅ **CLIENT-SAFE CODE** (Safe everywhere):

1. **Type definitions:**
   - `types/*.ts` files with only TypeScript types/interfaces
   - Type guards that only check properties (don't call functions)

2. **Pure utility functions:**
   - Functions that only transform data
   - No side effects, no async, no I/O

3. **React hooks and client utilities:**
   - Custom hooks (usually start with `use`)
   - Client-side state management

## Quick Decision Tree

```
Is this file used by a client component?
├─ YES → Can it import server-only code?
│   ├─ NO ❌ → Only import:
│   │   - Types
│   │   - Pure utility functions
│   │   - Client-safe utilities
│   │
│   └─ YES ✅ → Only if it's an API route or "use server" function
│
└─ NO (Server component only) → Can import anything ✅
```

## How to Check if a File is Client-Safe

### 1. **Look for `"use client"` directive:**
```typescript
"use client";  // ← This file will be bundled for browser
```

### 2. **Check the import chain:**
```
Your file → imports → imports → imports → server-only code?
```

If any file in the chain imports server-only code, your file cannot be used in client components.

### 3. **Common patterns to watch:**

**❌ BAD - Will break:**
```typescript
// utils/collection.ts (used by client component)
import { isProject } from "./project";  // project.ts imports prisma!

// project.ts
import { prisma } from "./prisma";  // ← Server-only!
```

**✅ GOOD - Safe:**
```typescript
// utils/collection.ts (used by client component)
import { isProject } from "../types/collection";  // types are safe!

// types/collection.ts
export function isProject(item: CollectionItem) {
  return item.type === "project";  // Just a type check, no server code
}
```

## Best Practices

### 1. **Separate by Purpose, Not by Feature**

**❌ DON'T organize like this:**
```
lib/
  project.ts          (has prisma + type guards + utilities mixed)
  event.ts            (has prisma + type guards + utilities mixed)
```

**✅ DO organize like this:**
```
lib/
  types/
    project.ts        (ONLY types)
    collection.ts     (types + pure type guards)
  utils/
    project.ts        (server functions: prisma, API calls)
    collection.ts     (pure utilities: filtering, sorting)
```

### 2. **Create a "Server Boundary"**

Mark server-only files clearly:
```typescript
// lib/utils/prisma.ts
// ⚠️ SERVER-ONLY: This file imports Node.js modules
// Do not import this in client components!
import { Pool } from "pg";
```

### 3. **Move Type Guards to Type Files**

Type guards are usually pure functions - put them in `types/` files:
```typescript
// types/collection.ts ✅
export function isProject(item: CollectionItem): item is ProjectItem {
  return item.type === "project";
}

// utils/project.ts ❌ (if used by client components)
// Keep prisma operations here, not type guards
```

### 4. **Use "use server" for Server Actions**

If you need to call server code from client, use server actions:
```typescript
// app/actions/project.ts
"use server";

import { prisma } from "@/lib/utils/prisma";

export async function createProject(data: ProjectData) {
  // Server code here
}
```

## Red Flags 🚩

If you see these, check your imports:

1. **Build errors mentioning Node.js modules:**
   - `Can't resolve 'fs'`, `Can't resolve 'net'`, etc.
   - Usually means `pg` or another Node module got bundled

2. **File imports prisma or database client:**
   - This file is server-only
   - Check if anything importing it is used in client components

3. **Type guard imports from utils file:**
   - Check if that utils file also has server code
   - Move type guard to types file instead

## Testing Your Changes

After moving code around:

1. **Build the app:**
   ```bash
   npm run build
   ```
   This will catch bundling issues immediately

2. **Check the import chain:**
   ```bash
   # Find all imports of a server-only file
   grep -r "from.*prisma" src/
   ```

3. **Verify client components:**
   - Look for `"use client"` directives
   - Trace their imports back to see if they touch server code

## Example: Safe File Structure

```
lib/
  types/
    collection.ts     ✅ Pure types + type guards (client-safe)
    project.ts        ✅ Pure types (client-safe)
    event.ts          ✅ Pure types (client-safe)
  
  utils/
    collection.ts     ✅ Pure utilities (client-safe)
    prisma.ts         ❌ Server-only (database client)
    project.ts        ❌ Server-only (prisma queries)
    event.ts          ❌ Server-only (prisma queries)
  
  components/
    CollectionCard.tsx  "use client" ✅ Can import from types/ or utils/collection.ts
    ProjectCard.tsx     "use client" ✅ Can import from types/, NOT utils/project.ts
```

## Quick Checklist

Before adding a function to a file, ask:

- [ ] Will this file be imported by a component with `"use client"`?
- [ ] Does this function need database access, file system, or Node.js APIs?
- [ ] Is this a pure utility (input → output, no side effects)?
- [ ] Is this just a type definition or type guard?

**If it's pure and might be used client-side:** Put it in `types/` or a pure `utils/` file  
**If it needs server access:** Put it in a server-only `utils/` file (one that imports prisma)

