CREATE TYPE "public"."doctor_patient_assignment_status" AS ENUM('pending', 'active', 'revoked', 'rejected', 'expired');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('patient', 'doctor');--> statement-breakpoint
CREATE TABLE "doctor_patient_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"doctor_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"status" "doctor_patient_assignment_status" DEFAULT 'pending' NOT NULL,
	"token_hash" varchar(64),
	"invited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "doctor_patient_assignments_distinct_check" CHECK ("doctor_patient_assignments"."doctor_id" <> "doctor_patient_assignments"."patient_id")
);
--> statement-breakpoint
CREATE TABLE "user_role_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"previous_role" "user_role" NOT NULL,
	"new_role" "user_role" NOT NULL,
	"changed_by" varchar(120) NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" "user_role" DEFAULT 'patient' NOT NULL;--> statement-breakpoint
ALTER TABLE "doctor_patient_assignments" ADD CONSTRAINT "doctor_patient_assignments_doctor_id_users_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_patient_assignments" ADD CONSTRAINT "doctor_patient_assignments_patient_id_users_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role_changes" ADD CONSTRAINT "user_role_changes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "doctor_patient_assignments_active_unique_index" ON "doctor_patient_assignments" USING btree ("doctor_id","patient_id") WHERE "doctor_patient_assignments"."status" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "doctor_patient_assignments_pending_unique_index" ON "doctor_patient_assignments" USING btree ("doctor_id","patient_id") WHERE "doctor_patient_assignments"."status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "doctor_patient_assignments_token_hash_unique_index" ON "doctor_patient_assignments" USING btree ("token_hash") WHERE "doctor_patient_assignments"."token_hash" is not null;--> statement-breakpoint
CREATE INDEX "doctor_patient_assignments_doctor_status_index" ON "doctor_patient_assignments" USING btree ("doctor_id","status");--> statement-breakpoint
CREATE INDEX "doctor_patient_assignments_patient_status_index" ON "doctor_patient_assignments" USING btree ("patient_id","status");--> statement-breakpoint
CREATE INDEX "user_role_changes_user_changed_index" ON "user_role_changes" USING btree ("user_id","changed_at");--> statement-breakpoint
CREATE INDEX "users_role_index" ON "users" USING btree ("role");