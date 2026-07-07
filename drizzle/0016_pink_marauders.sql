CREATE TABLE "user_warehouse_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"deleted_at" timestamp,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "user_warehouse_mappings" ADD CONSTRAINT "user_warehouse_mappings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_warehouse_mappings" ADD CONSTRAINT "user_warehouse_mappings_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_uwm_user_id" ON "user_warehouse_mappings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_uwm_warehouse_id" ON "user_warehouse_mappings" USING btree ("warehouse_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_user_warehouse" ON "user_warehouse_mappings" USING btree ("user_id","warehouse_id");