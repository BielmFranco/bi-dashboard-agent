import type { KPI } from "@/lib/api";

function fmt(v: number | null, kind: KPI["format"]) {
  if (v === null || v === undefined) return "—";
  if (kind === "int") return v.toLocaleString("pt-BR");
  return v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

export default function KPICard({ kpi }: { kpi: KPI }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">{kpi.label}</p>
      <p className="mt-2 text-2xl font-semibold text-indigo-300">
        {fmt(kpi.value, kpi.format)}
      </p>
    </div>
  );
}
