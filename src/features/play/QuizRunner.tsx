"use client";

// The quiz screen every feature uses (QUIZ.md §2–4), with the answer review (UI.md
// page 9) as a second view. Mounted only by /play/quiz; other features link there
// with quizHref(). Every amount shown comes from submitAnswer's result.
import Link from "next/link";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { chapterHref } from "@/features/learn";
import { useT } from "@/shared/i18n";
import { getLevel, getTitle } from "@/shared/rating";
import { Button, Card, Celebration, ProgressBar, TitleBadge } from "@/shared/ui/primitives";
import { revealAnswer, showQuestion, submitAnswer } from "./actions";
import en from "./messages/en.json";
import hi from "./messages/hi.json";
import te from "./messages/te.json";
import type { Tag } from "@/shared/types";
import type { AnswerResult, QuizContext, QuizQuestion } from "./types";

const SECONDS = 30;
const LETTERS = ["A", "B", "C", "D"];
const LINK_BUTTON = "flex min-h-11 items-center justify-center rounded-xl bg-brand px-4 font-semibold text-white";
const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

type Answered = AnswerResult & { question: QuizQuestion; answer: string };
type Phase = "ask" | "correct" | "wrong" | "reveal" | "error" | "done" | "review";

export function QuizRunner({
  context,
  returnTo,
  attemptId,
  questions,
  start,
  learnMore = {},
}: {
  context: QuizContext;
  returnTo: string;
  attemptId: string;
  questions: QuizQuestion[];
  start: { coins: number; rating: number; totalXp: number };
  learnMore?: Partial<Record<Tag, string>>; // tag → chapter slug, reel quizzes only
}) {
  const t = useT({ en, te, hi });
  const [index, setIndex] = useState(0);
  const [tryNo, setTryNo] = useState<1 | 2>(1);
  const [phase, setPhase] = useState<Phase>(questions.length ? "ask" : "done");
  const [left, setLeft] = useState(SECONDS);
  const [busy, setBusy] = useState(false);
  const [coins, setCoins] = useState(start.coins);
  const [result, setResult] = useState<Answered | null>(null); // the try on screen
  const [answered, setAnswered] = useState<Answered[]>([]); // first tries: they count
  const [celebrated, setCelebrated] = useState(false);
  const [skipped, setSkipped] = useState(0); // first tries that never reached the server
  const retry = useRef<() => void>(() => {});
  const shownAt = useRef(0);
  const question = questions[index];
  // The caller checks this attempt on its own server (Learn's chapter bonus).
  const back = `${returnTo}${returnTo.includes("?") ? "&" : "?"}attempt=${attemptId}`;

  // Fills in the correct answer once it is known, on screen and in the review list.
  function showKey(key: { correctAnswer?: string; explanation?: string }) {
    setResult((r) => r && { ...r, ...key });
    setAnswered((a) => a.map((x) => (x.question.id === question.id ? { ...x, ...key } : x)));
  }

  async function submit(answer: string) {
    if (busy) return;
    retry.current = () => submit(answer);
    setBusy(true);
    try {
      // A timeout is sent as an empty answer at the full 30 s (QUIZ.md §3).
      const timeMs = answer ? Math.min(SECONDS * 1000, Date.now() - shownAt.current) : SECONDS * 1000;
      const res = await submitAnswer({ attemptId, questionId: question.id, answer, timeMs, try: tryNo });
      const r = { ...res, question, answer };
      setCoins((c) => c + r.coins);
      if (tryNo === 1) setAnswered((a) => [...a, r]);
      setResult(r);
      if (tryNo === 2) showKey(res);
      setPhase(r.correct ? "correct" : tryNo === 1 && context !== "placement" ? "wrong" : "reveal");
    } catch {
      setPhase("error");
    } finally {
      setBusy(false);
    }
  }

  async function reveal() {
    if (busy) return;
    retry.current = reveal;
    setBusy(true);
    try {
      showKey(await revealAnswer({ attemptId, questionId: question.id }));
      setPhase("reveal");
    } catch {
      setPhase("error");
    } finally {
      setBusy(false);
    }
  }

  const next = () => (index + 1 < questions.length ? ask(index + 1, 1) : setPhase("done"));

  function ask(i: number, nextTry: 1 | 2) {
    setIndex(i);
    setTryNo(nextTry);
    setLeft(SECONDS);
    setResult(null);
    setPhase("ask");
  }

  const onTimeUp = useEffectEvent(() => submit(""));
  useEffect(() => {
    if (phase !== "ask") return;
    shownAt.current = Date.now();
    // Placement remembers the question on screen: leaving now makes it a timeout (W3-P6).
    if (context === "placement") void showQuestion({ attemptId, questionId: questions[index].id }).catch(() => {});
    const id = setInterval(() => {
      const s = SECONDS - Math.floor((Date.now() - shownAt.current) / 1000);
      setLeft(Math.max(0, s));
      if (s <= 0) {
        clearInterval(id);
        onTimeUp();
      }
    }, 250);
    return () => clearInterval(id);
  }, [phase, index, tryNo, context, attemptId, questions]);

  const correctCount = answered.filter((a) => a.correct).length;
  const score = `${correctCount} / ${questions.length}`;
  const endLink = (
    <Link prefetch={context === "placement" ? false : undefined} href={back} className={LINK_BUTTON}>
      {t("quiz.end")}
    </Link>
  );

  if (phase === "done") {
    const xp = answered.reduce((n, a) => n + a.xp, 0);
    const ratingDelta = answered.reduce((n, a) => n + a.ratingDelta, 0);
    const before = getLevel(start.totalXp);
    const after = getLevel(start.totalXp + xp);
    const title = getTitle(after.level).label;
    return (
      <section className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        {questions.length ? (
          <>
            <h1 className="text-2xl font-bold">{t("quiz.completed")}</h1>
            {skipped > 0 && <p className="text-sm text-danger">{t("quiz.notCounted")}</p>}
            {/* Placement resumes over several visits, so this screen sees only part of it; onboarding shows the result. No coins in placement. */}
            {context !== "placement" && (
              <>
                <p className="text-lg">🎯 {t("quiz.youAnswered")} {score}</p>
                <p>
                  <span className="text-coin">🪙 {signed(coins - start.coins)} {t("quiz.coins")}</span> · +{xp} {t("quiz.xp")}
                </p>
              </>
            )}
            <p>
              {t("quiz.rating")} {start.rating + ratingDelta}{" "}
              <span className={ratingDelta < 0 ? "text-danger" : "text-success"}>({signed(ratingDelta)})</span>
            </p>
            {after.level > before.level && (
              <p className="font-semibold text-brand">🎉 {t("quiz.levelUp")} {after.level}</p>
            )}
            <div className="mt-4 grid w-full gap-2">
              <Button variant="secondary" onClick={() => setPhase("review")}>📊 {t("quiz.review")}</Button>
              {endLink}
            </div>
            {title !== getTitle(before.level).label && !celebrated && (
              <Celebration title={t("quiz.titleUp")} closeLabel={t("quiz.continue")} onClose={() => setCelebrated(true)}>
                <TitleBadge label={title} />
              </Celebration>
            )}
          </>
        ) : (
          <>
            <p className="text-muted">{t("quiz.empty")}</p>
            {endLink}
          </>
        )}
      </section>
    );
  }

  if (phase === "review") {
    return (
      <section className="flex flex-col gap-4 p-4">
        <div className="flex items-center justify-between text-sm">
          <button type="button" onClick={() => setPhase("done")} className="text-muted">
            ← {t("quiz.backToSummary")}
          </button>
          <span>{score}</span>
        </div>
        <h1 className="text-xl font-bold">{t("quiz.review")}</h1>
        {answered.map((a, i) => (
          <Card key={a.question.id} className="flex flex-col gap-3">
            <div className="flex justify-between text-sm text-muted">
              <span>{t("quiz.question")} {i + 1} / {questions.length}</span>
              <span>{a.correct ? "✅" : "❌"}</span>
            </div>
            <p className="text-xs text-muted">#{a.question.tag}</p>
            <p className="font-semibold">{a.question.prompt}</p>
            <Options question={a.question} chosen={a.answer} correctAnswer={a.correctAnswer} />
            {a.explanation && <p className="rounded-xl bg-background p-3 text-sm">💡 {a.explanation}</p>}
          </Card>
        ))}
        {endLink}
      </section>
    );
  }

  return (
    <section className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between text-sm">
        <Link prefetch={context === "placement" ? false : undefined} href={back} aria-label={t("quiz.exit")} className="text-lg">✕</Link>
        <span className={left <= 5 ? "font-bold text-danger" : ""}>
          ⏱️ {left}{t("quiz.secondsShort")}
        </span>
        <span>{index + 1} / {questions.length}</span>
      </div>
      <ProgressBar value={((index + 1) / questions.length) * 100} />
      <Card>
        {question.englishOnly && <p className="mb-1 text-xs text-muted">{t("quiz.englishOnly")}</p>}
        <p className="text-lg font-semibold">{question.prompt}</p>
      </Card>
      <Options
        grid
        question={question}
        chosen={result?.answer}
        correctAnswer={phase === "correct" || phase === "reveal" ? result?.correctAnswer : undefined}
        onPick={phase === "ask" && !busy ? submit : undefined}
      />
      {result && phase !== "error" && (
        <Card className="flex flex-col gap-3">
          <p className={`font-bold ${phase === "correct" ? "text-success" : "text-danger"}`}>
            {phase === "correct" ? `✅ ${t("quiz.correct")}` : `❌ ${t("quiz.wrong")}`}
          </p>
          {phase === "correct" && tryNo === 2 && <p>{t("quiz.coinReturned")}</p>}
          {phase === "correct" && tryNo === 1 && result.coins > 0 && (
            <p className="text-coin">🪙 +{result.coins} {t("quiz.coins")}</p>
          )}
          {phase === "wrong" ? (
            <div className="grid gap-2">
              {context !== "placement" && (
                <Button disabled={busy || coins < 1} onClick={() => ask(index, 2)}>
                  🪙 {coins < 1 ? t("quiz.notEnoughCoins") : t("quiz.reattempt")}
                </Button>
              )}
              <Button variant="secondary" disabled={busy} onClick={reveal}>📖 {t("quiz.showAnswer")}</Button>
            </div>
          ) : (
            <>
              {result.explanation && <p className="text-sm">💡 {result.explanation}</p>}
              {!result.correct && learnMore[question.tag] && (
                <Link href={chapterHref(learnMore[question.tag]!)} className="text-center text-sm font-semibold text-brand">
                  📚 {t("quiz.learnMore")}
                </Link>
              )}
              <Button onClick={next}>{t("quiz.next")}</Button>
            </>
          )}
        </Card>
      )}
      {phase === "error" && (
        <Card className="flex flex-col gap-3">
          <p className="text-danger">{t("quiz.error")}</p>
          <Button disabled={busy} onClick={() => retry.current()}>{t("quiz.retry")}</Button>
          <Button variant="secondary" disabled={busy}
            onClick={() => { if (tryNo === 1 && !result) setSkipped((n) => n + 1); next(); }}>{t("quiz.skip")}</Button>
        </Card>
      )}
    </section>
  );
}

