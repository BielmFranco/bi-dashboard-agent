# 02 — Estrutura do Projeto

Inventário dos arquivos versionados. `node_modules/`, `.venv/`, `graft/`, `uploads/*`
e `cache/*` estão no `.gitignore` e não aparecem aqui.

Total: 51 commits. Código de aplicação: 1.769 linhas de Python em `backend/` (mais 179 de
teste) e 4.048 linhas de TypeScript em `frontend/src/`.

---

## Árvore

```
bi-dashboard-agent/
├── .claude/                      Configuração do Claude Code (versionada)
│   ├── helpers/
│   │   ├── graft-hooks.cjs       Hooks de rebuild do índice graft
│   │   └── graft-statusline.cjs  Statusline customizada
│   ├── launch.json               Config do dev server para o Browser pane
│   ├── settings.json             Hooks, statusline, permissões
│   └── skills/
│       ├── graft/SKILL.md        Skill de consulta ao code-graph
│       └── project-context/      Skill de continuidade (criada nesta operação)
│           └── SKILL.md
├── .gitignore
├── .ignore                       Impede ripgrep de pular os cards do graft
├── .mcp.json                     Servidor MCP graft
├── .pre-commit-config.yaml       detect-secrets + hooks básicos
├── .secrets.baseline             Baseline do detect-secrets
├── CHANGELOG.md                  Histórico organizado por tipo
├── CLAUDE.md                     Manual operacional do agente
├── DEPLOY.md                     Guia Railway + Vercel
├── LICENSE                       MIT
├── PROGRESS.md                   Estado atual do projeto
├── README.md                     Visão geral pública
├── backend/
│   ├── .dockerignore
│   ├── .env.example              Todas as variáveis, com placeholders
│   ├── Dockerfile                Base Playwright + Python
│   ├── analyzer.py               Leitura + perfil estatístico
│   ├── cache.py                  Persistência em disco
│   ├── cache/.gitkeep
│   ├── dashboard_planner.py      Regras de KPI e gráfico
│   ├── filters.py                Aplicação de filtros
│   ├── llm.py                    Cadeia Groq → Gemini
│   ├── main.py                   Endpoints FastAPI
│   ├── pdf_export.py             Playwright → PDF (endpoint legado)
│   ├── prompts.py                System prompts pt-BR
│   ├── pytest.ini
│   ├── railway.json
│   ├── requirements.txt
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── test_filters_profile.py
│   │   └── test_llm_chain.py
│   └── uploads/.gitkeep
├── docs/
│   ├── 00_CONTEXT.md ... 15_CONTINUITY.md   Documentação forense
│   ├── Documentacao_Tecnica_BI_Agent.docx   Doc técnica anterior (19 seções)
│   ├── HANDOFF_NOVO_PC.md                   Guia de troca de máquina
│   ├── build_doc.js                         Regenera o .docx
│   ├── capture_screenshots.py               Playwright → 10 PNGs
│   ├── package.json / package-lock.json     Deps do build_doc.js
│   └── screenshots/                         10 PNGs (dark + light)
└── frontend/
    ├── .gitignore
    ├── AGENTS.md                 Aviso: Next.js 16 difere do treino do modelo
    ├── CLAUDE.md                 Apenas `@AGENTS.md`
    ├── README.md                 Boilerplate do create-next-app
    ├── eslint.config.mjs
    ├── next.config.ts
    ├── package.json
    ├── postcss.config.mjs
    ├── public/
    │   ├── screenshots/step1..step4.png    Usados na landing page
    │   └── *.svg                            SVGs do boilerplate
    ├── src/
    │   ├── app/
    │   │   ├── globals.css
    │   │   ├── history/page.tsx
    │   │   ├── icon.svg
    │   │   ├── layout.tsx
    │   │   ├── page.tsx
    │   │   └── report/[fileId]/
    │   │       ├── layout.tsx
    │   │       ├── page.tsx
    │   │       └── report.css
    │   ├── components/
    │   │   ├── Boxplot.tsx
    │   │   ├── ChartBlock.tsx
    │   │   ├── Chat.tsx
    │   │   ├── CorrelationHeatmap.tsx
    │   │   ├── DrillDownModal.tsx
    │   │   ├── FilterBar.tsx
    │   │   ├── InsightsPanel.tsx
    │   │   ├── KPICard.tsx
    │   │   ├── Navbar.tsx
    │   │   ├── ProfileSummary.tsx
    │   │   ├── ThemeProvider.tsx
    │   │   ├── ThemeToggle.tsx
    │   │   ├── Upload.tsx
    │   │   ├── report/
    │   │   │   ├── InsightsGrid.tsx     NÃO IMPORTADO — código morto
    │   │   │   ├── ReportChart.tsx
    │   │   │   ├── ReportKPI.tsx
    │   │   │   └── ReportProfile.tsx
    │   │   └── ui/                       badge, button, card, dialog,
    │   │                                 progress, separator, skeleton, tooltip
    │   └── lib/
    │       ├── api.ts                    Cliente REST tipado
    │       ├── format.ts                 Formatação numérica pt-BR
    │       └── utils.ts                  `cn()` (clsx + tailwind-merge)
    ├── tsconfig.json
    └── vercel.json
```

