# Bolt Journal
## 2023-11-20 - [Fixing N+1 Queries on Items Batch Operations]
**Learning:** Found multiple instances where the application iterates sequentially using a `for` loop to execute database queries. Specifically, `src/modules/item/item.model.ts` had a `for` loop that ran sequential validation and insertions when creating/updating items.
**Action:** Replace looped individual db calls in Drizzle with batch reads using `where(inArray(table.id, arrayIds))` + a `Map` structure to enable O(1) in-memory checks, and bulk insert values array to cut N queries down to a single query. Check codebase for loops when doing any CRUD operation.
## 2026-07-15 - [Fixing N+1 Queries on Inventory Transaction Operations]
**Learning:** Found N+1 sequential database reads/writes occurring in a loop during transaction finalization (complete/cancel) in `src/modules/transaction/transaction.service.ts`.
**Action:** Replace `for` loop database `SELECT`s with an array mapping of `itemId`s, fetching a single `inArray` query into a Map for O(1) checks. For modifications, push new entry objects into an array to bulk `insert`, and push update promises into an array to run `Promise.all(updatePromises)`, eliminating N+1 sequential blocking ops.

## 2025-02-12 - Batched Query Updates with Drizzle ORM CASE Statements
**Learning:** When refactoring loop-based N+1 inserts/updates, relying on Drizzle ORM's `sql` tagged template literates allows for generating raw `CASE` statements to perform batched updates securely and effectively. However, when passing Javascript numbers (e.g. accumulating quantities) inside these template queries, Drizzle does not natively know the underlying DB type.
**Action:** When dynamically building `CASE` updates using `sql.join` in Drizzle, always map dependencies to Javascript values accurately in-memory first to aggregate state, and pass them parameterized via `${value}`. Ensure empty arrays are conditionally guarded before executing `inArray()` filters to prevent SQL compilation errors.
