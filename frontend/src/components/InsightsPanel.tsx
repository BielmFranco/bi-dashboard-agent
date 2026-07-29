"use client";

import { Copy, Sparkles } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 flex flex-col min-h-[24rem]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-400" />
          Insights Estratégicos
        </h3>
        <div className="flex items-center gap-2">
          {insights && (
            <button
              onClick={copyAll}
              className="rounded-lg border border-slate-700 hover:bg-slate-800 px-2 py-1.5 text-xs flex items-center gap-1"
              title="Copiar texto"
            >
              <Copy className="h-3 w-3" />
              {copied ? "Copiado" : "Copiar"}
            </button>
          )}
          <button
            onClick={onRun}
            disabled={loading}
            className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-xs font-medium disabled:opacity-50"
          >
            {loading ? "Gerando..." : insights ? "Regenerar" : "Gerar com Gemini"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2">
        {insights ? (
          <div className="markdown-insights text-sm leading-relaxed">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{insights}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-sm text-slate-400">
            Clique em <em>Gerar com Gemini</em> para receber análise em linguagem natural com base no perfil e no plano de dashboard.
          </p>
        )}
      </div>
    </div>
  );
}
