ALTER TABLE "purchase_orders" DROP CONSTRAINT "purchase_orders_purchase_request_id_purchase_requests_id_fk";
--> statement-breakpoint
ALTER TABLE "purchase_orders" DROP COLUMN "purchase_request_id";