"use client";

// A choice simulation's screen (/play/sim/<id>). Shows the cards from CHOICE_SIMS; the
// score and XP come from finishChoiceSim, which replays the choices on the server.
import Link from "next/link";
import { useState } from "react";
import { useT } from "@/shared/i18n";
import { Button, Card } from "@/shared/ui/primitives";
import { finishChoiceSim } from "./actions";
import en from "./messages/en.json";
import hi from "./messages/hi.json";
import te from "./messages/te.json";
import { CHOICE_SIMS, type ChoiceSimId } from "./sim";

const LINK_BUTTON = "flex min-h-11 items-center justify-center rounded-xl border border-border bg-surface px-4 font-semibold";

type Result = Awaited<ReturnType<typeof finishChoiceSim>>;

export function ChoiceSim({ id }: { id: ChoiceSimId }) {
  const t = useT({ en, te, hi });
  const { cards } = CHOICE_SIMS[id];
  const [started, setStarted] = useState(false);
  const [choices, setChoices] = useState<number[]>([]);
  const [picked, setPicked] = useState<number | null>(null); // choice on screen, lesson shown
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const step = choices.length;
  const card = cards[step];

  function restart() {
    setChoices([]);
    setPicked(null);
    setResult(null);
  }

  async function finish(all: number[]) {
    setBusy(true);
    setFailed(false);
    try {
      setResult(await finishChoiceSim(id, all));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  function next() {
    const all = [...choices, picked!];
    setChoices(all);
    setPicked(null);
    if (all.length === cards.length) void finish(all);
  }

  if (!started) {
    return (
      <section className="flex flex-1 flex-col justify-center gap-4 p-6 text-center">
        <h1 className="text-2xl font-bold">{t(`sims.${id}.title`)}</h1>
        <p>{t(`sims.${id}.intro`)}</p>
        <p className="text-sm text-muted">{t(`sims.${id}.assumptions`)}</p>
        <Button onClick={() => setStarted(true)}>{t("sim.start")}</Button>
      </section>
    );
  }

  if (result) {
    return (
      <section className="flex flex-1 flex-col justify-center gap-3 p-6 text-center">
        <h1 className="text-2xl font-bold">{t("sims.done")}</h1>
        <p>{t("sims.best")}: {result.best} / {result.cards}</p>
        <p className="text-lg font-semibold">{t("sim.score")}: {result.score} / 100 · +{result.xp} {t("sim.xp")}</p>
        <p className="text-sm text-muted">{t("sim.xpOnce")}</p>
        <p className="text-sm text-muted">{t(`sims.${id}.assumptions`)}</p>
        <div className="mt-4 grid gap-2">
          <Button onClick={restart}>{t("sim.again")}</Button>
          <Link href="/play" className={LINK_BUTTON}>{t("sim.back")}</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-1 flex-col gap-4 p-4">
      <p className="text-sm text-muted">{t("sim.choice")} {Math.min(step + 1, cards.length)} / {cards.length}</p>
      {card && (
        <Card className="flex flex-col gap-3">
          <p className="text-lg font-semibold">{t(`sims.${id}.${card.key}.title`)}</p>
          {card.points.map((_, i) => (
            <button
              key={i}
              type="button"
              disabled={picked !== null}
              onClick={() => setPicked(i)}
              className={`min-h-12 rounded-xl border-2 bg-background px-3 py-2 text-left text-sm disabled:opacity-60 ${picked === i ? "border-brand" : "border-border"}`}
            >
              {t(`sims.${id}.${card.key}.${i}`)}
            </button>
          ))}
        </Card>
      )}
      {card && picked !== null && (
        <Card className="flex flex-col gap-3">
          <p className="text-sm">💡 {t(`sims.${id}.${card.key}.lesson${picked}`)}</p>
          <Button onClick={next}>{step + 1 < cards.length ? t("sim.next") : t("sim.seeResult")}</Button>
        </Card>
      )}
      {!card && !failed && <p className="text-center text-sm text-muted">{t("sims.scoring")}</p>}
      {!card && failed && (
        <Card className="flex flex-col gap-3 text-center">
          <p className="text-sm text-danger">{t("sims.failed")}</p>
          <Button disabled={busy} onClick={() => finish(choices)}>{t("sims.retry")}</Button>
        </Card>
      )}
    </section>
  );
}
