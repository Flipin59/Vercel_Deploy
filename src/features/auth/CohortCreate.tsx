"use client";

import { useActionState } from "react";
import { useT } from "@/shared/i18n";
import { Button } from "@/shared/ui/primitives";
import { createCohort } from "./actions";
import en from "./messages/en.json";
import hi from "./messages/hi.json";
import te from "./messages/te.json";

export default function CohortCreate() {
  const t = useT({ en, te, hi });
  const [state, action, pending] = useActionState(createCohort, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">{t("cohortName")}
        <input name="name" required maxLength={60} className="min-h-11 rounded-xl border border-border bg-background px-3" />
      </label>
      {state.message && <p role="status">{t(state.message)}</p>}
      <Button disabled={pending}>{t("cohortCreate")}</Button>
    </form>
  );
}
