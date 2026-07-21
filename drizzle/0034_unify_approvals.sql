-- Create document_approvals table
CREATE TABLE IF NOT EXISTS "document_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_type" varchar(20) NOT NULL,
	"document_id" uuid NOT NULL,
	"stage" integer NOT NULL,
	"status" integer DEFAULT 0 NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"remark" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);

-- Create indexes for document_approvals
CREATE INDEX IF NOT EXISTS "idx_doc_approvals_doc_type" ON "document_approvals" ("document_type");
CREATE INDEX IF NOT EXISTS "idx_doc_approvals_doc_id" ON "document_approvals" ("document_id");
CREATE INDEX IF NOT EXISTS "idx_doc_approvals_approved_by" ON "document_approvals" ("approved_by");
CREATE INDEX IF NOT EXISTS "idx_doc_approvals_doc_type_id_stage" ON "document_approvals" ("document_type", "document_id", "stage");
CREATE INDEX IF NOT EXISTS "idx_doc_approvals_deleted_at" ON "document_approvals" ("deleted_at");

-- Add foreign key reference to users
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'document_approvals_approved_by_users_id_fk'
	) THEN
		ALTER TABLE "document_approvals" ADD CONSTRAINT "document_approvals_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
	END IF;
END $$;

-- Migrate data from purchase_request_approvals
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_request_approvals') THEN
		INSERT INTO "document_approvals" (
			"id", "document_type", "document_id", "stage", "status", "approved_by", "approved_at", "remark", "is_active", "created_at", "updated_at", "deleted_at", "created_by", "updated_by"
		)
		SELECT 
			"id", 'PR', "purchase_request_id", "stage", "status", "approved_by", "approved_at", "remark", "is_active", COALESCE("created_at", now()), COALESCE("updated_at", "created_at", now()), "deleted_at", "created_by", "updated_by"
		FROM "purchase_request_approvals"
		ON CONFLICT (id) DO NOTHING;
	END IF;
END $$;

-- Migrate data from purchase_order_approvals
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_order_approvals') THEN
		INSERT INTO "document_approvals" (
			"id", "document_type", "document_id", "stage", "status", "approved_by", "approved_at", "remark", "created_at", "updated_at", "deleted_at", "created_by", "updated_by"
		)
		SELECT 
			"id", 'PO', "purchase_order_id", "stage", "status", "approved_by", "approved_at", "remark", COALESCE("created_at", now()), COALESCE("updated_at", "created_at", now()), "deleted_at", "created_by", "updated_by"
		FROM "purchase_order_approvals"
		ON CONFLICT (id) DO NOTHING;
	END IF;
END $$;

-- Migrate data from quotation_plan_approvals
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'quotation_plan_approvals') THEN
		INSERT INTO "document_approvals" (
			"id", "document_type", "document_id", "stage", "status", "approved_by", "approved_at", "remark", "created_at", "updated_at", "deleted_at", "created_by", "updated_by"
		)
		SELECT 
			"id", 'QP', "quotation_plan_id", "stage", "status", "approver_id", NULL, "notes", COALESCE("created_at", now()), COALESCE("updated_at", "created_at", now()), "deleted_at", "created_by", NULL
		FROM "quotation_plan_approvals"
		ON CONFLICT (id) DO NOTHING;
	END IF;
END $$;

-- Migrate data from quality_control_approvals
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'quality_control_approvals') THEN
		INSERT INTO "document_approvals" (
			"id", "document_type", "document_id", "stage", "status", "approved_by", "approved_at", "remark", "is_active", "created_at", "updated_at", "deleted_at", "created_by", "updated_by"
		)
		SELECT 
			"id", 'QC', "quality_control_id", "stage", "status", "approved_by", "approved_at", "remark", "is_active", COALESCE("created_at", now()), COALESCE("updated_at", "created_at", now()), "deleted_at", "created_by", "updated_by"
		FROM "quality_control_approvals"
		ON CONFLICT (id) DO NOTHING;
	END IF;
END $$;

-- Drop old tables
DROP TABLE IF EXISTS "purchase_request_approvals" CASCADE;
DROP TABLE IF EXISTS "purchase_order_approvals" CASCADE;
DROP TABLE IF EXISTS "quotation_plan_approvals" CASCADE;
DROP TABLE IF EXISTS "quality_control_approvals" CASCADE;