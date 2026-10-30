"use client";

import { useEffect, useState } from "react";
import { useT, useLocale } from "@/i18n/provider";
import { distanceKm, formatKm, type GeoPos } from "@/lib/geo";

/**
 * "à 2 km de vous" on the event page — but ONLY when geolocation was already
 * granted to this origin. A page load must never fire a permission prompt;
 * without a grant this renders nothing, which is the honest state (the events
 * wall's "Near me" button is where consent is asked for).
 */
export function DistanceAway({ lat, lng }: { lat: number; lng: number }) {
  const t = useT();
  const locale = useLocale();
  const [km, setKm] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const nav = navigator;
    nav.permissions
      ?.query({ name: "geolocation" })
      .then((status) => {
        if (cancelled || status.state !== "granted") return;
        nav.geolocation.getCurrentPosition(
          (p) => {
            if (cancelled) return;
            const here: GeoPos = {
              lat: p.coords.latitude,
              lng: p.coords.longitude,
            };
            setKm(distanceKm(here, { lat, lng }));
          },
          () => {},
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [lat, lng]);

  if (km === null) return null;
  return (
    <span className="whitespace-nowrap font-semibold" data-distance>
      {t("detail.distance", { km: formatKm(km, locale) })}
    </span>
  );
}
