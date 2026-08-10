# Deploy — Railway (backend) + Vercel (frontend)

## Pré-requisitos

- Conta Railway (https://railway.app) — plano Hobby $5/mês ok
- Conta Vercel (https://vercel.com) — free tier suficiente
- Repo GitHub `BielmFranco/bi-dashboard-agent` já sincronizado

---

## Backend — Railway

### 1. Novo projeto

- Railway → **New Project** → **Deploy from GitHub repo** → escolha `bi-dashboard-agent`
- Railway detecta o `Dockerfile` em `backend/`
- Nas **Settings** do serviço:
  - **Root Directory**: `backend`
  - **Watch Paths**: `backend/**`

### 2. Variáveis de ambiente

Adicione em **Variables**:

```
GOOGLE_API_KEY=AIzaSy_ou_AQ.Ab8RN...      (sua key do AI Studio)
MODEL_ID=gemini-flash-latest
FRONTEND_URL=https://<seu-projeto>.vercel.app
```

Opcional — se quiser aceitar Vercel preview deploys automaticamente:
```
FRONTEND_URL_REGEX=^https://.*\.vercel\.app$
```

### 3. Persistência (opcional mas recomendado)

Cache disco não sobrevive redeploys. Adicione **volume** em Storage:
- Mount path: `/app/cache` (para JSONs de análise)
- Mount path: `/app/uploads` (para raw files)

Sem volume: reupload é necessário após cada deploy.

### 4. Deploy

Push no GitHub dispara build. Playwright image tem ~1GB de base — primeira build leva ~5 min.

### 5. Verificar

```
curl https://<seu-backend>.railway.app/health
```

Deve retornar `{"ok": true, "has_api_key": true, ...}`.

---

## Frontend — Vercel

### 1. Novo projeto

- Vercel → **Add New** → **Project** → import `BielmFranco/bi-dashboard-agent`
- **Root Directory**: `frontend`
- Framework: **Next.js** (auto-detect)

### 2. Variável de ambiente

```
NEXT_PUBLIC_API_URL=https://<seu-backend>.railway.app
```

### 3. Deploy

Vercel builda em ~2 min. URL final: `https://<projeto>.vercel.app`.

---

## Pós-deploy

### Fluxo de teste

1. Abre URL Vercel
2. Faz upload de planilha
3. Verifica se `/analyze` retorna 200 (Network tab)
4. Clica "Gerar com Gemini" — deve funcionar streaming
5. Clica "Baixar PDF" — Playwright deve renderizar

### Troubleshooting

**CORS bloqueando frontend**:
- Confira `FRONTEND_URL` no Railway com URL Vercel exata (sem trailing slash)
- Ou defina `FRONTEND_URL_REGEX=^https://.*\.vercel\.app$`

**PDF não renderiza / timeout**:
- Playwright precisa acessar frontend público
- Verifique env `FRONTEND_URL` no Railway
- Container Railway com pouca RAM (mínimo 512MB) → aumentar plano

**Upload > 4.5MB falha no Vercel**:
- Body limit padrão Vercel serverless functions = 4.5MB
- Fix: upload direto pro Railway (frontend chama `NEXT_PUBLIC_API_URL/upload` — já é o comportamento atual)

**Cold start lento**:
- Railway free tier hiberna após inatividade
- Upgrade para hobby ($5/mês) para always-on

---

## Custos estimados

| Serviço | Plano | Custo mês |
|---------|-------|-----------|
| Railway backend | Hobby | $5 |
| Vercel frontend | Hobby (free) | $0 |
| Gemini API | Free tier (1500 req/dia) | $0 |
| **Total** | | **~$5/mês** |

Free tier Gemini cobre ~50 usuários/dia com uso moderado. Além disso, upgrade para plano pago do Google AI.

---

## Alternativas

- **Fly.io** (backend): mais barato ($3/mês) mas Playwright mais complicado — sem base image oficial
- **Render** (backend): free tier existe, mas hiberna e volumes pagos
- **Netlify** (frontend): equivalente ao Vercel, ambos funcionam

---

## Rollback

Railway e Vercel guardam N deploys anteriores. Rollback via UI (1 clique) ou:

```bash
railway service redeploy --commit <sha>
vercel rollback <deployment-url>
```
