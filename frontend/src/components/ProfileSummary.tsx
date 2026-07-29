"use client";

import { AlertTriangle, Database } from "lucide-react";
import { motion } from "framer-motion";
import type { Profile } from "@/lib/api";
import { fmtNumberBR } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const SEMANTIC_LABEL: Record<string, string> = {
  numeric: "numérica",
  categorical: "categórica",
  datetime: "data",
  datetime_like: "data",
  boolean: "boolean",
  id: "identificador",
  text: "texto",
  empty: "vazia",
  unknown: "outro",
};

const SEMANTIC_VARIANT: Record<
  string,
  "default" | "secondary" | "outline" | "success" | "warning" | "destructive"
> = {
  numeric: "default",
  categorical: "outline",
  datetime: "outline",
  datetime_like: "outline",
  boolean: "outline",
  id: "secondary",
  text: "secondary",
  empty: "destructive",
  unknown: "secondary",
};

export default function ProfileSummary({ profile }: { profile: Profile }) {
  const issues: string[] = [];
  if (profile.duplicates > 0) issues.push(`${profile.duplicates} linhas duplicadas`);
  if (profile.empty_columns.length)
    issues.push(`Colunas vazias: ${profile.empty_columns.join(", ")}`);
  profile.columns.forEach((c) => {
    if (c.null_pct > 30 && c.semantic !== "empty")
      issues.push(`${c.name}: ${c.null_pct}% nulos`);
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-[var(--muted-foreground)]" />
            <CardTitle className="text-sm">Resumo da Base</CardTitle>
          </div>
          <CardDescription>Perfil estatístico dos dados enviados</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] font-medium">
                Linhas
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight">
                {fmtNumberBR(profile.rows, { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] font-medium">
                Colunas
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight">
                {profile.cols}
              </p>
            </div>
          </div>

          <Separator />

          <div>
            <p className="text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] font-medium mb-2">
              Colunas detectadas
            </p>
            <div className="max-h-56 overflow-y-auto pr-1 space-y-1">
              {profile.columns.map((c) => (
                <div
                  key={c.name}
                  className="flex items-center justify-between gap-2 py-1.5 border-b border-[var(--border)] last:border-0 text-xs"
                >
                  <span className="font-mono truncate text-[var(--foreground)]">
                    {c.name}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant={SEMANTIC_VARIANT[c.semantic] ?? "secondary"}>
                      {SEMANTIC_LABEL[c.semantic] ?? c.semantic}
                    </Badge>
                    {c.null_pct > 0 && (
                      <span
                        className={`text-[10px] tabular-nums ${
                          c.null_pct > 30
                            ? "text-[var(--warning)]"
                            : "text-[var(--muted-foreground)]"
                        }`}
                      >
                        {c.null_pct}% nulos
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {issues.length > 0 && (
            <div className="rounded-lg border border-[var(--warning)]/30 bg-[var(--warning)]/8 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <AlertTriangle className="h-3.5 w-3.5 text-[var(--warning)]" />
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--warning)]">
                  Alertas de qualidade
                </p>
              </div>
              <ul className="text-xs text-[var(--foreground)]/80 list-disc list-inside space-y-0.5">
                {issues.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
