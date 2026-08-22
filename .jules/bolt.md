## 2025-02-23 - [Optimize handleFinalApproval N+1 Queries]
**Learning:** In Drizzle ORM transactions, performing nested database calls like findMany or update inside loops can drastically degrade performance, acting as severe N+1 bottlenecks.
**Action:** Use batched operations with inArray in single queries by collecting IDs first, utilizing Sets to deduplicate them, and mapping results in-memory rather than relying on repeated database queries.
