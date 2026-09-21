# Bolt Journal
## 2023-11-20 - [Fixing N+1 Queries on Items Batch Operations]
**Learning:** Found multiple instances where the application iterates sequentially using a `for` loop to execute database queries. Specifically, `src/modules/item/item.model.ts` had a `for` loop that ran sequential validation and insertions when creating/updating items.
**Action:** Replace looped individual db calls in Drizzle with batch reads using `where(inArray(table.id, arrayIds))` + a `Map` structure to enable O(1) in-memory checks, and bulk insert values array to cut N queries down to a single query. Check codebase for loops when doing any CRUD operation.
## 2026-07-15 - [Fixing N+1 Queries on Inventory Transaction Operations]
**Learning:** Found N+1 sequential database reads/writes occurring in a loop during transaction finalization (complete/cancel) in `src/modules/transaction/transaction.service.ts`.
**Action:** Replace `for` loop database `SELECT`s with an array mapping of `itemId`s, fetching a single `inArray` query into a Map for O(1) checks. For modifications, push new entry objects into an array to bulk `insert`, and push update promises into an array to run `Promise.all(updatePromises)`, eliminating N+1 sequential blocking ops.

## 2024-05-30 - [Do not confuse in-memory Map lookup with DB records]
**Learning:** When using an in-memory Map to store fetched database stocks and tracking inserts in a separate array `insertPayloads`, DO NOT add newly constructed insert payload objects into the Map representing database state if subsequent loops check the map for existence (e.g., `const stock = stockMap.get(...)`). If you do, the loop will mistake the newly constructed object (which lacks an 'id') for an existing database record, attempting to update it using Drizzle SQL with `id = undefined`, causing a runtime crash.
**Action:** When handling duplicates during bulk updates/inserts, keep the `insertPayloads` tracking strictly separated from the `stockMap` representing actual database rows. Use a `.find()` on `insertPayloads` for duplicates instead of injecting them into the DB state map.
