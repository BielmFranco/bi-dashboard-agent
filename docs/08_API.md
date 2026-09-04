# 08 — API

Todos os endpoints de `backend/main.py`. Base local: `http://127.0.0.1:8000`.

Não há autenticação. Não há versionamento de rota. Todas as mensagens de erro são em pt-BR.

**Convenção de erro:** o FastAPI serializa `HTTPException` como `{"detail": "<mensagem>"}`.
O handler global (`main.py:86`) devolve `{"error": "Erro interno. ..."}` para exceções não
tratadas. O cliente (`api.ts:parseError`) lê `detail`, depois `message`, depois o texto cru.

---

## GET /health

**Objetivo:** verificar se o backend está no ar e configurado.

**Request:** sem parâmetros. Sem rate limit.

**Response 200:**

```json
{
  "ok": true,
  "version": "1.0.0",
  "uptime_s": 3600,
  "has_api_key": true,
  "model": "gemini-flash-latest",
  "cached_files": 3,
  "retention_days": 7,
  "disk_free_gb": 124.5
}
```

`has_api_key` verifica apenas `GOOGLE_API_KEY` ou `GEMINI_API_KEY` — **não considera
`GROQ_API_KEY`**. Um backend com só a key do Groq reporta `has_api_key: false` mesmo
funcionando.

**Consumidores:** healthcheck do Railway (`railway.json`), verificação manual.

---

## GET /files

**Objetivo:** listar todas as análises em cache.

**Response 200:**

```json
{
  "files": [
    {
      "file_id": "a1b2c3...",
      "filename": "vendas.csv",
      "uploaded_at": 1787927948.472,
      "rows": 1500,
      "cols": 8,
      "has_profile": true,
      "has_plan": true
    }
  ]
}
```

Ordenado por `uploaded_at` decrescente. `uploaded_at` é epoch em segundos (float).

**Consumidores:** `api.listFiles()` → `/history`.

---

## DELETE /files/{file_id}

**Objetivo:** apagar a análise e o arquivo raw.

**Response 200:** `{"ok": true}`
**Erros:** 404 `"file_id não encontrado."`

Remove a entrada do cache em memória, o JSON em `cache/` e o arquivo em `uploads/`.
**Irreversível.**

**Consumidores:** `api.deleteFile()` → botão de reset em `/` e botão de lixeira em `/history`.

---

## POST /upload

**Objetivo:** enviar a planilha.

**Rate limit:** 20/minuto por IP.

**Request:** `multipart/form-data`, campo `file`.

**Response 200:**

```json
{ "file_id": "a1b2c3d4e5f6...", "filename": "vendas.csv", "size": 45231 }
```

**Erros:**

| Status | Condição |
|---|---|
| 400 | `"Extensão não suportada: .xyz"` — fora de `{.csv, .xlsx, .xls, .xlsm, .tsv}` |
| 400 | `"Arquivo excede 50MB"` |
| 429 | Rate limit |

**Consumidores:** `api.uploadFile()` → `Upload.tsx`.

---

## POST /analyze/{file_id}

**Objetivo:** gerar o perfil estatístico e o plano de dashboard.

**Rate limit:** 30/minuto.

**Request:** sem body.

**Response 200:** `{"profile": Profile, "plan": Plan}` — esquemas na seção final.

**Erros:**

| Status | Condição |
|---|---|
| 404 | `file_id` desconhecido |
| 400 | `"Falha ao ler arquivo: ..."` |

**Efeito colateral:** grava `profile` e `plan` no cache em disco.

**Consumidores:** `api.analyze()` → `page.tsx` após o upload.

---

## GET /analyze/{file_id}

**Objetivo:** recuperar a análise já em cache, sem recalcular. Usado para restaurar sessão.

**Response 200:** `{"profile": Profile, "plan": Plan, "filename": string}`

**Erros:**

| Status | Condição |
|---|---|
| 404 | `file_id` desconhecido |
| 404 | `"Análise não encontrada. Rode POST /analyze."` |

**Consumidores:** `api.getAnalysis()` → restauração via `localStorage` em `page.tsx`.

---

## POST /analyze/{file_id}/filtered

**Objetivo:** reprofilar e replanejar sobre o subconjunto filtrado.

**Rate limit:** 30/minuto.

**Request:**

```json
{ "filters": { "categoria": { "op": "in", "values": ["A", "B"] } } }
```

**Response 200:** `{"profile": Profile, "plan": Plan}`
O `profile` ganha o campo extra `active_filters: string[]`.

**Erros:**

