const BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export async function uploadFile(file: File) {
  const fd = new FormData();
  fd.append("file", file);
  const r = await fetch(`${BASE}/upload`, { method: "POST", body: fd });
  if (!r.ok) throw new Error((await r.json()).detail || "Erro no upload");
  return r.json() as Promise<{ file_id: string; filename: string; size: number }>;
}

export async function analyze(fileId: string) {
  const r = await fetch(`${BASE}/analyze/${fileId}`, { method: "POST" });
  if (!r.ok) throw new Error((await r.json()).detail || "Erro na análise");
  return r.json() as Promise<{ profile: Profile; plan: Plan }>;
}

export async function insights(fileId: string) {
  const r = await fetch(`${BASE}/insights/${fileId}`, { method: "POST" });
  if (!r.ok) throw new Error((await r.json()).detail || "Erro nos insights");
  return r.json() as Promise<{ insights: string }>;
}

export async function chat(fileId: string, history: ChatMsg[], message: string) {
  const r = await fetch(`${BASE}/chat/${fileId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ history, message }),
  });
  if (!r.ok) throw new Error((await r.json()).detail || "Erro no chat");
  return r.json() as Promise<{ reply: string }>;
}

export type ChatMsg = { role: "user" | "assistant"; content: string };

export type ColumnProfile = {
  name: string;
  dtype: string;
  semantic: string;
  n: number;
  nulls: number;
  null_pct: number;
  unique: number;
  min?: number | null;
  max?: number | null;
  mean?: number | null;
  median?: number | null;
  std?: number | null;
  sum?: number | null;
  outliers_count?: number;
  top_values?: { value: unknown; count: number }[];
  min_date?: string | null;
  max_date?: string | null;
};

export type Profile = {
  rows: number;
  cols: number;
  columns: ColumnProfile[];
  duplicates: number;
  empty_columns: string[];
  correlation: { columns: string[]; matrix: (number | null)[][] } | null;
  sample: Record<string, unknown>[];
  sample_size: number;
};

export type ChartSpec = {
  id: string;
  type: "bar" | "line" | "pie" | "scatter";
  title: string;
  rationale: string;
  x_label?: string;
  y_label?: string;
  data: { label?: string; value?: number; x?: number; y?: number }[];
};

export type KPI = {
  id: string;
  label: string;
  value: number | null;
  format: "int" | "num";
};

export type Plan = {
  kpis: KPI[];
  charts: ChartSpec[];
  filters_suggested: string[];
};
