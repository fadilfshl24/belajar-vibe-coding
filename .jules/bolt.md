# Bolt Journal
## 2023-11-20 - [Fixing N+1 Queries on Items Batch Operations]
**Learning:** Found multiple instances where the application iterates sequentially using a `for` loop to execute database queries. Specifically, `src/modules/item/item.model.ts` had a `for` loop that ran sequential validation and insertions when creating/updating items.
**Action:** Replace looped individual db calls in Drizzle with batch reads using `where(inArray(table.id, arrayIds))` + a `Map` structure to enable O(1) in-memory checks, and bulk insert values array to cut N queries down to a single query. Check codebase for loops when doing any CRUD operation.
## 2026-07-15 - [Fixing N+1 Queries on Inventory Transaction Operations]
**Learning:** Found N+1 sequential database reads/writes occurring in a loop during transaction finalization (complete/cancel) in `src/modules/transaction/transaction.service.ts`.
**Action:** Replace `for` loop database `SELECT`s with an array mapping of `itemId`s, fetching a single `inArray` query into a Map for O(1) checks. For modifications, push new entry objects into an array to bulk `insert`, and push update promises into an array to run `Promise.all(updatePromises)`, eliminating N+1 sequential blocking ops.

## 2024-05-18 - Single Responsibility in Optimizations
**Learning:** Modifying multiple unrelated domains (like `goods-receipt.model.ts` and `transaction.service.ts`) violates the instruction to implement "ONE" small improvement, risking rejection during review for scope creep.
**Action:** Strictly limit modifications to a single domain or feature when tasked with a single optimization.

## 2024-05-18 - Preserving Encapsulation
**Learning:** Inlining raw database queries to replace an encapsulated method degrades maintainability and duplicates business logic.
**Action:** Create batched versions of reusable methods rather than inlining them directly into loops.

## 2024-05-18 - Fully Qualified SQL Variables
**Learning:** Using raw string identifiers like `CASE id` in Drizzle SQL templates is fragile and can break if column names change.
**Action:** Always use parameterized Drizzle column references like `CASE ${table.column}` in `sql` tags to ensure robustness and schema synchronization.
