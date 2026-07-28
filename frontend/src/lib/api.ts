const BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

async function parseError(r: Response): Promise<string> {
  const ct = r.headers.get("content-type") || "";
  try {
    if (ct.includes("application/json")) {
      const j = await r.json();
      return j.detail || j.message || JSON.stringify(j);
    }
    const t = await r.text();
    return t.slice(0, 400) || `HTTP ${r.status}`;
  } catch {
    return `HTTP ${r.status} ${r.statusText}`;
  }
}

async function request<T>(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const { timeoutMs = 120000, ...rest } = init;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(`${BASE}${path}`, { ...rest, signal: ctrl.signal });
    if (!r.ok) {
      const msg = await parseError(r);
      throw new Error(`[${r.status}] ${msg}`);
    }
    return (await r.json()) as T;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error(`Timeout após ${timeoutMs / 1000}s`);
    }
    if (e instanceof TypeError) {
      throw new Error(
        `Falha de rede — backend em ${BASE} não respondeu. Confira se o servidor está rodando.`,
      );
    }
    throw e;
  } finally {
    clearTimeout(t);
  }
}

export async function uploadFile(file: File) {
  const fd = new FormData();
  fd.append("file", file);
  return request<{ file_id: string; filename: string; size: number }>("/upload", {
    method: "POST",
    body: fd,
    timeoutMs: 60000,
  });
}

export async function analyze(fileId: string) {
  return request<{ profile: Profile; plan: Plan }>(`/analyze/${fileId}`, {
    method: "POST",
    timeoutMs: 60000,
  });
}

export async function insights(fileId: string) {
  return request<{ insights: string }>(`/insights/${fileId}`, {
    method: "POST",
    timeoutMs: 180000,
  });
}

export async function chat(fileId: string, history: ChatMsg[], message: string) {
  return request<{ reply: string }>(`/chat/${fileId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ history, message }),
    timeoutMs: 120000,
  });
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
