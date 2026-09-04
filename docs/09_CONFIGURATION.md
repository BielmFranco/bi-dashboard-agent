# 09 — Configuração e Variáveis de Ambiente

> **Nota de numeração:** o plano original pedia `08_CONFIGURATION.md`, mas `08` já estava
> ocupado por [`08_API.md`](08_API.md). Este documento usa `09` para evitar colisão.

**Nenhuma chave real aparece aqui.** Todos os exemplos usam placeholders.
`backend/.env` e `frontend/.env.local` não são versionados.

---

## Backend — `backend/.env`

Modelo completo em `backend/.env.example`. Carregado por `python-dotenv` em `llm.py`,
com `override=True` a cada chamada de LLM.

| Variável | Obrigatória | Utilização | Onde é lida | Exemplo seguro |
|---|---|---|---|---|
| `GROQ_API_KEY` | Uma das duas | Autentica no provider primário. Ausente → cadeia pula para o Gemini. | `llm.py:56` | `<sua-key-groq>` |
| `GOOGLE_API_KEY` | Uma das duas | Autentica no Gemini. Ausente → `client()` levanta `RuntimeError`. | `llm.py:141`, `main.py:160` | `<sua-key-google>` |
| `GEMINI_API_KEY` | Não | Alias aceito no lugar de `GOOGLE_API_KEY` | `llm.py:141`, `main.py:160` | `<sua-key-google>` |
| `GROQ_MODEL_ID` | Não | Modelo Groq primário | `llm.py:33` | `openai/gpt-oss-20b` |
| `GROQ_FALLBACK_MODEL_ID` | Não | Modelo Groq secundário | `llm.py:34` | `openai/gpt-oss-120b` |
| `MODEL_ID` | Não | Modelo Gemini primário | `llm.py:153`, `main.py:162` | `gemini-flash-latest` |
| `FALLBACK_MODEL_ID` | Não | Modelo Gemini secundário. String vazia desliga o fallback. | `llm.py:43` | `gemini-flash-lite-latest` |
| `LLM_MAX_RETRIES` | Não | Tentativas por modelo em erro transitório | `llm.py:30` | `3` |
| `LLM_RETRY_BASE_DELAY` | Não | Base do backoff exponencial, em segundos | `llm.py:31` | `1.5` |
| `CACHE_RETENTION_DAYS` | Não | Idade máxima antes da limpeza automática | `main.py:115` | `7` |
| `LOG_FORMAT` | Não | `text` ou `json`. `json` ativa o `JsonFormatter`. | `main.py:60` | `text` |
| `APP_VERSION` | Não | Aparece no `/health` e no título do FastAPI | `main.py:70` | `1.0.0` |
| `FRONTEND_URL` | Em produção | Origem adicional permitida no CORS **e** base do `POST /export` | `main.py:96`, `main.py:291` | `https://exemplo.vercel.app` |
| `FRONTEND_URL_REGEX` | Não | Regex de origem para previews do Vercel | `main.py:99` | `^https://.*\.vercel\.app$` |
| `PORT` | Só em container | Porta injetada pelo Railway | `Dockerfile`, `railway.json` | `8000` |

### Padrões divergentes — atenção

`MODEL_ID` tem dois padrões diferentes no código:

| Local | Padrão |
|---|---|
| `llm.py:153` | `gemini-2.0-flash` |
| `main.py:162` (só exibição no `/health`) | `gemini-flash-latest` |
| `.env.example` | `gemini-flash-latest` |

Na prática o `.env` define o valor e o padrão do código não é usado. Ainda assim é uma
inconsistência real. Ver [`14_KNOWN_LIMITATIONS.md`](14_KNOWN_LIMITATIONS.md).

### Modelo mínimo de `.env`

```env
# Ao menos uma das duas chaves é obrigatória
GROQ_API_KEY=<sua-key-groq>
GOOGLE_API_KEY=<sua-key-google-ai-studio>
```

Todo o resto tem padrão sensato no código.

Onde obter as chaves:
- Groq: <https://console.groq.com/keys>
- Google AI Studio: <https://aistudio.google.com/apikey>

---

## Frontend — `frontend/.env.local`

| Variável | Obrigatória | Utilização | Onde é lida | Exemplo seguro |
|---|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | Sim (em produção) | URL base do backend | `lib/api.ts:1`, `report/[fileId]/page.tsx:17` | `http://127.0.0.1:8000` |
| `API_URL` | Não | Alias que `next.config.ts` mapeia para `NEXT_PUBLIC_API_URL` | `next.config.ts:6` | `https://exemplo.trycloudflare.com` |

Padrão quando ausente: `http://127.0.0.1:8000`.

### Por que existe o alias `API_URL`

```ts
// frontend/next.config.ts
env: {
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "",
}
```

O Vercel bloqueia salvar variáveis com prefixo `NEXT_PUBLIC_` como *secret*. O bloco `env`
permite definir uma variável comum `API_URL` no painel e reexportá-la para o bundle.
Commit `f3b9702`.

### `NEXT_PUBLIC_API_URL` é lida em tempo de build

Esta é a pegadinha mais frequente do projeto.

