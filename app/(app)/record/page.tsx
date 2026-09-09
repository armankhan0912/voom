import { redirect } from "next/navigation";
import { requireDbUser } from "@/lib/current-user";

export default async function RecordPage() {
  await requireDbUser();
  redirect("/?record=1");
}
