ALTER TABLE "item_categories" DROP CONSTRAINT "item_categories_code_unique";--> statement-breakpoint
ALTER TABLE "customers" DROP CONSTRAINT "customers_code_unique";--> statement-breakpoint
ALTER TABLE "item_platform_skus" DROP CONSTRAINT "item_platform_skus_platform_sku_unique";--> statement-breakpoint
ALTER TABLE "items" DROP CONSTRAINT "items_code_unique";--> statement-breakpoint
ALTER TABLE "items" DROP CONSTRAINT "items_barcode_text_unique";--> statement-breakpoint
ALTER TABLE "platforms" DROP CONSTRAINT "platforms_code_unique";--> statement-breakpoint
ALTER TABLE "roles" DROP CONSTRAINT "roles_code_unique";--> statement-breakpoint
ALTER TABLE "uoms" DROP CONSTRAINT "uoms_code_unique";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_email_unique";--> statement-breakpoint
ALTER TABLE "vendors" DROP CONSTRAINT "vendors_code_unique";--> statement-breakpoint
ALTER TABLE "warehouses" DROP CONSTRAINT "warehouses_code_unique";--> statement-breakpoint
DROP INDEX "idx_item_platform_skus_platform_sku";--> statement-breakpoint
CREATE UNIQUE INDEX "idx_item_categories_code_active" ON "item_categories" USING btree ("code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_customers_code_active" ON "customers" USING btree ("code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_items_code_active" ON "items" USING btree ("code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_items_barcode_text_active" ON "items" USING btree ("barcode_text") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_platforms_code_active" ON "platforms" USING btree ("code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_roles_code_active" ON "roles" USING btree ("code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_uoms_code_active" ON "uoms" USING btree ("code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_email_active" ON "users" USING btree ("email") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_vendors_code_active" ON "vendors" USING btree ("code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_warehouses_code_active" ON "warehouses" USING btree ("code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_item_platform_skus_platform_sku" ON "item_platform_skus" USING btree ("platform_sku") WHERE deleted_at IS NULL;