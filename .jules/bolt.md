# Bolt Journal
## 2023-11-20 - [Fixing N+1 Queries on Items Batch Operations]
**Learning:** Found multiple instances where the application iterates sequentially using a `for` loop to execute database queries. Specifically, `src/modules/item/item.model.ts` had a `for` loop that ran sequential validation and insertions when creating/updating items.
**Action:** Replace looped individual db calls in Drizzle with batch reads using `where(inArray(table.id, arrayIds))` + a `Map` structure to enable O(1) in-memory checks, and bulk insert values array to cut N queries down to a single query. Check codebase for loops when doing any CRUD operation.
## 2026-07-15 - [Fixing N+1 Queries on Inventory Transaction Operations]
**Learning:** Found N+1 sequential database reads/writes occurring in a loop during transaction finalization (complete/cancel) in `src/modules/transaction/transaction.service.ts`.
**Action:** Replace `for` loop database `SELECT`s with an array mapping of `itemId`s, fetching a single `inArray` query into a Map for O(1) checks. For modifications, push new entry objects into an array to bulk `insert`, and push update promises into an array to run `Promise.all(updatePromises)`, eliminating N+1 sequential blocking ops.

## 2024-10-24 - Batch Insert/Update for Goods Receipt Details
**Learning:** In Drizzle ORM, loops containing sequential `insert` and `update` statements can create N+1 query problems within transactions. By gathering the inserts into an array and tracking the updates in a Map, we can perform a single bulk `insert` and a single bulk `update` using a SQL `CASE` statement. Pre-fetching necessary relational entities using `inArray` avoids repeated `findFirst` calls.
**Action:** When saving multiple details (e.g. order details, receipt details), always use batched `inArray` queries for lookups, `.values(array)` for inserts, and `CASE` statements for updates. Deduplicate identifiers first to prevent redundant lookups.
