ALTER TABLE "transactions" ALTER COLUMN "created_by" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD COLUMN "current_approval_stage" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD COLUMN "warehouse_head_approved_by" uuid;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD COLUMN "warehouse_head_approved_at" timestamp;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD COLUMN "branch_head_approved_by" uuid;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD COLUMN "branch_head_approved_at" timestamp;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD COLUMN "manager_approved_by" uuid;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD COLUMN "manager_approved_at" timestamp;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_warehouse_head_approved_by_users_id_fk" FOREIGN KEY ("warehouse_head_approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_branch_head_approved_by_users_id_fk" FOREIGN KEY ("branch_head_approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_manager_approved_by_users_id_fk" FOREIGN KEY ("manager_approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;