"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useT } from "@/shared/i18n";
import type { Profile } from "@/shared/types";
import { Button, Card } from "@/shared/ui/primitives";
import { updateProfile } from "./actions";
import en from "./messages/en.json";
import te from "./messages/te.json";
import hi from "./messages/hi.json";

export default function ProfileForm({ profile, saved }: { profile: Profile; saved: boolean }) {
  const t = useT({ en, te, hi });
  const [state, action, pending] = useActionState(updateProfile, {});
  const field = "min-h-11 rounded-xl border border-border bg-background px-3";
  return <section className="flex flex-col gap-4 p-4">
    <Link href="/dashboard" className="text-muted">← {t("backDashboard")}</Link>
    <h1 className="text-2xl font-bold">{t("profileTitle")}</h1>
    <Card>
      <p className="mb-4 font-semibold">{profile.username}</p>
      <form action={action} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">{t("language")}
          <select className={field} name="language" defaultValue={profile.language} required>
            <option value="en">{t("english")}</option><option value="te">{t("telugu")}</option><option value="hi">{t("hindi")}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">{t("grade")}
          <select className={field} name="grade" defaultValue={profile.grade ?? ""} required>
            <option value="" disabled>{t("chooseGrade")}</option>
            <option value="11">{t("grade11")}</option><option value="12">{t("grade12")}</option>
          </select>
        </label>
        {state.message ? <p role="status">{t(state.message)}</p> : saved && <p role="status">{t("profileSaved")}</p>}
        <Button disabled={pending}>{t(pending ? "working" : "saveProfile")}</Button>
      </form>
    </Card>
  </section>;
}
