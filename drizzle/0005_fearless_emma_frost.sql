ALTER TABLE "menus" ADD COLUMN "icon" varchar(255);--> statement-breakpoint
ALTER TABLE "menus" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;