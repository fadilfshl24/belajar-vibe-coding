import { db } from "./index";
import { sql } from "drizzle-orm";

async function run() {
  console.log("Running migration 0035 ALTER TABLE commands...");
  await db.execute(sql`
    ALTER TABLE "stock_orders"
      ADD COLUMN IF NOT EXISTS "remark" text,
      ADD COLUMN IF NOT EXISTS "packed_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS "packed_at" timestamp with time zone,
      ADD COLUMN IF NOT EXISTS "returned_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS "returned_at" timestamp with time zone,
      ADD COLUMN IF NOT EXISTS "platform_rts_at" timestamp with time zone,
      ADD COLUMN IF NOT EXISTS "platform_shipped_at" timestamp with time zone,
      ADD COLUMN IF NOT EXISTS "platform_delivered_at" timestamp with time zone;
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "idx_stock_orders_packed_by" ON "stock_orders" ("packed_by");
    CREATE INDEX IF NOT EXISTS "idx_stock_orders_returned_by" ON "stock_orders" ("returned_by");
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "stock_order_item_mappings" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "stock_order_id" uuid NOT NULL REFERENCES "stock_orders"("id") ON DELETE CASCADE,
      "item_id" uuid NOT NULL REFERENCES "items"("id") ON DELETE CASCADE,
      "quantity" numeric(15, 2) NOT NULL,
      "is_auto_restock_if_return" boolean NOT NULL DEFAULT false,
      "created_at" timestamp with time zone DEFAULT now(),
      "updated_at" timestamp with time zone DEFAULT now(),
      "deleted_at" timestamp with time zone,
      "created_by" uuid,
      "updated_by" uuid,
      "deleted_by" uuid
    );
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "idx_stock_order_item_mappings_order_id" ON "stock_order_item_mappings" ("stock_order_id");
    CREATE INDEX IF NOT EXISTS "idx_stock_order_item_mappings_item_id" ON "stock_order_item_mappings" ("item_id");
    CREATE INDEX IF NOT EXISTS "idx_stock_order_item_mappings_deleted_at" ON "stock_order_item_mappings" ("deleted_at");
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "stock_order_returns" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "stock_order_id" uuid NOT NULL REFERENCES "stock_orders"("id") ON DELETE CASCADE,
      "return_reason" text,
      "proof_image_url" text NOT NULL,
      "returned_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
      "created_at" timestamp with time zone DEFAULT now(),
      "updated_at" timestamp with time zone DEFAULT now(),
      "deleted_at" timestamp with time zone,
      "created_by" uuid,
      "updated_by" uuid,
      "deleted_by" uuid
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "stock_order_return_items" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "stock_order_return_id" uuid NOT NULL REFERENCES "stock_order_returns"("id") ON DELETE CASCADE,
      "item_id" uuid REFERENCES "items"("id") ON DELETE SET NULL,
      "item_name_snapshot" varchar(255) NOT NULL,
      "returned_quantity" numeric(15, 2) NOT NULL,
      "is_restocked" boolean NOT NULL DEFAULT false,
      "notes" text,
      "created_at" timestamp with time zone DEFAULT now(),
      "updated_at" timestamp with time zone DEFAULT now(),
      "deleted_at" timestamp with time zone,
      "created_by" uuid,
      "updated_by" uuid,
      "deleted_by" uuid
    );
  `);

  console.log("Migration executed successfully!");
  process.exit(0);
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
