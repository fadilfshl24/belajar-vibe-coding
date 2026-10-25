# Bolt Journal
## 2023-11-20 - [Fixing N+1 Queries on Items Batch Operations]
**Learning:** Found multiple instances where the application iterates sequentially using a `for` loop to execute database queries. Specifically, `src/modules/item/item.model.ts` had a `for` loop that ran sequential validation and insertions when creating/updating items.
**Action:** Replace looped individual db calls in Drizzle with batch reads using `where(inArray(table.id, arrayIds))` + a `Map` structure to enable O(1) in-memory checks, and bulk insert values array to cut N queries down to a single query. Check codebase for loops when doing any CRUD operation.
## 2026-07-15 - [Fixing N+1 Queries on Inventory Transaction Operations]
**Learning:** Found N+1 sequential database reads/writes occurring in a loop during transaction finalization (complete/cancel) in `src/modules/transaction/transaction.service.ts`.
**Action:** Replace `for` loop database `SELECT`s with an array mapping of `itemId`s, fetching a single `inArray` query into a Map for O(1) checks. For modifications, push new entry objects into an array to bulk `insert`, and push update promises into an array to run `Promise.all(updatePromises)`, eliminating N+1 sequential blocking ops.

## 2023-10-25 - Resolved N+1 query in stock-order.model.ts by prefetching and grouping by packageItemId
**Learning:** `Promise.all` inside database loops is a classic N+1 query vulnerability that is easy to introduce when fetching details for a list of items. In `src/modules/stock-order/stock-order.model.ts`, mapping over `rawPlatformItems` and executing a separate `.select()` for each item creates a bottleneck.
**Action:** Replace `Promise.all` + `.select()` inside loops with a single batched `.select()` using `inArray` to fetch all necessary data at once, then group the results in-memory using a `Map` before mapping them back to the original items.
