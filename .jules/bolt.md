# Bolt Journal
## 2023-11-20 - [Fixing N+1 Queries on Items Batch Operations]
**Learning:** Found multiple instances where the application iterates sequentially using a `for` loop to execute database queries. Specifically, `src/modules/item/item.model.ts` had a `for` loop that ran sequential validation and insertions when creating/updating items.
**Action:** Replace looped individual db calls in Drizzle with batch reads using `where(inArray(table.id, arrayIds))` + a `Map` structure to enable O(1) in-memory checks, and bulk insert values array to cut N queries down to a single query. Check codebase for loops when doing any CRUD operation.
## 2026-07-15 - [Fixing N+1 Queries on Inventory Transaction Operations]
**Learning:** Found N+1 sequential database reads/writes occurring in a loop during transaction finalization (complete/cancel) in `src/modules/transaction/transaction.service.ts`.
**Action:** Replace `for` loop database `SELECT`s with an array mapping of `itemId`s, fetching a single `inArray` query into a Map for O(1) checks. For modifications, push new entry objects into an array to bulk `insert`, and push update promises into an array to run `Promise.all(updatePromises)`, eliminating N+1 sequential blocking ops.
## 2024-11-20 - Fix N+1 query in transaction.service.ts
**Learning:** Found an N+1 query bottleneck inside `TransactionService.completeTransaction`, where `isStockLocked` was repeatedly called in a loop for each item. Additionally, learned the precise sequence of bash commands to bootstrap PostgreSQL in the sandbox (apt-get install, service start, `sudo -u postgres psql`, setting `trust` in `pg_hba.conf`). Temporary shell and python scripts must be cleaned up before committing to pass code reviews.
**Action:** Next time, search for loops over arrays executing database queries. Refactor them using batched methods like `getLockedItems` with `inArray` to convert N queries into 1. Make sure to delete any temporary scripts before submitting code.
