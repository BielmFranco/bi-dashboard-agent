# 00 — Contexto Geral

> Documento de entrada. Se você é um agente novo neste repositório, leia este arquivo primeiro,
> depois `PROGRESS.md`, depois `docs/15_CONTINUITY.md`.

---

## Nome

**BI Dashboard Agent**

Repositório público: <https://github.com/BielmFranco/bi-dashboard-agent>
Demo (frontend): <https://bi-agent-rosy.vercel.app>

## Objetivo

Transformar uma planilha (`.csv`, `.xlsx`, `.xls`, `.xlsm`, `.tsv`) em um dashboard de
Business Intelligence completo — KPIs, gráficos, perfil estatístico da base e análise
estratégica em linguagem natural — sem que o usuário escreva uma linha de código.

## Problema resolvido

Analistas e gestores recebem planilhas cruas e precisam de horas em Excel ou Power BI para
chegar a um primeiro diagnóstico. O projeto entrega esse diagnóstico em segundos, com a
garantia de que **todo número exibido foi calculado por Pandas, não gerado por um LLM**.

## Usuário-alvo

Analistas de dados, gestores e times de operação que trabalham com planilhas em português
e precisam de leitura rápida antes de investir em modelagem formal.

## Arquitetura em uma frase

Frontend Next.js (Vercel) chama um backend FastAPI (local via túnel Cloudflare, ou Railway)
que lê o arquivo com Pandas, calcula o perfil estatístico e um plano de dashboard por regras
determinísticas, e só então envia esse resultado já calculado para um LLM interpretar.

Detalhe completo em [`01_ARCHITECTURE.md`](01_ARCHITECTURE.md).

## Stack confirmada

| Camada | Tecnologia | Versão fixada em |
|---|---|---|
| Backend | FastAPI 0.115.5 + Uvicorn 0.32.1 | `backend/requirements.txt` |
| Processamento | Pandas ≥2.2.3, NumPy ≥2.1.3, SciPy ≥1.14.1, openpyxl 3.1.5 | `backend/requirements.txt` |
| LLM | `groq` ≥1.0.0 (primário) + `google-genai` ≥1.0.0 (fallback) | `backend/requirements.txt` |
| Rate limit | slowapi 0.1.10 | `backend/requirements.txt` |
| PDF (servidor) | Playwright ≥1.49.0 + Chromium | `backend/requirements.txt` |
| Testes | pytest ≥8.0.0 | `backend/requirements.txt` |
| Frontend | Next.js 16.2.12 (App Router, Turbopack) | `frontend/package.json` |
| UI | React 19.2.4, Tailwind CSS 4, Radix UI, lucide-react, framer-motion, sonner | `frontend/package.json` |
| Gráficos | Recharts 2.15 | `frontend/package.json` |
| Markdown | react-markdown 10 + remark-gfm 4 | `frontend/package.json` |

Runtime observado na máquina de desenvolvimento: **Python 3.14.3**, Windows 10 Pro.
O `HANDOFF_NOVO_PC.md` pede Python 3.12+ — 3.14 funciona e é o que está em uso.

## Fluxo principal

```
Upload da planilha
  → POST /upload            (backend salva em uploads/, gera file_id)
  → POST /analyze/{file_id} (Pandas: perfil + plano de dashboard por regras)
  → UI renderiza KPIs, gráficos, perfil, heatmap de correlação
  → POST /insights_stream/{file_id} (LLM interpreta o perfil já calculado, via SSE)
  → POST /chat_stream/{file_id}     (perguntas ad-hoc sobre a base, via SSE)
  → "Baixar PDF" abre /report/{file_id}?pdf=1 e dispara window.print()
```

São 16 endpoints ao todo. Contratos completos em [`08_API.md`](08_API.md).

## LLM

Cadeia de providers, em ordem, definida em `backend/llm.py`:

1. Groq `openai/gpt-oss-20b`
2. Groq `openai/gpt-oss-120b`
3. Gemini `gemini-flash-latest`
4. Gemini `gemini-flash-lite-latest`
5. Erro traduzido para pt-BR

