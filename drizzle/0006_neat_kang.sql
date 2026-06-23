CREATE TYPE "public"."approval_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."approval_type" AS ENUM('CANCEL');--> statement-breakpoint
CREATE TYPE "public"."transaction_status" AS ENUM('DRAFT', 'COMPLETED', 'CANCEL_PENDING', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('IN', 'OUT');--> statement-breakpoint
CREATE TABLE "inventory_stocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"quantity" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"deleted_at" timestamp,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "transaction_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"type" "approval_type" DEFAULT 'CANCEL' NOT NULL,
	"status" "approval_status" DEFAULT 'PENDING' NOT NULL,
	"remark" text NOT NULL,
	"response_remark" text,
	"requested_by" uuid NOT NULL,
	"approved_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"deleted_at" timestamp,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "transaction_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"quantity" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"deleted_at" timestamp,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"type" "transaction_type" NOT NULL,
	"reference_number" varchar(100) NOT NULL,
	"description" text,
	"transaction_date" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "transaction_status" DEFAULT 'DRAFT' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"deleted_at" timestamp,
	"updated_by" uuid,
	CONSTRAINT "transactions_reference_number_unique" UNIQUE("reference_number")
);
--> statement-breakpoint
ALTER TABLE "inventory_stocks" ADD CONSTRAINT "inventory_stocks_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_stocks" ADD CONSTRAINT "inventory_stocks_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_approvals" ADD CONSTRAINT "transaction_approvals_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_approvals" ADD CONSTRAINT "transaction_approvals_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_approvals" ADD CONSTRAINT "transaction_approvals_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_items" ADD CONSTRAINT "transaction_items_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_items" ADD CONSTRAINT "transaction_items_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unq_inventory_stocks_wh_item" ON "inventory_stocks" USING btree ("warehouse_id","item_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_stocks_warehouse_id" ON "inventory_stocks" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_stocks_item_id" ON "inventory_stocks" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "idx_transaction_approvals_transaction_id" ON "transaction_approvals" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "idx_transaction_approvals_status" ON "transaction_approvals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_transaction_items_transaction_id" ON "transaction_items" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "idx_transaction_items_item_id" ON "transaction_items" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "idx_transactions_warehouse_id" ON "transactions" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "idx_transactions_type" ON "transactions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_transactions_status" ON "transactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_transactions_date" ON "transactions" USING btree ("transaction_date");