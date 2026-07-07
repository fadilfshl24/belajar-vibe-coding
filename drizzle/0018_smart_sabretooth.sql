ALTER TABLE "user_warehouse_roles" ALTER COLUMN "warehouse_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_request_details" ADD COLUMN "remark" text;--> statement-breakpoint
ALTER TABLE "purchase_request_details" ADD COLUMN "attachment_url" varchar(500);