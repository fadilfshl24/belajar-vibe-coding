CREATE TABLE "item_platform_skus" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"platform_id" uuid NOT NULL,
	"platform_sku" varchar(100) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"deleted_at" timestamp,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "item_platform_skus_platform_sku_unique" UNIQUE("platform_sku")
);
--> statement-breakpoint
ALTER TABLE "item_platform_skus" ADD CONSTRAINT "item_platform_skus_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_platform_skus" ADD CONSTRAINT "item_platform_skus_platform_id_platforms_id_fk" FOREIGN KEY ("platform_id") REFERENCES "public"."platforms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_item_platform_skus_item_id" ON "item_platform_skus" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "idx_item_platform_skus_platform_id" ON "item_platform_skus" USING btree ("platform_id");--> statement-breakpoint
CREATE INDEX "idx_item_platform_skus_platform_sku" ON "item_platform_skus" USING btree ("platform_sku");--> statement-breakpoint
CREATE INDEX "idx_item_platform_skus_deleted_at" ON "item_platform_skus" USING btree ("deleted_at");