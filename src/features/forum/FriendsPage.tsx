"use client";

import { useRef, useState, useTransition } from "react";
import { useT } from "@/shared/i18n";
import { Button, Card, TitleBadge, Toast } from "@/shared/ui/primitives";
import {
  respondFriendRequestAction,
  searchProfilesAction,
  sendFriendRequestAction,
} from "./actions";
import en from "./messages/en.json";
import hi from "./messages/hi.json";
import te from "./messages/te.json";
import type { FriendsPageData, FriendUser, PendingFriendRequest } from "./types";

export function FriendsPage({ initialData }: { initialData: FriendsPageData }) {
  const t = useT({ en, te, hi });

  const [friends, setFriends] = useState(initialData.friends);
  const [pendingRequests, setPendingRequests] = useState(initialData.pendingRequests);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FriendUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latestQuery = useRef("");

  // Debounced search (300ms); answers for an older query are ignored.
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    clearTimeout(searchTimer.current);
    const q = value.trim();
    latestQuery.current = q;
    if (!q) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchTimer.current = setTimeout(async () => {
      const results = await searchProfilesAction(q).catch(() => []);
      if (latestQuery.current !== q) return;
      setSearchResults(results);
      setIsSearching(false);
    }, 300);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSendRequest = (targetUser: FriendUser) => {
    startTransition(async () => {
      const res = await sendFriendRequestAction(targetUser.id);
      if (res.success) {
        setSearchResults((prev) =>
          prev.map((u) => (u.id === targetUser.id ? { ...u, status: "pending_sent" } : u)),
        );
        showToast(t("friends.requestSent"));
      } else {
        showToast(res.error);
      }
    });
  };

  const handleRespond = (req: PendingFriendRequest, action: "accept" | "decline") => {
    startTransition(async () => {
      const res = await respondFriendRequestAction(req.id, action);
      if (res.success) {
        setPendingRequests((prev) => prev.filter((r) => r.id !== req.id));
        if (action === "accept") {
          setFriends((prev) => [
            ...prev,
            {
              id: req.requesterId,
              username: req.requesterUsername,
              title: req.requesterTitle,
              level: req.requesterLevel,
            },
          ]);
          showToast(t("friends.requestAccepted"));
        } else {
          showToast(t("friends.requestDeclined"));
        }
      } else {
        showToast(res.error);
      }
    });
  };

  return (
    <div className="flex flex-col gap-5 p-4">
      {/* Top Header Information */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">{t("friends.title")}</h1>
          <p className="text-xs text-muted">{t("friends.subtitle")}</p>
        </div>
        <div className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold text-foreground">
          👥 {t("friends.totalFriends").replace("{count}", String(friends.length))}
        </div>
      </div>

      {/* Cell 1: Search Bar */}
      <div className="flex flex-col gap-2">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={t("friends.searchPlaceholder")}
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground placeholder-muted outline-none transition-colors focus:border-brand"
          />
          {isSearching && (
            <span className="absolute right-3 top-3.5 text-xs text-muted">{t("friends.searching")}</span>
          )}
        </div>
      </div>

      {/* Cell 2: Search Results */}
      {searchQuery.trim().length > 0 && (
        <Card className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
            {t("friends.searchResults")}
          </h2>
          {searchResults.length === 0 && !isSearching ? (
            <p className="py-2 text-center text-xs text-muted">
              {t("friends.noResults").replace("{query}", searchQuery.trim())}
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {searchResults.map((user) => (
                <div key={user.id} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-raised font-bold text-brand">
                      {user.username.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{user.username}</p>
                      <TitleBadge label={user.title} />
                    </div>
                  </div>

                  <div>
                    {user.status === "none" && (
                      <Button
                        variant="primary"
                        disabled={isPending}
                        onClick={() => handleSendRequest(user)}
                        className="min-h-8 px-3 py-1 text-xs"
                      >
                        {t("friends.connect")}
                      </Button>
                    )}
                    {user.status === "pending_sent" && (
                      <span className="rounded-lg border border-border bg-surface px-2.5 py-1 text-xs text-muted">
                        {t("friends.pendingSent")}
                      </span>
                    )}
                    {user.status === "pending_received" && (
                      <span className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-400">
                        {t("friends.pendingReceived")}
                      </span>
                    )}
                    {user.status === "friends" && (
                      <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-400">
                        {t("friends.alreadyFriends")}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Cell 3: Pending Request Queue */}
      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-foreground">{t("friends.pendingHeader")}</h2>
          {pendingRequests.length > 0 && (
            <span className="rounded-full bg-danger px-2 py-0.5 text-xs font-bold text-white">
              {pendingRequests.length}
            </span>
          )}
        </div>

        {pendingRequests.length === 0 ? (
          <p className="py-2 text-xs text-muted">{t("friends.noPending")}</p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {pendingRequests.map((req) => (
              <div key={req.id} className="flex flex-col gap-2.5 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-500/10 font-bold text-rose-400">
                      {req.requesterUsername.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {req.requesterUsername}{" "}
                        <span className="font-normal text-muted">{t("friends.wantsToConnect")}</span>
                      </p>
                      <div className="flex items-center gap-1.5">
                        <TitleBadge label={req.requesterTitle} />
                        {req.requesterLevel && (
                          <span className="text-xs text-muted">
                            · {t("friends.level")} {req.requesterLevel}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pl-11">
                  <button
                    disabled={isPending}
                    onClick={() => handleRespond(req, "accept")}
                    className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    ✓ {t("friends.accept")}
                  </button>
                  <button
                    disabled={isPending}
                    onClick={() => handleRespond(req, "decline")}
                    className="rounded-lg border border-border bg-surface px-3.5 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-surface-raised disabled:opacity-50"
                  >
                    ✕ {t("friends.decline")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Connected Friends List */}
      <Card className="flex flex-col gap-3">
        <h2 className="text-sm font-bold text-foreground">{t("friends.myFriendsHeader")}</h2>
        {friends.length === 0 ? (
          <p className="py-3 text-center text-xs text-muted">{t("friends.noFriends")}</p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {friends.map((f) => (
              <div key={f.id} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-raised font-bold text-brand">
                    {f.username.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{f.username}</p>
                    <div className="flex items-center gap-1.5">
                      <TitleBadge label={f.title} />
                      {f.level && (
                        <span className="text-xs text-muted">
                          · {t("friends.level")} {f.level}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <span className="text-xs text-muted">{t("friends.friendLabel")}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {toastMessage && <Toast message={toastMessage} />}
    </div>
  );
}
