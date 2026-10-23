## 2026-07-22 - Drizzle ORM inArray edge case
**Learning:** When passing an array to Drizzle's `inArray()` operator to batch queries, passing an empty array will throw a runtime error in Drizzle rather than returning an empty set.
**Action:** Always wrap `inArray()` queries with an early return if the array is empty: `if (!itemIds.length) return [];`
