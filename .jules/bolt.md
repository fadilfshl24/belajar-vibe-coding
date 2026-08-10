# Bolt Journal
## 2023-11-20 - [Fixing N+1 Queries on Items Batch Operations]
**Learning:** Found multiple instances where the application iterates sequentially using a `for` loop to execute database queries. Specifically, `src/modules/item/item.model.ts` had a `for` loop that ran sequential validation and insertions when creating/updating items.
**Action:** Replace looped individual db calls in Drizzle with batch reads using `where(inArray(table.id, arrayIds))` + a `Map` structure to enable O(1) in-memory checks, and bulk insert values array to cut N queries down to a single query. Check codebase for loops when doing any CRUD operation.
## 2026-07-15 - [Fixing N+1 Queries on Inventory Transaction Operations]
**Learning:** Found N+1 sequential database reads/writes occurring in a loop during transaction finalization (complete/cancel) in `src/modules/transaction/transaction.service.ts`.
**Action:** Replace `for` loop database `SELECT`s with an array mapping of `itemId`s, fetching a single `inArray` query into a Map for O(1) checks. For modifications, push new entry objects into an array to bulk `insert`, and push update promises into an array to run `Promise.all(updatePromises)`, eliminating N+1 sequential blocking ops.
## 2026-08-10 - [Fixing N+1 Queries on isStockLocked in TransactionService]
**Learning:** The `completeTransaction` method called `isStockLocked` in a loop for each item in a transaction, leading to N+1 sequential database queries to check for locked stocks. Since this occurs inside an "OUT" transaction validation logic, this can be a severe bottleneck for large outbound transactions.
**Action:** Refactored to fetch all locked items in a single query using `inArray` before the loop. Extracted item IDs, called a new batched method `getLockedStockItems` that returns a Set of locked `itemId`s, and performed O(1) in-memory lookups instead.
