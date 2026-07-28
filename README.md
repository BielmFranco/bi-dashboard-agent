# BI Dashboard Agent

Agente de Business Intelligence que transforma planilhas em dashboards profissionais com KPIs, gráficos e insights gerados por Claude Haiku.

## Stack

- **Backend**: FastAPI + Pandas + Anthropic SDK (Claude Haiku 4.5)
- **Frontend**: Next.js 16 (App Router, TS, Tailwind, Recharts)

## Arquitetura

```
bi-agent/
├── backend/
│   ├── main.py               # FastAPI endpoints
│   ├── analyzer.py           # Perfil estatístico com Pandas
│   ├── dashboard_planner.py  # Regras de seleção de KPIs e gráficos
│   ├── llm.py                # Cliente Claude Haiku
│   └── prompts.py            # System prompt do agente BI
└── frontend/
    └── src/
        ├── app/              # Rota principal
        ├── components/       # Upload, KPICard, ChartBlock, Chat, ...
        └── lib/api.ts        # Cliente REST tipado
```

Números vêm de Pandas (determinístico); Claude apenas interpreta o perfil já calculado — sem alucinar dados.

## Setup

### 1. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate     # Windows
pip install -r requirements.txt
copy .env.example .env     # coloque sua ANTHROPIC_API_KEY
python main.py
```

Backend sobe em `http://127.0.0.1:8000`.

### 2. Frontend

```bash
cd frontend
npm install
copy .env.local.example .env.local
npm run dev
```

Frontend em `http://localhost:3000`.

## Fluxo

1. Upload `.xlsx` / `.csv` → backend cacheia
2. `/analyze` → perfil (tipos, nulos, stats, correlação, outliers) + plano de dashboard
3. UI renderiza KPIs + gráficos (bar/line/pie/scatter/histograma)
4. Botão "Gerar com Claude" → insights em 5 seções (Resumo, EDA, Dashboard, Insights, Próximas Análises)
5. Chat para perguntas ad-hoc sobre a base

## Endpoints

| Método | Rota | Uso |
|--------|------|-----|
| POST | `/upload` | Envia planilha, retorna `file_id` |
| POST | `/analyze/{file_id}` | Perfil + plano de dashboard |
| POST | `/insights/{file_id}` | Análise em NL via Claude |
| POST | `/chat/{file_id}` | Chat sobre a base |