// A–D options. Highlighting follows UI.md page 9: the student's right answer green,
// a wrong choice red, and the correct answer dashed green once it is revealed.
function Options({
  question,
  chosen,
  correctAnswer,
  onPick,
  grid,
}: {
  question: QuizQuestion;
  chosen?: string;
  correctAnswer?: string;
  onPick?: (answer: string) => void;
  grid?: boolean;
}) {
  const t = useT({ en, te, hi });
  return (
    <div className={`grid gap-3 ${grid ? "grid-cols-2" : ""}`}>
      {question.options?.map((text, i) => {
        const letter = LETTERS[i];
        const isChosen = letter === chosen;
        const isCorrect = letter === correctAnswer;
        const look = isChosen && isCorrect ? "border-success" : isChosen ? "border-danger" : isCorrect ? "border-dashed border-success" : "border-border";
        const label = isChosen && isCorrect ? "quiz.yourAnswerCorrect" : isChosen && correctAnswer ? "quiz.yourChoice" : isCorrect ? "quiz.correctAnswer" : "";
        return (
          <button
            key={letter}
            type="button"
            disabled={!onPick}
            onClick={() => onPick?.(letter)}
            className={`flex min-h-14 items-start gap-2 rounded-xl border-2 bg-surface p-3 text-left text-sm ${look}`}
          >
            <span className="font-bold">{letter}</span>
            <span className="flex-1">
              {text}
              {label && <span className="mt-1 block text-xs font-semibold">{t(label)}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
