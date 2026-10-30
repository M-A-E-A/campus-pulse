"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { toggleFollowAction } from "@/lib/actions/rsvp";
import { isOfflineError } from "@/lib/offline";
import { useT } from "@/i18n/provider";

/**
 * The club follow toggle, extracted from SaveFollowButtons so the event
 * detail and the club directory/profile cannot drift: one optimistic flip,
 * one offline path (roll back and say so instead of pretending), one
 * "sign in and bring me back here" redirect for visitors.
 *
 * Returns a FRAGMENT — the button and its status note as siblings — so the
 * event detail keeps its single flex row (save · follow · note) exactly as
 * it was. The caller owns the layout container; this owns the behavior.
 * `data-follow` is the probe hook: labels translate, the attribute doesn't.
 */

/** The paired on/off look for both toggle buttons (save + follow), in one
 *  place: two identical buttons that flip fill read as on/off, not as two
 *  choices. min-h-11 is the 44px touch target on phones; on lg the pair
 *  goes back to poster-compact. */
export const toggleCls = (on: boolean) =>
  [
    "btn btn-secondary min-h-11 border-2 border-ink py-1.5! text-sm! lg:min-h-0",
    on ? "bg-ink text-paper hover:bg-ink" : "bg-paper text-ink hover:bg-line",
  ].join(" ");

export function FollowButton({
  clubId,
  initialFollowing,
  isAuthenticated,
}: {
  clubId: string;
  initialFollowing: boolean;
  isAuthenticated: boolean;
}) {
  const t = useT();
  const [following, setFollowing] = useState(initialFollowing);
  const [note, setNote] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  async function onFollow() {
    if (!isAuthenticated) {
      router.push(`/login?from=${encodeURIComponent(pathname)}`);
      return;
    }
    const next = !following;
    setFollowing(next); // optimistic — rolled back below if the action dies
    setNote(null);
    try {
      await toggleFollowAction(clubId);
      setNote(next ? t("detail.follow.followedNote") : t("detail.follow.unfollowedNote"));
    } catch (err) {
      setFollowing(!next);
      if (isOfflineError(err)) {
        setNote(t("errors.offline"));
        return;
      }
      throw err;
    }
  }

  return (
    <>
      <button
        className={toggleCls(following)}
        onClick={onFollow}
        aria-pressed={following}
        data-follow={clubId}
      >
        {/* The on-state carries the check as drawn imagery, not a text glyph
            — the emoji rule bans ✓ characters, and this button flips fill
            so currentColor switches with it. */}
        {following && (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        )}
        {following ? t("detail.follow.on") : t("detail.follow.off")}
      </button>
      {note && (
        <span className="text-xs font-semibold text-ink" role="status">
          {note}
        </span>
      )}
    </>
  );
}
