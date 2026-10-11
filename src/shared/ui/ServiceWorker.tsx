"use client";

import { useEffect } from "react";

// Registers the offline shell (public/sw.js). Production only: in dev it would cache
// build files that change on every edit.
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
