# Bolt Journal
## 2023-11-20 - [Fixing N+1 Queries on Items Batch Operations]
**Learning:** Found multiple instances where the application iterates sequentially using a `for` loop to execute database queries. Specifically, `src/modules/item/item.model.ts` had a `for` loop that ran sequential validation and insertions when creating/updating items.
**Action:** Replace looped individual db calls in Drizzle with batch reads using `where(inArray(table.id, arrayIds))` + a `Map` structure to enable O(1) in-memory checks, and bulk insert values array to cut N queries down to a single query. Check codebase for loops when doing any CRUD operation.
## 2026-07-15 - [Fixing N+1 Queries on Inventory Transaction Operations]
**Learning:** Found N+1 sequential database reads/writes occurring in a loop during transaction finalization (complete/cancel) in `src/modules/transaction/transaction.service.ts`.
**Action:** Replace `for` loop database `SELECT`s with an array mapping of `itemId`s, fetching a single `inArray` query into a Map for O(1) checks. For modifications, push new entry objects into an array to bulk `insert`, and push update promises into an array to run `Promise.all(updatePromises)`, eliminating N+1 sequential blocking ops.
## 2024-10-03 - [Eliminating N+1 queries in Drizzle by Map-Batched Grouping]
**Learning:** When executing multiple DB queries inside a `Promise.all` inside `.map` to fetch related data (e.g., retrieving `itemPackageDetails` for multiple `rawPlatformItems`), it triggers N+1 queries. We can resolve this efficiently using Drizzle ORM's `inArray` to query all related items simultaneously, extracting unique IDs for batched queries, and then mapping the results back using a Javascript `Map` object for O(1) in-memory lookup.
**Action:** Always batch related queries using `inArray` combined with an in-memory `Map` or hash table for assigning related elements to parent objects, instead of nesting DB queries in a `Promise.all` inside map/for loops.
