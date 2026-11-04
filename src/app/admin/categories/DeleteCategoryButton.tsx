"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { deleteCategoryAction } from "@/lib/actions/admin";
import { useT } from "@/i18n/provider";

/**
 * The two-step confirm state machine, extracted: nothing destructive runs
 * on the first click — the opener only ARMS the confirm step, which then
 * names the row before the action fires. RejectForm carries the same
 * open/confirm/cancel shape inline; this hook is where it gets a name.
 */
function useConfirm() {
  const [open, setOpen] = useState(false);
  return {
    open,
    arm: () => setOpen(true),
    cancel: () => setOpen(false),
  };
}

/** The pending state lives in a child so useFormStatus can see the form. */
function ConfirmButton({ name }: { name: string }) {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <button className="btn btn-danger px-3! py-1! text-xs!" disabled={pending}>
      {t("admin.categories.deleteConfirm", { name })}
    </button>
  );
}

/**
 * Two-step delete (the RejectForm pattern): one misclick must not remove a
 * category. The confirm button carries the row's own name, so the question
 * names what dies. The action returns nothing and only runs when the
 * category is empty (the page hides the affordance otherwise), so a plain
 * form — no useActionState — keeps this honest.
 */
export function DeleteCategoryButton({
  categoryId,
  name,
}: {
  categoryId: string;
  name: string;
}) {
  const { open, arm, cancel } = useConfirm();
  const t = useT();

  return (
    <>
      <button className="btn btn-danger px-3! py-1! text-xs!" onClick={arm}>
        {t("admin.categories.delete")}
      </button>
      {open && (
        <form action={deleteCategoryAction} className="flex items-center gap-2">
          <input type="hidden" name="categoryId" value={categoryId} />
          <ConfirmButton name={name} />
          <button
            type="button"
            className="btn btn-secondary px-3! py-1! text-xs!"
            onClick={cancel}
          >
            {t("admin.categories.deleteCancel")}
          </button>
        </form>
      )}
    </>
  );
}