| Status | Condição |
|---|---|
| 404 | `file_id` desconhecido |
| 400 | `"Falha ao ler arquivo: ..."` |
| 400 | `"Filtros resultaram em 0 registros. Ajuste os critérios."` |

**Não persiste** o resultado filtrado no cache — o cache guarda só a análise base.

**Consumidores:** `api.analyzeFiltered()` → `FilterBar` via `page.applyFilters()`.

---

## GET /report_data/{file_id}

**Objetivo:** alimentar a página `/report/[fileId]` do Next.js.

**Response 200:**

```json
{
  "profile": { },
  "plan": { },
  "filename": "vendas.csv",
  "insights": "## 1. Resumo da Base\n..."
}
```

`insights` é `null` a menos que `POST /export` tenha sido chamado com o texto.

**Erros:** 404 nos dois casos (`file_id` inexistente ou análise ausente).

**Consumidores:** `report/[fileId]/page.tsx` — via `fetch` direto, não pelo `api.ts`.

---

## POST /export/{file_id}

> **Sem chamador no frontend desde o commit `f3732e7`.** Mantido no código; requer
> Playwright com Chromium instalado. Ver [`14_KNOWN_LIMITATIONS.md`](14_KNOWN_LIMITATIONS.md).

**Objetivo:** renderizar o relatório em PDF via Chromium headless.

**Rate limit:** 5/minuto.

**Request (opcional):**

```json
{ "insights": "texto markdown", "frontend_url": "https://exemplo.vercel.app" }
```

**Response 200:** `application/pdf`, com header
`Content-Disposition: attachment; filename="<nome>_relatorio.pdf"`.

**Erros:**

| Status | Condição |
|---|---|
| 404 | `file_id` desconhecido |
| 400 | `"Rode /analyze antes."` |
| 500 | `PdfExportError` — inclui timeout de `.report-doc` após 15 s |

**Efeito colateral:** se `insights` vier no body, é gravado no cache.

**Fluxo interno:** monta `{frontend}/report/{file_id}` → `pdf_export.render_pdf(url)` →
Chromium abre a URL, espera `.report-doc`, gera o PDF A4 paisagem.

**Dependência crítica:** o Chromium precisa **conseguir acessar a URL do frontend**. Foi
essa dependência que quebrou repetidamente no ambiente com túnel Cloudflare.

---

## POST /drill/{file_id}

**Objetivo:** listar as linhas por trás de um ponto do gráfico.

**Rate limit:** 30/minuto.

**Request:**

```json
{
  "column": "categoria",
  "value": "Eletrônicos",
  "op": "eq",
  "filters": { },
  "limit": 200
}
```

`op` aceita `"eq"`; qualquer outro valor devolve o DataFrame sem filtro adicional
(apenas os `filters` do dashboard).

**Response 200:**

```json
{
  "column": "categoria",
  "value": "Eletrônicos",
  "total": 42,
  "columns": ["data", "categoria", "valor"],
  "rows": [ { "data": "2025-01-15", "categoria": "Eletrônicos", "valor": 1500 } ]
}
```

`total` é a contagem **após** o `limit`, não o total real de correspondências.

**Erros:** 404 `file_id`; 400 leitura de arquivo; 400 `"Coluna 'X' não existe"`.

**Consumidores:** `api.drillDown()` → `DrillDownModal.tsx`.

---

## POST /insights/{file_id}

> **Sem chamador no frontend.** A interface usa apenas a versão em streaming.

**Rate limit:** 10/minuto.

**Request:** `{"filters": {}}` (opcional)
**Response 200:** `{"insights": "## 1. Resumo da Base\n..."}`
**Erros:** 404; 400 `"Rode /analyze antes."`; 500 com mensagem de LLM traduzida.

---

## POST /insights_stream/{file_id}

**Objetivo:** gerar insights com streaming SSE.

**Rate limit:** 10/minuto.

**Request:** `{"filters": {}}` (opcional)

**Response 200:** `text/event-stream`

```
event: chunk
data: ## 1. Resumo da Base

event: chunk
data: A base contém 1.500 registros...

event: done
data: 
```

Em caso de falha do LLM, o stream emite `event: error` com a mensagem — **status HTTP
continua 200**, porque os headers já foram enviados.

Headers de resposta:

```
Cache-Control: no-cache, no-transform
X-Accel-Buffering: no
Connection: keep-alive
```

**Erros antes do stream:** 404; 400 `"Rode /analyze antes."`

**Consumidores:** `api.insightsStream()` → `page.runInsights()`.

---

## POST /chat/{file_id}

> **Sem chamador no frontend.** A interface usa apenas a versão em streaming.

