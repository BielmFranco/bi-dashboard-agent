import type { KPI } from "@/lib/api";
import { fmtCompactBR, fmtNumberBR } from "@/lib/format";

function fmt(v: number | null, kind: KPI["format"]) {
  if (v === null || v === undefined) return "—";
  const abs = Math.abs(v);
  if (kind === "int" && abs < 1_000_000) return fmtNumberBR(v, { maximumFractionDigits: 0 });
  if (abs >= 10_000) return fmtCompactBR(v);
  return fmtNumberBR(v);
}

export default function ReportKPI({ kpi }: { kpi: KPI }) {
  return (
    <div className="report-kpi">
      <p className="report-kpi-label">{kpi.label}</p>
      <p className="report-kpi-value">{fmt(kpi.value, kpi.format)}</p>
    </div>
  );
}
