"use client";

// Weekly goals and badges (Wave 3b). Display only: neither gives XP or coins.
import { useT } from "@/shared/i18n";
import { Card, ProgressBar } from "@/shared/ui/primitives";
import type { Badge, WeeklyGoal } from "./badges";
import en from "./messages/en.json";
import hi from "./messages/hi.json";
import te from "./messages/te.json";

export function Badges({ badges, goals }: { badges: Badge[]; goals: WeeklyGoal[] }) {
  const t = useT({ en, te, hi });
  return (
    <>
      <Card className="flex flex-col gap-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted">🎯 {t("dashboard.goalsHeading")}</h2>
        {goals.map((g) => (
          <div key={g.id} className="flex flex-col gap-1">
            <div className="flex justify-between text-sm">
              <span>{g.value >= g.target ? "✅ " : ""}{t(`dashboard.goal.${g.id}`)}</span>
              <span className="text-muted">{g.value} / {g.target}</span>
            </div>
            <ProgressBar value={(g.value / g.target) * 100} label={t(`dashboard.goal.${g.id}`)} />
          </div>
        ))}
      </Card>
      <Card className="flex flex-col gap-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted">
          🏅 {t("dashboard.badgesHeading")} · {badges.filter((b) => b.earned).length} / {badges.length}
        </h2>
        <ul className="grid grid-cols-3 gap-2">
          {badges.map((b) => (
            <li key={b.id} className={`flex flex-col items-center gap-1 rounded-xl border border-border p-2 text-center ${b.earned ? "" : "opacity-40 grayscale"}`}>
              <span className="text-2xl" aria-hidden>{b.icon}</span>
              <span className="text-[11px] leading-tight">{t(`dashboard.badge.${b.id}`)}</span>
              <span className="sr-only">{t(b.earned ? "dashboard.badgeEarned" : "dashboard.badgeLocked")}</span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
