"use client";

// /cohort: a teacher's classes and their members' progress (Wave 3b). Shows username,
// title, level and XP only (D13).
import Link from "next/link";
import { useT } from "@/shared/i18n";
import { PILLARS } from "@/shared/types";
import { Card, TitleBadge } from "@/shared/ui/primitives";
import type { Cohort } from "./cohort";
import CohortCreate from "./CohortCreate";
import en from "./messages/en.json";
import hi from "./messages/hi.json";
import te from "./messages/te.json";

export default function CohortView({ cohorts }: { cohorts: Cohort[] }) {
  const t = useT({ en, te, hi });
  return (
    <section className="flex flex-col gap-4 p-4">
      <Link href="/profile" className="text-muted">← {t("profileTitle")}</Link>
      <h1 className="text-2xl font-bold">{t("cohortTeacherTitle")}</h1>
      {cohorts.map((c) => (
        <Card key={c.id} className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-semibold">{c.name}</h2>
            <p className="text-sm text-muted">{t("cohortCode")}: <span className="font-mono font-bold tracking-widest text-foreground">{c.code}</span></p>
          </div>
          {c.members.length === 0 ? (
            <p className="text-sm text-muted">{t("cohortEmpty")}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {c.members.map((m) => (
                <li key={m.username} className="flex flex-col gap-1 border-t border-border pt-3 text-sm">
                  <p className="flex flex-wrap items-center gap-2">
                    <b>{m.username}</b> <TitleBadge label={m.title} />
                    <span className="text-muted">{t("cohortLevel")} {m.level}</span>
                    <span className="ml-auto">{m.weeklyXp} {t("cohortWeeklyXp")}</span>
                  </p>
                  <p className="text-xs text-muted">
                    {PILLARS.map((p) => `${t(`cohortPillar_${p}`)} ${m.pillarXp[p]}`).join(" · ")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ))}
      <Card className="flex flex-col gap-3">
        <h2 className="font-semibold">{t("cohortNew")}</h2>
        <CohortCreate />
      </Card>
    </section>
  );
}
