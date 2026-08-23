## 2025-02-18 - [Drizzle Typescript SQL Namespace Error]
**Learning:** When dynamically constructing SQL chunks in Drizzle ORM for operations like CASE statements, declaring the accumulator array as `sql[]` directly will trigger a TypeScript error: `Cannot use namespace 'sql' as a type`.
**Action:** Declare the accumulator array as `any[]` (or explicitly import and use the uppercase `SQL` type from `drizzle-orm`) to avoid TypeScript namespace collisions.