Cada modelo tem até `LLM_MAX_RETRIES` (padrão 3) tentativas com backoff exponencial, mas
**só reexecuta em erros transitórios** (503, timeout, overloaded). Erro de autenticação
não é retentado.

**O LLM nunca calcula números.** Ele recebe o perfil estatístico já pronto e escreve a
interpretação. Ver [`07_LLM.md`](07_LLM.md).

## Backend

Diretório `backend/`. Oito módulos Python, 1.769 linhas:

- `main.py` — endpoints FastAPI, CORS, rate limit, logging, cache em memória
- `analyzer.py` — leitura do arquivo e perfil estatístico (Pandas)
- `dashboard_planner.py` — seleção de KPIs e gráficos por regras
- `llm.py` — cadeia multi-provider Groq → Gemini
- `prompts.py` — system prompts em pt-BR
- `filters.py` — aplicação de filtros no DataFrame
- `cache.py` — persistência em disco do metadata + análise
- `pdf_export.py` — renderização via Playwright (endpoint legado, ver limitações)

Detalhe em [`04_BACKEND.md`](04_BACKEND.md).

## Frontend

Diretório `frontend/`. Next.js App Router com três rotas:

- `/` — upload + dashboard completo
- `/history` — lista de análises já feitas (multi-arquivo)
- `/report/[fileId]` — layout A4 paisagem para impressão em PDF

Detalhe em [`05_FRONTEND.md`](05_FRONTEND.md).

## Deploy

| Componente | Onde roda hoje | Estado |
|---|---|---|
| Frontend | Vercel (`bi-agent-rosy.vercel.app`) | Ativo, deploy automático via GitHub |
| Backend | Máquina local + túnel Cloudflare | Ativo, mas o túnel muda de URL a cada restart |
| Backend (alternativa preparada) | Railway (`Dockerfile` + `railway.json`) | Configurado no repositório, **não confirmado em produção** |

Detalhe em [`DEPLOY.md`](../DEPLOY.md) e [`09_CONFIGURATION.md`](09_CONFIGURATION.md).

## Estado atual

Aplicação funcional de ponta a ponta. Última mudança relevante foi a migração da geração
de PDF: saiu de Playwright no servidor e passou a usar `window.print()` no navegador do
usuário. Ver [`PROGRESS.md`](../PROGRESS.md) para o estado detalhado por área.

## Principais arquivos

| Arquivo | Por que importa |
|---|---|
| `backend/main.py` | Todos os endpoints. Ponto de entrada de qualquer mudança de API. |
| `backend/analyzer.py` | Define o que é "perfil". Mudar aqui muda tudo a jusante. |
| `backend/dashboard_planner.py` | Decide quais gráficos aparecem. Regras puras, sem LLM. |
| `backend/llm.py` | Cadeia de providers e tratamento de erro. |
| `frontend/src/lib/api.ts` | Contrato tipado entre frontend e backend. |
| `frontend/src/app/page.tsx` | Orquestra todo o dashboard. |
| `frontend/src/app/report/[fileId]/page.tsx` | Página de impressão do PDF. |

## Principais riscos

1. **URL do túnel Cloudflare muda a cada restart** e `NEXT_PUBLIC_API_URL` é lida em tempo
   de build no Vercel — trocar a URL exige redeploy. É a causa raiz mais comum de "o site
   parou de funcionar".
2. **`backend/uploads/` e `backend/cache/` não são versionados** e não sobrevivem a um
   redeploy de container sem volume montado.
3. **Endpoint `POST /export/{file_id}` (Playwright) continua no código mas não é mais
   chamado pelo frontend.** Ver [`14_KNOWN_LIMITATIONS.md`](14_KNOWN_LIMITATIONS.md).

## Próximo passo recomendado

Ver a seção `NEXT STEP` de [`PROGRESS.md`](../PROGRESS.md).
