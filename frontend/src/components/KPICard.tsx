"use client";

import { motion } from "framer-motion";
import type { KPI } from "@/lib/api";
import { fmtCompactBR, fmtNumberBR } from "@/lib/format";
import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function fmt(v: number | null, kind: KPI["format"]) {
  if (v === null || v === undefined) return "—";
  const abs = Math.abs(v);
  if (kind === "int" && abs < 1_000_000) return fmtNumberBR(v, { maximumFractionDigits: 0 });
  if (abs >= 10_000) return fmtCompactBR(v);
  return fmtNumberBR(v);
}

type Props = { kpi: KPI; index?: number };

export default function KPICard({ kpi, index = 0 }: Props) {
  const value = fmt(kpi.value, kpi.format);
  const full =
    kpi.value !== null && kpi.value !== undefined
      ? kpi.value.toLocaleString("pt-BR", { maximumFractionDigits: 4 })
      : undefined;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04, ease: [0.16, 1, 0.3, 1] }}
    >
      <Card className="group relative overflow-hidden p-5 transition-colors hover:border-[var(--muted-foreground)]/40">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--primary)]/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

        <p className="text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] font-medium">
          {kpi.label}
        </p>

        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <p
                className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-[var(--foreground)] truncate cursor-default"
              >
                {value}
              </p>
            </TooltipTrigger>
            {full && full !== value && (
              <TooltipContent>
                <span className="font-mono text-xs">{full}</span>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </Card>
    </motion.div>
  );
}
