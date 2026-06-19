ALTER TABLE "menus" ADD COLUMN "parent_id" uuid;--> statement-breakpoint
ALTER TABLE "menus" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "menus" ADD CONSTRAINT "menus_parent_id_menus_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."menus"("id") ON DELETE no action ON UPDATE no action;