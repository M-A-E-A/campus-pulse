"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { toggleSaveAction } from "@/lib/actions/rsvp";
import { isOfflineError } from "@/lib/offline";
import { useT } from "@/i18n/provider";
import { FollowButton, toggleCls } from "../FollowButton";

export function SaveFollowButtons({
  eventId,
  clubId,
  isSaved,
  isFollowing,
  isAuthenticated,
}: {
  eventId: string;
  clubId: string;
  isSaved: boolean;
  isFollowing: boolean;
  isAuthenticated: boolean;
}) {
  const t = useT();
  const [saved, setSaved] = useState(isSaved);
  const [note, setNote] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  // Logged out, the toggle can't do its job — send the visitor to sign in and
  // bring them back here rather than dropping them on a bare /login.
  const signInHere = () => router.push(`/login?from=${encodeURIComponent(pathname)}`);

  async function onSave() {
    if (!isAuthenticated) {
      signInHere();
      return;
    }
    const next = !saved;
    setSaved(next); // optimistic — rolled back below if the action dies
    setNote(null);
    try {
      await toggleSaveAction(eventId);
    } catch (err) {
      setSaved(!next);
      if (isOfflineError(err)) {
        setNote(t("errors.offline"));
        return;
      }
      throw err;
    }
  }

  // Follow lives in FollowButton (shared with the club pages); its note
  // comes back as a sibling inside this same flex row, so the pair still
  // reads save · follow · status.
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button className={toggleCls(saved)} onClick={onSave} aria-pressed={saved}>
        {saved ? t("detail.save.on") : t("detail.save.off")}
      </button>
      <FollowButton
        clubId={clubId}
        initialFollowing={isFollowing}
        isAuthenticated={isAuthenticated}
      />
      {note && <span className="text-xs font-semibold text-ink" role="status">{note}</span>}
    </div>
  );
}
