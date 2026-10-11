"use client";

// "Survive the month" screen (P6). Shows the cards from SIM; the score and XP come from
// finishSim, which replays the choices on the server.
import Link from "next/link";
import { useState } from "react";
import { useT } from "@/shared/i18n";
import { Button, Card } from "@/shared/ui/primitives";
import { finishSim } from "./actions";
import en from "./messages/en.json";
import hi from "./messages/hi.json";
import te from "./messages/te.json";
import { SIM } from "./sim";

const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const LINK_BUTTON = "flex min-h-11 items-center justify-center rounded-xl border border-border bg-surface px-4 font-semibold";

type Result = Awaited<ReturnType<typeof finishSim>>;

export function SimRunner() {
  const t = useT({ en, te, hi });
  const [started, setStarted] = useState(false);
  const [choices, setChoices] = useState<number[]>([]);
  const [picked, setPicked] = useState<number | null>(null); // choice on screen, lesson shown
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const step = choices.length;
  const card = SIM.cards[step];
  const balance = SIM.start - choices.reduce((n, c, i) => n + SIM.cards[i].costs[c], 0);

  function restart() {
    setChoices([]);
    setPicked(null);
    setResult(null);
  }

  async function next() {
    const all = [...choices, picked!];
    setChoices(all);
    setPicked(null);
    if (all.length < SIM.cards.length) return;
    setBusy(true);
    try {
      setResult(await finishSim(SIM.id, all));
    } finally {
      setBusy(false);
    }
  }

  if (!started) {
    return (
      <section className="flex flex-1 flex-col justify-center gap-4 p-6 text-center">
        <h1 className="text-2xl font-bold">{t("sim.title")}</h1>
        <p className="text-4xl font-bold text-coin">{rupees(SIM.start)}</p>
        <p>{t("sim.intro")}</p>
        <p className="text-sm text-muted">{t("sim.assumptions")}</p>
        <Button onClick={() => setStarted(true)}>{t("sim.start")}</Button>
      </section>
    );
  }

  if (result) {
    return (
      <section className="flex flex-1 flex-col justify-center gap-3 p-6 text-center">
        <h1 className="text-2xl font-bold">{t("sim.done")}</h1>
        <p>{t("sim.needsPaid")}: {result.needsPaid} / {result.needs}</p>
        <p>{t("sim.moneyLeft")}: <span className="text-coin">{rupees(result.balance)}</span></p>
        <p className="text-lg font-semibold">{t("sim.score")}: {result.score} / 100 · +{result.xp} {t("sim.xp")}</p>
        <p className="text-sm text-muted">{t("sim.xpOnce")}</p>
        <div className="mt-4 grid gap-2">
          <Button onClick={restart}>{t("sim.again")}</Button>
          <Link href="/play" className={LINK_BUTTON}>{t("sim.back")}</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex justify-between text-sm text-muted">
        <span>{t("sim.choice")} {Math.min(step + 1, SIM.cards.length)} / {SIM.cards.length}</span>
        <span>{t("sim.moneyLeft")}: <span className="font-semibold text-coin">{rupees(balance)}</span></span>
      </div>
      {card && (
        <Card className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-muted">{t(card.need ? "sim.need" : "sim.want")}</p>
          <p className="text-lg font-semibold">{t(`sim.${card.key}.title`)}</p>
          {card.costs.map((cost, i) => (
            <button
              key={i}
              type="button"
              disabled={picked !== null || cost > balance}
              onClick={() => setPicked(i)}
              className={`flex min-h-12 items-center justify-between rounded-xl border-2 bg-background px-3 text-left text-sm disabled:opacity-50 ${picked === i ? "border-brand" : "border-border"}`}
            >
              <span>{t(`sim.${card.key}.${i}`)}</span>
              <span className="font-semibold">{rupees(cost)}</span>
            </button>
          ))}
        </Card>
      )}
      {card && picked !== null && (
        <Card className="flex flex-col gap-3">
          <p className="text-sm">💡 {t(`sim.${card.key}.lesson${picked}`)}</p>
          <Button disabled={busy} onClick={next}>
            {step + 1 < SIM.cards.length ? t("sim.next") : t("sim.seeResult")}
          </Button>
        </Card>
      )}
    </section>
  );
}
