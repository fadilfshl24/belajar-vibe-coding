# Bolt Journal
## 2023-11-20 - [Fixing N+1 Queries on Items Batch Operations]
**Learning:** Found multiple instances where the application iterates sequentially using a `for` loop to execute database queries. Specifically, `src/modules/item/item.model.ts` had a `for` loop that ran sequential validation and insertions when creating/updating items.
**Action:** Replace looped individual db calls in Drizzle with batch reads using `where(inArray(table.id, arrayIds))` + a `Map` structure to enable O(1) in-memory checks, and bulk insert values array to cut N queries down to a single query. Check codebase for loops when doing any CRUD operation.
## 2026-07-15 - [Fixing N+1 Queries on Inventory Transaction Operations]
**Learning:** Found N+1 sequential database reads/writes occurring in a loop during transaction finalization (complete/cancel) in `src/modules/transaction/transaction.service.ts`.
**Action:** Replace `for` loop database `SELECT`s with an array mapping of `itemId`s, fetching a single `inArray` query into a Map for O(1) checks. For modifications, push new entry objects into an array to bulk `insert`, and push update promises into an array to run `Promise.all(updatePromises)`, eliminating N+1 sequential blocking ops.
## 2025-02-23 - [N+1 query problem with transaction locking validation]
**Learning:** During validation of outgoing transactions (`completeTransaction`), a database query checking if an item is locked (`isStockLocked`) was executed inside a `for...of` loop over each transaction item. The missing `inArray` import was present but it's important to remember to verify imports. Temporary test files create clutter that blocks code review and merge.
**Action:** Always clean up temporary debug scripts using `rm` after confirming logic or use a specific scratch folder, and verify new variables or external functions like `inArray` are properly imported in the destination file before sending for review.
