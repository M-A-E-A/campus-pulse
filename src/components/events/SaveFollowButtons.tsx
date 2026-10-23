"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

  async function onSave() {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    setSaved((s) => !s);
    await toggleSaveAction(eventId);
  }

  async function onFollow() {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    setFollowing((f) => !f);
    await toggleFollowAction(clubId);
    setNote(following ? t("detail.follow.unfollowedNote") : t("detail.follow.followedNote"));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button className="btn btn-secondary py-1.5! text-sm!" onClick={onSave} aria-pressed={saved}>
        {saved ? t("detail.save.on") : t("detail.save.off")}
      </button>
      <button className="btn btn-secondary py-1.5! text-sm!" onClick={onFollow} aria-pressed={following}>
        {following ? t("detail.follow.on") : t("detail.follow.off")}
      </button>
      {note && <span className="text-xs text-muted" role="status">{note}</span>}
    </div>
  );
}
