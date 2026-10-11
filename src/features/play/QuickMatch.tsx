"use client";

// /play/duel: the quick-match waiting screen (RECOMMENDATION.md §6). Polls findMatch
// every 2 s; after 30 s it offers Paisa Bot while the search goes on.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/shared/i18n";
import { Button } from "@/shared/ui/primitives";
import { findMatch, leaveQueue, startBotDuel } from "./duelActions";
import en from "./messages/en.json";
import hi from "./messages/hi.json";
import te from "./messages/te.json";

export function QuickMatch() {
  const t = useT({ en, te, hi });
  const router = useRouter();
  const [waited, setWaited] = useState(0);
  const [failures, setFailures] = useState(0); // consecutive failed polls
  const [bot, setBot] = useState<"idle" | "starting" | "failed">("idle");
  const searching = useRef(true);

  useEffect(() => {
    searching.current = true; // Strict Mode remounts after a simulated cleanup
    const start = Date.now();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      const duelId = await findMatch().then((r) => r.duelId, () => undefined);
      if (!searching.current) return;
      setFailures((n) => (duelId === undefined ? n + 1 : 0));
      if (duelId) return router.push(`/play/duel/${duelId}`);
      setWaited(Date.now() - start);
      timer = setTimeout(poll, 2_000);
    };
    timer = setTimeout(poll, 0);
    return () => {
      searching.current = false;
      clearTimeout(timer);
      void leaveQueue().catch(() => {});
    };
  }, [router]);

  // Stops the search first, so the student isn't matched while the bot duel starts.
  async function playBot() {
    searching.current = false;
    setBot("starting");
    try {
      router.push(`/play/duel/${await startBotDuel()}`);
    } catch {
      setBot("failed");
    }
  }

  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-4xl" aria-hidden>⚔️</p>
      <h1 className="text-xl font-bold">{t("duel.searching")}</h1>
      <p className="text-muted">{Math.floor(waited / 1000)}{t("quiz.secondsShort")}</p>
      {failures >= 3 && <p className="text-sm text-danger">{t("duel.searchFailed")}</p>}
      {waited >= 30_000 && (
        <>
          <p>{t("duel.noOne")}</p>
          <Button disabled={bot === "starting"} onClick={playBot}>🤖 {t("hub.playBot")}</Button>
          {bot === "failed" ? <p className="text-sm text-danger">{t("hub.error")}</p> : <p className="text-sm text-muted">{t("duel.keepWaiting")}</p>}
        </>
      )}
      <Link href="/play" className="text-sm text-muted">{t("duel.cancel")}</Link>
    </section>
  );
}
