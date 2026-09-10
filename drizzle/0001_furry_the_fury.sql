CREATE TYPE "public"."transcript_status" AS ENUM('pending', 'processing', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE "transcripts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" uuid NOT NULL,
	"status" "transcript_status" NOT NULL,
	"error" text,
	"language" text,
	"segments" jsonb,
	"provider" text DEFAULT 'assemblyai' NOT NULL,
	"provider_job_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "transcripts_video_id_unique" UNIQUE("video_id")
);
--> statement-breakpoint
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;