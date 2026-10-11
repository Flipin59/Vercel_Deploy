"use client";

// The Play hub's screen (UI.md page 6 entry, IMPLEMENTATION.md P8). Invites are polled
// every 5 s while it is open.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useT } from "@/shared/i18n";
import { createClient } from "@/shared/supabase/client";
import { PILLARS, type PublicProfile } from "@/shared/types";
import { Button, Card, TitleBadge } from "@/shared/ui/primitives";
import { challengeFriend, getInvites, joinCode, respondInvite, startBotDuel } from "./duelActions";
import en from "./messages/en.json";
import hi from "./messages/hi.json";
import te from "./messages/te.json";
import { quizHref } from "./quizHref";
import { CHOICE_SIMS } from "./sim";

type Invite = Awaited<ReturnType<typeof getInvites>>[number];
const CHIP = "rounded-full border border-border bg-surface px-3 py-2 text-sm";

export function PlayHubView({ friends, userId, realtime }: {
  friends: PublicProfile[];
  userId: string;
  realtime: boolean; // false in the local demo (no Supabase)
}) {
  const t = useT({ en, te, hi });
  const router = useRouter();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [code, setCode] = useState("");
  const [online, setOnline] = useState<Set<string>>(new Set());

  // Who is on the Play hub right now (Realtime presence on play:lobby, RECOMMENDATION.md §6).
  // Display only: it never decides a match. Only friends' dots are shown.
  useEffect(() => {
    if (!realtime) return;
    const supabase = createClient();
    const lobby = supabase.channel("play:lobby", { config: { presence: { key: userId } } });
    lobby
      .on("presence", { event: "sync" }, () => setOnline(new Set(Object.keys(lobby.presenceState()))))
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void lobby.track({});
      });
    return () => {
      void supabase.removeChannel(lobby);
    };
  }, [realtime, userId]);

  useEffect(() => {
    const load = () => getInvites().then(setInvites, () => {});
    load();
    const timer = setInterval(load, 5_000);
    return () => clearInterval(timer);
  }, []);

  async function go(start: () => Promise<string | void>) {
    setBusy(true);
    setError(false);
    try {
      const id = await start();
      if (id) router.push(`/play/duel/${id}`);
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  async function decline(id: string) {
    setBusy(true);
    setError(false);
    try {
      await respondInvite(id, false);
      setInvites((l) => l.filter((x) => x.id !== id));
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-4 p-4">
      {invites.map((inv) => (
        <Card key={inv.id} className="flex flex-col gap-2 border-brand">
          <p>
            <b>{inv.username}</b> <TitleBadge label={inv.title} /> {t("hub.challengesYou")}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button disabled={busy} onClick={() => go(() => respondInvite(inv.id, true).then(() => inv.id))}>{t("hub.accept")}</Button>
            <Button variant="secondary" disabled={busy} onClick={() => decline(inv.id)}>
              {t("hub.decline")}
            </Button>
          </div>
        </Card>
      ))}

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">⚔️ {t("hub.duel")}</h2>
        <div className="grid grid-cols-2 gap-2">
          <Link href="/play/duel" className="flex min-h-11 items-center justify-center rounded-xl bg-brand px-4 font-semibold text-white">
            {t("hub.quickMatch")}
          </Link>
          <Button variant="secondary" disabled={busy} onClick={() => go(startBotDuel)}>🤖 {t("hub.playBot")}</Button>
        </div>
        {error && <p className="text-sm text-danger">{t("hub.error")}</p>}
        <p className="text-sm text-muted">{t("hub.challengeFriend")}</p>
        {friends.length === 0 && <p className="text-sm text-muted">{t("hub.noFriends")}</p>}
        {friends.map((f) => (
          <div key={f.id} className="flex items-center gap-2">
            <span className="flex-1 truncate">
              {online.has(f.id) && <span title={t("hub.online")} aria-label={t("hub.online")}>🟢 </span>}
              {f.username} <TitleBadge label={f.title} /> {f.level && <span className="text-xs text-muted">{t("hub.level")} {f.level}</span>}
            </span>
            <Button variant="secondary" disabled={busy} onClick={() => go(() => challengeFriend(f.id))}>{t("hub.challenge")}</Button>
          </div>
        ))}
        <p className="text-sm text-muted">🏫 {t("code.title")}</p>
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
            placeholder={t("code.enter")}
            aria-label={t("code.enter")}
            autoCapitalize="characters"
            autoComplete="off"
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 font-mono tracking-widest"
          />
          <Button variant="secondary" disabled={busy || code.length !== 6} onClick={() => go(() => joinCode(code))}>{t("code.join")}</Button>
        </div>
        <Link href="/play/code" className="text-sm text-brand">{t("code.showMine")} →</Link>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">🎯 {t("hub.practice")}</h2>
        <div className="flex flex-wrap gap-2">
          <Link className={CHIP} href={quizHref({ context: "practice", returnTo: "/play" })}>{t("hub.mixed")}</Link>
          {PILLARS.map((p) => (
            <Link key={p} className={CHIP} href={quizHref({ context: "practice", returnTo: "/play", pillar: p })}>
              {t(`hub.pillar.${p}`)}
            </Link>
          ))}
        </div>
      </Card>

      <Card className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">🧮 {t("hub.simulations")}</h2>
        <Link href="/play/sim/survive-month" className="text-brand">{t("sim.title")} →</Link>
        {Object.keys(CHOICE_SIMS).map((id) => (
          <Link key={id} href={`/play/sim/${id}`} className="text-brand">{t(`sims.${id}.title`)} →</Link>
        ))}
      </Card>
    </section>
  );
}
