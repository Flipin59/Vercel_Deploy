"use client";

import { useActionState } from "react";
import { useLanguage, useT } from "@/shared/i18n";
import { Button, Card } from "@/shared/ui/primitives";
import { PILLARS, type Language, type Profile } from "@/shared/types";
import { completeOnboarding } from "./actions";
import en from "./messages/en.json";
import te from "./messages/te.json";
import hi from "./messages/hi.json";

export default function Onboarding({ profile, placement }: {
  profile: Profile;
  placement: { answered: number; total: number; correct: number } | null;
}) {
  const t = useT({ en, te, hi });
  const { language, setLanguage } = useLanguage();
  const [state, action, pending] = useActionState(completeOnboarding, {});
  const field = "min-h-11 rounded-xl border border-border bg-background px-3";
  return <main className="mx-auto flex w-full max-w-md flex-col gap-4 p-5">
    <h1 className="text-2xl font-bold">{t("onboardingTitle")}</h1>
    <p className="text-muted">{t("onboardingIntro")}</p>
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">{t("language")}
        <select className={field} name="language" value={language} onChange={e => setLanguage(e.target.value as Language)}>
          <option value="en">{t("english")}</option><option value="te">{t("telugu")}</option><option value="hi">{t("hindi")}</option>
        </select>
      </label>
      <label className="flex flex-col gap-1">{t("grade")}
        <select className={field} name="grade" defaultValue={profile.grade ?? ""} required>
          <option value="" disabled>{t("chooseGrade")}</option>
          <option value="11">{t("grade11")}</option><option value="12">{t("grade12")}</option>
        </select>
      </label>
      {PILLARS.map(pillar => <Card key={pillar}>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-semibold">{t(`question_${pillar}`)}</legend>
          {["new", "learning", "confident"].map(answer => <label key={answer} className="flex min-h-11 items-center gap-3">
            <input type="radio" name={pillar} value={answer} defaultChecked={profile.persona?.answers?.[pillar] === answer} required />{t(answer)}
          </label>)}
        </fieldset>
      </Card>)}
      {state.message && <p role="status">{t(state.message)}</p>}
      <Card className="flex flex-col gap-3">
        <h2 className="font-semibold">{t("placementTitle")}</h2>
        <p className="text-sm text-muted">{t("placementIntro")}</p>
        {placement && <p role="status">{t("placementProgress")
          .replace("{answered}", String(placement.answered)).replace("{total}", String(placement.total))}</p>}
        {placement && placement.answered === placement.total ? (
          <p>{t("placementResult").replace("{correct}", String(placement.correct)).replace("{total}", String(placement.total))}</p>
        ) : <Button name="intent" value="placement" disabled={pending}>
          {t(placement ? "resumePlacement" : "takePlacement")}
        </Button>}
        <Button name="intent" value="finish" variant="secondary" disabled={pending}>
          {t(pending ? "working" : placement && placement.answered === placement.total ? "finishOnboarding" : "skipPlacement")}
        </Button>
      </Card>
    </form>
  </main>;
}
