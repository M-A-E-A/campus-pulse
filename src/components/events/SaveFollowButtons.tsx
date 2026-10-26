"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { toggleSaveAction, toggleFollowAction } from "@/lib/actions/rsvp";
import { useT } from "@/i18n/provider";

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
  const [following, setFollowing] = useState(isFollowing);
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
    setSaved((s) => !s);
    await toggleSaveAction(eventId);
  }

  async function onFollow() {
    if (!isAuthenticated) {
      signInHere();
      return;
    }
    setFollowing((f) => !f);
    await toggleFollowAction(clubId);
    setNote(following ? t("detail.follow.unfollowedNote") : t("detail.follow.followedNote"));
  }

  // min-h-11: 44px is the comfortable touch target on a phone; on lg the pair
  // goes back to poster-compact. The pressed state is a real fill so the toggle
  // reads as on/off rather than two identical buttons.
  const cls = (on: boolean) =>
    [
      "btn btn-secondary min-h-11 border-2 border-ink py-1.5! text-sm! lg:min-h-0",
      on ? "bg-ink text-paper hover:bg-ink" : "bg-paper text-ink hover:bg-line",
    ].join(" ");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button className={cls(saved)} onClick={onSave} aria-pressed={saved}>
        {saved ? t("detail.save.on") : t("detail.save.off")}
      </button>
      <button className={cls(following)} onClick={onFollow} aria-pressed={following}>
        {following ? t("detail.follow.on") : t("detail.follow.off")}
      </button>
      {note && <span className="text-xs font-semibold text-ink" role="status">{note}</span>}
    </div>
  );
}
