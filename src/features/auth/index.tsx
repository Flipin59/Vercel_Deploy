"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useT } from "@/shared/i18n";
import { Button, Card } from "@/shared/ui/primitives";
import { authenticate, signOut } from "./actions";
import en from "./messages/en.json";
import te from "./messages/te.json";
import hi from "./messages/hi.json";

export default function AuthFeature({ demo = false, verificationFailed = false }: {
  demo?: boolean; verificationFailed?: boolean;
}) {
  const t = useT({ en, te, hi });
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [state, action, pending] = useActionState(authenticate, {});
  const field = "min-h-11 w-full rounded-xl border border-border bg-background px-3";
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 p-5">
      <h1 className="text-3xl font-bold text-brand">{t("brand")}</h1>
      <p className="text-muted">{t("intro")}</p>
      <Card>
        <h2 className="mb-4 text-xl font-semibold">{t(mode)}</h2>
        {verificationFailed && <p role="alert" className="mb-4 text-danger">{t("verificationFailed")}</p>}
        {demo && <p className="mb-4 text-muted">{t("demoNotice")}</p>}
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="mode" value={mode} />
          <label className="flex flex-col gap-1">{t("email")}
            <input className={field} name="email" type="email" autoComplete="email" maxLength={254} required />
          </label>
          {mode === "signup" && <label className="flex flex-col gap-1">{t("username")}
            <input className={field} name="username" autoComplete="username" pattern="[a-zA-Z0-9_]{3,24}" minLength={3} maxLength={24} required aria-describedby="username-help" />
            <span id="username-help" className="text-sm text-muted">{t("usernameHint")}</span>
          </label>}
          <label className="flex flex-col gap-1">{t("password")}
            <input className={field} name="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={mode === "signup" ? 8 : 1} maxLength={128} required />
          </label>
          {state.message && <p role="status">{t(state.message)}</p>}
          <Button disabled={pending || demo}>{t(pending ? "working" : mode)}</Button>
          <Button type="button" variant="secondary" disabled={pending} onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
            {t(mode === "signin" ? "switchSignup" : "switchSignin")}
          </Button>
        </form>
      </Card>
      {demo && <Link className="rounded-xl border border-border p-3 text-center" href="/dashboard">{t("exploreDemo")}</Link>}
    </main>
  );
}

export function SignOutButton() {
  const t = useT({ en, te, hi });
  const [state, action, pending] = useActionState(signOut, {});
  return <form action={action} className="p-4">
    <Button variant="secondary" disabled={pending}>{t(pending ? "working" : "signout")}</Button>
    {state.message && <p role="status">{t(state.message)}</p>}
  </form>;
}
