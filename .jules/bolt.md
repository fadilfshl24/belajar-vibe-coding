# Bolt Journal
## 2023-11-20 - [Fixing N+1 Queries on Items Batch Operations]
**Learning:** Found multiple instances where the application iterates sequentially using a `for` loop to execute database queries. Specifically, `src/modules/item/item.model.ts` had a `for` loop that ran sequential validation and insertions when creating/updating items.
**Action:** Replace looped individual db calls in Drizzle with batch reads using `where(inArray(table.id, arrayIds))` + a `Map` structure to enable O(1) in-memory checks, and bulk insert values array to cut N queries down to a single query. Check codebase for loops when doing any CRUD operation.
## 2026-07-15 - [Fixing N+1 Queries on Inventory Transaction Operations]
**Learning:** Found N+1 sequential database reads/writes occurring in a loop during transaction finalization (complete/cancel) in `src/modules/transaction/transaction.service.ts`.
**Action:** Replace `for` loop database `SELECT`s with an array mapping of `itemId`s, fetching a single `inArray` query into a Map for O(1) checks. For modifications, push new entry objects into an array to bulk `insert`, and push update promises into an array to run `Promise.all(updatePromises)`, eliminating N+1 sequential blocking ops.

## 2026-08-03 - [Eliminating N+1 Queries in Drizzle ORM Transactions]
**Learning:** Using an ORM inside a loop (especially inside a transaction loop) can easily cause an N+1 query pattern where queries are executed sequentially. This heavily degrades performance. In Drizzle ORM, instead of running a query for each item in an array, it's significantly more efficient to map the array to a list of IDs and fetch all relevant records in a single query using the `inArray` operator, and then mapping the results.
**Action:** Always inspect loops containing `await` for database queries. If a query is based on an item property inside the loop, extract the IDs first, do a single `inArray` query before the loop, and use a `Set` or `Map` to look up values inside the loop.
