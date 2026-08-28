"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import ReportKPI from "@/components/report/ReportKPI";
import ReportChart from "@/components/report/ReportChart";
import ReportProfile from "@/components/report/ReportProfile";
import type { Plan, Profile } from "@/lib/api";
import "./report.css";

type ReportData = {
  profile: Profile;
  plan: Plan;
  filename?: string;
};

const DEFAULT_API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function ReportPage() {
  const { fileId } = useParams<{ fileId: string }>();
  const searchParams = useSearchParams();
  const apiBase = searchParams.get("api") || DEFAULT_API;
  const autoPdf = searchParams.get("pdf") === "1";
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const printTriggered = useRef(false);

  useEffect(() => {
    if (!fileId) return;
    fetch(`${apiBase}/report_data/${fileId}`, { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error("not found");
        return r.json();
      })
      .then((d) => setData(d as ReportData))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [fileId, apiBase]);

  useEffect(() => {
    if (autoPdf && data && !loading && !printTriggered.current) {
      printTriggered.current = true;
      setTimeout(() => window.print(), 1200);
    }
  }, [autoPdf, data, loading]);

  if (loading) {
    return (
      <div className="report-empty">
        <p>Carregando relatório…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="report-empty">
        <p>
          Análise não encontrada para <code>{fileId}</code>.
        </p>
      </div>
    );
  }

  const { profile, plan, filename } = data;
  const now = new Date();
  const dateStr = now.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const timeStr = now.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="report-page">
      <article className="report-doc">
        <header className="report-cover">
          <div className="report-cover-brand">
            <div className="report-brand-mark">BI</div>
            <div className="report-brand-info">
              <p className="report-brand-name">BI Dashboard Agent</p>
              <p className="report-brand-sub">Relatório executivo</p>
            </div>
          </div>

          <div className="report-cover-title">
            <p className="report-eyebrow">Análise da base</p>
            <h1>{filename ?? "Planilha enviada"}</h1>
          </div>

          <div className="report-cover-meta">
            <p>{dateStr}</p>
            <p className="report-cover-time">{timeStr}</p>
          </div>
        </header>

        <div className="report-hero-strip">
          <div className="report-hero-stat">
            <p className="report-hero-stat-label">Registros</p>
            <p className="report-hero-stat-value">
              {profile.rows.toLocaleString("pt-BR")}
            </p>
          </div>
          <div className="report-hero-stat">
            <p className="report-hero-stat-label">Colunas</p>
            <p className="report-hero-stat-value">{profile.cols}</p>
          </div>
          <div className="report-hero-stat">
            <p className="report-hero-stat-label">Indicadores</p>
            <p className="report-hero-stat-value">{plan.kpis.length}</p>
          </div>
          <div className="report-hero-stat">
            <p className="report-hero-stat-label">Visualizações</p>
            <p className="report-hero-stat-value">{plan.charts.length}</p>
          </div>
        </div>

        <div className="report-body">
          <section className="report-section">
            <div className="report-section-head">
              <span className="report-section-num">01</span>
              <div>
                <h2>Indicadores principais</h2>
                <p>KPIs derivados automaticamente das colunas numéricas.</p>
              </div>
            </div>
            <div className="report-kpi-grid">
              {plan.kpis.map((k) => (
                <ReportKPI key={k.id} kpi={k} />
              ))}
            </div>
          </section>

          <div className="report-split">
            <section className="report-section">
              <div className="report-section-head">
                <span className="report-section-num">02</span>
                <div>
                  <h2>Perfil da base</h2>
                  <p>Tipos, cardinalidade e qualidade por coluna.</p>
                </div>
              </div>
              <ReportProfile profile={profile} />
            </section>

            <section className="report-section report-section-charts">
              <div className="report-section-head">
                <span className="report-section-num">03</span>
                <div>
                  <h2>Visualizações</h2>
                  <p>Gráficos escolhidos pelo motor de regras.</p>
                </div>
              </div>
              <div className="report-chart-grid">
                {plan.charts.map((c) => (
                  <ReportChart key={c.id} chart={c} />
                ))}
              </div>
            </section>
          </div>
        </div>

        <footer className="report-footer">
          <span>© BI Dashboard Agent</span>
          <span>
            Gerado com Gemini · Dados 100% baseados no arquivo enviado
          </span>
        </footer>
      </article>
    </div>
  );
}
