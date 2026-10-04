# Bolt Journal
## 2023-11-20 - [Fixing N+1 Queries on Items Batch Operations]
**Learning:** Found multiple instances where the application iterates sequentially using a `for` loop to execute database queries. Specifically, `src/modules/item/item.model.ts` had a `for` loop that ran sequential validation and insertions when creating/updating items.
**Action:** Replace looped individual db calls in Drizzle with batch reads using `where(inArray(table.id, arrayIds))` + a `Map` structure to enable O(1) in-memory checks, and bulk insert values array to cut N queries down to a single query. Check codebase for loops when doing any CRUD operation.
## 2026-07-15 - [Fixing N+1 Queries on Inventory Transaction Operations]
**Learning:** Found N+1 sequential database reads/writes occurring in a loop during transaction finalization (complete/cancel) in `src/modules/transaction/transaction.service.ts`.
**Action:** Replace `for` loop database `SELECT`s with an array mapping of `itemId`s, fetching a single `inArray` query into a Map for O(1) checks. For modifications, push new entry objects into an array to bulk `insert`, and push update promises into an array to run `Promise.all(updatePromises)`, eliminating N+1 sequential blocking ops.

## 2024-05-18 - Safe Batching with Drizzle SQL CASE Updates
**Learning:** When using raw SQL `CASE` statements for bulk updates in Drizzle, always pre-aggregate data if there is a possibility of multiple update sources targeting the same ID. A SQL `CASE` evaluates sequentially and returns on the first match, which can cause silent overwrites or missed increments without pre-aggregation. Construct one `WHEN` block per unique ID.
**Action:** When resolving N+1 loops, mutate the in-memory state objects directly during loops, and construct the single update `CASE` loop *after* aggregating unique IDs from the modified Map objects.
