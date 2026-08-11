"use client";

import { Filter, X } from "lucide-react";
import { useState } from "react";
import type { ColumnProfile, FilterMap, Profile } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Props = {
  profile: Profile;
  filters: FilterMap;
  onChange: (next: FilterMap) => void;
  onClear: () => void;
  loading?: boolean;
};

function isFilterable(c: ColumnProfile): boolean {
  return (
    c.semantic === "categorical" ||
    c.semantic === "boolean" ||
    c.semantic === "datetime" ||
    c.semantic === "datetime_like" ||
    c.semantic === "numeric"
  );
}

export default function FilterBar({
  profile,
  filters,
  onChange,
  onClear,
  loading,
}: Props) {
  const [open, setOpen] = useState(false);
  const filterable = profile.columns.filter(isFilterable);
  const activeCount = Object.keys(filters).filter((k) => filters[k] !== undefined).length;

  function toggleCategoricalValue(col: string, value: string) {
    const current = filters[col];
    const arr = current && current.op === "in" ? [...current.values] : [];
    const idx = arr.indexOf(value);
    if (idx >= 0) arr.splice(idx, 1);
    else arr.push(value);
    const next = { ...filters };
    if (arr.length === 0) delete next[col];
    else next[col] = { op: "in", values: arr };
    onChange(next);
  }

  function isChecked(col: string, value: string): boolean {
    const s = filters[col];
    return !!(s && s.op === "in" && s.values.includes(value));
  }

  const activePills: { col: string; label: string }[] = Object.entries(filters).flatMap(
    ([col, spec]) => {
      if (spec.op === "in") {
        return spec.values.map((v) => ({ col, label: `${col}: ${v}` }));
      }
      if (spec.op === "range") {
        const parts: string[] = [];
        if (spec.min !== undefined && spec.min !== null) parts.push(`≥ ${spec.min}`);
        if (spec.max !== undefined && spec.max !== null) parts.push(`≤ ${spec.max}`);
        return [{ col, label: `${col}: ${parts.join(" ")}` }];
      }
      if (spec.op === "eq") return [{ col, label: `${col} = ${spec.value}` }];
      return [];
    },
  );

  function removePill(col: string, value?: string) {
    const spec = filters[col];
    if (!spec) return;
    const next = { ...filters };
    if (spec.op === "in" && value !== undefined) {
      const remaining = spec.values.filter((v) => String(v) !== String(value));
      if (remaining.length === 0) delete next[col];
      else next[col] = { op: "in", values: remaining };
    } else {
      delete next[col];
    }
    onChange(next);
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant={activeCount > 0 ? "default" : "outline"}
          size="sm"
          onClick={() => setOpen((v) => !v)}
          disabled={loading}
          className="gap-1.5"
        >
          <Filter className="h-3.5 w-3.5" />
          Filtros
          {activeCount > 0 && (
            <Badge variant="secondary" className="ml-1">
              {activeCount}
            </Badge>
          )}
        </Button>

        {activePills.map((p) => (
          <button
            key={`${p.col}-${p.label}`}
            onClick={() => {
              const spec = filters[p.col];
              if (spec?.op === "in") {
                const val = p.label.split(": ")[1];
                removePill(p.col, val);
              } else {
                removePill(p.col);
              }
            }}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--muted)]/60 hover:bg-[var(--muted)] px-2.5 py-1 text-[11px] text-[var(--foreground)] transition-colors"
          >
            {p.label}
            <X className="h-3 w-3" />
          </button>
        ))}

        {activeCount > 0 && (
          <button
            onClick={onClear}
            className="text-[11px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] underline underline-offset-2 ml-auto"
          >
            Limpar tudo
          </button>
        )}

        {loading && (
          <span className="ml-auto text-[11px] text-[var(--muted-foreground)] animate-pulse">
            Aplicando...
          </span>
        )}
      </div>

      {open && (
        <div className="mt-3 pt-3 border-t border-[var(--border)] grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 max-h-72 overflow-y-auto">
          {filterable.map((c) => (
            <div key={c.name} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium font-mono">{c.name}</span>
                <Badge variant="secondary" className="text-[9px]">
                  {c.semantic}
                </Badge>
              </div>

              {c.semantic === "categorical" || c.semantic === "boolean" ? (
                <div className="max-h-32 overflow-y-auto space-y-0.5 pr-1">
                  {(c.top_values ?? []).map((tv) => {
                    const label = String(tv.value ?? "—");
                    return (
                      <label
                        key={label}
                        className="flex items-center gap-2 text-[11px] cursor-pointer hover:bg-[var(--muted)]/50 rounded px-1 py-0.5"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked(c.name, label)}
                          onChange={() => toggleCategoricalValue(c.name, label)}
                          className="cursor-pointer accent-[var(--primary)]"
                        />
                        <span className="flex-1 truncate">{label}</span>
                        <span className="text-[9px] text-[var(--muted-foreground)] tabular-nums">
                          {tv.count}
                        </span>
                      </label>
                    );
                  })}
                </div>
              ) : c.semantic === "numeric" ? (
                <div className="space-y-1">
                  <div className="text-[9px] text-[var(--muted-foreground)]">
                    range: {c.min ?? "—"} — {c.max ?? "—"}
                  </div>
                  <RangeInput
                    col={c.name}
                    current={filters[c.name]}
                    onChange={(next) => {
                      const nx = { ...filters };
                      if (next) nx[c.name] = next;
                      else delete nx[c.name];
                      onChange(nx);
                    }}
                    kind="numeric"
                  />
                </div>
              ) : c.semantic === "datetime" || c.semantic === "datetime_like" ? (
                <div className="space-y-1">
                  <div className="text-[9px] text-[var(--muted-foreground)]">
                    período: {c.min_date?.slice(0, 10) ?? "—"} — {c.max_date?.slice(0, 10) ?? "—"}
                  </div>
                  <RangeInput
                    col={c.name}
                    current={filters[c.name]}
                    onChange={(next) => {
                      const nx = { ...filters };
                      if (next) nx[c.name] = next;
                      else delete nx[c.name];
                      onChange(nx);
                    }}
                    kind="date"
                  />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RangeInput({
  col,
  current,
  onChange,
  kind,
}: {
  col: string;
  current: import("@/lib/api").FilterSpec | undefined;
  onChange: (next: import("@/lib/api").FilterSpec | null) => void;
  kind: "numeric" | "date";
}) {
  const min = current?.op === "range" ? current.min : undefined;
  const max = current?.op === "range" ? current.max : undefined;

  function update(part: "min" | "max", raw: string) {
    const next: { min?: number | string | null; max?: number | string | null } = {
      min: min ?? null,
      max: max ?? null,
    };
    if (raw === "") next[part] = null;
    else next[part] = kind === "numeric" ? Number(raw) : raw;
    if (next.min === null && next.max === null) onChange(null);
    else onChange({ op: "range", min: next.min ?? undefined, max: next.max ?? undefined });
  }

  const inputCls =
    "w-full text-[11px] rounded border border-[var(--border)] bg-[var(--muted)]/40 px-2 py-1 outline-none focus:border-[var(--ring)]";

  return (
    <div className="flex gap-1.5">
      <input
        type={kind === "date" ? "date" : "number"}
        placeholder="mín"
        value={min ?? ""}
        onChange={(e) => update("min", e.target.value)}
        className={inputCls}
        aria-label={`${col} mínimo`}
      />
      <input
        type={kind === "date" ? "date" : "number"}
        placeholder="máx"
        value={max ?? ""}
        onChange={(e) => update("max", e.target.value)}
        className={inputCls}
        aria-label={`${col} máximo`}
      />
    </div>
  );
}
