CREATE TYPE "public"."chapter_status" AS ENUM('pending', 'processing', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE "chapters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" uuid NOT NULL,
	"status" "chapter_status" NOT NULL,
	"error" text,
	"chapters" jsonb,
	"provider" text DEFAULT 'gemini' NOT NULL,
	"model" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chapters_video_id_unique" UNIQUE("video_id")
);
--> statement-breakpoint
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;