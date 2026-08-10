"use client";

import { Sparkles } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import ThemeToggle from "@/components/ThemeToggle";

type Props = {
  onReset?: () => void;
  hasSession?: boolean;
};

export default function Navbar({ onReset, hasSession }: Props) {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[color-mix(in_oklab,var(--background)_82%,transparent)] backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-6 h-14 flex items-center justify-between">
        <Link
          href="/"
          onClick={(e) => {
            if (hasSession && onReset && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
              e.preventDefault();
              onReset();
            }
          }}
          className="flex items-center gap-2 group"
          aria-label={hasSession ? "Voltar para tela inicial" : "BI Agent"}
        >
          <span
            className="relative flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm ring-1 ring-inset ring-white/10 transition-transform group-hover:scale-105"
            aria-hidden
          >
            <Sparkles className="h-3.5 w-3.5" strokeWidth={2.5} />
          </span>
          <span className="flex items-baseline gap-1.5">
            <span className="text-sm font-semibold tracking-tight text-[var(--foreground)]">
              BI Agent
            </span>
            <Badge variant="secondary" className="hidden sm:inline-flex">
              Beta
            </Badge>
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          <Link
            href="/history"
            className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] px-3 py-1.5 rounded-md hover:bg-[var(--muted)] transition-colors"
          >
            Histórico
          </Link>
          {hasSession && onReset && (
            <button
              onClick={onReset}
              className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] px-3 py-1.5 rounded-md hover:bg-[var(--muted)] transition-colors"
            >
              Nova análise
            </button>
          )}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
