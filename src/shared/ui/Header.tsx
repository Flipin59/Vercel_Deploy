"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/shared/i18n";
import { BACK_LINKS, NO_HEADER_PREFIXES, hasPrefix } from "@/shared/nav";
import en from "./messages/en.json";
import hi from "./messages/hi.json";
import te from "./messages/te.json";
import { TitleBadge } from "./primitives";

// Top bar for every signed-in screen (UI.md §2.1). Only the student's own numbers.
export function Header({
  title,
  streakDays,
  coins,
  pendingRequests,
}: {
  title?: string;
  streakDays?: number;
  coins?: number;
  pendingRequests: number;
}) {
  const pathname = usePathname();
  const t = useT({ en, te, hi });
  if (hasPrefix(pathname, NO_HEADER_PREFIXES)) return null;
  const back = BACK_LINKS[pathname];
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-2 border-b border-border bg-background/95 px-4 backdrop-blur">
      {back ? (
        <Link href={back} className="text-sm text-muted">
          ← {t("header.back")}
        </Link>
      ) : (
        <Link href="/dashboard" className="flex items-center gap-2 font-bold text-brand">
          FinQuest {title && <TitleBadge label={title} />}
        </Link>
      )}
      {streakDays !== undefined && <span className="ml-auto text-sm" title={t("header.streak")}>
        🔥 {streakDays}
      </span>}
      {coins !== undefined && <span className="text-sm text-coin" title={t("header.coins")}>
        🪙 {coins}
      </span>}
      {title === undefined && <span role="status" className="ml-auto text-xs text-muted">{t("header.progressUnavailable")}</span>}
      <Link href="/forum/friends" aria-label={t("header.friends")} className="relative shrink-0 text-lg">
        ❤️
        {pendingRequests > 0 && (
          <span aria-label={t("header.friendRequests")} className="absolute -top-1 -right-1 h-3 w-3">
            <span className="absolute inset-0 animate-ping rounded-full bg-danger" />
            <span className="absolute inset-0 rounded-full bg-danger" />
          </span>
        )}
      </Link>
    </header>
  );
}