> Alterar `NEXT_PUBLIC_API_URL` no painel do Vercel **não muda nada** no site publicado
> até que um novo deploy seja feito. O valor é inlinado no bundle JavaScript durante o
> `next build`. Sempre: salvar a variável → **Redeploy**.

O mesmo vale em desenvolvimento: mudou `.env.local`, reinicie o `npm run dev`.

### `REPORT_API_URL` — obsoleta

Aparece em documentação antiga (`HANDOFF_NOVO_PC.md`, seções 5 e 6). **Nenhum arquivo em
`frontend/src/` lê essa variável.** Foi eliminada quando a página de relatório virou
Client Component (commit `876c47b`). Pode ser removida de qualquer `.env.local` existente.

---

## Configuração do Vercel

Projeto: `bi-agent` · Time: `bielmfrancos-projects` (`team_wY2WX8LEV0xWvtYoKzOcs4Id`)
Domínio de produção: <https://bi-agent-rosy.vercel.app>

| Ajuste | Valor |
|---|---|
| Root Directory | `frontend` |
| Framework | Next.js (autodetectado) |
| Build Command | `npm run build` |
| Install Command | `npm ci` |
| Output Directory | `.next` |
| Bundler | Turbopack |
| Variável de ambiente | `NEXT_PUBLIC_API_URL` ou `API_URL` |

Definido em `frontend/vercel.json`. Deploy automático a cada push em `main`.

---

## Configuração do Railway (preparada, não confirmada em produção)

`backend/railway.json`:

```json
{
  "build":  { "builder": "DOCKERFILE", "dockerfilePath": "Dockerfile" },
  "deploy": {
    "startCommand": "uvicorn main:app --host 0.0.0.0 --port $PORT --log-level info",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 30,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 5
  }
}
```

| Ajuste | Valor |
|---|---|
| Root Directory | `backend` |
| Watch Paths | `backend/**` |
| Imagem base | `mcr.microsoft.com/playwright/python:v1.62.0-jammy` |
| Volumes recomendados | `/app/cache` e `/app/uploads` |

Sem volumes montados, cada redeploy apaga uploads e análises.

Variáveis mínimas no Railway: `GOOGLE_API_KEY` (ou `GROQ_API_KEY`), `MODEL_ID`,
`FRONTEND_URL`, opcionalmente `FRONTEND_URL_REGEX`.

Guia passo a passo em [`DEPLOY.md`](../DEPLOY.md).

---

## Configuração de CORS

```python
# backend/main.py:94
_default_origins = ["http://localhost:3000", "http://127.0.0.1:3000"]
_extra = os.environ.get("FRONTEND_URL")
_allowed = _default_origins + ([_extra.rstrip("/")] if _extra else [])
_allow_regex = os.environ.get("FRONTEND_URL_REGEX") or None
```

- Localhost está sempre liberado, mesmo em produção
- `FRONTEND_URL` tem a barra final removida automaticamente
- `FRONTEND_URL_REGEX` cobre os domínios de preview do Vercel
- `allow_credentials=True`, `allow_methods=["*"]`, `allow_headers=["*"]`

**Erro comum:** CORS bloqueando o frontend. Quase sempre é `FRONTEND_URL` com barra final,
com esquema errado (`http` vs `https`) ou apontando para um domínio de preview em vez do
de produção.

---

## Configuração do Claude Code

Arquivos versionados em `.claude/`:

| Arquivo | Papel |
|---|---|
| `settings.json` | Statusline e hooks do graft (PostToolUse, UserPromptSubmit, SessionStart, Stop); permissões `Bash(graft:*)` |
| `launch.json` | Dev server `npm run dev --prefix frontend`, porta 3000 |
| `skills/graft/SKILL.md` | Como consultar o code-graph |
| `skills/project-context/SKILL.md` | Skill de continuidade — ler e atualizar documentação |
| `helpers/graft-hooks.cjs` | Rebuild incremental do índice |
| `helpers/graft-statusline.cjs` | Statusline customizada |

`.claude/settings.local.json` é per-machine e está no `.gitignore`.

`.mcp.json` registra o servidor MCP `graft` via `npx -y @nanonets/graft mcp`.

> Observado nesta sessão: o servidor MCP `graft` pode falhar com `CONNECT_TIMEOUT` após
> 30 s. Não bloqueia nada — apenas as ferramentas `graft_*` ficam indisponíveis.

---

## Boas práticas de segredos

1. Nunca commitar `backend/.env` ou `frontend/.env.local` — o `.gitignore` já cobre.
2. Manter o hook `pre-commit` instalado: `detect-secrets` bloqueia chaves acidentais.
3. Após um vazamento, **rotacionar a chave** no console do provider, não apenas remover
   do arquivo — o histórico do git preserva o valor.
4. Falso positivo do `detect-secrets`: `detect-secrets scan --update .secrets.baseline`
   e commitar o baseline atualizado.

---

## Checklist de configuração de máquina nova

- [ ] `backend/.env` criado a partir de `.env.example`
- [ ] Ao menos uma chave de LLM preenchida
- [ ] `GET /health` retorna `ok: true`
- [ ] `frontend/.env.local` criado com `NEXT_PUBLIC_API_URL`
- [ ] Frontend consegue chamar o backend (upload funciona)
- [ ] `pre-commit install` executado
- [ ] Se for usar o Vercel: variável definida **e** redeploy feito
