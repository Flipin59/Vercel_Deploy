"use client";

import { useT } from "@/shared/i18n";
import type { XpSummary } from "@/shared/progress";
import type { Profile } from "@/shared/types";
import { Card, ProgressBar, TitleBadge } from "@/shared/ui/primitives";
import en from "./messages/en.json";
import hi from "./messages/hi.json";
import te from "./messages/te.json";

export function ProfileCard({
  profile,
  summary,
}: {
  profile: Profile;
  summary: XpSummary;
}) {
  const t = useT({ en, te, hi });

  return (
    <Card className="flex flex-col gap-4 border-brand/20 bg-gradient-to-b from-surface to-surface-raised/40 p-4 shadow-lg">
      {/* Top row: Avatar, Username, Title Badge */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/15 text-lg font-bold text-brand shadow-inner">
            {profile.username.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-foreground">{profile.username}</h2>
              {profile.grade && (
                <span className="rounded-md bg-surface-raised px-1.5 py-0.5 text-[10px] font-semibold text-muted">
                  {t("dashboard.grade")} {profile.grade}
                </span>
              )}
            </div>
            <p className="text-xs text-muted">
              {t("dashboard.level")} {summary.level} · {summary.title.label}
            </p>
          </div>
        </div>

        <TitleBadge label={summary.title.label} />
      </div>

      {/* Level Progress Bar */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-foreground">
            {t("dashboard.progress")} {summary.level + 1}
          </span>
          <span className="font-bold text-brand">{summary.progress}%</span>
        </div>
        <ProgressBar value={summary.progress} label={`${summary.progress}%`} />
        <div className="flex justify-between text-[10px] text-muted">
          <span>{summary.progress} / 100 XP</span>
          <span>{t("dashboard.xpToGo").replace("{xp}", String(100 - summary.progress))}</span>
        </div>
      </div>

      {/* Bottom stats row: Skill Rating, Streak, Coins */}
      <div className="grid grid-cols-3 gap-2 border-t border-border/70 pt-3 text-center">
        <div className="flex flex-col items-center rounded-xl bg-surface-raised/50 p-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
            {t("dashboard.rating")}
          </span>
          <span className="text-sm font-extrabold text-foreground">🎯 {summary.rating}</span>
          <span className="text-[9px] text-muted">{t("dashboard.skillLevel")}</span>
        </div>

        <div className="flex flex-col items-center rounded-xl bg-surface-raised/50 p-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
            {t("dashboard.streak")}
          </span>
          <span className="text-sm font-extrabold text-amber-400">🔥 {summary.streakDays}</span>
          <span className="text-[9px] text-muted">{t("dashboard.streakDays")}</span>
        </div>

        <div className="flex flex-col items-center rounded-xl bg-surface-raised/50 p-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
            {t("dashboard.coins")}
          </span>
          <span className="text-sm font-extrabold text-coin">🪙 {summary.coins}</span>
          <span className="text-[9px] text-muted">{t("dashboard.reattempts")}</span>
        </div>
      </div>
    </Card>
  );
}
