// Every top-level route is already listed here so nobody needs to edit this file
// to get their feature into the nav. Order and icons follow UI.md §2.2.
export const NAV_ITEMS = [
  { href: "/dashboard", key: "nav.home", icon: "🏠" },
  { href: "/play", key: "nav.play", icon: "⚔️" },
  { href: "/reels", key: "nav.reels", icon: "📱" },
  { href: "/forum", key: "nav.forum", icon: "💬" },
  { href: "/learn", key: "nav.learn", icon: "📚" },
] as const;

// Screens without the bottom nav (UI.md §1.2).
export const NO_NAV_PREFIXES = ["/play/quiz", "/forum/friends"];
// Self-contained screens with their own top bar.
export const NO_HEADER_PREFIXES = ["/play/quiz"];
// Sub-pages whose header shows a back button instead of the logo.
export const BACK_LINKS: Record<string, string> = { "/forum/friends": "/dashboard" };

export const hasPrefix = (pathname: string, prefixes: readonly string[]) =>
  prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
