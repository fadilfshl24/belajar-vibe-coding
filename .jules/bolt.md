## 2024-05-23 - Avoiding N+1 queries in transactions
**Learning:** Performing `select` queries on the global `db` object inside a transaction loop leads to N+1 query problems and can exhaust database connections or cause deadlocks.
**Action:** Extract all required lookup keys before the transaction and execute a single batched `IN` query to load the necessary existing states into a Set or Map in memory, replacing the inner-loop awaitable database call with an O(1) memory lookup.
