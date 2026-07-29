"use client";

import { useState } from "react";
import { BarChart3, Loader2 } from "lucide-react";
import Upload from "@/components/Upload";
import KPICard from "@/components/KPICard";
import ChartBlock from "@/components/ChartBlock";
import ProfileSummary from "@/components/ProfileSummary";
import InsightsPanel from "@/components/InsightsPanel";
import Chat from "@/components/Chat";
import { analyze, insightsStream, type Plan, type Profile } from "@/lib/api";

export default function Home() {
  const [fileId, setFileId] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [insightsText, setInsightsText] = useState<string | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);

  async function handleUploaded(id: string, name: string) {
    setFileId(id);
    setFilename(name);
    setProfile(null);
    setPlan(null);
    setInsightsText(null);
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const res = await analyze(id);
      setProfile(res.profile);
      setPlan(res.plan);
    } catch (e) {
      setAnalyzeError(e instanceof Error ? e.message : "Erro");
    } finally {
      setAnalyzing(false);
    }
  }

  async function runInsights() {
    if (!fileId) return;
    setInsightsLoading(true);
    setInsightsText("");
    try {
      await insightsStream(fileId, (delta) => {
        setInsightsText((prev) => (prev ?? "") + delta);
      });
    } catch (e) {
      setInsightsText(
        (prev) =>
          (prev ? prev + "\n\n" : "") +
          `> **Erro:** ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setInsightsLoading(false);
    }
  }

  function reset() {
    setFileId(null);
    setFilename(null);
    setProfile(null);
    setPlan(null);
    setInsightsText(null);
  }

  return (
    <main className="mx-auto max-w-7xl w-full px-6 py-8 flex-1">
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-8 w-8 text-indigo-400" />
          <div>
            <h1 className="text-2xl font-bold">BI Dashboard Agent</h1>
            <p className="text-sm text-slate-400">
              Análise, KPIs, dashboards e insights com Gemini 2.0 Flash
            </p>
          </div>
        </div>
        {fileId && (
          <button
            onClick={reset}
            className="text-sm text-slate-400 hover:text-slate-200 underline"
          >
            Nova análise
          </button>
        )}
      </header>

      {!fileId && <Upload onUploaded={handleUploaded} />}

      {fileId && (
        <section className="space-y-6">
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 flex items-center gap-3">
            <span className="rounded-lg bg-indigo-500/20 px-2 py-1 text-xs text-indigo-300">
              Arquivo
            </span>
            <span className="font-mono text-sm">{filename}</span>
            {analyzing && (
              <span className="ml-auto flex items-center gap-2 text-sm text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Analisando...
              </span>
            )}
          </div>

          {analyzeError && (
            <div className="rounded-xl border border-red-800 bg-red-900/30 p-4 text-red-200 text-sm">
              {analyzeError}
            </div>
          )}

          {profile && plan && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {plan.kpis.map((k) => (
                  <KPICard key={k.id} kpi={k} />
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-1">
                  <ProfileSummary profile={profile} />
                </div>
                <div className="lg:col-span-2 grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {plan.charts.map((c) => (
                    <ChartBlock key={c.id} chart={c} />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <InsightsPanel
                  insights={insightsText}
                  loading={insightsLoading}
                  onRun={runInsights}
                />
                <Chat fileId={fileId} />
              </div>
            </>
          )}
        </section>
      )}
    </main>
  );
}