---

## Arquivos críticos

### backend/main.py

| Campo | Valor |
|---|---|
| **Caminho** | `backend/main.py` (546 linhas) |
| **Responsabilidade** | Expor todos os endpoints HTTP, configurar CORS, rate limit, logging e o cache em memória |
| **Entradas** | Requests HTTP; variáveis de ambiente; JSONs em `backend/cache/` |
| **Saídas** | JSON, `StreamingResponse` (SSE), `Response` com bytes de PDF |
| **Dependências** | `analyzer`, `dashboard_planner`, `filters`, `llm`, `cache`, `pdf_export`, FastAPI, slowapi, pandas |
| **Consumidores** | `frontend/src/lib/api.ts`; `docs/capture_screenshots.py` indiretamente |
| **Dependências externas** | Nenhuma direta — delega ao `llm.py` |
| **Risco de alteração** | **Alto.** Qualquer mudança de contrato quebra o frontend, que não tem testes. |
| **Testes relacionados** | Nenhum teste cobre os endpoints diretamente. Só os módulos que ele chama. |
| **Documentação** | [`04_BACKEND.md`](04_BACKEND.md), [`08_API.md`](08_API.md) |

### backend/analyzer.py

| Campo | Valor |
|---|---|
| **Caminho** | `backend/analyzer.py` (201 linhas) |
| **Responsabilidade** | Carregar o arquivo em DataFrame e produzir o dicionário `profile` |
| **Entradas** | Caminho de arquivo (`load_dataframe`); `pd.DataFrame` (`profile_dataframe`) |
| **Saídas** | `pd.DataFrame`; `dict` com `rows`, `cols`, `columns[]`, `duplicates`, `empty_columns`, `correlation`, `sample`, `sample_size` |
| **Dependências** | pandas, numpy |
| **Consumidores** | `main.py`, `dashboard_planner.py` (importa `_safe`), `tests/test_filters_profile.py` |
| **Risco de alteração** | **Muito alto.** O formato de `profile` é o contrato com o planner, com o LLM e com os tipos TypeScript em `api.ts`. |
| **Testes relacionados** | `tests/test_filters_profile.py` cobre soma e contagem de linhas após filtro |
| **Documentação** | [`04_BACKEND.md`](04_BACKEND.md), [`06_DATA_PIPELINE.md`](06_DATA_PIPELINE.md) |

### backend/dashboard_planner.py

