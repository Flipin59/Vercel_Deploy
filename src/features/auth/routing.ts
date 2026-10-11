// Only this exact quiz URL may bypass onboarding. Never trust a caller's header.
export function isPlacementRoute(pathname: string, context: string | null): boolean {
  return pathname === "/play/quiz" && context === "placement";
}
