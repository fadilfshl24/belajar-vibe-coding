ALTER TABLE "purchase_order_details" ADD COLUMN "quotation_plan_detail_id" uuid;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "quotation_plan_id" uuid;