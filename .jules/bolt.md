# Bolt Journal
## 2023-11-20 - [Fixing N+1 Queries on Items Batch Operations]
**Learning:** Found multiple instances where the application iterates sequentially using a `for` loop to execute database queries. Specifically, `src/modules/item/item.model.ts` had a `for` loop that ran sequential validation and insertions when creating/updating items.
**Action:** Replace looped individual db calls in Drizzle with batch reads using `where(inArray(table.id, arrayIds))` + a `Map` structure to enable O(1) in-memory checks, and bulk insert values array to cut N queries down to a single query. Check codebase for loops when doing any CRUD operation.
## 2026-07-15 - [Fixing N+1 Queries on Inventory Transaction Operations]
**Learning:** Found N+1 sequential database reads/writes occurring in a loop during transaction finalization (complete/cancel) in `src/modules/transaction/transaction.service.ts`.
**Action:** Replace `for` loop database `SELECT`s with an array mapping of `itemId`s, fetching a single `inArray` query into a Map for O(1) checks. For modifications, push new entry objects into an array to bulk `insert`, and push update promises into an array to run `Promise.all(updatePromises)`, eliminating N+1 sequential blocking ops.

## 2024-03-20 - Raw SQL CASE Statement Overwrites

**Learning:** When using raw SQL `CASE` statements to perform bulk updates in Drizzle ORM to resolve N+1 queries, failing to pre-aggregate data (e.g., when a request loop updates the same target ID multiple times) will cause the database to execute the `CASE` sequentially. Since SQL `CASE` stops at the first `WHEN` match, only the first update will be applied, causing data loss (e.g., missed increments).

**Action:** Always pre-aggregate data in-memory (e.g., incrementing values inside a Map or Set) *before* constructing the dynamic SQL `CASE` statement to ensure only the final aggregated value per ID is passed to the database.
