CREATE TYPE "public"."item_type" AS ENUM('single', 'package');--> statement-breakpoint
CREATE TABLE "item_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"deleted_at" timestamp,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "item_categories_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "item_package_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_item_id" uuid NOT NULL,
	"child_item_id" uuid NOT NULL,
	"quantity" numeric(10, 2) DEFAULT '1.00' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"price" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"discount_percentage" numeric(5, 2) DEFAULT '0.00' NOT NULL,
	"discount_price" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"price_after_discount" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"deleted_at" timestamp,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"uom_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"barcode_text" varchar(150),
	"barcode_type" varchar(50),
	"image_url" text,
	"item_type" "item_type" DEFAULT 'single' NOT NULL,
	"purchase_price" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"selling_price" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"discount_percentage" numeric(5, 2) DEFAULT '0.00' NOT NULL,
	"discount_price" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"price_after_discount" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"deleted_at" timestamp,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "items_code_unique" UNIQUE("code"),
	CONSTRAINT "items_barcode_text_unique" UNIQUE("barcode_text")
);
--> statement-breakpoint
CREATE TABLE "uoms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"deleted_at" timestamp,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "uoms_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "warehouse_heads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"deleted_at" timestamp,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "warehouses" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "warehouses" ADD COLUMN "province" varchar(20);--> statement-breakpoint
ALTER TABLE "warehouses" ADD COLUMN "city_regency" varchar(20);--> statement-breakpoint
ALTER TABLE "warehouses" ADD COLUMN "district" varchar(20);--> statement-breakpoint
ALTER TABLE "warehouses" ADD COLUMN "village" varchar(20);--> statement-breakpoint
ALTER TABLE "warehouses" ADD COLUMN "zip_code" varchar(10);--> statement-breakpoint
ALTER TABLE "warehouses" ADD COLUMN "latitude" numeric(10, 8);--> statement-breakpoint
ALTER TABLE "warehouses" ADD COLUMN "longitude" numeric(11, 8);--> statement-breakpoint
ALTER TABLE "warehouses" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "item_package_details" ADD CONSTRAINT "item_package_details_package_item_id_items_id_fk" FOREIGN KEY ("package_item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_package_details" ADD CONSTRAINT "item_package_details_child_item_id_items_id_fk" FOREIGN KEY ("child_item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_uom_id_uoms_id_fk" FOREIGN KEY ("uom_id") REFERENCES "public"."uoms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_category_id_item_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."item_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_heads" ADD CONSTRAINT "warehouse_heads_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_heads" ADD CONSTRAINT "warehouse_heads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_item_categories_code" ON "item_categories" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_item_categories_is_active" ON "item_categories" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_item_categories_deleted_at" ON "item_categories" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_item_pkg_details_package_item_id" ON "item_package_details" USING btree ("package_item_id");--> statement-breakpoint
CREATE INDEX "idx_item_pkg_details_child_item_id" ON "item_package_details" USING btree ("child_item_id");--> statement-breakpoint
CREATE INDEX "idx_items_code" ON "items" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_items_uom_id" ON "items" USING btree ("uom_id");--> statement-breakpoint
CREATE INDEX "idx_items_category_id" ON "items" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_items_item_type" ON "items" USING btree ("item_type");--> statement-breakpoint
CREATE INDEX "idx_items_is_active" ON "items" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_items_deleted_at" ON "items" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_items_barcode_text" ON "items" USING btree ("barcode_text");--> statement-breakpoint
CREATE INDEX "idx_uoms_code" ON "uoms" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_uoms_is_active" ON "uoms" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_uoms_deleted_at" ON "uoms" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_warehouse_heads_warehouse_id" ON "warehouse_heads" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "idx_warehouse_heads_user_id" ON "warehouse_heads" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_warehouse_heads_is_active" ON "warehouse_heads" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_activity_logs_user_id" ON "activity_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_activity_logs_action" ON "activity_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_activity_logs_created_at" ON "activity_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_oauth_user_id" ON "user_oauth_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_oauth_provider_user_id" ON "user_oauth_accounts" USING btree ("provider","provider_user_id");--> statement-breakpoint
CREATE INDEX "idx_user_sessions_user_id" ON "user_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_sessions_expires_at" ON "user_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_menus_code" ON "menus" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_menus_deleted_at" ON "menus" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_rmp_role_id" ON "role_menu_permissions" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "idx_rmp_menu_id" ON "role_menu_permissions" USING btree ("menu_id");--> statement-breakpoint
CREATE INDEX "idx_roles_name" ON "roles" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_roles_deleted_at" ON "roles" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_uwr_user_id" ON "user_warehouse_roles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_uwr_warehouse_id" ON "user_warehouse_roles" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "idx_uwr_role_id" ON "user_warehouse_roles" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "idx_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_users_status" ON "users" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_users_deleted_at" ON "users" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_warehouses_code" ON "warehouses" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_warehouses_is_active" ON "warehouses" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_warehouses_deleted_at" ON "warehouses" USING btree ("deleted_at");