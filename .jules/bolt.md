# Bolt Journal
## 2023-11-20 - [Fixing N+1 Queries on Items Batch Operations]
**Learning:** Found multiple instances where the application iterates sequentially using a `for` loop to execute database queries. Specifically, `src/modules/item/item.model.ts` had a `for` loop that ran sequential validation and insertions when creating/updating items.
**Action:** Replace looped individual db calls in Drizzle with batch reads using `where(inArray(table.id, arrayIds))` + a `Map` structure to enable O(1) in-memory checks, and bulk insert values array to cut N queries down to a single query. Check codebase for loops when doing any CRUD operation.
## 2026-07-15 - [Fixing N+1 Queries on Inventory Transaction Operations]
**Learning:** Found N+1 sequential database reads/writes occurring in a loop during transaction finalization (complete/cancel) in `src/modules/transaction/transaction.service.ts`.
**Action:** Replace `for` loop database `SELECT`s with an array mapping of `itemId`s, fetching a single `inArray` query into a Map for O(1) checks. For modifications, push new entry objects into an array to bulk `insert`, and push update promises into an array to run `Promise.all(updatePromises)`, eliminating N+1 sequential blocking ops.
## 2025-02-18 - [Drizzle ORM N+1 with Promise.all]
**Learning:** Using `Promise.all(arr.map(async () => db.select()))` generates an N+1 query problem, which is especially problematic when scanning outbound orders that may have multiple items. It creates multiple round-trips to the database instead of one.
**Action:** Replace `Promise.all` with a single `inArray` query. Extract unique IDs (`[...new Set(arr.map(id))]`), handle the empty array check (`if(ids.length > 0)`), use a batched query, and structure results in an in-memory `Map` for O(1) lookups during synchronous mapping.
