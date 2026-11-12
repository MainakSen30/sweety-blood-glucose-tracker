CREATE TYPE "public"."reading_slot" AS ENUM('morning', 'after_breakfast', 'after_lunch', 'after_dinner');--> statement-breakpoint
CREATE TABLE "readings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"reading_date" date NOT NULL,
	"slot" "reading_slot" NOT NULL,
	"value" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "readings_value_range_check" CHECK ("readings"."value" BETWEEN 40 AND 600)
);
--> statement-breakpoint
ALTER TABLE "readings" ADD CONSTRAINT "readings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "readings_user_date_slot_unique_index" ON "readings" USING btree ("user_id","reading_date","slot");--> statement-breakpoint
CREATE INDEX "readings_user_date_index" ON "readings" USING btree ("user_id","reading_date");