ALTER TABLE "roles" DROP CONSTRAINT "roles_name_unique";--> statement-breakpoint
ALTER TABLE "roles" ADD COLUMN "code" varchar(50);--> statement-breakpoint
UPDATE "roles" SET "code" = "name";--> statement-breakpoint
ALTER TABLE "roles" ALTER COLUMN "code" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_roles_code" ON "roles" USING btree ("code");--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_code_unique" UNIQUE("code");