import type { Pillar, PublicProfile } from "@/shared/types";

export type FriendshipStatus = "none" | "pending_sent" | "pending_received" | "friends";

export type FriendUser = {
  id: string;
  username: string;
  title: string;
  level?: number;
  status: FriendshipStatus;
};

export type PendingFriendRequest = {
  id: string;
  requesterId: string;
  requesterUsername: string;
  requesterTitle: string;
  requesterLevel?: number;
  createdAt: string;
};

export type FriendsPageData = {
  friends: PublicProfile[];
  pendingRequests: PendingFriendRequest[];
  totalFriendsCount: number;
};

export type ForumThread = {
  id: string;
  authorId: string;
  authorUsername: string;
  authorTitle: string;
  title: string;
  content: string;
  pillar: Pillar;
  tags: string[];
  upvotes: number;
  replyCount: number;
  createdAt: string;
  hasUpvoted?: boolean;
  isAuthor?: boolean;
  isHidden?: boolean;
};

export type ForumReply = {
  id: string;
  threadId: string;
  authorId: string;
  authorUsername: string;
  authorTitle: string;
  authorRole?: "teacher" | "mentor"; // set by an admin; shown as a badge
  content: string;
  parentReplyId?: string | null;
  upvotes: number;
  isAccepted?: boolean;
  createdAt: string;
  hasUpvoted?: boolean;
  isAuthor?: boolean;
  isHidden?: boolean;
};

export type ThreadDetail = {
  thread: ForumThread;
  replies: ForumReply[];
};

export type ReportReason = "personal_info" | "harassment" | "spam" | "other";

// A thread's text in another language (machine translation); replies by id.
export type ThreadTranslation = { title: string; content: string; replies: Record<string, string> };
