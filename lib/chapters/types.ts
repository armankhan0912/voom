export type ChapterStatus = "pending" | "processing" | "ready" | "failed";

export type Chapter = {
  start: number;
  title: string;
};
