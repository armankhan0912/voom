import { relations } from "drizzle-orm";
import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { TranscriptSegment } from "@/lib/transcription/types";

export const videoStatus = pgEnum("video_status", [
  "uploading",
  "ready",
  "failed",
]);

export const transcriptStatus = pgEnum("transcript_status", [
  "pending",
  "processing",
  "ready",
  "failed",
]);

export const summaryStatus = pgEnum("summary_status", [
  "pending",
  "processing",
  "ready",
  "failed",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const videos = pgTable("videos", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  title: text("title").notNull(),
  s3Key: text("s3_key").notNull(),
  status: videoStatus("status").notNull(),
  duration: integer("duration"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const transcripts = pgTable("transcripts", {
  id: uuid("id").primaryKey().defaultRandom(),
  videoId: uuid("video_id")
    .notNull()
    .references(() => videos.id, { onDelete: "cascade" })
    .unique(),
  status: transcriptStatus("status").notNull(),
  error: text("error"),
  language: text("language"),
  segments: jsonb("segments").$type<TranscriptSegment[] | null>(),
  provider: text("provider").notNull().default("assemblyai"),
  providerJobId: text("provider_job_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const summaries = pgTable("summaries", {
  id: uuid("id").primaryKey().defaultRandom(),
  videoId: uuid("video_id")
    .notNull()
    .references(() => videos.id, { onDelete: "cascade" })
    .unique(),
  status: summaryStatus("status").notNull(),
  error: text("error"),
  overview: text("overview"),
  keyPoints: jsonb("key_points").$type<string[] | null>(),
  provider: text("provider").notNull().default("gemini"),
  model: text("model"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  videos: many(videos),
}));

export const videosRelations = relations(videos, ({ one }) => ({
  user: one(users, {
    fields: [videos.userId],
    references: [users.id],
  }),
  transcript: one(transcripts, {
    fields: [videos.id],
    references: [transcripts.videoId],
  }),
  summary: one(summaries, {
    fields: [videos.id],
    references: [summaries.videoId],
  }),
}));

export const transcriptsRelations = relations(transcripts, ({ one }) => ({
  video: one(videos, {
    fields: [transcripts.videoId],
    references: [videos.id],
  }),
}));

export const summariesRelations = relations(summaries, ({ one }) => ({
  video: one(videos, {
    fields: [summaries.videoId],
    references: [videos.id],
  }),
}));
