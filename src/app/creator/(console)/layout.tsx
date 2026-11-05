import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CREATOR_COOKIE, verifyCreatorSession } from "@/lib/creator-session";

export const metadata: Metadata = {
  // The console never gets indexed — its only door is the signed cookie.
  robots: { index: false, follow: false },
};

/**
 * The guard for `/creator`: one signed-cookie check before anything in the
 * console renders. Deliberately a route-group layout rather than
 * middleware — the creator session is not a NextAuth session, and keeping
 * the check here means the middleware's JWT matcher stays untouched. A
 * bad or missing cookie bounces to the login door with no data rendered.
 */
export default async function CreatorConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const store = await cookies();
  if (!(await verifyCreatorSession(store.get(CREATOR_COOKIE)?.value))) {
    redirect("/creator/login");
  }
  return <>{children}</>;
}
