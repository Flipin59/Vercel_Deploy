// Small building blocks for every feature. No hooks, so they work in Server and
// Client Components alike; pass strings in already translated.
import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" }) {
  const look = {
    primary: "bg-brand text-white",
    secondary: "border border-border bg-surface text-foreground",
    danger: "bg-danger text-white",
  }[variant];
  return (
    <button
      className={`min-h-11 rounded-xl px-4 font-semibold disabled:opacity-50 ${look} ${className}`}
      {...props}
    />
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-border bg-surface p-4 ${className}`}>{children}</section>;
}

// `value` is 0–100.
export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}
      className="h-2 w-full overflow-hidden rounded-full bg-border">
      <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
    </div>
  );
}

const TIER_COLOURS: Record<string, string> = {
  Bronze: "#cd7f32",
  Silver: "#c0c0c0",
  Gold: "#fbbf24",
  Platinum: "#5eead4",
  Diamond: "#93c5fd",
};

// A title such as "Silver 2" (RATING.md §3) — the only rank other students see.
export function TitleBadge({ label }: { label: string }) {
  const colour = TIER_COLOURS[label.split(" ")[0]] ?? "var(--muted)";
  return (
    <span className="rounded-full border px-2 py-0.5 text-xs font-semibold" style={{ borderColor: colour, color: colour }}>
      🛡️ {label}
    </span>
  );
}

// Shown while the caller renders it; the caller decides when to hide it.
export function Toast({ message, tone = "success" }: { message: string; tone?: "success" | "danger" }) {
  return (
    <div role="status" className={`fixed inset-x-4 bottom-24 z-50 mx-auto max-w-sm rounded-xl px-4 py-3 text-center text-sm font-semibold text-white ${tone === "success" ? "bg-success" : "bg-danger"}`}>
      {message}
    </div>
  );
}

// Full-screen title-up moment (RATING.md §8). Render from a Client Component that owns `onClose`.
export function Celebration({
  title,
  children,
  closeLabel,
  onClose,
}: {
  title: string;
  children?: ReactNode;
  closeLabel: string;
  onClose: () => void;
}) {
  return (
    <div role="dialog" aria-modal aria-label={title} className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-background/95 p-6 text-center">
      <p className="text-5xl" aria-hidden>🎉</p>
      <h2 className="text-2xl font-bold">{title}</h2>
      {children}
      <Button onClick={onClose}>{closeLabel}</Button>
    </div>
  );
}