| Campo | Valor |
|---|---|
| **Caminho** | `backend/dashboard_planner.py` (207 linhas) |
| **Responsabilidade** | Escolher KPIs e gráficos por regras, e calcular os dados de cada gráfico |
| **Entradas** | `pd.DataFrame` + `profile` |
| **Saídas** | `dict` com `kpis[]`, `charts[]`, `filters_suggested[]` |
| **Dependências** | pandas, `analyzer._safe` |
| **Consumidores** | `main.py` (`/analyze`, `/analyze/filtered`, `_plan_for_context`) |
| **Risco de alteração** | **Médio.** O tipo `ChartSpec` em `api.ts` precisa acompanhar. |
| **Testes relacionados** | Nenhum teste direto — lacuna conhecida |
| **Documentação** | [`04_BACKEND.md`](04_BACKEND.md) |

### backend/llm.py

| Campo | Valor |
|---|---|
| **Caminho** | `backend/llm.py` (459 linhas) |
| **Responsabilidade** | Cadeia multi-provider, retry com backoff, streaming unificado, tradução de erro para pt-BR |
| **Entradas** | `profile`, `plan`, histórico de chat, mensagem do usuário |
| **Saídas** | `str` ou `Iterator[str]`; levanta `RuntimeError` com mensagem em pt-BR |
| **Dependências** | `groq`, `google-genai`, `python-dotenv`, `prompts` |
| **Consumidores** | `main.py` (insights, chat, suggestions) |
| **Dependências externas** | Groq API, Google Gemini API |
| **Risco de alteração** | **Alto.** É o ponto único de falha para toda funcionalidade de IA. |
| **Testes relacionados** | `tests/test_llm_chain.py` — 12 testes cobrindo retry, fallback, transient, PT_BR, stream |
| **Documentação** | [`07_LLM.md`](07_LLM.md) |

### frontend/src/lib/api.ts

| Campo | Valor |
|---|---|
| **Caminho** | `frontend/src/lib/api.ts` (383 linhas) |
| **Responsabilidade** | Contrato tipado entre frontend e backend; parsing de SSE; tradução de erro de rede |
| **Entradas** | Argumentos das funções exportadas |
| **Saídas** | Promises tipadas; callbacks `onChunk` para streams |
| **Dependências** | `process.env.NEXT_PUBLIC_API_URL` |
| **Consumidores** | `app/page.tsx`, `app/history/page.tsx`, `components/Chat.tsx`, `components/Upload.tsx`, `components/DrillDownModal.tsx` |
| **Risco de alteração** | **Alto.** Único ponto onde os tipos do backend são espelhados em TypeScript. |
| **Testes relacionados** | Nenhum. Não há suíte de testes no frontend. |
| **Documentação** | [`05_FRONTEND.md`](05_FRONTEND.md), [`08_API.md`](08_API.md) |

### frontend/src/app/page.tsx

| Campo | Valor |
|---|---|
| **Caminho** | `frontend/src/app/page.tsx` (361 linhas) |
| **Responsabilidade** | Orquestrar todo o ciclo do dashboard: upload, análise, filtros, insights, chat, drill-down, exportação |
| **Entradas** | Interação do usuário; `localStorage["bi-agent:last-file-id"]` |
| **Saídas** | Árvore React renderizada |
| **Dependências** | `lib/api`, 10 componentes, framer-motion, sonner |
| **Risco de alteração** | **Alto.** Concentra todo o estado da aplicação em hooks locais, sem store externa. |
| **Testes relacionados** | Nenhum |
| **Documentação** | [`05_FRONTEND.md`](05_FRONTEND.md) |

### frontend/src/app/report/[fileId]/page.tsx

| Campo | Valor |
|---|---|
| **Caminho** | `frontend/src/app/report/[fileId]/page.tsx` (176 linhas) |
| **Responsabilidade** | Renderizar o relatório em layout A4 paisagem e disparar `window.print()` quando `?pdf=1` |
| **Entradas** | Rota `fileId`; query params `api` e `pdf`; `GET /report_data/{fileId}` |
| **Saídas** | Página HTML impressa pelo navegador |
| **Dependências** | `report.css`, `ReportKPI`, `ReportChart`, `ReportProfile` |
| **Risco de alteração** | **Médio.** A qualidade do PDF depende inteiramente do `@media print` em `report.css`. |
| **Testes relacionados** | Nenhum |
| **Documentação** | [`05_FRONTEND.md`](05_FRONTEND.md), [`12_TECHNICAL_DECISIONS.md`](12_TECHNICAL_DECISIONS.md) |

