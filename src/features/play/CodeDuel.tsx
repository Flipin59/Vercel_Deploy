"use client";

// /play/code: shows the student's classroom code (RECOMMENDATION.md §6) and waits for a
// classmate to type it in. Polls codeStatus every 2 s; leaving the screen cancels the code.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/shared/i18n";
import { cancelCode, codeStatus, createCode } from "./duelActions";
import en from "./messages/en.json";
import hi from "./messages/hi.json";
import te from "./messages/te.json";

export function CodeDuel() {
  const t = useT({ en, te, hi });
  const router = useRouter();
  const [code, setCode] = useState<{ code: string; expiresAt: number } | null>(null);
  const [state, setState] = useState<"waiting" | "joined" | "expired" | "failed">("waiting");
  const [now, setNow] = useState(() => Date.now());
  const created = useRef(false); // Strict Mode mounts twice: one code only
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    if (!created.current) {
      created.current = true;
      createCode().then(setCode, () => setState("failed"));
    }
    return () => {
      mounted.current = false;
      // Deferred, so Strict Mode's simulated unmount doesn't cancel the code.
      setTimeout(() => {
        if (!mounted.current) void cancelCode().catch(() => {});
      }, 0);
    };
  }, []);

  useEffect(() => {
    if (!code || state !== "waiting") return;
    const poll = setInterval(async () => {
      setNow(Date.now());
      const status = await codeStatus().catch(() => null);
      if (status?.duelId) {
        setState("joined"); // stops polling: the code row is gone now and would read "expired"
        router.push(`/play/duel/${status.duelId}`);
      }
      else if (status?.expired) setState("expired");
    }, 2_000);
    return () => clearInterval(poll);
  }, [code, state, router]);

  const minutes = code ? Math.max(0, Math.ceil((code.expiresAt - now) / 60_000)) : 0;
  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-4xl" aria-hidden>🏫</p>
      {state === "failed" && <p className="text-danger">{t("hub.error")}</p>}
      {state === "expired" && <p>{t("code.expired")}</p>}
      {state === "waiting" && code && (
        <>
          <h1 className="text-xl font-bold">{t("code.show")}</h1>
          <p className="font-mono text-4xl font-bold tracking-widest" aria-label={code.code.split("").join(" ")}>{code.code}</p>
          <p className="text-muted">{t("code.validFor").replace("{n}", String(minutes))}</p>
        </>
      )}
      <Link href="/play" className="text-sm text-muted">{t(state === "waiting" ? "duel.cancel" : "duel.backToPlay")}</Link>
    </section>
  );
}
