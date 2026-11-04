import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getT } from "@/i18n/server";
import { AdminHeader } from "../AdminHeader";
import { CategoryForm } from "./CategoryForm";
import { DeleteCategoryButton } from "./DeleteCategoryButton";

export default async function AdminCategoriesPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/");
  const t = await getT();

  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { events: true } } },
  });

  return (
    <>
      <AdminHeader titleKey="admin.categories.header" active="/admin/categories" width="max-w-3xl" />

      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="card p-5">
          <h2 className="font-semibold">{t("admin.categories.addTitle")}</h2>
          <div className="mt-3">
            <CategoryForm />
          </div>
        </div>

        <ul className="mt-6 divide-y divide-line">
          {categories.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-3">
              <span className="font-medium">{c.name}</span>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-muted">{t("admin.categories.count", { n: c._count.events })}</span>
                {c._count.events === 0 && (
                  <DeleteCategoryButton categoryId={c.id} name={c.name} />
                )}
              </div>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
