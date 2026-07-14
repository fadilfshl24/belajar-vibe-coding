CREATE TABLE "scrap_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scrap_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"quantity" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"deleted_at" timestamp,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "scraps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(100) NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"type" varchar(10) NOT NULL,
	"reason_category" varchar(50) NOT NULL,
	"notes" text,
	"status" integer DEFAULT 0 NOT NULL,
	"current_approval_stage" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"deleted_at" timestamp,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "scraps_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "inventory_stocks" ADD COLUMN "physical_qty" numeric(15, 2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_stocks" ADD COLUMN "reserved_qty" numeric(15, 2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_stocks" ADD COLUMN "available_qty" numeric(15, 2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE "scrap_details" ADD CONSTRAINT "scrap_details_scrap_id_scraps_id_fk" FOREIGN KEY ("scrap_id") REFERENCES "public"."scraps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrap_details" ADD CONSTRAINT "scrap_details_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scraps" ADD CONSTRAINT "scraps_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_scrap_details_scrap_id" ON "scrap_details" USING btree ("scrap_id");--> statement-breakpoint
CREATE INDEX "idx_scrap_details_item_id" ON "scrap_details" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "idx_scrap_details_deleted_at" ON "scrap_details" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_scraps_code" ON "scraps" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_scraps_warehouse_id" ON "scraps" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "idx_scraps_status" ON "scraps" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_scraps_deleted_at" ON "scraps" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_inventory_stocks_available_qty" ON "inventory_stocks" USING btree ("available_qty");--> statement-breakpoint
UPDATE "inventory_stocks" SET "physical_qty" = "quantity", "available_qty" = "quantity";