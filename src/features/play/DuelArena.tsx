"use client";

// The duel screen (UI.md page 6). It shows what the server decided: it polls
// /play/duel/<id>/state every second and uses the server's clock for the countdowns.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/shared/i18n";
import type { PublicProfile } from "@/shared/types";
import { Button, Card, TitleBadge } from "@/shared/ui/primitives";
import { REACTIONS, REACTION_SHOW_MS, ROUNDS, ROUND_MS } from "./duel";
import { answerDuel, blockOpponent, cancelInvite, claimDuel, reactDuel, requestRematch, respondInvite, startBotDuel } from "./duelActions";
import type { DuelView } from "./duelStore";
import en from "./messages/en.json";
import hi from "./messages/hi.json";
import te from "./messages/te.json";

const LETTERS = ["A", "B", "C", "D"];
const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);
const RESULT_POLL_MS = 60_000; // the result screen keeps polling this long for reactions and a rematch

export function DuelArena({ id, initial, rating, opponent }: {
  id: string;
  initial: DuelView;
  rating: number;
  opponent: PublicProfile | null; // null = Paisa Bot
}) {
  const t = useT({ en, te, hi });
  const router = useRouter();
  const [view, setView] = useState(initial);
  const [offset, setOffset] = useState(0); // server clock − phone clock
  const [now, setNow] = useState(initial.now);
  const [mine, setMine] = useState<{ round: number; answer: string; correct: boolean | null } | null>(null);
  const [reward, setReward] = useState<Awaited<ReturnType<typeof claimDuel>>>(null);
  const [blocked, setBlocked] = useState<"blocked" | "reported" | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<"answer" | "claim" | "action" | null>(null);
  const [resultStale, setResultStale] = useState(false);
  const live = view.status === "active" || view.status === "invited" || (view.status === "done" && opponent !== null && !resultStale);
  const status = useRef(view.status);
  useEffect(() => { status.current = view.status; }, [view.status]);

  useEffect(() => {
    if (!live) return;
    const poll = setInterval(async () => {
      const res = await fetch(`/play/duel/${id}/state`, { cache: "no-store" }).catch(() => null);
      // A signed-out phone is redirected to the login page: go there instead of freezing.
      if (res?.redirected) return window.location.assign(res.url);
      const next: DuelView | null = res?.ok ? await res.json().catch(() => null) : null;
      if (!next) return;
      setOffset(next.now - Date.now());
      setView(next);
    }, 1_000);
    return () => clearInterval(poll);
  }, [id, live]);

  // Leaving the waiting screen takes the invite back (W3-P8). Deferred, so Strict Mode's
  // simulated unmount (immediately remounted) doesn't cancel it.
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      setTimeout(() => {
        if (!mounted.current && status.current === "invited" && !initial.invitee) void cancelInvite(id).catch(() => {});
      }, 0);
    };
  }, [id, initial.invitee]);

  useEffect(() => {
    if (view.status !== "done") return;
    const timer = setTimeout(() => setResultStale(true), RESULT_POLL_MS);
    return () => clearTimeout(timer);
  }, [view.status]);

  // Both players tapped Rematch: the new duel.
  const rematchId = view.rematch.duelId;
  useEffect(() => {
    if (rematchId) router.push(`/play/duel/${rematchId}`);
  }, [rematchId, router]);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now() + offset), 250);
    return () => clearInterval(tick);
  }, [offset]);

  // Retried a few times; if it still fails the result is credited on the next visit to Play.
  useEffect(() => {
    if (view.status !== "done") return;
    let stopped = false;
    const claim = (left: number): Promise<void> => claimDuel(id).then(
      (r) => { if (!stopped) setReward(r); },
      () => (left && !stopped ? new Promise((ok) => setTimeout(ok, 2_000)).then(() => claim(left - 1)) : setFailed("claim")),
    );
    void claim(3);
    return () => { stopped = true; };
  }, [id, view.status]);

  async function act(run: () => Promise<unknown>) {
    setBusy(true);
    setFailed(null);
    try {
      await run();
    } catch {
      setFailed("action");
    } finally {
      setBusy(false);
    }
  }

  const opponentName = opponent ? opponent.username : `🤖 ${t("duel.bot")}`;
  const shown = (r: DuelView["reactions"]["me"]) => (r && now - r.at < REACTION_SHOW_MS ? r.r : null);
  // The 4 preset reactions: the only thing players can say to each other.
  const reactions = opponent && !blocked && (
    <div className="flex flex-col items-center gap-1">
      <p className="h-6 text-sm" aria-live="polite">
        {shown(view.reactions.opponent) && <span>{opponentName}: <b>{shown(view.reactions.opponent)}</b></span>}
        {shown(view.reactions.opponent) && shown(view.reactions.me) && " · "}
        {shown(view.reactions.me) && <span>{t("duel.you")}: <b>{shown(view.reactions.me)}</b></span>}
      </p>
      <div className="flex justify-center gap-2">
        {REACTIONS.map((r) => (
          <button key={r} type="button" onClick={() => void reactDuel(id, r).catch(() => {})}
            className="min-h-11 min-w-11 rounded-full border border-border bg-surface px-3 text-lg font-semibold">
            {r}
          </button>
        ))}
      </div>
    </div>
  );
  const back = <Link href="/play" className="text-center text-brand">{t("duel.backToPlay")}</Link>;

  if (view.status === "invited") {
    const secondsLeft = <p className="text-muted">{Math.max(0, Math.ceil((view.inviteExpiresAt - now) / 1000))}{t("quiz.secondsShort")}</p>;
    if (view.invitee) {
      return (
        <Centered>
          <p><b>{opponentName}</b> {t("hub.challengesYou")}</p>
          {secondsLeft}
          <div className="grid w-full grid-cols-2 gap-2">
            <Button disabled={busy} onClick={() => act(() => respondInvite(id, true))}>{t("hub.accept")}</Button>
            <Button variant="secondary" disabled={busy} onClick={() => act(() => respondInvite(id, false))}>{t("hub.decline")}</Button>
          </div>
          {failed === "action" && <p className="text-sm text-danger">{t("duel.actionFailed")}</p>}
          {back}
        </Centered>
      );
    }
    return (
      <Centered>
        <p>{t("duel.waitingFor")} <b>{opponentName}</b></p>
        {secondsLeft}
        {back}
      </Centered>
    );
  }
  if (view.status !== "active" && view.status !== "done") {
    return <Centered><p>{t(`duel.status.${view.status}`)}</p>{back}</Centered>;
  }

  if (view.status === "done" && view.result) {
    const { outcome, forfeit } = view.result;
    return (
      <Centered>
        <h1 className="text-3xl font-bold">{t(outcome === 1 ? "duel.won" : outcome === 0.5 ? "duel.draw" : "duel.lost")}</h1>
        <p className="text-lg">{view.score.me} – {view.score.opponent} · {opponentName}</p>
        {forfeit && <p className="text-sm text-muted">{t(forfeit === "me" ? "duel.youLeft" : "duel.theyLeft")}</p>}
        {reward && (
          <>
            <p>+{reward.xp} {t("quiz.xp")} · {t("quiz.rating")}{" "}
              <span className={reward.ratingDelta < 0 ? "text-danger" : "text-success"}>{signed(reward.ratingDelta)}</span>
            </p>
            {reward.levelUp && <p className="font-semibold text-brand">🎉 {t("duel.levelUp")}</p>}
          </>
        )}
        {failed === "claim" && <p className="text-sm text-muted">{t("duel.claimFailed")}</p>}
        {reactions}
        {!opponent && (
          <Button disabled={busy} onClick={() => act(async () => router.push(`/play/duel/${await startBotDuel()}`))}>{t("duel.rematch")}</Button>
        )}
        {opponent && !blocked && !resultStale && (
          <>
            {view.rematch.theirsUntil && !view.rematch.mineUntil && (
              <p className="text-sm"><b>{opponentName}</b> {t("duel.wantsRematch")} · {secondsUntil(view.rematch.theirsUntil, now)}{t("quiz.secondsShort")}</p>
            )}
            {view.rematch.mineUntil ? (
              <p className="text-sm text-muted">{t("duel.rematchWaiting")} · {secondsUntil(view.rematch.mineUntil, now)}{t("quiz.secondsShort")}</p>
            ) : (
              <Button disabled={busy} onClick={() => act(async () => {
                const next = await requestRematch(id);
                if (next.duelId) router.push(`/play/duel/${next.duelId}`);
              })}>{t("duel.rematch")}</Button>
            )}
          </>
        )}
        {opponent && !blocked && (
          <div className="grid w-full grid-cols-2 gap-2">
            <Button variant="secondary" disabled={busy}
              onClick={() => act(() => blockOpponent(id, false).then(() => setBlocked("blocked")))}>{t("duel.block")}</Button>
            <Button variant="danger" disabled={busy}
              onClick={() => act(() => blockOpponent(id, true).then(() => setBlocked("reported")))}>{t("duel.report")}</Button>
          </div>
        )}
        {failed === "action" && <p className="text-sm text-danger">{t("duel.actionFailed")}</p>}
        {blocked && <p className="text-sm text-muted">{t(`duel.${blocked}`)}</p>}
        {back}
      </Centered>
    );
  }

  const round = view.rounds.at(-1)!;
  const n = view.rounds.length;
  const previous = view.rounds.at(-2);
  const started = now >= round.revealAt;
  const myTry = mine?.round === n ? mine : null;
  const answered = round.myAnswer ?? myTry?.answer ?? null;
  const frozen = answered !== null && myTry?.correct !== true;

  async function answer(letter: string) {
    setFailed(null);
    setMine({ round: n, answer: letter, correct: null });
    try {
      const { correct } = await answerDuel(id, n, letter);
      setMine({ round: n, answer: letter, correct });
    } catch {
      // Never reached the server: the round isn't lost, the student can tap again.
      setMine(null);
      setFailed("answer");
    }
  }

  return (
    <section className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-start justify-between text-sm">
        <div>
          <p className="font-semibold">{t("duel.you")}</p>
          <p className="text-muted">{t("quiz.rating")} {rating}</p>
          <p className="text-lg font-bold">{view.score.me}</p>
        </div>
        <div className="text-center">
          <p className="font-bold">{t("duel.round")} {n} / {ROUNDS}</p>
          {started && <p className="text-2xl">⏱️ {Math.max(0, Math.ceil((round.revealAt + ROUND_MS - now) / 1000))}</p>}
        </div>
        <div className="text-right">
          <p className="font-semibold">{opponentName}</p>
          {opponent && <TitleBadge label={opponent.title} />}
          <p className="text-lg font-bold">{view.score.opponent}</p>
        </div>
      </div>

      {!started ? (
        <Card className="flex flex-col items-center gap-2 text-center">
          {previous && <p className="font-semibold">{roundLine(previous, t, opponentName)}</p>}
          <p className="text-muted">{t("duel.round")} {n} · {Math.max(0, Math.ceil((round.revealAt - now) / 1000))}</p>
        </Card>
      ) : (
        round.question && (
          <>
            <Card><p className="text-lg font-semibold">{round.question.prompt}</p></Card>
            <div className="relative grid grid-cols-2 gap-3">
              {round.question.options.map((text, i) => {
                const letter = LETTERS[i];
                const look = letter === answered ? (myTry?.correct ? "border-success" : frozen ? "border-danger" : "border-brand") : "border-border";
                return (
                  <button key={letter} type="button" disabled={answered !== null} onClick={() => answer(letter)}
                    className={`flex min-h-14 items-start gap-2 rounded-xl border-2 bg-surface p-3 text-left text-sm ${look}`}>
                    <span className="font-bold">{letter}</span><span className="flex-1">{text}</span>
                  </button>
                );
              })}
              {frozen && myTry?.correct === false && (
                <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/80 text-xl font-bold">
                  🔒 {t("duel.frozen")}
                </div>
              )}
            </div>
            {failed === "answer" && <p className="text-center text-sm text-danger">{t("duel.answerFailed")}</p>}
            {round.opponentFrozen && <p className="text-center text-sm text-muted">{opponentName} {t("duel.opponentFrozen")}</p>}
          </>
        )
      )}
      <div className="mt-auto">{reactions}</div>
    </section>
  );
}

function roundLine(r: DuelView["rounds"][number], t: (key: string) => string, opponentName: string) {
  if (r.winner === "me") return `⭐ ${t("duel.youTookIt")} +${r.points}`;
  if (r.winner === "opponent") return `${opponentName} ${t("duel.tookIt")} (${r.correctAnswer})`;
  return `${t("duel.nobody")} (${r.correctAnswer})`;
}

const secondsUntil = (until: number, now: number) => Math.max(0, Math.ceil((until - now) / 1000));

function Centered({ children }: { children: React.ReactNode }) {
  return <section className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">{children}</section>;
}
