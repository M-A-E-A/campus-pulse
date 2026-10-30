import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { getClubDirectory, getFollowedClubIds } from "@/lib/queries";
import { getLocale, getT } from "@/i18n/server";
import { ClubsExplorer } from "@/components/clubs/ClubsExplorer";

// Directory + follow state are per-request (session read), so dynamic — the
// club counts themselves come from the shared tagged cache in queries.ts.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("clubs.metaTitle"), description: t("clubs.metaDescription") };
}

export default async function ClubsPage() {
  const locale = await getLocale();
  const session = await auth();
  const [clubs, followingIds] = await Promise.all([
    getClubDirectory(locale),
    session?.user ? getFollowedClubIds(session.user.id) : Promise.resolve([]),
  ]);

  return (
    <ClubsExplorer
      clubs={clubs}
      followingIds={followingIds}
      isAuthenticated={Boolean(session?.user)}
    />
  );
}
