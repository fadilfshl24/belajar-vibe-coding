# Bolt Journal
## 2023-11-20 - [Fixing N+1 Queries on Items Batch Operations]
**Learning:** Found multiple instances where the application iterates sequentially using a `for` loop to execute database queries. Specifically, `src/modules/item/item.model.ts` had a `for` loop that ran sequential validation and insertions when creating/updating items.
**Action:** Replace looped individual db calls in Drizzle with batch reads using `where(inArray(table.id, arrayIds))` + a `Map` structure to enable O(1) in-memory checks, and bulk insert values array to cut N queries down to a single query. Check codebase for loops when doing any CRUD operation.
## 2026-07-15 - [Fixing N+1 Queries on Inventory Transaction Operations]
**Learning:** Found N+1 sequential database reads/writes occurring in a loop during transaction finalization (complete/cancel) in `src/modules/transaction/transaction.service.ts`.
**Action:** Replace `for` loop database `SELECT`s with an array mapping of `itemId`s, fetching a single `inArray` query into a Map for O(1) checks. For modifications, push new entry objects into an array to bulk `insert`, and push update promises into an array to run `Promise.all(updatePromises)`, eliminating N+1 sequential blocking ops.

## 2025-02-12 - N+1 Query in Controller Transaction Map Iteration
**Learning:** In Drizzle ORM workflows where Excel/bulk imports build a large `Map` and then iterate over `.entries()` to insert data, fetching existence checks (like `findByTrackingId`) inside the transaction loop introduces an O(N) database bottleneck. This happens because the transaction iterates row-by-row sequentially.
**Action:** Always extract the unique keys from the `Map` (e.g. `Array.from(map.keys())`) before the transaction loop, execute a single `inArray` query to find existing records, store them in a `Set`, and perform an O(1) existence check inside the loop. When refactoring, preserve the original single-lookup method for backward compatibility in other parts of the codebase.
