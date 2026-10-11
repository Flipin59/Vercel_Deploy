"use client";

// One full-screen reel: video, gestures (UI.md page 7) and the action rail.
import Link from "next/link";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { COMPLETE_RATIO, SKIP_MS } from "../feed";
import type { ReelCardData } from "../queries";

const HOLD_MS = 300;
const DOUBLE_TAP_MS = 300;

export type WatchKind = "view" | "complete" | "skip";

export function ReelCard({
  reel,
  active,
  preload,
  muted,
  liked,
  saved,
  likeCount,
  t,
  onToggleMute,
  onLike,
  onSave,
  onShare,
  onWatch,
}: {
  reel: ReelCardData;
  active: boolean;
  preload: boolean; // the next reel: fetch it, don't play it
  muted: boolean;
  liked: boolean;
  saved: boolean;
  likeCount: number | null;
  t: (key: string) => string;
  onToggleMute: () => void;
  onLike: (on: boolean) => void;
  onSave: (on: boolean) => void;
  onShare: () => void;
  onWatch: (kind: WatchKind) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const [paused, setPaused] = useState(false); // press & hold in the centre
  const [blocked, setBlocked] = useState(false); // autoplay refused (iOS Low Power Mode, data saver)
  const [fast, setFast] = useState(false); // press & hold top right
  const [hearts, setHearts] = useState<{ id: number; x: number; y: number }[]>([]);

  // Seconds of the clip actually played, so looping and seeking can't inflate it.
  const watched = useRef({ ms: 0, last: 0, view: false, complete: false });
  const onWatchRef = useRef(onWatch);
  useEffect(() => {
    onWatchRef.current = onWatch;
  });

  const src = active || preload ? reel.videoUrl : undefined;

  // Always pause when not active: a reel that loses its src keeps playing otherwise.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (!active) v.pause();
    else
      v.play().catch((e: Error) => {
        if (e.name === "NotAllowedError") setBlocked(true);
      });
  }, [active]);

  // Leaving a reel before 3 s is a skip.
  useEffect(() => {
    if (!active) return;
    const w = watched.current;
    return () => {
      if (w.ms > 0 && !w.view) onWatchRef.current("skip");
    };
  }, [active]);

  function onTimeUpdate() {
    const v = videoRef.current;
    if (!v || !active) return; // only the on-screen reel counts toward view/complete/quiz
    const w = watched.current;
    const step = v.currentTime - w.last;
    w.last = v.currentTime;
    if (step <= 0 || step > 1.5) return; // loop restart or seek
    w.ms += step * 1000;
    if (!w.view && w.ms >= SKIP_MS) {
      w.view = true;
      onWatchRef.current("view");
    }
    if (w.view && !w.complete && v.duration > 0 && w.ms >= v.duration * 1000 * COMPLETE_RATIO) {
      w.complete = true;
      onWatchRef.current("complete");
    }
  }

  const gesture = useRef<{ timer?: ReturnType<typeof setTimeout>; held: boolean; lastTap: number }>({
    held: false,
    lastTap: 0,
  });

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const topRight = e.clientX - box.left > box.width * 0.7 && e.clientY - box.top < box.height * 0.3;
    const g = gesture.current;
    g.held = false;
    clearTimeout(g.timer);
    g.timer = setTimeout(() => {
      g.held = true;
      const v = videoRef.current;
      if (topRight) {
        if (v) v.playbackRate = 2;
        setFast(true);
      } else {
        v?.pause();
        setPaused(true);
      }
    }, HOLD_MS);
  }

  function endHold() {
    const v = videoRef.current;
    if (fast) {
      if (v) v.playbackRate = 1;
      setFast(false);
    }
    if (paused) {
      if (active) v?.play().catch(() => {});
      setPaused(false);
    }
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    clearTimeout(g.timer);
    if (g.held) {
      g.held = false;
      endHold();
      return;
    }
    const now = Date.now();
    if (now - g.lastTap < DOUBLE_TAP_MS) {
      g.lastTap = 0;
      const box = e.currentTarget.getBoundingClientRect();
      const heart = { id: now, x: e.clientX - box.left, y: e.clientY - box.top };
      setHearts((h) => [...h, heart]);
      setTimeout(() => setHearts((h) => h.filter((x) => x.id !== heart.id)), 700);
      if (!liked) onLike(true);
    } else {
      g.lastTap = now;
    }
  }

  // The browser took the touch for scrolling: undo any hold.
  function onPointerCancel() {
    const g = gesture.current;
    clearTimeout(g.timer);
    if (g.held) endHold();
    g.held = false;
  }

  const missing = failed;

  return (
    <article className="relative h-full w-full overflow-hidden bg-black" aria-label={reel.title}>
      {missing ? (
        <div className="flex h-full items-center justify-center p-8 text-center text-muted">{t("reel.videoMissing")}</div>
      ) : (
        <video
          ref={videoRef}
          src={src}
          preload={src ? "auto" : "none"}
          muted={muted}
          loop
          playsInline
          disablePictureInPicture
          onTimeUpdate={onTimeUpdate}
          onPlay={() => setBlocked(false)}
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      )}

      {/* Gesture layer: double tap = like, hold = pause, hold top right = 2× */}
      <div
        className="absolute inset-0 touch-pan-y select-none [-webkit-touch-callout:none]"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerLeave={onPointerCancel}
        onContextMenu={(e) => e.preventDefault()}
      >
        {hearts.map((h) => (
          <span
            key={h.id}
            aria-hidden
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 animate-ping text-6xl"
            style={{ left: h.x, top: h.y }}
          >
            ❤️
          </span>
        ))}
      </div>

      {active && blocked && !missing && (
        <button
          type="button"
          onClick={() => videoRef.current?.play().catch(() => {})}
          aria-label={t("reel.play")}
          className="absolute inset-0 m-auto flex size-20 items-center justify-center rounded-full bg-black/60 text-4xl text-white"
        >
          <span aria-hidden>▶</span>
        </button>
      )}

      {fast && (
        <span className="pointer-events-none absolute top-3 right-3 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white">
          ⏩ {t("reel.speed")}
        </span>
      )}

      {!paused && (
        <>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 pr-20 text-white">
            <h2 className="font-bold">{reel.title}</h2>
            <p className="mt-1 text-sm">{reel.captions}</p>
            <p className="mt-1 text-xs text-white/70">{reel.hashtags.map((h) => `#${h}`).join(" ")}</p>
            {reel.pillar === "invest" && <p className="mt-2 text-xs text-white/70">{t("reel.investNote")}</p>}
          </div>

          <div className="absolute right-2 bottom-6 flex flex-col items-center gap-4 text-white">
            <RailButton
              icon={liked ? "❤️" : "🤍"}
              label={likeCount === null ? t("reel.like") : String(likeCount)}
              ariaLabel={t("reel.like")}
              pressed={liked}
              onClick={() => onLike(!liked)}
            />
            <RailButton
              icon="🔖"
              label={saved ? t("reel.saved") : t("reel.save")}
              ariaLabel={t("reel.save")}
              pressed={saved}
              onClick={() => onSave(!saved)}
            />
            <RailButton icon="📤" label={t("reel.share")} onClick={onShare} />
            {reel.chapter && (
              <Link href={`/learn/${reel.chapter}`} className="flex flex-col items-center text-xs">
                <span aria-hidden className="text-2xl">📖</span>
                {t("reel.chapter")}
              </Link>
            )}
            <RailButton
              icon={muted ? "🔇" : "🔊"}
              label={muted ? t("reel.unmute") : t("reel.mute")}
              onClick={onToggleMute}
            />
          </div>
        </>
      )}
    </article>
  );
}

function RailButton({
  icon,
  label,
  ariaLabel,
  pressed,
  onClick,
}: {
  icon: string;
  label: string;
  ariaLabel?: string;
  pressed?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={pressed}
      className="flex min-h-11 min-w-11 flex-col items-center text-xs"
    >
      <span aria-hidden className="text-2xl">{icon}</span>
      {label}
    </button>
  );
}
