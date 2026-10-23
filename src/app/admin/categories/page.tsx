import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteCategoryAction } from "@/lib/actions/admin";
import { getT } from "@/i18n/server";
import { CategoryForm } from "./CategoryForm";

export default async function AdminCategoriesPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/");
  const t = await getT();

  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { events: true } } },
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">{t("admin.categories.header")}</h1>
      <nav className="mt-2 flex gap-4 text-sm">
        <Link href="/admin" className="text-muted hover:text-ink">{t("admin.nav.queue")}</Link>
        <Link href="/admin/clubs" className="text-muted hover:text-ink">{t("admin.nav.clubs")}</Link>
        <Link href="/admin/categories" className="font-semibold text-accent-dark">{t("admin.nav.categories")}</Link>
      </nav>

      <div className="card mt-8 p-5">
        <h2 className="font-semibold">{t("admin.categories.addTitle")}</h2>
        <div className="mt-3">
          <CategoryForm />
        </div>
      </div>

      <ul className="mt-6 divide-y divide-line">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center justify-between py-3">
            <span className="font-medium">{c.name}</span>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted">{t("admin.categories.count", { n: c._count.events })}</span>
              {c._count.events === 0 && (
                <form action={deleteCategoryAction}>
                  <input type="hidden" name="categoryId" value={c.id} />
                  <button className="btn btn-danger px-3! py-1! text-xs!">{t("admin.categories.delete")}</button>
                </form>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
