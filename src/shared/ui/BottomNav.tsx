"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/shared/i18n";
import { NAV_ITEMS, NO_NAV_PREFIXES, hasPrefix } from "@/shared/nav";
import en from "./messages/en.json";
import hi from "./messages/hi.json";
import te from "./messages/te.json";

export function BottomNav() {
  const pathname = usePathname();
  const t = useT({ en, te, hi });
  if (hasPrefix(pathname, NO_NAV_PREFIXES) || /^\/play\/duel\/[^/]+$/.test(pathname)) return null;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 mx-auto flex h-18 w-full max-w-md border-t border-border bg-surface/95 backdrop-blur-lg">
      {NAV_ITEMS.map((item) => {
        const active = hasPrefix(pathname, [item.href]);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-xs ${
              active ? "font-semibold text-brand" : "text-muted"
            }`}
          >
            <span aria-hidden className="text-xl">{item.icon}</span>
            {t(item.key)}
            <span aria-hidden className={`h-1 w-1 rounded-full ${active ? "bg-brand" : "bg-transparent"}`} />
          </Link>
        );
      })}
    </nav>
  );
}
