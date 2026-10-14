# Bolt Journal
## 2023-11-20 - [Fixing N+1 Queries on Items Batch Operations]
**Learning:** Found multiple instances where the application iterates sequentially using a `for` loop to execute database queries. Specifically, `src/modules/item/item.model.ts` had a `for` loop that ran sequential validation and insertions when creating/updating items.
**Action:** Replace looped individual db calls in Drizzle with batch reads using `where(inArray(table.id, arrayIds))` + a `Map` structure to enable O(1) in-memory checks, and bulk insert values array to cut N queries down to a single query. Check codebase for loops when doing any CRUD operation.
## 2026-07-15 - [Fixing N+1 Queries on Inventory Transaction Operations]
**Learning:** Found N+1 sequential database reads/writes occurring in a loop during transaction finalization (complete/cancel) in `src/modules/transaction/transaction.service.ts`.
**Action:** Replace `for` loop database `SELECT`s with an array mapping of `itemId`s, fetching a single `inArray` query into a Map for O(1) checks. For modifications, push new entry objects into an array to bulk `insert`, and push update promises into an array to run `Promise.all(updatePromises)`, eliminating N+1 sequential blocking ops.

## 2024-05-18 - Replacing Loop Queries with inArray Needs Empty Check & GROUP BY
**Learning:** When refactoring an N+1 query loop to a batched `inArray` Drizzle query, you must check for empty arrays (to prevent Drizzle from throwing an error) and should ideally add `.groupBy()` (or `.distinct()`) on the target ID. Otherwise, if the join condition matches multiple rows (like a single item having multiple locks), you will unnecessarily pull hundreds of duplicated rows over the network only to drop them later in Javascript.
**Action:** Always verify `.length` before running `inArray`, and explicitly use `.groupBy()` in many-to-one or many-to-many joins where only existence/distinct values matter.
