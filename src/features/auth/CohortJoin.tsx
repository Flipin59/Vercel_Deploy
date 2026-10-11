"use client";

// The class section of /profile (Wave 3b): join a teacher's cohort with its code, or leave it.
import Link from "next/link";
import { useActionState } from "react";
import { useT } from "@/shared/i18n";
import { Button, Card } from "@/shared/ui/primitives";
import { joinCohort, leaveCohort } from "./actions";
import en from "./messages/en.json";
import hi from "./messages/hi.json";
import te from "./messages/te.json";

export default function CohortJoin({ cohortName, teacher }: { cohortName: string | null; teacher: boolean }) {
  const t = useT({ en, te, hi });
  const [joined, join, joining] = useActionState(joinCohort, {});
  const [left, leave, leaving] = useActionState(leaveCohort, {});
  const message = joined.message ?? left.message;
  return (
    <Card className="mx-4 mb-4 flex flex-col gap-3">
      <h2 className="font-semibold">🏫 {t("cohortTitle")}</h2>
      {teacher && <Link href="/cohort" className="text-brand">{t("cohortTeacherLink")} →</Link>}
      {cohortName ? (
        <form action={leave} className="flex flex-col gap-3">
          <p>{t("cohortIn")} <b>{cohortName}</b></p>
          <p className="text-sm text-muted">{t("cohortPrivacy")}</p>
          <Button variant="secondary" disabled={leaving}>{t("cohortLeave")}</Button>
        </form>
      ) : (
        <form action={join} className="flex flex-col gap-3">
          <p className="text-sm text-muted">{t("cohortPrivacy")}</p>
          <label className="flex flex-col gap-1">{t("cohortCode")}
            <input name="code" required minLength={6} maxLength={6} autoCapitalize="characters" autoComplete="off"
              className="min-h-11 rounded-xl border border-border bg-background px-3 font-mono uppercase tracking-widest" />
          </label>
          <Button disabled={joining}>{t("cohortJoin")}</Button>
        </form>
      )}
      {message && <p role="status">{t(message)}</p>}
    </Card>
  );
}
