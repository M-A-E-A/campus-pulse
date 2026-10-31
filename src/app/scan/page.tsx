import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getT } from "@/i18n/server";
import { ScanScanner } from "@/components/scan/ScanScanner";

/**
 * The student scanner: point at a poster (or any event QR) and land on the
 * event. Signed-in only — a scan has nowhere to put an RSVP for a visitor,
 * and the login page is one redirect away.
 *
 * The camera itself starts on the user's tap, never on load (a permission
 * prompt nobody asked for is how a browser tab gets closed).
 */
export default async function ScanPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const t = await getT();

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <h1 className="text-2xl font-bold sm:text-3xl">{t("scan.title")}</h1>
      <p className="mt-1 text-muted">{t("scan.sub")}</p>
      <div className="mt-6">
        <ScanScanner />
      </div>
    </div>
  );
}
