import type { KPI } from "@/lib/api";
import { fmtCompactBR, fmtNumberBR } from "@/lib/format";

function fmt(v: number | null, kind: KPI["format"]) {
  if (v === null || v === undefined) return "—";
  const abs = Math.abs(v);
  if (kind === "int" && abs < 1_000_000) return fmtNumberBR(v, { maximumFractionDigits: 0 });
  if (abs >= 10_000) return fmtCompactBR(v);
  return fmtNumberBR(v);
}

export default function KPICard({ kpi }: { kpi: KPI }) {
  const value = fmt(kpi.value, kpi.format);
  const full =
    kpi.value !== null && kpi.value !== undefined
      ? kpi.value.toLocaleString("pt-BR", { maximumFractionDigits: 4 })
      : undefined;
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">{kpi.label}</p>
      <p
        className="mt-2 text-2xl font-semibold text-indigo-300"
        title={full}
      >
        {value}
      </p>
    </div>
  );
}
