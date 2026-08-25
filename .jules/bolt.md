# Bolt Journal
## 2023-11-20 - [Fixing N+1 Queries on Items Batch Operations]
**Learning:** Found multiple instances where the application iterates sequentially using a `for` loop to execute database queries. Specifically, `src/modules/item/item.model.ts` had a `for` loop that ran sequential validation and insertions when creating/updating items.
**Action:** Replace looped individual db calls in Drizzle with batch reads using `where(inArray(table.id, arrayIds))` + a `Map` structure to enable O(1) in-memory checks, and bulk insert values array to cut N queries down to a single query. Check codebase for loops when doing any CRUD operation.
## 2026-07-15 - [Fixing N+1 Queries on Inventory Transaction Operations]
**Learning:** Found N+1 sequential database reads/writes occurring in a loop during transaction finalization (complete/cancel) in `src/modules/transaction/transaction.service.ts`.
**Action:** Replace `for` loop database `SELECT`s with an array mapping of `itemId`s, fetching a single `inArray` query into a Map for O(1) checks. For modifications, push new entry objects into an array to bulk `insert`, and push update promises into an array to run `Promise.all(updatePromises)`, eliminating N+1 sequential blocking ops.
## 2026-08-25 - [Batched Drizzle Queries]
**Learning:** Drizzle ORM supports `inArray` to batch lookups, but it's important to pre-check if the array is empty (`uniquePrIds.length > 0`) before executing it to prevent query failures. Also it's possible to batch updates for simple statuses by filtering with `inArray` on the primary keys.
**Action:** When converting N+1 queries in loops to batched queries, use `inArray`, ensure to deduplicate the array with `[...new Set(ids)]`, handle empty arrays, and map the fetched data back to a Map or dictionary by their foreign keys for O(1) loop processing.
