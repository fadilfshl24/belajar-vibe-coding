CREATE TABLE "regions_districts" (
	"id" varchar(7) PRIMARY KEY NOT NULL,
	"regency_id" varchar(4) NOT NULL,
	"name" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "regions_provinces" (
	"id" varchar(2) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "regions_regencies" (
	"id" varchar(4) PRIMARY KEY NOT NULL,
	"province_id" varchar(2) NOT NULL,
	"name" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "regions_villages" (
	"id" varchar(10) PRIMARY KEY NOT NULL,
	"district_id" varchar(7) NOT NULL,
	"name" varchar(255) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "regions_districts" ADD CONSTRAINT "regions_districts_regency_id_regions_regencies_id_fk" FOREIGN KEY ("regency_id") REFERENCES "public"."regions_regencies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regions_regencies" ADD CONSTRAINT "regions_regencies_province_id_regions_provinces_id_fk" FOREIGN KEY ("province_id") REFERENCES "public"."regions_provinces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regions_villages" ADD CONSTRAINT "regions_villages_district_id_regions_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."regions_districts"("id") ON DELETE cascade ON UPDATE no action;