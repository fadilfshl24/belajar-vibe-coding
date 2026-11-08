## 2024-05-12 - Goods Receipt Model Batch Update Optimization
**Learning:** Using raw SQL CASE statement chunks directly inside Drizzle's set method effectively removes sequential loops and N+1 query patterns during bulk updates, especially useful in backend transaction updates.
**Action:** Identify and rewrite subsequent update loops matching this signature to use `inArray` + pre-aggregation + SQL Case chunk batch updates.

## 2024-05-12 - Goods Receipt Model Batch Update Optimization
**Learning:** Using raw SQL CASE statement chunks directly inside Drizzle's set method effectively removes sequential loops and N+1 query patterns during bulk updates, especially useful in backend transaction updates.
**Action:** Identify and rewrite subsequent update loops matching this signature to use `inArray` + pre-aggregation + SQL Case chunk batch updates.
