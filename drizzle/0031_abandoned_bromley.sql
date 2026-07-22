CREATE TABLE "stock_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stock_order_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"sku_id" varchar(150) NOT NULL,
	"sku_name" varchar(255) NOT NULL,
	"sku_price" numeric(15, 2),
	"subtotal_before_discount" numeric(15, 2),
	"platform_discount" numeric(15, 2),
	"seller_discount" numeric(15, 2),
	"subtotal_after_discount" numeric(15, 2),
	"quantity" numeric(15, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "stock_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_channel" varchar(50) NOT NULL,
	"tracking_id" varchar(150) NOT NULL,
	"order_id" varchar(150) NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"status" varchar(50) DEFAULT 'UNPACKED' NOT NULL,
	"type" varchar(50) DEFAULT 'OUTBOUND' NOT NULL,
	"payment_method" varchar(100),
	"shipping_provider_name" varchar(150),
	"buyer_username" varchar(150),
	"recipient" varchar(255),
	"phone" varchar(50),
	"address" text,
	"seller_note" text,
	"platform_created_at" timestamp with time zone,
	"platform_paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "stock_order_items" ADD CONSTRAINT "stock_order_items_stock_order_id_stock_orders_id_fk" FOREIGN KEY ("stock_order_id") REFERENCES "public"."stock_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_order_items" ADD CONSTRAINT "stock_order_items_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_orders" ADD CONSTRAINT "stock_orders_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_stock_order_items_stock_order_id" ON "stock_order_items" USING btree ("stock_order_id");--> statement-breakpoint
CREATE INDEX "idx_stock_order_items_item_id" ON "stock_order_items" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "idx_stock_order_items_deleted_at" ON "stock_order_items" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_stock_orders_tracking_id" ON "stock_orders" USING btree ("tracking_id");--> statement-breakpoint
CREATE INDEX "idx_stock_orders_order_id" ON "stock_orders" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_stock_orders_warehouse_id" ON "stock_orders" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "idx_stock_orders_status" ON "stock_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_stock_orders_type" ON "stock_orders" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_stock_orders_deleted_at" ON "stock_orders" USING btree ("deleted_at");