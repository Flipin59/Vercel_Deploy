// Machine translation of student-written text through Google Cloud Translation
// (GOOGLE_TRANSLATE_API_KEY). Server code only: the key must never reach the browser.
// Fixed content (UI strings, the question bank) is translated ahead of time in the repo,
// never through this.
import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "./supabase/admin";
import { isSupabaseConfigured } from "./supabase/config";
import type { Language } from "./types";

export type TranslateTarget = Exclude<Language, "en">;
const ENDPOINT = "https://translation.googleapis.com/language/translate/v2";
const TIMEOUT_MS = 8_000;
const MAX_CHARS = 20_000; // per call, so one thread can't run the bill up

// `texts` in `target`, in the same order, or null when translation isn't configured or
// fails. Results are cached in core_translations, so each text is paid for once.
export async function translate(texts: string[], target: TranslateTarget): Promise<string[] | null> {
  const key = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (!key || texts.reduce((n, t) => n + t.length, 0) > MAX_CHARS) return null;
  const hashes = texts.map((t) => createHash("sha256").update(t).digest("hex"));
  const known = new Map<string, string>();
  const db = isSupabaseConfigured() ? createAdminClient() : null;
  if (db && texts.length) {
    const { data } = await db.from("core_translations").select("hash, text").eq("language", target).in("hash", hashes);
    for (const row of data ?? []) known.set(row.hash, row.text);
  }
  const missing = [...new Set(hashes.filter((h) => !known.has(h)))];
  if (missing.length) {
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        // The key goes in a header, not the URL, so it stays out of request logs.
        headers: { "Content-Type": "application/json", "X-goog-api-key": key },
        body: JSON.stringify({ q: missing.map((h) => texts[hashes.indexOf(h)]), target, format: "text" }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const body = res.ok ? await res.json() : null;
      const out: unknown[] | undefined = body?.data?.translations?.map((t: { translatedText?: unknown }) => t.translatedText);
      if (!out || out.length !== missing.length || out.some((t) => typeof t !== "string")) {
        console.error("[translate] bad response", res.status);
        return null;
      }
      missing.forEach((h, i) => known.set(h, out[i] as string));
      if (db) {
        const { error } = await db.from("core_translations")
          .upsert(missing.map((h) => ({ hash: h, language: target, text: known.get(h)! })), { ignoreDuplicates: true });
        if (error) console.error("[translate] cache", error.message);
      }
    } catch (error) {
      console.error("[translate]", error);
      return null;
    }
  }
  return hashes.map((h) => known.get(h)!);
}
