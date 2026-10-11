"use client";

import { useMemo, useState, useTransition } from "react";
import { useT } from "@/shared/i18n";
import type { Pillar } from "@/shared/types";
import { Button, Toast } from "@/shared/ui/primitives";
import { getThreadDetailAction } from "./actions";
import en from "./messages/en.json";
import hi from "./messages/hi.json";
import te from "./messages/te.json";
import { NewThreadModal, type ThreadDraft } from "./NewThreadModal";
import { ThreadCard } from "./ThreadCard";
import { ThreadDetailView } from "./ThreadDetailView";
import type { ForumThread, ThreadDetail } from "./types";

const FILTER_PILLARS: { key: "all" | Pillar; labelKey: string }[] = [
  { key: "all", labelKey: "forum.filterAll" },
  { key: "budget", labelKey: "forum.filterBudget" },
  { key: "save", labelKey: "forum.filterSave" },
  { key: "invest", labelKey: "forum.filterInvest" },
  { key: "safety", labelKey: "forum.filterSafety" },
];

export function ForumView({ initialThreads, draft }: {
  initialThreads: ForumThread[];
  draft?: ThreadDraft; // from Learn's "Discuss this chapter": the new-thread form opens prefilled
}) {
  const t = useT({ en, te, hi });

  const [threads, setThreads] = useState(initialThreads);
  const [selectedPillar, setSelectedPillar] = useState<"all" | Pillar>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(Boolean(draft));
  const [selectedThreadDetail, setSelectedThreadDetail] = useState<ThreadDetail | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const filteredThreads = useMemo(() => {
    return threads.filter((thread) => {
      if (selectedPillar !== "all" && thread.pillar !== selectedPillar) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = thread.title.toLowerCase().includes(q);
        const matchesContent = thread.content.toLowerCase().includes(q);
        const matchesTags = thread.tags.some((tag) => tag.toLowerCase().includes(q));
        if (!matchesTitle && !matchesContent && !matchesTags) return false;
      }
      return true;
    });
  }, [threads, selectedPillar, searchQuery]);

  const handleSelectThread = (thread: ForumThread) => {
    startTransition(async () => {
      const detail = await getThreadDetailAction(thread.id);
      if (detail) {
        setSelectedThreadDetail(detail);
      } else {
        // Fallback with empty replies
        setSelectedThreadDetail({ thread, replies: [] });
      }
    });
  };

  const handleThreadCreated = (threadId?: string) => {
    setIsModalOpen(false);
    showToast(t("forum.threadPublished"));
    if (threadId) {
      startTransition(async () => {
        const detail = await getThreadDetailAction(threadId);
        if (detail) {
          setThreads((prev) => [detail.thread, ...prev]);
          setSelectedThreadDetail(detail);
        }
      });
    }
  };

  // If viewing a single thread detail
  if (selectedThreadDetail) {
    return (
      <ThreadDetailView
        thread={selectedThreadDetail.thread}
        replies={selectedThreadDetail.replies}
        onBack={() => setSelectedThreadDetail(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Top Header Row */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">{t("forum.title")}</h1>
          <p className="text-xs text-muted">{t("forum.subtitle")}</p>
        </div>
        <Button
          variant="primary"
          onClick={() => setIsModalOpen(true)}
          className="min-h-9 px-3.5 py-1.5 text-xs shadow-md"
        >
          {t("forum.startThread")}
        </Button>
      </div>

      {/* Cell 1: Search & Filter Bar */}
      <div className="flex flex-col gap-2.5">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t("forum.searchPlaceholder")}
          className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-xs text-foreground placeholder-muted outline-none transition-colors focus:border-brand"
        />

        {/* Filter Chips */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {FILTER_PILLARS.map((item) => (
            <button
              key={item.key}
              onClick={() => setSelectedPillar(item.key)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                selectedPillar === item.key
                  ? "bg-brand text-white shadow-sm"
                  : "border border-border bg-surface text-muted hover:border-border/80 hover:text-foreground"
              }`}
            >
              {t(item.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Cell 2: Suggested Threads List */}
      <div className="flex flex-col gap-3">
        {filteredThreads.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-8 text-center">
            <span className="text-3xl">💬</span>
            <p className="mt-2 text-xs text-muted">{t("forum.noThreads")}</p>
            <Button
              variant="secondary"
              onClick={() => setIsModalOpen(true)}
              className="mt-4 min-h-8 px-3 text-xs"
            >
              {t("forum.startThread")}
            </Button>
          </div>
        ) : (
          filteredThreads.map((thread) => (
            <ThreadCard
              key={thread.id}
              thread={thread}
              onSelect={() => handleSelectThread(thread)}
            />
          ))
        )}
      </div>

      {/* Create New Thread Modal */}
      {isModalOpen && (
        <NewThreadModal
          draft={draft}
          onClose={() => setIsModalOpen(false)}
          onCreated={handleThreadCreated}
        />
      )}

      {toastMessage && <Toast message={toastMessage} />}
    </div>
  );
}
