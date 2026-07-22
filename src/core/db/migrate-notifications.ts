import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://itejos:Ej0s3nt0dBo55!@202.155.95.129:5432/db_vibe_code";

const sql = postgres(DATABASE_URL);

const migration = `
CREATE TABLE IF NOT EXISTS "notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" varchar(100) NOT NULL,
  "source_type" varchar(50) NOT NULL,
  "source_id" uuid NOT NULL,
  "title" varchar(255) NOT NULL,
  "message" text NOT NULL,
  "target_role" varchar(50),
  "target_warehouse_id" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "deleted_at" timestamp,
  CONSTRAINT "notifications_code_unique" UNIQUE("code")
);

CREATE TABLE IF NOT EXISTS "user_notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "notification_id" uuid NOT NULL,
  "is_read" boolean DEFAULT false NOT NULL,
  "read_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "deleted_at" timestamp
);

DO $$ BEGIN
  ALTER TABLE "notifications" ADD CONSTRAINT "notifications_target_warehouse_id_warehouses_id_fk" 
    FOREIGN KEY ("target_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_user_id_users_id_fk" 
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_notification_id_notifications_id_fk" 
    FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "idx_notifications_source_type" ON "notifications" USING btree ("source_type");
CREATE INDEX IF NOT EXISTS "idx_notifications_source_id" ON "notifications" USING btree ("source_id");
CREATE INDEX IF NOT EXISTS "idx_notifications_target_warehouse_id" ON "notifications" USING btree ("target_warehouse_id");
CREATE INDEX IF NOT EXISTS "idx_notifications_created_at" ON "notifications" USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "idx_notifications_deleted_at" ON "notifications" USING btree ("deleted_at");
CREATE INDEX IF NOT EXISTS "idx_user_notifications_user_id" ON "user_notifications" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "idx_user_notifications_notification_id" ON "user_notifications" USING btree ("notification_id");
CREATE INDEX IF NOT EXISTS "idx_user_notifications_is_read" ON "user_notifications" USING btree ("is_read");
CREATE INDEX IF NOT EXISTS "idx_user_notifications_deleted_at" ON "user_notifications" USING btree ("deleted_at");
`;

try {
  await sql.unsafe(migration);
  console.log("✅ Notification tables created successfully!");
} catch (err) {
  console.error("❌ Migration failed:", err);
} finally {
  await sql.end();
}
