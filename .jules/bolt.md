# Bolt Journal
## 2023-11-20 - [Fixing N+1 Queries on Items Batch Operations]
**Learning:** Found multiple instances where the application iterates sequentially using a `for` loop to execute database queries. Specifically, `src/modules/item/item.model.ts` had a `for` loop that ran sequential validation and insertions when creating/updating items.
**Action:** Replace looped individual db calls in Drizzle with batch reads using `where(inArray(table.id, arrayIds))` + a `Map` structure to enable O(1) in-memory checks, and bulk insert values array to cut N queries down to a single query. Check codebase for loops when doing any CRUD operation.
## 2026-07-15 - [Fixing N+1 Queries on Inventory Transaction Operations]
**Learning:** Found N+1 sequential database reads/writes occurring in a loop during transaction finalization (complete/cancel) in `src/modules/transaction/transaction.service.ts`.
**Action:** Replace `for` loop database `SELECT`s with an array mapping of `itemId`s, fetching a single `inArray` query into a Map for O(1) checks. For modifications, push new entry objects into an array to bulk `insert`, and push update promises into an array to run `Promise.all(updatePromises)`, eliminating N+1 sequential blocking ops.

## 2024-05-30 - Fix N+1 Query Using inArray and Group By in Drizzle
**Learning:** When executing a complex query for child items within a `Promise.all` inside a loop, it results in an N+1 query pattern. Even if the array is small, eliminating this database round trip provides a noticeable speed up in backend request processing. Furthermore, when creating an array using `inArray`, we should deduplicate the IDs first to ensure the SQL `IN (...)` parameter list is as small as possible.
**Action:** Always replace database queries inside map iterations with a single query using `inArray` based on the gathered IDs, and build an in-memory grouping mapping (e.g. `reduce`) to map the items back for O(1) performance lookup inside the mapping loop. Ensure handling of empty ID arrays to prevent Drizzle ORM errors.
