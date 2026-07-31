# Bolt Journal
## 2023-11-20 - [Fixing N+1 Queries on Items Batch Operations]
**Learning:** Found multiple instances where the application iterates sequentially using a `for` loop to execute database queries. Specifically, `src/modules/item/item.model.ts` had a `for` loop that ran sequential validation and insertions when creating/updating items.
**Action:** Replace looped individual db calls in Drizzle with batch reads using `where(inArray(table.id, arrayIds))` + a `Map` structure to enable O(1) in-memory checks, and bulk insert values array to cut N queries down to a single query. Check codebase for loops when doing any CRUD operation.
## 2026-07-15 - [Fixing N+1 Queries on Inventory Transaction Operations]
**Learning:** Found N+1 sequential database reads/writes occurring in a loop during transaction finalization (complete/cancel) in `src/modules/transaction/transaction.service.ts`.
**Action:** Replace `for` loop database `SELECT`s with an array mapping of `itemId`s, fetching a single `inArray` query into a Map for O(1) checks. For modifications, push new entry objects into an array to bulk `insert`, and push update promises into an array to run `Promise.all(updatePromises)`, eliminating N+1 sequential blocking ops.

## 2026-07-31 - [Replacing N+1 Sequential Reads on Order Transactions]
**Learning:** In Drizzle ORM workflows where a sequential loop updates database entries based on stock existence, replacing internal reads with a bulk `inArray` read followed by map checking cuts query latency by N operations. Note: It's vital to update the memory map when sequentially modifying records, as duplicates within the iteration will cause false state bypasses.
**Action:** Bulk select records outside loops and put them into a Map object for sequential iteration. When executing updates against the map's elements, manually decrement/increment the map's properties to maintain an accurate rolling state throughout the loop execution.
