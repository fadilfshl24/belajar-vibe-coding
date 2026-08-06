# Bolt Journal
## 2023-11-20 - [Fixing N+1 Queries on Items Batch Operations]
**Learning:** Found multiple instances where the application iterates sequentially using a `for` loop to execute database queries. Specifically, `src/modules/item/item.model.ts` had a `for` loop that ran sequential validation and insertions when creating/updating items.
**Action:** Replace looped individual db calls in Drizzle with batch reads using `where(inArray(table.id, arrayIds))` + a `Map` structure to enable O(1) in-memory checks, and bulk insert values array to cut N queries down to a single query. Check codebase for loops when doing any CRUD operation.
## 2026-07-15 - [Fixing N+1 Queries on Inventory Transaction Operations]
**Learning:** Found N+1 sequential database reads/writes occurring in a loop during transaction finalization (complete/cancel) in `src/modules/transaction/transaction.service.ts`.
**Action:** Replace `for` loop database `SELECT`s with an array mapping of `itemId`s, fetching a single `inArray` query into a Map for O(1) checks. For modifications, push new entry objects into an array to bulk `insert`, and push update promises into an array to run `Promise.all(updatePromises)`, eliminating N+1 sequential blocking ops.
## 2025-02-23 - [N+1 Query in Quotation Plan Approval]
**Learning:** Found an N+1 query loop in `src/modules/quotation-plan/quotation-plan.model.ts` inside `QuotationPlanModel.approve` where it queries PR details and updates PR status for each PR individually within a `for...of` loop.
**Action:** Deduplicate PR IDs and use Drizzle ORM's `inArray` to batch fetch details and batch update the matching purchase requests in a single round-trip, significantly reducing database calls. Ensure to handle empty array conditions for `inArray`.
