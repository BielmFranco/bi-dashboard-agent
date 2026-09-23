"use client";

import { animate, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
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
  const reduceMotion = useReducedMotion();
  const target = kpi.value;
  // Count-up: no 1º carregamento sobe de 0 (efeito "terminal"); ao reaplicar
  // filtros, anima do valor anterior → novo (não recomeça do zero).
  // `currentRef` guarda o último valor exibido, ponto de partida da animação.
  const currentRef = useRef(0);
  const [display, setDisplay] = useState<number | null>(
    target === null || target === undefined ? null : reduceMotion ? target : 0,
  );

  useEffect(() => {
    if (target === null || target === undefined) {
      setDisplay(null);
      return;
    }
    if (reduceMotion) {
      currentRef.current = target;
      setDisplay(target);
      return;
    }
    const controls = animate(currentRef.current, target, {
      duration: 0.85,
      delay: index * 0.05,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        currentRef.current = v;
        setDisplay(v);
      },
    });
    return () => controls.stop();
  }, [target, reduceMotion, index]);

  const value = fmt(display, kpi.format);
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
      <Card className="group relative overflow-hidden p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[color-mix(in_oklab,var(--primary)_40%,var(--border))] hover:shadow-[var(--shadow-card-hover)]">
        {/* Marca esmeralda vertical — âncora visual da célula de dados */}
        <span className="absolute left-0 top-4 bottom-4 w-[3px] rounded-full bg-[var(--primary-dim)] transition-colors group-hover:bg-[var(--primary)]" />

        <div className="pl-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
            {kpi.label}
          </p>

          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="mt-2.5 font-mono text-[1.7rem] font-medium tabular-nums tracking-tight text-[var(--foreground)] truncate cursor-default">
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
        </div>
      </Card>
    </motion.div>
  );
}
