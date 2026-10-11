// Client-safe entry point for the forum feature.
// Server-only helpers (getFriends, getPendingRequestCount) are in "@/features/forum/server".

export { ForumView as default } from "./ForumView";
export { ForumView } from "./ForumView";
export { FriendsPage } from "./FriendsPage";
export * from "./types";
export * from "./actions";
