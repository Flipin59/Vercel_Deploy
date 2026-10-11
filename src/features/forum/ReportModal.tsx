"use client";

import { useState } from "react";
import { useT } from "@/shared/i18n";
import { Button } from "@/shared/ui/primitives";
import { reportContentAction } from "./actions";
import en from "./messages/en.json";
import hi from "./messages/hi.json";
import te from "./messages/te.json";
import type { ReportReason } from "./types";

export function ReportModal({
  target,
  onClose,
  onReported,
}: {
  target: { threadId?: string; replyId?: string };
  onClose: () => void;
  onReported: () => void;
}) {
  const t = useT({ en, te, hi });
  const [reason, setReason] = useState<ReportReason>("personal_info");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await reportContentAction({
        threadId: target.threadId,
        replyId: target.replyId,
        reason,
      });
      if (res.success) {
        onReported();
      }
    } finally {
      setIsSubmitting(false);
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-5 shadow-2xl">
        <h3 className="text-base font-bold text-foreground">{t("forum.reportPrompt")}</h3>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          <label className="flex items-center gap-2.5 rounded-xl border border-border bg-surface-raised p-3 text-xs text-foreground cursor-pointer">
            <input
              type="radio"
              name="reportReason"
              value="personal_info"
              checked={reason === "personal_info"}
              onChange={() => setReason("personal_info")}
              className="accent-brand"
            />
            {t("forum.reportReasonPersonal")}
          </label>

          <label className="flex items-center gap-2.5 rounded-xl border border-border bg-surface-raised p-3 text-xs text-foreground cursor-pointer">
            <input
              type="radio"
              name="reportReason"
              value="harassment"
              checked={reason === "harassment"}
              onChange={() => setReason("harassment")}
              className="accent-brand"
            />
            {t("forum.reportReasonHarassment")}
          </label>

          <label className="flex items-center gap-2.5 rounded-xl border border-border bg-surface-raised p-3 text-xs text-foreground cursor-pointer">
            <input
              type="radio"
              name="reportReason"
              value="spam"
              checked={reason === "spam"}
              onChange={() => setReason("spam")}
              className="accent-brand"
            />
            {t("forum.reportReasonSpam")}
          </label>

          <label className="flex items-center gap-2.5 rounded-xl border border-border bg-surface-raised p-3 text-xs text-foreground cursor-pointer">
            <input
              type="radio"
              name="reportReason"
              value="other"
              checked={reason === "other"}
              onChange={() => setReason("other")}
              className="accent-brand"
            />
            {t("forum.reportReasonOther")}
          </label>

          <div className="mt-2 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isSubmitting}
              className="min-h-9 px-3 text-xs"
            >
              {t("forum.cancel")}
            </Button>
            <Button
              type="submit"
              variant="danger"
              disabled={isSubmitting}
              className="min-h-9 px-3 text-xs"
            >
              {t("forum.report")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
