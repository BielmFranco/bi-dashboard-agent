"use client";

import { motion } from "framer-motion";
import { Check, Copy, Sparkles } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type Props = {
  insights: string | null;
  loading: boolean;
  onRun: () => void;
};

export default function InsightsPanel({ insights, loading, onRun }: Props) {
  const [copied, setCopied] = useState(false);

  async function copyAll() {
    if (!insights) return;
    try {
      await navigator.clipboard.writeText(insights);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
    >
      <Card className="flex flex-col min-h-[26rem]">
        <CardHeader className="flex-row items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-amber-400/20 to-orange-500/20 border border-amber-500/30">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            </div>
            <CardTitle className="text-sm">Insights estratégicos</CardTitle>
          </div>
          <div className="flex items-center gap-1.5">
            {insights && !loading && (
              <Button variant="ghost" size="sm" onClick={copyAll} className="h-7 gap-1">
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                <span className="text-[11px]">{copied ? "Copiado" : "Copiar"}</span>
              </Button>
            )}
            <Button
              variant={insights ? "outline" : "default"}
              size="sm"
              onClick={onRun}
              disabled={loading}
              className="h-7"
            >
              <Sparkles className="h-3 w-3" />
              <span className="text-[11px]">
                {loading ? "Gerando" : insights ? "Regenerar" : "Gerar análise"}
              </span>
            </Button>
          </div>
        </CardHeader>

        <div className="flex-1 overflow-y-auto px-5 pb-5 pr-3">
          {insights ? (
            <div className="markdown-insights">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{insights}</ReactMarkdown>
              {loading && (
                <span className="inline-block w-2 h-4 ml-0.5 bg-[var(--primary)] animate-pulse align-middle rounded-sm" />
              )}
            </div>
          ) : loading ? (
            <div className="space-y-3">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
              <Skeleton className="h-3 w-4/6" />
              <div className="pt-3">
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-3 w-full mt-2" />
                <Skeleton className="h-3 w-3/4 mt-2" />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400/10 to-orange-500/10 border border-amber-500/20 mb-4">
                <Sparkles className="h-5 w-5 text-amber-500" />
              </div>
              <p className="text-sm font-medium text-[var(--foreground)] mb-1">
                Análise em linguagem natural
              </p>
              <p className="text-xs text-[var(--muted-foreground)] max-w-xs">
                Gere insights estratégicos completos com base no perfil dos dados e no
                plano de dashboard.
              </p>
              <Button size="sm" className="mt-4" onClick={onRun}>
                <Sparkles className="h-3.5 w-3.5" /> Gerar análise
              </Button>
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
