"use client";

import { Brain, Clock, Plus } from "lucide-react";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";


type Props = {
  onReset?: () => void;
  hasSession?: boolean;
};

const REPO_URL = "https://github.com/BielmFranco/bi-dashboard-agent";

export default function Navbar({ onReset, hasSession }: Props) {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[color-mix(in_oklab,var(--background)_82%,transparent)] backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
        <Link
          href="/"
          onClick={(e) => {
            if (hasSession && onReset && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
              e.preventDefault();
              onReset();
            }
          }}
          className="flex items-center gap-2.5 group"
          aria-label={hasSession ? "Voltar para tela inicial" : "BI Agent"}
        >
          <span
            className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md ring-1 ring-inset ring-white/10 transition-transform group-hover:scale-105"
            aria-hidden
          >
            <Brain className="h-4.5 w-4.5" strokeWidth={2.5} />
          </span>
          <span className="text-base font-bold tracking-tight bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">
            BI Agent
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] px-2.5 py-1.5 rounded-md hover:bg-[var(--muted)] transition-colors inline-flex items-center gap-1.5"
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
            </svg>
            <span className="hidden sm:inline">GitHub</span>
          </a>
          <Link
            href="/history"
            className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] px-2.5 py-1.5 rounded-md hover:bg-[var(--muted)] transition-colors inline-flex items-center gap-1.5"
          >
            <Clock className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Histórico</span>
          </Link>
          {hasSession && onReset && (
            <button
              onClick={onReset}
              className="text-xs font-medium text-white bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 px-3 py-1.5 rounded-lg transition-all inline-flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              Nova análise
            </button>
          )}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
