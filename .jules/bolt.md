## 2026-07-17 - Prevent N+1 queries in loops with DB operations
**Learning:** Found N+1 database queries happening inside service transaction loops when fetching single row records (e.g. inventory stocks based on item ID) in `TransactionService`. This can cause performance bottlenecks when transaction arrays are large.
**Action:** When iterating over arrays (like transaction items or details), pre-fetch all necessary related records before the loop using `inArray()` with `map()` extraction, and store them in a `Map` structure for O(1) memory lookup inside the loop.
