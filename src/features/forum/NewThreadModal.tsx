"use client";

import { useMemo, useState } from "react";
import { useT } from "@/shared/i18n";
import { PILLARS, type Pillar } from "@/shared/types";
import { Button } from "@/shared/ui/primitives";
import { createThreadAction } from "./actions";
import en from "./messages/en.json";
import hi from "./messages/hi.json";
import te from "./messages/te.json";
import { checkSafety } from "./safety";


// What the form starts with when it is opened from a chapter (chapter title, pillar, tags).
export type ThreadDraft = { title: string; pillar: Pillar; tags: string[] };

export function NewThreadModal({
  draft,
  onClose,
  onCreated,
}: {
  draft?: ThreadDraft;
  onClose: () => void;
  onCreated: (threadId?: string) => void;
}) {
  const t = useT({ en, te, hi });

  const [title, setTitle] = useState(draft ? `${t("forum.discussPrefix")} ${draft.title}`.slice(0, 200) : "");
  const [content, setContent] = useState("");
  const [pillar, setPillar] = useState<Pillar>(draft?.pillar ?? "budget");
  const [tagsInput, setTagsInput] = useState(draft?.tags.join(", ") ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Real-time safety validation (F3)
  const safetyWarning = useMemo(() => {
    const titleCheck = checkSafety(title);
    if (!titleCheck.safe) {
      return titleCheck.violation === "email" ? t("forum.errorEmail") : t("forum.errorPhone");
    }
    const contentCheck = checkSafety(content);
    if (!contentCheck.safe) {
      return contentCheck.violation === "email" ? t("forum.errorEmail") : t("forum.errorPhone");
    }
    return null;
  }, [title, content, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (safetyWarning) return;

    if (title.trim().length < 5 || content.trim().length < 10) {
      setErrorMsg(t("forum.errorLength"));
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const tags = tagsInput
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

    try {
      const res = await createThreadAction({
        title,
        content,
        pillar,
        tags,
      });

      if (res.success) {
        onCreated(res.data);
      } else {
        setErrorMsg(res.error);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
    >
      <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-y-auto rounded-2xl border border-border bg-surface p-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h2 className="text-base font-bold text-foreground">{t("forum.startThread")}</h2>
          <button
            onClick={onClose}
            className="text-lg font-semibold text-muted transition-colors hover:text-foreground"
          >
            ✕
          </button>
        </div>

        {/* Safety Banner */}
        <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
          🛡️ {t("forum.safetyNotice")}
        </div>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          {/* Pillar selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted">{t("forum.selectPillar")}</label>
            <div className="grid grid-cols-2 gap-2">
              {PILLARS.map((p) => (
                <button
                  type="button"
                  key={p}
                  onClick={() => setPillar(p)}
                  className={`rounded-xl border p-2.5 text-left text-xs font-semibold transition-all ${
                    pillar === p
                      ? "border-brand bg-brand/10 text-brand"
                      : "border-border bg-surface-raised text-foreground hover:border-border/80"
                  }`}
                >
                  {t(`forum.pillar.${p}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted">{t("forum.newThreadTitle")}</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("forum.newThreadTitlePlaceholder")}
              className="w-full rounded-xl border border-border bg-surface-raised px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-brand"
            />
          </div>

          {/* Content */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted">{t("forum.newThreadContent")}</label>
            <textarea
              required
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t("forum.newThreadContentPlaceholder")}
              className="w-full rounded-xl border border-border bg-surface-raised px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-brand"
            />
          </div>

          {/* Tags */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted">{t("forum.tagsPlaceholder")}</label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g. 50-30-20, pocket-money, upi"
              className="w-full rounded-xl border border-border bg-surface-raised px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-brand"
            />
          </div>

          {/* Safety error / violation */}
          {safetyWarning && (
            <div className="rounded-xl border border-danger/40 bg-danger/10 p-2.5 text-xs font-semibold text-danger">
              ⚠️ {safetyWarning}
            </div>
          )}

          {errorMsg && (
            <div className="rounded-xl border border-danger/40 bg-danger/10 p-2.5 text-xs text-danger">
              {errorMsg}
            </div>
          )}

          {/* Buttons */}
          <div className="mt-2 flex items-center justify-end gap-2 border-t border-border pt-3">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isSubmitting}
              className="min-h-9 px-4 text-xs"
            >
              {t("forum.cancel")}
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting || Boolean(safetyWarning)}
              className="min-h-9 px-4 text-xs"
            >
              {isSubmitting ? "Posting..." : t("forum.postThread")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