**Rate limit:** 10/minuto.

**Request:**

```json
{
  "history": [ { "role": "user", "content": "..." }, { "role": "assistant", "content": "..." } ],
  "message": "Qual a média de vendas?",
  "filters": { }
}
```

**Response 200:** `{"reply": "..."}`

---

## POST /chat_stream/{file_id}

**Objetivo:** chat com streaming SSE.

**Rate limit:** 10/minuto.

**Request:** idêntico ao `/chat`.
**Response:** mesmo formato SSE do `/insights_stream`.

**Erros antes do stream:** 404; 400 `"Rode /analyze antes."` (verifica só `profile`, não `plan`).

**Consumidores:** `api.chatStream()` → `Chat.tsx`.

---

## GET /suggestions/{file_id}

**Objetivo:** 4 perguntas sugeridas, geradas pelo LLM, sem considerar filtros.

**Rate limit:** 20/minuto.

**Response 200:** `{"suggestions": ["Qual o produto mais vendido?", "..."]}` — sempre no
máximo 4 itens.

**Consumidores:** `api.fetchSuggestions()` quando não há filtros ativos.

---

## POST /suggestions/{file_id}

**Objetivo:** mesma coisa, mas considerando os filtros ativos.

**Rate limit:** 20/minuto.
**Request:** `{"filters": { }}`
**Response:** idêntica ao `GET`.

Existe porque `GET` não aceita body. O `GET` foi mantido por compatibilidade.

**Consumidores:** `api.fetchSuggestions()` quando há filtros ativos.

---

## Esquemas

### Profile

```ts
{
  rows: number;
  cols: number;
  columns: ColumnProfile[];
  duplicates: number;
  empty_columns: string[];
  correlation: { columns: string[]; matrix: (number | null)[][] } | null;
  sample: Record<string, unknown>[];
  sample_size: number;
  active_filters?: string[];    // só quando há filtros
}
```

### ColumnProfile

```ts
{
  name: string;
  dtype: string;
  semantic: "numeric" | "categorical" | "datetime" | "datetime_like"
          | "boolean" | "text" | "id" | "empty";
  n: number;
  nulls: number;
  null_pct: number;
  unique: number;
  // se semantic === "numeric":
  min?, max?, mean?, median?, std?, sum?: number | null;
  outliers_count?: number;
  // se semantic é categorical | text | boolean:
  top_values?: { value: unknown; count: number }[];
  // se semantic é datetime | datetime_like:
  min_date?, max_date?: string | null;
}
```

O backend também devolve `q25` e `q75` para colunas numéricas, mas **esses campos não
estão declarados** em `ColumnProfile` no `api.ts`. Divergência de contrato registrada em
[`14_KNOWN_LIMITATIONS.md`](14_KNOWN_LIMITATIONS.md).

### Plan

```ts
{
  kpis: { id: string; label: string; value: number | null; format: "int" | "num" }[];
  charts: ChartSpec[];
  filters_suggested: string[];
}
```

### ChartSpec

```ts
{
  id: string;
  type: "bar" | "line" | "pie" | "scatter" | "boxplot";
  title: string;
  rationale: string;
  x_label?: string;
  y_label?: string;
  data: { label?: string; value?: number; x?: number; y?: number }[] | BoxplotStats[];
}
```

### BoxplotStats

```ts
{
  min: number; q1: number; median: number; q3: number; max: number;
  abs_min: number; abs_max: number;
  outliers: number[];      // até 50
  outliers_count: number;  // total real
  n: number; mean: number;
}
```

### FilterMap

```ts
type FilterSpec =
  | { op: "in";    values: (string | number)[] }
  | { op: "range"; min?: number | string | null; max?: number | string | null }
  | { op: "eq";    value: string | number };

type FilterMap = Record<string, FilterSpec>;
```

---

## Rate limits — resumo

| Limite | Endpoints |
|---|---|
| 5/min | `POST /export` |
| 10/min | `/insights`, `/insights_stream`, `/chat`, `/chat_stream` |
| 20/min | `POST /upload`, `GET` e `POST /suggestions` |
| 30/min | `/analyze`, `/analyze/filtered`, `/drill` |
| sem limite | `GET /health`, `GET /files`, `DELETE /files`, `GET /analyze`, `GET /report_data` |

A chave é o IP resolvido por `_client_ip`, que respeita `cf-connecting-ip` e
`x-forwarded-for` — importante atrás do túnel Cloudflare, senão todos os usuários
compartilhariam o mesmo balde.

Estouro devolve **HTTP 429** via o handler padrão do slowapi.
