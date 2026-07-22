CREATE TABLE "approval_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_type" varchar(20) NOT NULL,
	"stage" integer NOT NULL,
	"role_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"deleted_at" timestamp,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "quotation_plan_purchase_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quotation_plan_id" uuid NOT NULL,
	"purchase_request_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"deleted_at" timestamp,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "quotation_plans" DROP CONSTRAINT "quotation_plans_purchase_request_id_purchase_requests_id_fk";
--> statement-breakpoint
DROP INDEX "idx_quotation_plans_pr_id";--> statement-breakpoint
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_plan_purchase_requests" ADD CONSTRAINT "quotation_plan_purchase_requests_quotation_plan_id_quotation_plans_id_fk" FOREIGN KEY ("quotation_plan_id") REFERENCES "public"."quotation_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_plan_purchase_requests" ADD CONSTRAINT "quotation_plan_purchase_requests_purchase_request_id_purchase_requests_id_fk" FOREIGN KEY ("purchase_request_id") REFERENCES "public"."purchase_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_approval_steps_doc_type" ON "approval_steps" USING btree ("document_type");--> statement-breakpoint
CREATE INDEX "idx_approval_steps_doc_type_stage" ON "approval_steps" USING btree ("document_type","stage");--> statement-breakpoint
CREATE INDEX "idx_approval_steps_deleted_at" ON "approval_steps" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_qp_pr_qp_id" ON "quotation_plan_purchase_requests" USING btree ("quotation_plan_id");--> statement-breakpoint
CREATE INDEX "idx_qp_pr_pr_id" ON "quotation_plan_purchase_requests" USING btree ("purchase_request_id");--> statement-breakpoint
ALTER TABLE "quotation_plans" DROP COLUMN "purchase_request_id";