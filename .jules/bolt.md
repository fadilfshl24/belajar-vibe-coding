## 2024-05-18 - [Bulk Insert Optimization]
**Learning:** [When dealing with bulk operations like importing excel files in Drizzle ORM, loops that contain an existence check (e.g., querying if a record exists before insertion) are a common source of N+1 query performance problems, as a single database call is made per loop iteration.]
**Action:** [Always pre-fetch all existing records using `inArray` or `in` operator in a single query outside the loop, mapping them to a `Set` or `Map` to perform O(1) in-memory lookups instead of making sequential database calls inside the loop.]
