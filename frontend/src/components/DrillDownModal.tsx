"use client";

import { Download, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { DrillResult, FilterMap } from "@/lib/api";
import { drillDown } from "@/lib/api";
import { fmtNumberBR } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileId: string;
  column: string | null;
  value: string | number | null;
  filters: FilterMap;
};

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return fmtNumberBR(v);
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) return v.slice(0, 10);
  return String(v);
}

function toCSV(result: DrillResult): string {
  const header = result.columns.join(",");
  const rows = result.rows
    .map((r) =>
      result.columns
        .map((c) => {
          const v = r[c];
          if (v === null || v === undefined) return "";
          const s = String(v);
          return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(","),
    )
    .join("\n");
  return header + "\n" + rows;
}

export default function DrillDownModal({
  open,
  onOpenChange,
  fileId,
  column,
  value,
  filters,
}: Props) {
  const [data, setData] = useState<DrillResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !column || value === null || value === undefined) return;
    setLoading(true);
    setErr(null);
    setData(null);
    drillDown(fileId, column, value as string | number, filters)
      .then(setData)
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [open, fileId, column, value, filters]);

  function downloadCSV() {
    if (!data) return;
    const csv = toCSV(data);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `drill_${column}_${value}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Detalhe: {column} = {String(value)}</DialogTitle>
          <DialogDescription>
            {loading
              ? "Carregando registros..."
              : data
                ? `${data.total} registro(s) — mostra até 200`
                : ""}
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center gap-2 py-8 justify-center text-sm text-[var(--muted-foreground)]">
            <Loader2 className="h-4 w-4 animate-spin" /> Buscando...
          </div>
        )}

        {err && (
          <div className="rounded-lg border border-[var(--destructive)]/30 bg-[var(--destructive)]/10 p-3 text-xs text-[var(--destructive)]">
            {err}
          </div>
        )}

        {data && !loading && (
          <>
            <div className="flex items-center justify-between">
              <Badge variant="secondary">
                {data.total} {data.total === 1 ? "registro" : "registros"}
              </Badge>
              <Button variant="outline" size="sm" onClick={downloadCSV} className="gap-1.5">
                <Download className="h-3.5 w-3.5" />
                Exportar CSV
              </Button>
            </div>

            <div className="max-h-[60vh] overflow-auto rounded-lg border border-[var(--border)]">
              <table className="w-full text-xs">
                <thead className="bg-[var(--muted)] sticky top-0">
                  <tr>
                    {data.columns.map((c) => (
                      <th
                        key={c}
                        className="px-3 py-2 text-left font-mono font-medium text-[var(--muted-foreground)] whitespace-nowrap border-b border-[var(--border)]"
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r, i) => (
                    <tr
                      key={i}
                      className="border-b border-[var(--border)] hover:bg-[var(--muted)]/50 transition-colors"
                    >
                      {data.columns.map((c) => (
                        <td
                          key={c}
                          className="px-3 py-1.5 tabular-nums text-[var(--foreground)] whitespace-nowrap"
                        >
                          {formatCell(r[c])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
