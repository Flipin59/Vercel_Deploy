// Safety filters for forum posts and comments (F3).
// Protects student privacy by blocking phone numbers and personal emails.

// Detects standard email addresses
const EMAIL_REGEX = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/i;

// Indian mobile numbers, also when written with spaces, dots or hyphens: optional
// +91/91/0 prefix, then 10 digits starting 6-9. Same rule as forum_has_phone() in
// supabase/migrations/20261011140100_forum_fixes.sql — change both together.
// ponytail: stripping separators can join two short numbers ("60000 12345") into a false
// positive; accepted for minors' privacy, refine if students hit it.
const PHONE_SEPARATORS = /[\s.-]/g;
const PHONE_REGEX = /(^|\D)(\+?91|0)?[6-9]\d{9}(\D|$)/;

export type SafetyCheckResult = {
  safe: boolean;
  violation?: "email" | "phone";
};

export function checkSafety(text: string): SafetyCheckResult {
  if (!text) return { safe: true };

  if (EMAIL_REGEX.test(text)) {
    return { safe: false, violation: "email" };
  }

  if (PHONE_REGEX.test(text.replace(PHONE_SEPARATORS, ""))) {
    return { safe: false, violation: "phone" };
  }

  return { safe: true };
}

export function isSafeContent(...texts: (string | undefined | null)[]): boolean {
  for (const text of texts) {
    if (text && !checkSafety(text).safe) {
      return false;
    }
  }
  return true;
}
