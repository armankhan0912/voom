export type SummaryStatus = "pending" | "processing" | "ready" | "failed";

export type GeneratedSummary = {
  overview: string;
  keyPoints: string[];
};
