"use client";

import { Filter, X, Hash, Calendar, ToggleLeft, Tag, Check } from "lucide-react";
import { useState, useCallback, useEffect, useRef } from "react";
import type { ColumnProfile, FilterMap, FilterSpec, Profile } from "@/lib/api";
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

function semanticIcon(semantic: string) {
  switch (semantic) {
    case "categorical":
      return Tag;
    case "boolean":
      return ToggleLeft;
    case "numeric":
      return Hash;
    case "datetime":
    case "datetime_like":
      return Calendar;
    default:
      return Filter;
  }
}

function semanticLabel(semantic: string) {
  switch (semantic) {
    case "categorical":
      return "Categórica";
    case "boolean":
      return "Booleana";
    case "numeric":
      return "Numérica";
    case "datetime":
    case "datetime_like":
      return "Data";
    default:
      return semantic;
  }
}

function filtersEqual(a: FilterMap, b: FilterMap): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

export default function FilterBar({
  profile,
  filters,
  onChange,
  onClear,
  loading,
}: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<FilterMap>(filters);
  const prevFiltersRef = useRef(filters);

  useEffect(() => {
    if (!filtersEqual(prevFiltersRef.current, filters)) {
      setDraft(filters);
      prevFiltersRef.current = filters;
    }
  }, [filters]);

  const filterable = profile.columns.filter(isFilterable);
  const activeCount = Object.keys(filters).filter((k) => filters[k] !== undefined).length;
  const isDirty = !filtersEqual(draft, filters);

  const applyDraft = useCallback(() => {
    onChange(draft);
  }, [draft, onChange]);

  function updateDraft(col: string, spec: FilterSpec | null) {
    setDraft((prev) => {
      const next = { ...prev };
      if (spec) next[col] = spec;
      else delete next[col];
      return next;
    });
  }

  function toggleCategoricalValue(col: string, value: string) {
    const current = draft[col];
    const arr = current && current.op === "in" ? [...current.values] : [];
    const idx = arr.indexOf(value);
    if (idx >= 0) arr.splice(idx, 1);
    else arr.push(value);
    if (arr.length === 0) updateDraft(col, null);
    else updateDraft(col, { op: "in", values: arr });
  }

  function isChecked(col: string, value: string): boolean {
    const s = draft[col];
    return !!(s && s.op === "in" && s.values.includes(value));
  }

  const activePills: { col: string; label: string; value?: string }[] = Object.entries(
    filters,
  ).flatMap(([col, spec]) => {
    if (spec.op === "in") {
      return spec.values.map((v) => ({
        col,
        label: `${col}: ${v}`,
        value: String(v),
      }));
    }
    if (spec.op === "range") {
      const parts: string[] = [];
      if (spec.min !== undefined && spec.min !== null) parts.push(`≥ ${spec.min}`);
      if (spec.max !== undefined && spec.max !== null) parts.push(`≤ ${spec.max}`);
      return [{ col, label: `${col}: ${parts.join(" e ")}` }];
    }
    if (spec.op === "eq") return [{ col, label: `${col} = ${spec.value}` }];
    return [];
  });

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

  function clearAll() {
    setDraft({});
    onClear();
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
      <div className="flex items-center gap-2 flex-wrap p-3">
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
            <Badge variant="secondary" className="ml-1 tabular-nums">
              {activeCount}
            </Badge>
          )}
        </Button>

        {activePills.map((p) => (
          <button
            key={`${p.col}-${p.label}`}
            onClick={() => removePill(p.col, p.value)}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--muted)]/60 hover:bg-[color-mix(in_oklab,var(--destructive)_12%,transparent)] hover:border-[var(--destructive)]/30 px-2.5 py-1 text-[11px] text-[var(--foreground)] transition-colors group"
          >
            {p.label}
            <X className="h-3 w-3 opacity-50 group-hover:opacity-100 group-hover:text-[var(--destructive)]" />
          </button>
        ))}

        {activeCount > 0 && (
          <button
            onClick={clearAll}
            className="text-[11px] text-[var(--muted-foreground)] hover:text-[var(--destructive)] underline underline-offset-2 ml-auto transition-colors"
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
        <div className="border-t border-[var(--border)]">
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-h-80 overflow-y-auto">
            {filterable.map((c) => {
              const Icon = semanticIcon(c.semantic);
              return (
                <div key={c.name} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 text-[var(--primary)] shrink-0" />
                    <span className="text-xs font-semibold truncate">{c.name}</span>
                    <span className="text-[9px] text-[var(--muted-foreground)] bg-[var(--muted)] px-1.5 py-0.5 rounded-md uppercase tracking-wide shrink-0">
                      {semanticLabel(c.semantic)}
                    </span>
                  </div>

                  {c.semantic === "categorical" || c.semantic === "boolean" ? (
                    <div className="max-h-36 overflow-y-auto space-y-0.5 pr-1">
                      {(c.top_values ?? []).map((tv) => {
                        const label = String(tv.value ?? "—");
                        const checked = isChecked(c.name, label);
                        return (
                          <button
                            key={label}
                            type="button"
                            onClick={() => toggleCategoricalValue(c.name, label)}
                            className={`flex w-full items-center gap-2 text-[11px] cursor-pointer rounded px-2 py-1 transition-colors text-left ${
                              checked
                                ? "bg-[var(--primary)]/10 text-[var(--foreground)]"
                                : "hover:bg-[var(--muted)]/50 text-[var(--muted-foreground)]"
                            }`}
                          >
                            <div
                              className={`h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                                checked
                                  ? "bg-[var(--primary)] border-[var(--primary)]"
                                  : "border-[var(--border)]"
                              }`}
                            >
                              {checked && <Check className="h-2.5 w-2.5 text-white" />}
                            </div>
                            <span className="flex-1 truncate">{label}</span>
                            <span className="text-[9px] text-[var(--muted-foreground)] tabular-nums shrink-0">
                              {tv.count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : c.semantic === "numeric" ? (
                    <RangeInput
                      col={c.name}
                      current={draft[c.name]}
                      onChange={(next) => updateDraft(c.name, next)}
                      kind="numeric"
                      minHint={c.min}
                      maxHint={c.max}
                    />
                  ) : c.semantic === "datetime" || c.semantic === "datetime_like" ? (
                    <RangeInput
                      col={c.name}
                      current={draft[c.name]}
                      onChange={(next) => updateDraft(c.name, next)}
                      kind="date"
                      minHint={c.min_date?.slice(0, 10)}
                      maxHint={c.max_date?.slice(0, 10)}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="border-t border-[var(--border)] px-4 py-3 flex items-center justify-between gap-3 bg-[var(--muted)]/30">
            <p className="text-[11px] text-[var(--muted-foreground)]">
              {isDirty
                ? "Alterações pendentes — clique Aplicar para atualizar o dashboard."
                : activeCount > 0
                  ? `${activeCount} filtro${activeCount > 1 ? "s" : ""} ativo${activeCount > 1 ? "s" : ""}`
                  : "Selecione filtros acima para refinar os dados."}
            </p>
            <div className="flex items-center gap-2 shrink-0">
              {(activeCount > 0 || isDirty) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAll}
                  className="text-[11px] h-7"
                >
                  Limpar
                </Button>
              )}
              <Button
                variant="default"
                size="sm"
                onClick={applyDraft}
                disabled={!isDirty || loading}
                className="gap-1.5 h-7"
              >
                <Check className="h-3 w-3" />
                Aplicar filtros
              </Button>
            </div>
          </div>
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
  minHint,
  maxHint,
}: {
  col: string;
  current: FilterSpec | undefined;
  onChange: (next: FilterSpec | null) => void;
  kind: "numeric" | "date";
  minHint?: number | string | null;
  maxHint?: number | string | null;
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
    "w-full text-[11px] rounded-md border border-[var(--border)] bg-[var(--muted)]/40 px-2.5 py-1.5 outline-none focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)] transition-colors";

  return (
    <div className="space-y-1.5">
      {(minHint !== undefined && minHint !== null) || (maxHint !== undefined && maxHint !== null) ? (
        <div className="text-[9px] text-[var(--muted-foreground)] flex items-center gap-1.5">
          <span className="inline-block h-px flex-1 bg-[var(--border)]" />
          <span>
            {minHint ?? "—"} até {maxHint ?? "—"}
          </span>
          <span className="inline-block h-px flex-1 bg-[var(--border)]" />
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-0.5">
          <label className="text-[9px] font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
            De
          </label>
          <input
            type={kind === "date" ? "date" : "number"}
            placeholder={minHint != null ? String(minHint) : "mín"}
            value={min ?? ""}
            onChange={(e) => update("min", e.target.value)}
            className={inputCls}
            aria-label={`${col} mínimo`}
          />
        </div>
        <div className="space-y-0.5">
          <label className="text-[9px] font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
            Até
          </label>
          <input
            type={kind === "date" ? "date" : "number"}
            placeholder={maxHint != null ? String(maxHint) : "máx"}
            value={max ?? ""}
            onChange={(e) => update("max", e.target.value)}
            className={inputCls}
            aria-label={`${col} máximo`}
          />
        </div>
      </div>
    </div>
  );
}
