# Bolt Journal
## 2023-11-20 - [Fixing N+1 Queries on Items Batch Operations]
**Learning:** Found multiple instances where the application iterates sequentially using a `for` loop to execute database queries. Specifically, `src/modules/item/item.model.ts` had a `for` loop that ran sequential validation and insertions when creating/updating items.
**Action:** Replace looped individual db calls in Drizzle with batch reads using `where(inArray(table.id, arrayIds))` + a `Map` structure to enable O(1) in-memory checks, and bulk insert values array to cut N queries down to a single query. Check codebase for loops when doing any CRUD operation.
## 2026-07-15 - [Fixing N+1 Queries on Inventory Transaction Operations]
**Learning:** Found N+1 sequential database reads/writes occurring in a loop during transaction finalization (complete/cancel) in `src/modules/transaction/transaction.service.ts`.
**Action:** Replace `for` loop database `SELECT`s with an array mapping of `itemId`s, fetching a single `inArray` query into a Map for O(1) checks. For modifications, push new entry objects into an array to bulk `insert`, and push update promises into an array to run `Promise.all(updatePromises)`, eliminating N+1 sequential blocking ops.
## 2024-03-24 - [Fixing N+1 DB operations on Quotation Plan approvals]
**Learning:** Found sequential processing in `src/modules/quotation-plan/quotation-plan.model.ts` during `handleFinalApproval` where PR IDs were queried inside a loop, and individual PR Details were fetched and updated one by one.
**Action:** Lift repeated queries out of loops, pre-aggregate modifications using a `Map`, use `CASE` statements constructed via `sql.join` to perform batch updates, and use `inArray` to fetch multiple IDs in a single query and perform bulk evaluations.
