# Bolt Journal
## 2023-11-20 - [Fixing N+1 Queries on Items Batch Operations]
**Learning:** Found multiple instances where the application iterates sequentially using a `for` loop to execute database queries. Specifically, `src/modules/item/item.model.ts` had a `for` loop that ran sequential validation and insertions when creating/updating items.
**Action:** Replace looped individual db calls in Drizzle with batch reads using `where(inArray(table.id, arrayIds))` + a `Map` structure to enable O(1) in-memory checks, and bulk insert values array to cut N queries down to a single query. Check codebase for loops when doing any CRUD operation.
## 2026-07-15 - [Fixing N+1 Queries on Inventory Transaction Operations]
**Learning:** Found N+1 sequential database reads/writes occurring in a loop during transaction finalization (complete/cancel) in `src/modules/transaction/transaction.service.ts`.
**Action:** Replace `for` loop database `SELECT`s with an array mapping of `itemId`s, fetching a single `inArray` query into a Map for O(1) checks. For modifications, push new entry objects into an array to bulk `insert`, and push update promises into an array to run `Promise.all(updatePromises)`, eliminating N+1 sequential blocking ops.
## 2025-02-27 - [Batched Update with Drizzle Case Statement]
**Learning:** [Dynamic SQL expressions such as CASE statements built with sql chunks can be passed directly to the .set() method to perform batched updates avoiding N+1 queries. It's important to pre-aggregate data in a Map to avoid overwriting or missed increments inside the CASE statements if multiple updates point to the same ID.]
**Action:** [Next time I need to solve an N+1 issue involving DB updates inside a loop, I'll leverage a map-aggregated CASE statement and Drizzle's sql.join directly in the set method.]
