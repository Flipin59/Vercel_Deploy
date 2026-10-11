"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { quizHref } from "@/features/play";
import { useT } from "@/shared/i18n";
import type { Language } from "@/shared/types";
import { Button, Card, ProgressBar } from "@/shared/ui/primitives";
import { saveProgress } from "./actions";
import { chapterHref, fill } from "./chapters";
import type { ChapterBonus } from "./server";
import en from "./messages/en.json";
import hi from "./messages/hi.json";
import te from "./messages/te.json";

// Page-by-page reader (UI.md page 5). Pages are pre-rendered images in a native
// scroll-snap strip: swipe on phones, buttons and arrow keys elsewhere.
export function Reader({
  slug,
  language,
  pages,
  download,
  initialPage,
  check,
}: {
  slug: string;
  language: Language;
  pages: number;
  download: boolean; // the chapter has a PDF to download
  initialPage: number;
  check: { correct: number; total: number; bonus: ChapterBonus; bonusXp: number } | null; // the check just taken
}) {
  const t = useT({ en, te, hi });
  const title = t(`chapter.${slug}`);
  const strip = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(initialPage);

  // Open where the student left off.
  useEffect(() => {
    const el = strip.current;
    if (el) el.scrollLeft = (initialPage - 1) * el.clientWidth;
  }, [initialPage]);

  // Remember every page reached; this also records the open and, on the last page, the finish.
  useEffect(() => {
    if (pages > 0) void saveProgress(slug, page, language);
  }, [slug, page, language, pages]);

  const onScroll = () => {
    const el = strip.current;
    if (el) setPage(Math.min(pages, Math.max(1, Math.round(el.scrollLeft / el.clientWidth) + 1)));
  };
  const turn = (by: number) => {
    const el = strip.current;
    el?.scrollBy({ left: by * el.clientWidth, behavior: "smooth" });
  };

  return (
    <section className="flex flex-1 flex-col gap-3 p-4">
      <div className="flex items-center gap-2 text-sm">
        <Link href="/learn" className="text-muted">
          ← {t("reader.back")}
        </Link>
        {pages > 0 && <span className="ml-auto text-muted">{fill(t("reader.page"), { page, total: pages })}</span>}
      </div>
      <h1 className="text-xl font-bold">{title}</h1>
      {check && (
        <Card className={`text-sm ${check.bonus === "earned" || check.bonus === "already" ? "border-success" : ""}`}>
          {fill(t(`reader.check.${check.bonus}`), {
            correct: check.correct,
            total: check.total,
            xp: check.bonusXp,
          })}
        </Card>
      )}

      {pages === 0 ? (
        <p className="text-muted">{t("reader.noPages")}</p>
      ) : (
        <>
          <ProgressBar value={(page / pages) * 100} label={fill(t("reader.page"), { page, total: pages })} />
          <div
            ref={strip}
            onScroll={onScroll}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") turn(1);
              if (e.key === "ArrowLeft") turn(-1);
            }}
            className="flex snap-x snap-mandatory overflow-x-auto rounded-xl bg-surface"
          >
            {Array.from({ length: pages }, (_, i) => (
              // eslint-disable-next-line @next/next/no-img-element -- pages are pre-rendered at 720 px; the optimizer adds nothing
              <img
                key={i}
                src={`${chapterHref(slug)}/pages/${language}/${i + 1}`}
                alt={fill(t("reader.pageAlt"), { chapter: title, page: i + 1 })}
                loading={Math.abs(i + 1 - initialPage) <= 1 ? "eager" : "lazy"}
                decoding="async"
                className="h-auto w-full shrink-0 snap-start"
              />
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => turn(-1)} disabled={page <= 1}>
              ← {t("reader.prev")}
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => turn(1)} disabled={page >= pages}>
              {t("reader.next")} →
            </Button>
          </div>
          {page === pages && (
            <Link
              href={quizHref({ context: "chapter", chapterSlug: slug, returnTo: chapterHref(slug) })}
              className="rounded-xl bg-brand p-4 text-center font-semibold text-white"
            >
              🎉 {t("reader.done")} {t("reader.takeCheck")} 🎯
            </Link>
          )}
        </>
      )}
      <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
        {download && (
          <a href={`${chapterHref(slug)}/download`} download className="flex min-h-11 items-center text-brand">
            ⬇️ {t("reader.download")}
          </a>
        )}
        <Link href={`/forum?discuss=${encodeURIComponent(slug)}`} className="flex min-h-11 items-center text-brand">
          💬 {t("reader.discuss")}
        </Link>
      </div>
    </section>
  );
}
