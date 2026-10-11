"use client";

import Link from "next/link";
import { useState } from "react";
import { useT } from "@/shared/i18n";
import { PILLARS, type Pillar } from "@/shared/types";
import { Card } from "@/shared/ui/primitives";
import { chapterHref, fill } from "./chapters";
import en from "./messages/en.json";
import hi from "./messages/hi.json";
import te from "./messages/te.json";

export type LibraryChapter = {
  slug: string;
  pillar: Pillar;
  level: number;
  pages: number;
  page: number | null; // last page reached, null if never opened
  finished: boolean;
  readFirst: string | null; // an unfinished prerequisite; the chapter still opens
};

const PILLAR_STYLE: Record<Pillar, { icon: string; className: string }> = {
  budget: { icon: "📊", className: "border-amber-400 bg-amber-400/15" },
  save: { icon: "🐷", className: "border-emerald-400 bg-emerald-400/15" },
  invest: { icon: "📈", className: "border-sky-400 bg-sky-400/15" },
  safety: { icon: "🛡️", className: "border-rose-400 bg-rose-400/15" },
};

// The library screen (RECOMMENDATION.md §5, UI.md page 5). Nothing is ever locked.
export function Library({
  chapters,
  continueReading,
  recommended,
}: {
  chapters: LibraryChapter[];
  continueReading: string[]; // slugs, most recent first
  recommended: { slug: string; score: number }[]; // best first
}) {
  const t = useT({ en, te, hi });
  const [query, setQuery] = useState("");
  const bySlug = new Map(chapters.map((c) => [c.slug, c]));
  const title = (slug: string) => t(`chapter.${slug}`);
  const matches = chapters.filter((c) => title(c.slug).toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <section className="flex flex-col gap-6 p-4">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("library.search")}
        aria-label={t("library.search")}
        className="min-h-11 rounded-xl border border-border bg-surface px-4"
      />

      {!query && recommended.length > 0 && (
        <div>
          <h2 className="mb-3 font-semibold">{t("library.recommended")}</h2>
          {/* Bubble radius 45–95 px from the recommendation score (UI.md §4). */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            {recommended.map(({ slug, score }) => {
              const size = 2 * (45 + 50 * Math.min(1, Math.max(0, score)));
              const { icon, className } = PILLAR_STYLE[bySlug.get(slug)?.pillar ?? "budget"];
              return (
                <Link
                  key={slug}
                  href={chapterHref(slug)}
                  style={{ width: size, height: size }}
                  className={`flex flex-col items-center justify-center rounded-full border-2 p-3 text-center text-xs font-semibold ${className}`}
                >
                  <span aria-hidden className="text-2xl">{icon}</span>
                  {title(slug)}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {!query && continueReading.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="font-semibold">{t("library.continue")}</h2>
          {continueReading.map((slug) => (
            <ChapterRow key={slug} chapter={bySlug.get(slug)!} title={title(slug)} t={t} />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-4">
        <h2 className="font-semibold">{t("library.all")}</h2>
        {matches.length === 0 && <p className="text-muted">{t("library.empty")}</p>}
        {PILLARS.map((pillar) => {
          const list = matches.filter((c) => c.pillar === pillar);
          if (list.length === 0) return null;
          return (
            <div key={pillar} className="flex flex-col gap-2">
              <h3 className="text-sm text-muted">
                {PILLAR_STYLE[pillar].icon} {t(`pillar.${pillar}`)}
              </h3>
              {list.map((c) => (
                <ChapterRow key={c.slug} chapter={c} title={title(c.slug)} t={t} />
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ChapterRow({ chapter, title, t }: { chapter: LibraryChapter; title: string; t: (key: string) => string }) {
  const status = chapter.finished
    ? `✓ ${t("library.finished")}`
    : chapter.page
      ? fill(t("library.pageOf"), { page: chapter.page, total: chapter.pages })
      : fill(t("library.level"), { level: chapter.level });
  return (
    <Link href={chapterHref(chapter.slug)}>
      <Card className="flex flex-col gap-1">
        <span className="font-semibold">{title}</span>
        <span className="text-sm text-muted">{status}</span>
        {chapter.readFirst && (
          <span className="text-xs text-coin">{fill(t("library.readFirst"), { chapter: t(`chapter.${chapter.readFirst}`) })}</span>
        )}
      </Card>
    </Link>
  );
}
