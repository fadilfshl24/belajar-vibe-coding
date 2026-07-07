CREATE TABLE "purchase_request_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_request_id" uuid NOT NULL,
	"stage" integer NOT NULL,
	"status" integer DEFAULT 0 NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp,
	"remark" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"deleted_at" timestamp,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "purchase_requests" DROP CONSTRAINT "purchase_requests_warehouse_head_approved_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "purchase_requests" DROP CONSTRAINT "purchase_requests_branch_head_approved_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "purchase_requests" DROP CONSTRAINT "purchase_requests_manager_approved_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "purchase_request_approvals" ADD CONSTRAINT "purchase_request_approvals_purchase_request_id_purchase_requests_id_fk" FOREIGN KEY ("purchase_request_id") REFERENCES "public"."purchase_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_request_approvals" ADD CONSTRAINT "purchase_request_approvals_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_pr_approvals_pr_id" ON "purchase_request_approvals" USING btree ("purchase_request_id");--> statement-breakpoint
CREATE INDEX "idx_pr_approvals_approved_by" ON "purchase_request_approvals" USING btree ("approved_by");--> statement-breakpoint
CREATE INDEX "idx_pr_approvals_pr_id_stage" ON "purchase_request_approvals" USING btree ("purchase_request_id","stage");--> statement-breakpoint
CREATE INDEX "idx_pr_approvals_deleted_at" ON "purchase_request_approvals" USING btree ("deleted_at");--> statement-breakpoint
ALTER TABLE "purchase_requests" DROP COLUMN "remark";--> statement-breakpoint
ALTER TABLE "purchase_requests" DROP COLUMN "warehouse_head_approved_by";--> statement-breakpoint
ALTER TABLE "purchase_requests" DROP COLUMN "warehouse_head_approved_at";--> statement-breakpoint
ALTER TABLE "purchase_requests" DROP COLUMN "branch_head_approved_by";--> statement-breakpoint
ALTER TABLE "purchase_requests" DROP COLUMN "branch_head_approved_at";--> statement-breakpoint
ALTER TABLE "purchase_requests" DROP COLUMN "manager_approved_by";--> statement-breakpoint
ALTER TABLE "purchase_requests" DROP COLUMN "manager_approved_at";