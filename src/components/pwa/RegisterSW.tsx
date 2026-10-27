"use client";

import { useEffect } from "react";

/**
 * Registers /sw.js. Production only: in dev the worker would cache Webpack
 * and HMR assets and serve stale modules — offline support is meaningless
 * during development and actively harmful there. Everything it does is
 * idempotent (registering an already-registered scope updates in place), so
 * running on every page load is fine and self-heals if the browser evicted it.
 *
 * Failure is deliberately silent: a private window, an insecure origin or a
 * browser with SWs disabled still gets the full site — only the offline
 * fallback and push go missing, which is exactly the degradation order we
 * want (the badge-less bell never depended on any of this).
 */
export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Intentionally empty: never surface SW trouble in the UI.
    });
  }, []);
  return null;
}
