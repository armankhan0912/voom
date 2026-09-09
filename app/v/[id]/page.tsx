import { redirect } from "next/navigation";
import { VIDEO_ID_PATTERN } from "@/lib/videos";

export default async function LegacyWatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!VIDEO_ID_PATTERN.test(id)) {
    redirect("/");
  }
  redirect(`/voom/${id}`);
}
