import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import KPICard from "@/components/KPICard";
import ChartBlock from "@/components/ChartBlock";
import ProfileSummary from "@/components/ProfileSummary";
import type { Plan, Profile } from "@/lib/api";

type ReportData = {
  profile: Profile;
  plan: Plan;
  filename?: string;
  insights?: string;
};

async function fetchReport(fileId: string): Promise<ReportData | null> {
  const base = process.env.REPORT_API_URL || "http://127.0.0.1:8000";
  try {
    const r = await fetch(`${base}/report_data/${fileId}`, { cache: "no-store" });
    if (!r.ok) return null;
    return (await r.json()) as ReportData;
  } catch {
    return null;
  }
}

export default async function ReportPage({
  params,
}: {
  params: Promise<{ fileId: string }>;
}) {
  const { fileId } = await params;
  const data = await fetchReport(fileId);

  if (!data) {
    return (
      <div className="p-12 text-center text-slate-500">
        Análise não encontrada para <code>{fileId}</code>.
      </div>
    );
  }

  const { profile, plan, filename, insights } = data;
  const now = new Date();
  const dateStr = now.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="report-root bg-white text-slate-900 min-h-screen">
      <style>{`
        @page { size: A4; margin: 14mm 12mm; }
        .report-root {
          font-family: var(--font-inter), system-ui, sans-serif;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .report-section { page-break-inside: avoid; break-inside: avoid; }
        .report-header { border-bottom: 2px solid #6366f1; padding-bottom: 12px; margin-bottom: 20px; }
        .report-insights h2 { color: #4f46e5; }
      `}</style>

      <div className="max-w-[210mm] mx-auto p-10 space-y-8">
        <header className="report-header report-section">
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-400 font-medium">
                Relatório Executivo
              </p>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900 mt-1">
                BI Dashboard Agent
              </h1>
            </div>
            <div className="text-right text-xs text-slate-500">
              <p className="font-mono">{filename ?? "—"}</p>
              <p>{dateStr}</p>
            </div>
          </div>
          <div className="mt-3 flex gap-4 text-xs text-slate-600">
            <span>
              <strong className="text-slate-900">{profile.rows.toLocaleString("pt-BR")}</strong>{" "}
              linhas
            </span>
            <span>
              <strong className="text-slate-900">{profile.cols}</strong> colunas
            </span>
            {profile.duplicates > 0 && (
              <span className="text-amber-600">
                <strong>{profile.duplicates}</strong> duplicadas
              </span>
            )}
          </div>
        </header>

        <section className="report-section">
          <h2 className="text-sm uppercase tracking-widest text-slate-500 font-medium mb-3">
            Indicadores principais
          </h2>
          <div className="grid grid-cols-4 gap-3">
            {plan.kpis.map((k, i) => (
              <KPICard key={k.id} kpi={k} index={i} />
            ))}
          </div>
        </section>

        <section className="report-section">
          <h2 className="text-sm uppercase tracking-widest text-slate-500 font-medium mb-3">
            Resumo da base
          </h2>
          <ProfileSummary profile={profile} />
        </section>

        <section>
          <h2 className="text-sm uppercase tracking-widest text-slate-500 font-medium mb-3">
            Visualizações
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {plan.charts.map((c, i) => (
              <div key={c.id} className="report-section">
                <ChartBlock chart={c} index={i} />
              </div>
            ))}
          </div>
        </section>

        {insights && (
          <section className="report-section report-insights">
            <h2 className="text-sm uppercase tracking-widest text-slate-500 font-medium mb-3">
              Análise estratégica
            </h2>
            <div className="markdown-insights rounded-lg border border-slate-200 bg-slate-50 p-6">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{insights}</ReactMarkdown>
            </div>
          </section>
        )}

        <footer className="pt-6 border-t border-slate-200 flex justify-between text-[10px] text-slate-400">
          <span>© BI Dashboard Agent</span>
          <span>Gerado com Gemini · Dados 100% baseados no arquivo enviado</span>
        </footer>
      </div>
    </div>
  );
}