---

## Arquivos de configuração

| Arquivo | Papel |
|---|---|
| `backend/.env.example` | Modelo de todas as variáveis. `backend/.env` não é versionado. |
| `backend/requirements.txt` | Dependências Python com versões fixadas ou mínimas |
| `backend/pytest.ini` | `testpaths = tests`, `addopts = -q --tb=short` |
| `backend/Dockerfile` | Base `mcr.microsoft.com/playwright/python:v1.62.0-jammy` |
| `backend/railway.json` | Builder Dockerfile, healthcheck em `/health` |
| `frontend/next.config.ts` | `devIndicators: false`; mapeia `API_URL` → `NEXT_PUBLIC_API_URL` |
| `frontend/vercel.json` | Framework Next.js, `npm ci` + `npm run build` |
| `frontend/tsconfig.json` | Alias `@/*` → `src/*` |
| `.mcp.json` | Servidor MCP `graft` via `npx @nanonets/graft mcp` |
| `.claude/settings.json` | Hooks graft em PostToolUse, UserPromptSubmit, SessionStart, Stop |
| `.claude/launch.json` | Dev server `npm run dev --prefix frontend` na porta 3000 |
| `.pre-commit-config.yaml` | detect-secrets + hooks de higiene |

## Arquivos de teste

| Arquivo | Testes | Cobre |
|---|---|---|
| `backend/tests/test_llm_chain.py` | 12 | Detecção de erro transitório, cadeia Groq→Gemini, PT_BR enforce, parsing de stream |
| `backend/tests/test_filters_profile.py` | 5 | Filtros `in` e `range`, recomputação de perfil, `summarize_active` |
| Frontend | 0 | Não existe suíte |

Total confirmado: **17 testes, todos passando** (`pytest -q`, exit code 0).

## Arquivos gerados / não versionados

| Caminho | Como regenerar |
|---|---|
| `backend/.venv/` | `python -m venv .venv && pip install -r requirements.txt` |
| `backend/uploads/*` | Criado em runtime pelo `POST /upload` |
| `backend/cache/*` | Criado em runtime pelo `cache.save()` |
| `backend/.env` | Copiar de `.env.example` e preencher as keys |
| `frontend/node_modules/` | `npm install` |
| `frontend/.next/` | `npm run build` ou `npm run dev` |
| `frontend/.env.local` | Criar manualmente — ver [`09_CONFIGURATION.md`](09_CONFIGURATION.md) |
| `graft/` | `graft build` |
| `docs/node_modules/` | `npm install` dentro de `docs/` |
| `test-data/` | **Não versionado e sem instrução de recriação.** Ver limitações. |

## Código morto identificado

Encontrado por busca de importadores. Nada foi removido nesta operação.

| Item | Local | Situação |
|---|---|---|
| `InsightsGrid` | `frontend/src/components/report/InsightsGrid.tsx` | Nenhum arquivo importa. Órfão desde o commit `1845cc1`, que removeu a seção de insights do PDF. |
| `exportPdf()` | `frontend/src/lib/api.ts:135` | Nenhum chamador desde `f3732e7`. Corresponde ao `POST /export/{file_id}`. |
| `insights()` | `frontend/src/lib/api.ts:174` | Versão não-streaming; a UI usa só `insightsStream()`. |
| `chat()` | `frontend/src/lib/api.ts:237` | Versão não-streaming; a UI usa só `chatStream()`. |
| `POST /export/{file_id}` | `backend/main.py:282` | Sem chamador no frontend. Depende de `pdf_export.py` e do Playwright. |
| `pdf_export.py` | `backend/pdf_export.py` | Só é usado pelo endpoint acima. |
| Query param `?api=` | `report/[fileId]/page.tsx:22` | Foi criado para o Playwright. Sem uso conhecido hoje, mas continua funcional como override manual. |
