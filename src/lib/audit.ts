import { prisma } from "@/lib/prisma";

export type AuditInput = {
  /** null = system (rate limiter, cron). SetNull on user deletion keeps the
   *  row readable via the snapshots below. */
  actorId?: string | null;
  /** Snapshot written now — survives the actor's deletion. */
  actorName: string;
  /** The FACT, never a rendered sentence (the app is trilingual): the admin
   *  page translates `admin.audit.action.<action>` at read time. */
  action: string;
  targetType: "event" | "rsvp" | "auth" | "club" | "category" | "user";
  targetId: string;
  /** Snapshot (event title, email…) so the row still reads after the
   *  target is gone — same keep-history-legible reasoning as Notification. */
  targetLabel?: string;
  meta?: Record<string, string | number | boolean>;
};

/**
 * Write one audit row. NEVER throws: a failed audit write must not undo the
 * action it describes — it lands in the server log instead. Callers await it
 * so the row is committed with the mutation it records.
 */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        actorName: input.actorName,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        targetLabel: input.targetLabel ?? null,
        meta: input.meta ? JSON.stringify(input.meta) : null,
      },
    });
  } catch (err) {
    console.error("[audit] write failed:", input.action, err);
  }
}
