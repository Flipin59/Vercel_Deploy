"use client";

import { createContext, useContext, useState } from "react";
import type { Language } from "../types";

const LanguageContext = createContext<{
  language: Language;
  setLanguage: (language: Language) => void;
}>({ language: "en", setLanguage: () => {} });

export function LanguageProvider({
  children,
  initialLanguage = "en",
}: {
  children: React.ReactNode;
  initialLanguage?: Language; // from the signed-in profile
}) {
  const [language, setLanguage] = useState<Language>(initialLanguage);
  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

type Messages = Record<string, string>;

// Each feature keeps its own strings in `messages/<lang>.json` and passes them in:
//   const t = useT({ en, te, hi });
// Missing translations fall back to English, then to the key itself.
export function useT(messages: Partial<Record<Language, Messages>>) {
  const { language } = useLanguage();
  return (key: string) => messages[language]?.[key] ?? messages.en?.[key] ?? key;
}
