"use client";

import { motion } from "framer-motion";
import { Download, FileText, Loader2, RotateCw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import Chat from "@/components/Chat";
import ChartBlock from "@/components/ChartBlock";
import CorrelationHeatmap from "@/components/CorrelationHeatmap";
import DrillDownModal from "@/components/DrillDownModal";
import FilterBar from "@/components/FilterBar";
import InsightsPanel from "@/components/InsightsPanel";
import KPICard from "@/components/KPICard";
import Navbar from "@/components/Navbar";
import ProfileSummary from "@/components/ProfileSummary";
import Upload from "@/components/Upload";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  analyze,
  analyzeFiltered,
  deleteFile,
  getAnalysis,
  insightsStream,
  type FilterMap,
  type Plan,
  type Profile,
} from "@/lib/api";

const LS_KEY = "bi-agent:last-file-id";

export default function Home() {
  const [fileId, setFileId] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [insightsText, setInsightsText] = useState<string | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [basePlan, setBasePlan] = useState<Plan | null>(null);
  const [baseProfile, setBaseProfile] = useState<Profile | null>(null);
  const [filters, setFilters] = useState<FilterMap>({});
  const [filtering, setFiltering] = useState(false);
  const [drill, setDrill] = useState<{ column: string; value: string | number } | null>(null);
  const insightsAbort = useState<{ ctrl: AbortController | null }>({ ctrl: null })[0];

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(LS_KEY) : null;
    if (!saved) {
      setRestoring(false);
      return;
    }
    (async () => {
      try {
        const res = await getAnalysis(saved);
        setFileId(saved);
        setFilename(res.filename ?? null);
        setProfile(res.profile);
        setPlan(res.plan);
        setBaseProfile(res.profile);
        setBasePlan(res.plan);
        setFilters({});
      } catch {
        localStorage.removeItem(LS_KEY);
      } finally {
        setRestoring(false);
      }
    })();
  }, []);

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
      setBaseProfile(res.profile);
      setBasePlan(res.plan);
      setFilters({});
      localStorage.setItem(LS_KEY, id);
      toast.success("Análise concluída", {
        description: `${res.profile.rows.toLocaleString("pt-BR")} linhas · ${
          res.profile.cols
        } colunas`,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro";
      setAnalyzeError(msg);
      toast.error("Falha na análise", { description: msg });
    } finally {
      setAnalyzing(false);
    }
  }

  async function runInsights() {
    if (!fileId) return;
    setInsightsLoading(true);
    setInsightsText("");
    const ctrl = new AbortController();
    insightsAbort.ctrl = ctrl;
    try {
      await insightsStream(
        fileId,
        (delta) => {
          setInsightsText((prev) => (prev ?? "") + delta);
        },
        ctrl.signal,
        filters,
      );
    } catch (e) {
      const isAbort = e instanceof DOMException && e.name === "AbortError";
      if (isAbort) {
        setInsightsText((prev) => (prev ? prev + "\n\n_[interrompido pelo usuário]_" : "_[interrompido pelo usuário]_"));
        toast("Geração interrompida");
      } else {
        const msg = e instanceof Error ? e.message : String(e);
        setInsightsText(
          (prev) => (prev ? prev + "\n\n" : "") + `> **Erro:** ${msg}`,
        );
        toast.error("Falha ao gerar insights", { description: msg });
      }
    } finally {
      setInsightsLoading(false);
      insightsAbort.ctrl = null;
    }
  }

  function stopInsights() {
    insightsAbort.ctrl?.abort();
  }

  function handleExport() {
    if (!fileId || exporting) return;
    setExporting(true);
    window.open(`/report/${fileId}?pdf=1`, "_blank", "noopener,noreferrer");
    toast.success("Relatório aberto — PDF será baixado automaticamente");
    setTimeout(() => setExporting(false), 2000);
  }

  async function applyFilters(next: FilterMap) {
    setFilters(next);
    if (!fileId) return;
    const empty = Object.keys(next).length === 0;
    if (empty) {
      if (baseProfile && basePlan) {
        setProfile(baseProfile);
        setPlan(basePlan);
      }
      return;
    }
    setFiltering(true);
    try {
      const res = await analyzeFiltered(fileId, next);
      setProfile(res.profile);
      setPlan(res.plan);
    } catch (e) {
      toast.error("Falha ao aplicar filtros", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setFiltering(false);
    }
  }

  function clearFilters() {
    setFilters({});
    if (baseProfile && basePlan) {
      setProfile(baseProfile);
      setPlan(basePlan);
    }
  }

  async function reset() {
    const oldId = fileId;
    setFileId(null);
    setFilename(null);
    setProfile(null);
    setPlan(null);
    setInsightsText(null);
    localStorage.removeItem(LS_KEY);
    if (oldId) {
      try {
        await deleteFile(oldId);
        toast.success("Sessão finalizada");
      } catch {
        /* ignore */
      }
    }
  }

  return (
    <>
      <Navbar hasSession={!!fileId} onReset={reset} />

      <main className="mx-auto max-w-7xl w-full px-4 sm:px-6 py-8 flex-1">
        {restoring && (
          <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)] mb-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Restaurando sessão anterior...
          </div>
        )}

        {!restoring && !fileId && (
          <div className="pt-12 pb-16">
            <Upload onUploaded={handleUploaded} />
          </div>
        )}

        {fileId && (
          <section className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="flex items-center gap-3 flex-wrap"
            >
              <Badge variant="secondary" className="gap-1.5">
                <FileText className="h-3 w-3" />
                Arquivo
              </Badge>
              <span className="font-mono text-sm text-[var(--foreground)] truncate max-w-md">
                {filename ?? "—"}
              </span>
              {analyzing && (
                <span className="ml-auto inline-flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Analisando...
                </span>
              )}
              {profile && !analyzing && (
                <div className="ml-auto flex items-center gap-3">
                  <span className="inline-flex items-center gap-3 text-xs text-[var(--muted-foreground)]">
                    <span className="tabular-nums">
                      {profile.rows.toLocaleString("pt-BR")} linhas
                    </span>
                    <span className="w-px h-3 bg-[var(--border)]" />
                    <span className="tabular-nums">{profile.cols} colunas</span>
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExport}
                    disabled={exporting}
                    className="h-8"
                  >
                    {exporting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    <span className="text-xs">{exporting ? "Gerando..." : "Baixar PDF"}</span>
                  </Button>
                </div>
              )}
            </motion.div>

            {analyzeError && (
              <div className="rounded-xl border border-[var(--destructive)]/30 bg-[var(--destructive)]/8 p-4 text-sm text-[var(--destructive)] flex items-start gap-3">
                <RotateCw className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="font-medium">Não foi possível analisar</p>
                  <p className="text-xs mt-1 opacity-80">{analyzeError}</p>
                </div>
              </div>
            )}

            {analyzing && !profile && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-xl" />
                ))}
              </div>
            )}

            {profile && plan && baseProfile && (
              <>
                <FilterBar
                  profile={baseProfile}
                  filters={filters}
                  onChange={applyFilters}
                  onClear={clearFilters}
                  loading={filtering}
                />

                <section aria-label="KPIs">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {plan.kpis.map((k, i) => (
                      <KPICard key={k.id} kpi={k} index={i} />
                    ))}
                  </div>
                </section>

                <section aria-label="Visualizações" className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="lg:col-span-1">
                    <ProfileSummary profile={profile} />
                  </div>
                  <div className="lg:col-span-2 grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {plan.charts.map((c, i) => (
                      <ChartBlock
                        key={c.id}
                        chart={c}
                        index={i}
                        onDrill={(column, value) => setDrill({ column, value })}
                      />
                    ))}
                  </div>
                </section>

                {profile.correlation && profile.correlation.columns.length >= 2 && (
                  <section aria-label="Correlação">
                    <CorrelationHeatmap profile={profile} />
                  </section>
                )}

                <section
                  aria-label="Análise IA"
                  className="grid grid-cols-1 lg:grid-cols-2 gap-4"
                >
                  <InsightsPanel
                    insights={insightsText}
                    loading={insightsLoading}
                    onRun={runInsights}
                    onStop={stopInsights}
                  />
                  <Chat fileId={fileId} filters={filters} />
                </section>
              </>
            )}
          </section>
        )}
      </main>

      {fileId && (
        <DrillDownModal
          open={drill !== null}
          onOpenChange={(o) => !o && setDrill(null)}
          fileId={fileId}
          column={drill?.column ?? null}
          value={drill?.value ?? null}
          filters={filters}
        />
      )}

      <footer className="border-t border-[var(--border)] py-4 mt-8">
        <div className="mx-auto max-w-7xl px-6 flex items-center justify-between text-[11px] text-[var(--muted-foreground)]">
          <span>© BI Dashboard Agent</span>
          <span className="hidden sm:inline">Análise 100% baseada nos seus dados · Nenhum dado é compartilhado</span>
        </div>
      </footer>
    </>
  );
}
