import { auth, currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export async function getCurrentDbUser() {
  const { isAuthenticated } = await auth();

  if (!isAuthenticated) {
    return null;
  }

  const clerkUser = await currentUser();
  const email = clerkUser?.primaryEmailAddress?.emailAddress;

  if (!email) {
    return null;
  }

  const name = clerkUser.fullName ?? clerkUser.firstName ?? null;

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing[0]) {
    return existing[0];
  }

  const created = await db
    .insert(users)
    .values({ email, name })
    .returning();

  return created[0];
}

export async function requireDbUser() {
  await auth.protect();

  const user = await getCurrentDbUser();

  if (!user) {
    throw new Error("Authenticated user is missing an email address");
  }

  return user;
}
