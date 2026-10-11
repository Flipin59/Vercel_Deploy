"use client";

import { useT } from "@/shared/i18n";
import type { Pillar } from "@/shared/types";
import { Card } from "@/shared/ui/primitives";
import en from "./messages/en.json";
import hi from "./messages/hi.json";
import te from "./messages/te.json";

const PILLAR_META: Record<
  Pillar,
  { icon: string; labelKey: string; colorClass: string; barBgClass: string }
> = {
  budget: {
    icon: "📊",
    labelKey: "dashboard.budget",
    colorClass: "text-blue-400",
    barBgClass: "bg-blue-500",
  },
  save: {
    icon: "💰",
    labelKey: "dashboard.save",
    colorClass: "text-emerald-400",
    barBgClass: "bg-emerald-500",
  },
  invest: {
    icon: "📈",
    labelKey: "dashboard.invest",
    colorClass: "text-amber-400",
    barBgClass: "bg-amber-500",
  },
  safety: {
    icon: "🛡️",
    labelKey: "dashboard.safety",
    colorClass: "text-purple-400",
    barBgClass: "bg-purple-500",
  },
};

export function PillarProgress({
  pillarXp,
}: {
  pillarXp: Record<Pillar, number>;
}) {
  const t = useT({ en, te, hi });

  const pillars: Pillar[] = ["budget", "save", "invest", "safety"];
  const maxPillarXp = Math.max(...pillars.map((p) => pillarXp[p] ?? 0), 0);

  // Find strongest pillar (if any XP > 0)
  let strongestPillar: Pillar | null = null;
  if (maxPillarXp > 0) {
    strongestPillar = pillars.find((p) => (pillarXp[p] ?? 0) === maxPillarXp) ?? null;
  }

  // Find weakest / growth focus pillar
  let minPillarXp = Infinity;
  let growthPillar: Pillar | null = null;
  for (const p of pillars) {
    const xp = pillarXp[p] ?? 0;
    if (xp < minPillarXp) {
      minPillarXp = xp;
      growthPillar = p;
    }
  }

  return (
    <Card className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-foreground">{t("dashboard.pillarHeading")}</h2>
          <p className="text-[11px] text-muted">{t("dashboard.pillarSub")}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {pillars.map((p) => {
          const meta = PILLAR_META[p];
          const xp = pillarXp[p] ?? 0;
          const relativePercent =
            maxPillarXp > 0 ? Math.min(100, Math.round((xp / maxPillarXp) * 100)) : 0;
          const isStrongest = strongestPillar === p;
          const isGrowth = maxPillarXp > 0 && growthPillar === p && !isStrongest;

          return (
            <div key={p} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 font-semibold text-foreground">
                  <span>{meta.icon}</span>
                  <span>{t(meta.labelKey)}</span>
                  {isStrongest && (
                    <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-400">
                      ★ {t("dashboard.strongestPillar")}
                    </span>
                  )}
                  {isGrowth && (
                    <span className="rounded bg-brand/15 px-1.5 py-0.5 text-[9px] font-bold text-brand">
                      🌱 {t("dashboard.growthPillar")}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-bold text-foreground">{xp} XP</span>
                  <span className="text-[10px] text-muted">({relativePercent}%)</span>
                </div>
              </div>

              {/* Progress bar relative to strongest pillar */}
              <div className="h-2 w-full overflow-hidden rounded-full bg-border">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${meta.barBgClass}`}
                  style={{ width: `${relativePercent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
