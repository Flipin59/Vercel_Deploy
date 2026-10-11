"use client";

// The vertical feed (UI.md page 7): one reel per screen, the 5-reel quiz gate and the
// 30-reel stop card (RECOMMENDATION.md §4, §7).
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { buildFeed, quizHref } from "@/features/play";
import { useT } from "@/shared/i18n";
import { Card, Toast } from "@/shared/ui/primitives";
import { logReelEvent, setReaction } from "../actions";
import { QUIZ_EVERY, quizReels, seededRandom, sessionFeed } from "../feed";
import en from "../messages/en.json";
import hi from "../messages/hi.json";
import te from "../messages/te.json";
import type { ReelsPageData } from "../queries";
import { ReelCard, type WatchKind } from "./ReelCard";

// Reels already shown in this tab, so a quiz round-trip doesn't restart the feed or the
// 30-reel count. Storage can be blocked (private mode): then each load is a new session.
const SEEN_KEY = "reels.seen";
function readSeen(): string[] {
  try {
    const ids: unknown = JSON.parse(sessionStorage.getItem(SEEN_KEY) ?? "[]");
    return Array.isArray(ids) ? ids.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function ReelsFeed({ data }: { data: ReelsPageData }) {
  const t = useT({ en, te, hi });
  const [muted, setMuted] = useState(true); // phones only autoplay muted video
  const [liked, setLiked] = useState(() => new Set(data.liked));
  const [saved, setSaved] = useState(() => new Set(data.saved));
  const [viewed, setViewed] = useState(data.viewedSinceQuiz);
  // Index of the last reel before the quiz gate; -1 = the gate was already waiting.
  const [gateAfter, setGateAfter] = useState<number | null>(() => (quizReels(data.viewedSinceQuiz) ? -1 : null));
  const [active, setActive] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const sent = useRef(new Set<string>()); // "<reelId>:<kind>", once per session
  // Seen ids as of this visit; null until read after hydration (the server can't see them).
  const [seen, setSeen] = useState<string[] | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- storage is readable only after hydration
  useEffect(() => setSeen(readSeen()), []);

  // Drop this session's reels *before* ranking (RECOMMENDATION.md §8), so variety and the
  // level window apply to what is actually left. A shared link's reel goes first regardless.
  const shownBefore = seen ?? [];
  const byId = new Map(data.reels.map((r) => [r.id, r]));
  const pool = data.items.filter((i) => !shownBefore.includes(i.id));
  const ranked = buildFeed(pool, data.user, { now: data.now, random: seededRandom(data.seed) }).map((i) => byId.get(i.id)!);
  const session = sessionFeed(ranked, shownBefore, data.startId ? byId.get(data.startId) : undefined);
  const shown = gateAfter === null ? session.items : session.items.slice(0, gateAfter + 1);
  const tail = gateAfter !== null ? "gate" : session.stop ? "stop" : "end";

  const activeId = seen === null ? undefined : shown[active]?.id;
  useEffect(() => {
    if (!activeId) return;
    const ids = readSeen();
    if (ids.includes(activeId)) return;
    try {
      sessionStorage.setItem(SEEN_KEY, JSON.stringify([...ids, activeId]));
    } catch {
      // Storage full or blocked.
    }
  }, [activeId]);

  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.index));
      },
      { root, threshold: 0.6 },
    );
    for (const el of root.querySelectorAll("[data-index]")) io.observe(el);
    return () => io.disconnect();
  }, [shown.length, seen]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(id);
  }, [toast]);

  function onWatch(index: number, reelId: string, kind: WatchKind) {
    const key = `${reelId}:${kind}`;
    if (sent.current.has(key)) return;
    sent.current.add(key);
    logReelEvent(reelId, kind).catch(() => {}); // offline: the event is lost, the feed goes on
    if (kind !== "view" || viewed.includes(reelId)) return;
    const next = [...viewed, reelId];
    setViewed(next);
    if (next.length >= QUIZ_EVERY && gateAfter === null) setGateAfter(index);
  }

  function react(kind: "like" | "save", reelId: string, on: boolean) {
    const set = kind === "like" ? setLiked : setSaved;
    const update = (want: boolean) => (s: Set<string>) => {
      const copy = new Set(s);
      if (want) copy.add(reelId);
      else copy.delete(reelId);
      return copy;
    };
    set(update(on));
    const undo = () => set(update(!on));
    setReaction(reelId, kind, on).then((ok) => ok || undo(), undo);
  }

  async function share(reelId: string, title: string) {
    const url = `${location.origin}/reels?r=${encodeURIComponent(reelId)}`;
    try {
      if (navigator.share) await navigator.share({ title, url });
      else {
        await navigator.clipboard.writeText(url);
        setToast(t("reel.linkCopied"));
      }
      logReelEvent(reelId, "share").catch(() => {});
    } catch {
      // Share sheet closed.
    }
  }

  // A waiting quiz gate shows even when nothing is left to rank (W3-R1).
  if (data.reels.length === 0 && gateAfter === null) {
    return <p className="p-6 text-center text-muted">{t("feed.empty")}</p>;
  }

  return (
    <div className="fixed inset-x-0 top-16 bottom-18 mx-auto max-w-md">
      <span className="pointer-events-none absolute top-3 left-3 z-10 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white">
        {t("feed.watched").replace("{n}", String(Math.min(viewed.length, QUIZ_EVERY)))}
      </span>
      <div
        ref={scroller}
        aria-label={t("feed.label")}
        className="h-full snap-y snap-mandatory overflow-y-scroll overscroll-contain [scrollbar-width:none]"
      >
        {shown.map((reel, i) => {
          const base = reel.likes === null ? null : reel.likes - (data.liked.includes(reel.id) ? 1 : 0);
          return (
            <div key={reel.id} data-index={i} className="h-full snap-start snap-always">
              <ReelCard
                reel={reel}
                active={i === active}
                preload={i === active + 1}
                muted={muted}
                liked={liked.has(reel.id)}
                saved={saved.has(reel.id)}
                likeCount={base === null ? null : base + (liked.has(reel.id) ? 1 : 0)}
                t={t}
                onToggleMute={() => setMuted((m) => !m)}
                onLike={(on) => react("like", reel.id, on)}
                onSave={(on) => react("save", reel.id, on)}
                onShare={() => share(reel.id, reel.title)}
                onWatch={(kind) => onWatch(i, reel.id, kind)}
              />
            </div>
          );
        })}

        <div data-index={shown.length} className="flex h-full snap-start snap-always items-center p-6">
          {tail === "gate" ? (
            <Card className="w-full text-center">
              <p className="text-4xl" aria-hidden>🧠</p>
              <h2 className="mt-2 text-xl font-bold">{t("gate.title")}</h2>
              <p className="mt-2 text-muted">{t("gate.body")}</p>
              {/* The gate stays until this quiz is finished; leaving it early brings it back. */}
              <Link
                href={quizHref({ context: "reel", reelIds: quizReels(viewed) ?? viewed, returnTo: "/reels" })}
                className="mt-4 block rounded-xl bg-brand px-4 py-3 font-semibold text-white"
              >
                {t("gate.cta")}
              </Link>
            </Card>
          ) : tail === "stop" ? (
            <Card className="w-full text-center">
              <p className="text-4xl" aria-hidden>🛑</p>
              <h2 className="mt-2 text-xl font-bold">{t("stop.title")}</h2>
              <p className="mt-2 text-muted">{t("stop.body")}</p>
              <Link href="/play" className="mt-4 block rounded-xl bg-brand px-4 py-3 font-semibold text-white">
                {t("stop.cta")}
              </Link>
            </Card>
          ) : (
            <Card className="w-full text-center">
              <p className="text-4xl" aria-hidden>✨</p>
              <h2 className="mt-2 text-xl font-bold">{t("end.title")}</h2>
              <p className="mt-2 text-muted">{t("end.body")}</p>
              <div className="mt-4 flex gap-2">
                <Link href="/play" className="flex-1 rounded-xl bg-brand px-4 py-3 font-semibold text-white">
                  {t("end.play")}
                </Link>
                <Link href="/learn" className="flex-1 rounded-xl border border-border px-4 py-3 font-semibold">
                  {t("end.learn")}
                </Link>
              </div>
            </Card>
          )}
        </div>
      </div>
      {toast && <Toast message={toast} />}
    </div>
  );
}
