"use client";

import { useState } from "react";
import { useT } from "@/shared/i18n";
import type { LeaderboardRow } from "@/shared/progress";
import { Button, Card, TitleBadge } from "@/shared/ui/primitives";
import en from "./messages/en.json";
import te from "./messages/te.json";
import hi from "./messages/hi.json";

type Board = { rows: LeaderboardRow[]; me: LeaderboardRow | null };
export type Leaderboards = { friends: Board | null; global: Board | null };

export function Leaderboard({ boards }: { boards: Leaderboards }) {
  const t = useT({ en, te, hi });
  const [scope, setScope] = useState<"friends" | "global">("friends");
  const board = boards[scope];
  const ownRowMissing = board?.me && !board.rows.some(row => row.isCurrentUser);
  return <Card className="flex flex-col gap-3">
    <h2 className="text-sm font-bold">🏆 {t("dashboard.leaderboardHeading")}</h2>
    <p className="text-xs text-muted">{t("dashboard.leaderboardPeriod")}</p>
    <div className="flex gap-2" role="group" aria-label={t("dashboard.leaderboardScope")}>
      {(["friends", "global"] as const).map(value => <Button key={value} className="flex-1"
        variant={scope === value ? "primary" : "secondary"} aria-pressed={scope === value}
        onClick={() => setScope(value)}>{t(`dashboard.${value}Tab`)}</Button>)}
    </div>
    {!board ? <p role="status">{t("dashboard.leaderboardError")}</p> : <>
      {board.rows.length === 0 ? <p className="text-sm text-muted">{t("dashboard.leaderboardEmpty")}</p> :
        <ol className="flex flex-col gap-2">
          {board.rows.map(row => <li key={row.username}><Row row={row} you={t("dashboard.you")} /></li>)}
        </ol>}
      {ownRowMissing && board.me && <div className="border-t border-border pt-3">
        <p className="mb-2 text-xs text-muted">{t("dashboard.yourRank")}</p>
        <Row row={board.me} you={t("dashboard.you")} />
      </div>}
    </>}
  </Card>;
}

function Row({ row, you }: { row: LeaderboardRow; you: string }) {
  return <div className={`flex items-center gap-2 rounded-xl p-2 text-sm ${row.isCurrentUser ? "bg-brand/10" : "bg-background"}`}>
    <span className="shrink-0 font-semibold">#{row.rank}</span>
    <span className="min-w-0 flex-1 break-words">{row.username}{row.isCurrentUser && <span className="ml-1 text-xs text-muted">({you})</span>}</span>
    <span className="shrink-0"><TitleBadge label={row.title} /></span>
  </div>;
}
