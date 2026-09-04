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

export type FilterSpec =
  | { op: "in"; values: (string | number)[] }
  | { op: "range"; min?: number | string | null; max?: number | string | null }
  | { op: "eq"; value: string | number };

export type FilterMap = Record<string, FilterSpec>;

export async function analyzeFiltered(fileId: string, filters: FilterMap) {
  return request<{ profile: Profile; plan: Plan }>(
    `/analyze/${fileId}/filtered`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filters }),
      timeoutMs: 60000,
    },
  );
}

export type DrillResult = {
  column: string;
  value: string | number | null;
  total: number;
  columns: string[];
  rows: Record<string, unknown>[];
};

export async function drillDown(
  fileId: string,
  column: string,
  value: string | number,
  filters: FilterMap = {},
) {
  return request<DrillResult>(`/drill/${fileId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ column, value, op: "eq", filters, limit: 200 }),
    timeoutMs: 30000,
  });
}

export async function getAnalysis(fileId: string) {
  return request<{ profile: Profile; plan: Plan; filename?: string }>(
    `/analyze/${fileId}`,
    { method: "GET", timeoutMs: 15000 },
  );
}

export async function deleteFile(fileId: string) {
  return request<{ ok: boolean }>(`/files/${fileId}`, {
    method: "DELETE",
    timeoutMs: 10000,
  });
}

export type FileEntry = {
  file_id: string;
  filename: string | null;
  uploaded_at: number | null;
  rows: number | null;
  cols: number | null;
  has_profile: boolean;
  has_plan: boolean;
};

export async function listFiles() {
  return request<{ files: FileEntry[] }>("/files", {
    method: "GET",
    timeoutMs: 15000,
  });
}

export async function exportPdf(
  fileId: string,
  opts?: { insights?: string; frontendUrl?: string },
): Promise<{ blob: Blob; filename: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 120000);
  try {
    const r = await fetch(`${BASE}/export/${fileId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        insights: opts?.insights ?? null,
        frontend_url:
          opts?.frontendUrl ??
          (typeof window !== "undefined" ? window.location.origin : null),
      }),
      signal: ctrl.signal,
    });
    if (!r.ok) {
      const ct = r.headers.get("content-type") || "";
      let msg = `HTTP ${r.status}`;
      try {
        msg = ct.includes("application/json")
          ? (await r.json()).detail || msg
          : (await r.text()).slice(0, 400) || msg;
      } catch {
        /* keep */
      }
      throw new Error(`[${r.status}] ${msg}`);
    }
    const cd = r.headers.get("Content-Disposition") || "";
    const match = /filename="?([^"]+)"?/i.exec(cd);
    const filename = match?.[1] ?? "relatorio.pdf";
    return { blob: await r.blob(), filename };
  } finally {
    clearTimeout(t);
  }
}

export async function insights(fileId: string, filters: FilterMap = {}) {
  return request<{ insights: string }>(`/insights/${fileId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filters }),
    timeoutMs: 180000,
  });
}

export async function insightsStream(
  fileId: string,
  onChunk: (delta: string) => void,
  signal?: AbortSignal,
  filters: FilterMap = {},
): Promise<void> {
  const r = await fetch(`${BASE}/insights_stream/${fileId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filters }),
    signal,
  });
  if (!r.ok || !r.body) {
    const ct = r.headers.get("content-type") || "";
    let msg = `HTTP ${r.status}`;
    try {
      if (ct.includes("application/json")) {
        const j = await r.json();
        msg = j.detail || msg;
      } else {
        msg = (await r.text()).slice(0, 400) || msg;
      }
    } catch {
      /* keep */
    }
    throw new Error(`[${r.status}] ${msg}`);
  }
  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let errored: string | null = null;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      const raw = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      let ev = "chunk";
      const dataLines: string[] = [];
      for (const line of raw.split("\n")) {
        if (line.startsWith("event: ")) ev = line.slice(7).trim();
        else if (line.startsWith("data: ")) dataLines.push(line.slice(6));
      }
      const data = dataLines.join("\n");
      if (ev === "chunk") onChunk(data);
      else if (ev === "error") errored = data;
      else if (ev === "done") return;
    }
  }
  if (errored) throw new Error(errored);
}

export async function chat(
  fileId: string,
  history: ChatMsg[],
  message: string,
  filters: FilterMap = {},
) {
  return request<{ reply: string }>(`/chat/${fileId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ history, message, filters }),
    timeoutMs: 120000,
  });
}

export async function chatStream(
  fileId: string,
  history: ChatMsg[],
  message: string,
  onChunk: (delta: string) => void,
  signal?: AbortSignal,
  filters: FilterMap = {},
): Promise<void> {
  const r = await fetch(`${BASE}/chat_stream/${fileId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ history, message, filters }),
    signal,
  });
  if (!r.ok || !r.body) {
    const msg = await parseError(r);
    throw new Error(`[${r.status}] ${msg}`);
  }
  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let errored: string | null = null;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      const raw = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      let ev = "chunk";
      const dataLines: string[] = [];
      for (const line of raw.split("\n")) {
        if (line.startsWith("event: ")) ev = line.slice(7).trim();
        else if (line.startsWith("data: ")) dataLines.push(line.slice(6));
      }
      const data = dataLines.join("\n");
      if (ev === "chunk") onChunk(data);
      else if (ev === "error") errored = data;
      else if (ev === "done") return;
    }
  }
  if (errored) throw new Error(errored);
}

export async function fetchSuggestions(fileId: string, filters: FilterMap = {}) {
  const hasFilters = Object.keys(filters).length > 0;
  if (!hasFilters) {
    return request<{ suggestions: string[] }>(`/suggestions/${fileId}`, {
      method: "GET",
      timeoutMs: 30000,
    });
  }
  return request<{ suggestions: string[] }>(`/suggestions/${fileId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filters }),
    timeoutMs: 30000,
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

export type GroupSummary = {
  dimension: string;
  metrics: string[];
  groups: {
    value: string;
    count: number;
    [metric: string]: string | number | { sum: number | null; mean: number | null };
  }[];
};

export type Profile = {
  rows: number;
  cols: number;
  columns: ColumnProfile[];
  duplicates: number;
  empty_columns: string[];
  correlation: { columns: string[]; matrix: (number | null)[][] } | null;
  group_summaries?: GroupSummary[];
  sample: Record<string, unknown>[];
  sample_size: number;
  active_filters?: string[];
};

export type BoxplotStats = {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  abs_min: number;
  abs_max: number;
  outliers: number[];
  outliers_count: number;
  n: number;
  mean: number;
};

export type ChartSpec = {
  id: string;
  type: "bar" | "line" | "pie" | "scatter" | "boxplot";
  title: string;
  rationale: string;
  x_label?: string;
  y_label?: string;
  data:
    | { label?: string; value?: number; x?: number; y?: number }[]
    | BoxplotStats[];
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
