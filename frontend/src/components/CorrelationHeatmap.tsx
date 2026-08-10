"use client";

import { motion } from "framer-motion";
import { Grid3x3 } from "lucide-react";
import type { Profile } from "@/lib/api";
import { truncate } from "@/lib/format";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/** Map correlation coefficient r in [-1, 1] to a diverging color scale. */
function corrColor(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "var(--muted)";
  const t = Math.max(-1, Math.min(1, v));
  const alpha = Math.abs(t);
  if (t >= 0) {
    // positive → primary blue-purple
    return `color-mix(in oklab, var(--primary) ${Math.round(alpha * 90)}%, transparent)`;
  }
  // negative → warm red/orange
  return `color-mix(in oklab, var(--destructive) ${Math.round(alpha * 85)}%, transparent)`;
}

function textColor(v: number | null | undefined): string {
  if (v === null || v === undefined) return "var(--muted-foreground)";
  return Math.abs(v) > 0.55 ? "#ffffff" : "var(--foreground)";
}

export default function CorrelationHeatmap({ profile }: { profile: Profile }) {
  const corr = profile.correlation;
  if (!corr || corr.columns.length < 2) return null;

  const cols = corr.columns;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Grid3x3 className="h-4 w-4 text-[var(--muted-foreground)]" />
            <CardTitle className="text-sm">Correlação entre métricas</CardTitle>
          </div>
          <CardDescription>
            Coeficiente de Pearson. Escala: −1 (vermelho) · 0 (neutro) · +1 (roxo).
          </CardDescription>
        </CardHeader>

        <div className="px-5 pb-5 overflow-x-auto">
          <TooltipProvider delayDuration={100}>
            <table
              className="border-collapse text-[11px] tabular-nums"
              style={{ borderSpacing: 2, minWidth: 320 }}
            >
              <thead>
                <tr>
                  <th className="p-1"></th>
                  {cols.map((c) => (
                    <th
                      key={c}
                      className="p-1 text-[10px] font-medium text-[var(--muted-foreground)] text-left"
                      style={{
                        transform: "rotate(-25deg)",
                        transformOrigin: "left bottom",
                        whiteSpace: "nowrap",
                        height: 60,
                        verticalAlign: "bottom",
                      }}
                    >
                      <span className="font-mono">{truncate(c, 14)}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cols.map((rowName, i) => (
                  <tr key={rowName}>
                    <td className="pr-2 text-[10px] font-mono text-[var(--muted-foreground)] whitespace-nowrap text-right">
                      {truncate(rowName, 16)}
                    </td>
                    {cols.map((colName, j) => {
                      const v = corr.matrix[i]?.[j];
                      return (
                        <td key={colName} className="p-0.5">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className="rounded flex items-center justify-center font-medium cursor-default"
                                style={{
                                  width: 42,
                                  height: 32,
                                  background: corrColor(v),
                                  color: textColor(v),
                                  border: "1px solid var(--border)",
                                }}
                              >
                                {v === null || v === undefined
                                  ? "—"
                                  : v.toLocaleString("pt-BR", {
                                      maximumFractionDigits: 2,
                                      minimumFractionDigits: 2,
                                    })}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <span className="text-xs">
                                <span className="font-mono">{rowName}</span> ×{" "}
                                <span className="font-mono">{colName}</span>:{" "}
                                <strong>
                                  {v === null || v === undefined
                                    ? "n/a"
                                    : v.toLocaleString("pt-BR", {
                                        maximumFractionDigits: 3,
                                      })}
                                </strong>
                              </span>
                            </TooltipContent>
                          </Tooltip>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </TooltipProvider>

          <div className="mt-4 flex items-center gap-3 text-[10px] text-[var(--muted-foreground)]">
            <span>Escala:</span>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded" style={{ background: corrColor(-1) }} />
              <span>−1</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded" style={{ background: corrColor(-0.5) }} />
              <span>−0.5</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-[var(--muted)] border border-[var(--border)]" />
              <span>0</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded" style={{ background: corrColor(0.5) }} />
              <span>+0.5</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded" style={{ background: corrColor(1) }} />
              <span>+1</span>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
