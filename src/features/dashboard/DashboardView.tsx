"use client";

import Link from "next/link";
import { useT } from "@/shared/i18n";
import type { XpSummary } from "@/shared/progress";
import type { Profile } from "@/shared/types";
import { Card } from "@/shared/ui/primitives";
import { Badges } from "./Badges";
import type { Badge, WeeklyGoal } from "./badges";
import en from "./messages/en.json";
import hi from "./messages/hi.json";
import te from "./messages/te.json";
import { Leaderboard, type Leaderboards } from "./Leaderboard";
import { PillarProgress } from "./PillarProgress";
import { ProfileCard } from "./ProfileCard";

export function DashboardView({
  profile,
  summary,
  achievements,
  leaderboards,
  continueLinks,
}: {
  profile: Profile;
  summary: XpSummary | null; // null: progress couldn't be loaded
  achievements: { badges: Badge[]; goals: WeeklyGoal[] } | null; // null with no summary
  leaderboards: Leaderboards;
  continueLinks: { reel: string; chapter: string };
}) {
  const t = useT({ en, te, hi });

  return (
    <div className="flex flex-col gap-5 p-4">
      {/* Welcome header banner */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted">{t("dashboard.greeting")}</p>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {profile.username}
          </h1>
        </div>
        <Link
          href="/forum/friends"
          className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:text-foreground"
        >
          👥 {t("dashboard.friendsHub")} →
        </Link>
      </div>

      {/* CELL 1: Profile Status Bar (D1) */}
      {summary ? <ProfileCard profile={profile} summary={summary} /> : <Card className="text-sm text-muted">{t("dashboard.progressError")}</Card>}
      <Link href="/profile" className="self-start text-sm font-semibold text-brand">{t("dashboard.editProfile")}</Link>

      {/* CELL 2: Pillar Bars (D2) */}
      {summary && <PillarProgress pillarXp={summary.pillarXp} />}

      {/* CELL 3: Continue & Fast Navigation Shortcuts */}
      <Card className="flex flex-col gap-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted">
          🚀 {t("dashboard.continueHeading")}
        </h2>
        <div className="grid grid-cols-2 gap-2.5">
          <Link
            href={continueLinks.reel}
            className="flex flex-col gap-1 rounded-xl border border-border bg-surface-raised/40 p-3 transition-all hover:border-brand/40"
          >
            <div className="flex items-center gap-1.5">
              <span className="text-base">📱</span>
              <span className="text-xs font-bold text-foreground">
                {t("dashboard.reelsShortcut")}
              </span>
            </div>
            <p className="text-[10px] text-muted">{t(continueLinks.reel === "/reels" ? "dashboard.reelsDesc" : "dashboard.resumeReel")}</p>
          </Link>

          <Link
            href="/play"
            className="flex flex-col gap-1 rounded-xl border border-border bg-surface-raised/40 p-3 transition-all hover:border-brand/40"
          >
            <div className="flex items-center gap-1.5">
              <span className="text-base">⚔️</span>
              <span className="text-xs font-bold text-foreground">
                {t("dashboard.playShortcut")}
              </span>
            </div>
            <p className="text-[10px] text-muted">{t("dashboard.playDesc")}</p>
          </Link>

          <Link
            href={continueLinks.chapter}
            className="flex flex-col gap-1 rounded-xl border border-border bg-surface-raised/40 p-3 transition-all hover:border-brand/40"
          >
            <div className="flex items-center gap-1.5">
              <span className="text-base">📚</span>
              <span className="text-xs font-bold text-foreground">
                {t("dashboard.learnShortcut")}
              </span>
            </div>
            <p className="text-[10px] text-muted">{t(continueLinks.chapter === "/learn" ? "dashboard.learnDesc" : "dashboard.resumeChapter")}</p>
          </Link>

          <Link
            href="/forum"
            className="flex flex-col gap-1 rounded-xl border border-border bg-surface-raised/40 p-3 transition-all hover:border-brand/40"
          >
            <div className="flex items-center gap-1.5">
              <span className="text-base">💬</span>
              <span className="text-xs font-bold text-foreground">
                {t("dashboard.forumShortcut")}
              </span>
            </div>
            <p className="text-[10px] text-muted">{t("dashboard.forumDesc")}</p>
          </Link>
        </div>
      </Card>

      {achievements && <Badges badges={achievements.badges} goals={achievements.goals} />}

      <Leaderboard boards={leaderboards} />
    </div>
  );
}
