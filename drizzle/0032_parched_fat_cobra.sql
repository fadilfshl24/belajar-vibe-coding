CREATE TABLE "assembly_order_components" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assembly_order_detail_id" uuid NOT NULL,
	"component_item_id" uuid NOT NULL,
	"quantity_used" numeric(12, 4) DEFAULT '0.0000' NOT NULL,
	"quantity_returned" numeric(12, 4) DEFAULT '0.0000' NOT NULL,
	"price_per_unit" numeric(12, 4) DEFAULT '0.0000' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "assembly_order_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assembly_order_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"quantity_produced" numeric(12, 4) DEFAULT '0.0000' NOT NULL,
	"unit_cost" numeric(12, 4) DEFAULT '0.0000' NOT NULL,
	"total_cost" numeric(12, 4) DEFAULT '0.0000' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "assembly_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(100) NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"notes" text,
	"status" integer DEFAULT 0 NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "assembly_orders_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "assembly_order_components" ADD CONSTRAINT "assembly_order_components_assembly_order_detail_id_assembly_order_details_id_fk" FOREIGN KEY ("assembly_order_detail_id") REFERENCES "public"."assembly_order_details"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assembly_order_components" ADD CONSTRAINT "assembly_order_components_component_item_id_items_id_fk" FOREIGN KEY ("component_item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assembly_order_details" ADD CONSTRAINT "assembly_order_details_assembly_order_id_assembly_orders_id_fk" FOREIGN KEY ("assembly_order_id") REFERENCES "public"."assembly_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assembly_order_details" ADD CONSTRAINT "assembly_order_details_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assembly_orders" ADD CONSTRAINT "assembly_orders_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assembly_orders" ADD CONSTRAINT "assembly_orders_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_assembly_order_components_detail_id" ON "assembly_order_components" USING btree ("assembly_order_detail_id");--> statement-breakpoint
CREATE INDEX "idx_assembly_order_components_item_id" ON "assembly_order_components" USING btree ("component_item_id");--> statement-breakpoint
CREATE INDEX "idx_assembly_order_components_deleted_at" ON "assembly_order_components" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_assembly_order_details_ao_id" ON "assembly_order_details" USING btree ("assembly_order_id");--> statement-breakpoint
CREATE INDEX "idx_assembly_order_details_item_id" ON "assembly_order_details" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "idx_assembly_order_details_deleted_at" ON "assembly_order_details" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_assembly_orders_code" ON "assembly_orders" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_assembly_orders_warehouse_id" ON "assembly_orders" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "idx_assembly_orders_status" ON "assembly_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_assembly_orders_deleted_at" ON "assembly_orders" USING btree ("deleted_at");