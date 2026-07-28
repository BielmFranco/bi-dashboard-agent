"use client";

import { Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";

type Props = {
  insights: string | null;
  loading: boolean;
  onRun: () => void;
};

export default function InsightsPanel({ insights, loading, onRun }: Props) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-400" />
          Insights Estratégicos
        </h3>
        <button
          onClick={onRun}
          disabled={loading}
          className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-xs font-medium disabled:opacity-50"
        >
          {loading ? "Gerando..." : insights ? "Regenerar" : "Gerar com Gemini"}
        </button>
      </div>
      {insights ? (
        <div className="prose prose-invert prose-sm max-w-none prose-headings:text-indigo-300 prose-strong:text-slate-100">
          <ReactMarkdown>{insights}</ReactMarkdown>
        </div>
      ) : (
        <p className="text-sm text-slate-400">
          Clique em <em>Gerar com Gemini</em> para receber análise em linguagem natural com base no perfil e no plano de dashboard.
        </p>
      )}
    </div>
  );
}
