ALTER TYPE "public"."transaction_type" ADD VALUE 'REJECT';--> statement-breakpoint
CREATE TABLE "quality_control_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quality_control_id" uuid NOT NULL,
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
CREATE TABLE "quality_control_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quality_control_id" uuid NOT NULL,
	"goods_receipt_detail_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"pass_quantity" integer DEFAULT 0 NOT NULL,
	"reject_quantity" integer DEFAULT 0 NOT NULL,
	"reject_reason" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"deleted_at" timestamp,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "quality_controls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(100) NOT NULL,
	"goods_receipt_id" uuid NOT NULL,
	"inspection_date" date NOT NULL,
	"status" integer DEFAULT 0 NOT NULL,
	"current_approval_stage" integer DEFAULT 0 NOT NULL,
	"inspector_id" uuid NOT NULL,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"deleted_at" timestamp,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "quality_controls_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "quality_control_approvals" ADD CONSTRAINT "quality_control_approvals_quality_control_id_quality_controls_id_fk" FOREIGN KEY ("quality_control_id") REFERENCES "public"."quality_controls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_control_approvals" ADD CONSTRAINT "quality_control_approvals_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_control_details" ADD CONSTRAINT "quality_control_details_quality_control_id_quality_controls_id_fk" FOREIGN KEY ("quality_control_id") REFERENCES "public"."quality_controls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_control_details" ADD CONSTRAINT "quality_control_details_goods_receipt_detail_id_goods_receipt_details_id_fk" FOREIGN KEY ("goods_receipt_detail_id") REFERENCES "public"."goods_receipt_details"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_control_details" ADD CONSTRAINT "quality_control_details_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_controls" ADD CONSTRAINT "quality_controls_goods_receipt_id_goods_receipts_id_fk" FOREIGN KEY ("goods_receipt_id") REFERENCES "public"."goods_receipts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_controls" ADD CONSTRAINT "quality_controls_inspector_id_users_id_fk" FOREIGN KEY ("inspector_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_qc_approvals_qc_id" ON "quality_control_approvals" USING btree ("quality_control_id");--> statement-breakpoint
CREATE INDEX "idx_qc_approvals_approved_by" ON "quality_control_approvals" USING btree ("approved_by");--> statement-breakpoint
CREATE INDEX "idx_qc_approvals_qc_id_stage" ON "quality_control_approvals" USING btree ("quality_control_id","stage");--> statement-breakpoint
CREATE INDEX "idx_qc_approvals_deleted_at" ON "quality_control_approvals" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_qc_details_qc_id" ON "quality_control_details" USING btree ("quality_control_id");--> statement-breakpoint
CREATE INDEX "idx_qc_details_item_id" ON "quality_control_details" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "idx_qc_details_deleted_at" ON "quality_control_details" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_quality_controls_code" ON "quality_controls" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_quality_controls_gr_id" ON "quality_controls" USING btree ("goods_receipt_id");--> statement-breakpoint
CREATE INDEX "idx_quality_controls_status" ON "quality_controls" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_quality_controls_deleted_at" ON "quality_controls" USING btree ("deleted_at");