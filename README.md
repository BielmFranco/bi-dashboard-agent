# BI Dashboard Agent

Agente de Business Intelligence que transforma planilhas em dashboards profissionais com
KPIs, gráficos e insights gerados por IA.

**Demo:** <https://bi-agent-rosy.vercel.app>

> **Anti-alucinação por design.** Todos os números vêm do Pandas (determinístico).
> O LLM recebe o perfil estatístico já calculado e apenas interpreta — nunca calcula.

---

## Stack

- **Backend**: FastAPI + Pandas + NumPy + SciPy
- **LLM**: Groq (primário) → Google Gemini (fallback), com retry e troca automática de modelo
- **Frontend**: Next.js 16 (App Router, TypeScript, Tailwind 4, Recharts)

---

## Arquitetura

```
bi-dashboard-agent/
├── backend/
│   ├── main.py               # Endpoints FastAPI, CORS, rate limit, cache
│   ├── analyzer.py           # Perfil estatístico com Pandas
│   ├── dashboard_planner.py  # Regras de seleção de KPIs e gráficos
│   ├── llm.py                # Cadeia multi-provider Groq → Gemini
│   ├── prompts.py            # System prompts do agente BI (pt-BR)
│   ├── filters.py            # Aplicação de filtros no DataFrame
│   ├── cache.py              # Persistência em disco (JSON por file_id)
│   ├── pdf_export.py         # Playwright → PDF (endpoint legado)
│   └── tests/                # 17 testes pytest
└── frontend/
    └── src/
        ├── app/              # / · /history · /report/[fileId]
        ├── components/       # Upload, KPICard, ChartBlock, Chat, FilterBar, ...
        └── lib/api.ts        # Cliente REST tipado
```

Documentação completa em [`docs/`](docs/) — comece por
[`docs/00_CONTEXT.md`](docs/00_CONTEXT.md).

---

## Setup

### 1. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # Linux/macOS
pip install -r requirements.txt
copy .env.example .env          # preencha GROQ_API_KEY e/ou GOOGLE_API_KEY
python main.py
```

Backend sobe em `http://127.0.0.1:8000`. Valide em `/health`.

**Chaves** (ao menos uma é necessária):

- Groq — free tier, ultra-rápido: <https://console.groq.com/keys>
- Google AI Studio — free tier de 1500 req/dia sem cartão: <https://aistudio.google.com/apikey>

### 2. Frontend

```bash
cd frontend
npm install
# crie .env.local com:
#   NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
npm run dev
```

Frontend em `http://localhost:3000`.

Guia detalhado, com validação e erros comuns, em [`docs/03_SETUP.md`](docs/03_SETUP.md).

---

## Fluxo

1. Upload de `.csv`, `.xlsx`, `.xls`, `.xlsm` ou `.tsv` (máx. 50 MB)
2. `/analyze` → perfil estatístico (tipos, nulos, quartis, correlação, outliers) +
   plano de dashboard por regras
3. A interface renderiza KPIs e gráficos (bar, line, pie, scatter, boxplot) + heatmap de
   correlação
4. **Gerar insights** → análise em 5 seções via streaming SSE
5. **Chat** para perguntas ad-hoc, ciente dos filtros ativos
6. **Filtros** (`in`, `range`, `eq`) recomputam perfil, KPIs e gráficos
7. **Drill-down**: clique em uma barra para ver as linhas por trás, com export CSV
8. **Baixar PDF**: abre o relatório em A4 paisagem e o diálogo de impressão

---

## Endpoints

| Método | Rota | Uso |
|---|---|---|
| GET | `/health` | Status, versão, uptime, arquivos em cache |
| POST | `/upload` | Envia planilha, retorna `file_id` |
| POST | `/analyze/{file_id}` | Perfil + plano de dashboard |
| GET | `/analyze/{file_id}` | Recupera análise em cache |
| POST | `/analyze/{file_id}/filtered` | Reanálise sobre subconjunto filtrado |
| GET | `/files` · DELETE `/files/{id}` | Lista e remove análises |
| GET | `/report_data/{file_id}` | Dados da página de relatório |
| POST | `/drill/{file_id}` | Linhas por trás de um ponto do gráfico |
| POST | `/insights_stream/{file_id}` | Insights via SSE |
| POST | `/chat_stream/{file_id}` | Chat via SSE |
| GET/POST | `/suggestions/{file_id}` | 4 perguntas sugeridas |
| POST | `/export/{file_id}` | PDF via Playwright *(legado — sem uso no frontend)* |

Contratos completos em [`docs/08_API.md`](docs/08_API.md).

---

## Testes

```bash
cd backend
pytest
```

17 testes cobrindo a cadeia de LLM (retry, fallback, detecção de erro transitório,
normalização entre providers) e filtros com recomputação de perfil.

Smoke test manual em [`docs/10_TESTING.md`](docs/10_TESTING.md).

---

## Deploy

| Componente | Plataforma | Configuração |
|---|---|---|
| Frontend | Vercel | Root `frontend/`, deploy automático a cada push em `main` |
| Backend | Railway (Dockerfile pronto) ou local + túnel Cloudflare | Root `backend/` |

Guia passo a passo em [`DEPLOY.md`](DEPLOY.md).

> `NEXT_PUBLIC_API_URL` é lida em **tempo de build**. Alterá-la no Vercel exige um
> **redeploy** para ter efeito.

---

## Documentação

| Documento | Conteúdo |
|---|---|
| [`docs/00_CONTEXT.md`](docs/00_CONTEXT.md) | Visão geral em 5 minutos |
| [`docs/01_ARCHITECTURE.md`](docs/01_ARCHITECTURE.md) | Arquitetura com diagramas |
| [`docs/03_SETUP.md`](docs/03_SETUP.md) | Setup de máquina nova |
| [`docs/07_LLM.md`](docs/07_LLM.md) | Cadeia de providers, prompts, o que é determinístico |
| [`docs/08_API.md`](docs/08_API.md) | Todos os endpoints e esquemas |
| [`docs/11_TROUBLESHOOTING.md`](docs/11_TROUBLESHOOTING.md) | 20 problemas reais e suas soluções |
| [`PROGRESS.md`](PROGRESS.md) | Estado atual e próximos passos |
| [`CHANGELOG.md`](CHANGELOG.md) | Histórico de mudanças |

---

## Licença

[MIT](LICENSE)
