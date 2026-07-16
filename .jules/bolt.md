## 2023-11-20 - [N+1 Query in Transaction Service]
**Learning:** Found a classic N+1 query issue in `transaction.service.ts` where the code was doing a `SELECT` query inside a loop for each item in a transaction to check stock levels.
**Action:** When updating multiple related records based on an array of input items, always aggregate the items first (to handle duplicates), batch fetch the required DB state using `inArray`, and then process the updates in memory/batch to avoid DB trips inside loops.
