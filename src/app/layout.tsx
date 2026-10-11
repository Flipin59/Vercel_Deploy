import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { LanguageProvider } from "@/shared/i18n";
import { getCurrentProfile } from "@/shared/session";
import { ServiceWorker } from "@/shared/ui/ServiceWorker";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FinQuest",
  description: "Financial literacy for Grades 11–12, learned by doing.",
  appleWebApp: { capable: true, title: "FinQuest", statusBarStyle: "black-translucent" },
  icons: { apple: "/icons/icon-192.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b1120",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const language = (await getCurrentProfile())?.language ?? "en";
  return (
    <html
      lang={language}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <LanguageProvider key={language} initialLanguage={language}>{children}</LanguageProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
