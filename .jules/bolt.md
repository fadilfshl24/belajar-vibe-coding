# Bolt Journal
## 2023-11-20 - [Fixing N+1 Queries on Items Batch Operations]
**Learning:** Found multiple instances where the application iterates sequentially using a `for` loop to execute database queries. Specifically, `src/modules/item/item.model.ts` had a `for` loop that ran sequential validation and insertions when creating/updating items.
**Action:** Replace looped individual db calls in Drizzle with batch reads using `where(inArray(table.id, arrayIds))` + a `Map` structure to enable O(1) in-memory checks, and bulk insert values array to cut N queries down to a single query. Check codebase for loops when doing any CRUD operation.
## 2026-07-15 - [Fixing N+1 Queries on Inventory Transaction Operations]
**Learning:** Found N+1 sequential database reads/writes occurring in a loop during transaction finalization (complete/cancel) in `src/modules/transaction/transaction.service.ts`.
**Action:** Replace `for` loop database `SELECT`s with an array mapping of `itemId`s, fetching a single `inArray` query into a Map for O(1) checks. For modifications, push new entry objects into an array to bulk `insert`, and push update promises into an array to run `Promise.all(updatePromises)`, eliminating N+1 sequential blocking ops.
## 2025-02-27 - [Type Safety with Drizzle ORM inArray]
**Learning:** When refactoring Drizzle ORM N+1 queries, you should avoid typing result sets as `any[]`. This sacrifices TypeScript safety. Furthermore, when creating deduplicated IDs to pass into `inArray`, ensure the array matches the type of the database column exactly (e.g. `const itemIds = [...new Set(arr.map(x => x.itemId))] as string[]` rather than `String(x.itemId)`) to maintain type safety and avoid passing improperly coerced elements.
**Action:** Always correctly map Drizzle return types using manual interfaces if type inference breaks across scopes, and ensure arguments to `inArray` match the schema column's primitive type.
