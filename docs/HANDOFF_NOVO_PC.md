# Handoff — Setup bi-agent em novo computador

Documento pra retomar dev do bi-agent em outra máquina sem quebrar nada.
Estado congelado no commit `e794879` (branch `main`, remote push confirmado).

---

## 0. Estado atual do projeto (o que já foi feito)

**Backend hardening**: rate limit slowapi, retry+fallback LLM, error handler global, cleanup >7 dias, JSON logs opt-in, health enriquecido, chat/insights/suggestions filter-aware.

**LLM chain**: Groq `openai/gpt-oss-20b` (primário) → Groq `gpt-oss-120b` (backup) → Gemini `flash-latest` → Gemini `flash-lite` → erro amigável.

**Frontend**: home page redesign (wider bounds, remove features grid, social proof strip), badge "Powered by Groq + Gemini", Chat/Insights recebem filtros.

**Testes**: 17 pytest verdes cobrindo retry, transient detection, filters, PT_BR enforce, stream extraction.

**Infra**: `.claude/` + graft skill wired, `.mcp.json` (graft MCP), `.pre-commit-config.yaml` + `.secrets.baseline`, LICENSE MIT, docs técnica completa (`docs/Documentacao_Tecnica_BI_Agent.docx`), 10 screenshots em `docs/screenshots/`.

**Repo público**: <https://github.com/BielmFranco/bi-dashboard-agent>

**Deploy Vercel**: <https://bi-agent-rosy.vercel.app> (Vercel env aponta pra tunnel Cloudflare — URL muda a cada restart do tunnel).

---

## 1. Pré-requisitos no novo PC

Instalar antes de clonar:

| Ferramenta | Versão | Windows install |
|---|---|---|
| **Python** | 3.12+ | <https://python.org> (marcar "Add to PATH") |
| **Node.js** | 20+ | <https://nodejs.org> (LTS) |
| **Git** | qualquer | <https://git-scm.com> (Git Bash incluso) |
| **GitHub CLI** | 2+ | `winget install --id GitHub.cli` |
| **cloudflared** | qualquer | `winget install --id Cloudflare.cloudflared` |
| **VS Code** ou similar | opcional | <https://code.visualstudio.com> |
| **Claude Code CLI** | opcional | `npm i -g @anthropic-ai/claude-code` |

Verifica cada um:
```powershell
python --version   # 3.12+
node --version     # 20+
git --version
gh --version
cloudflared --version
```

---

## 2. Autenticação

### GitHub CLI
```powershell
gh auth login
```
Escolhe: GitHub.com → HTTPS → Yes (git creds) → login via browser.

Verifica:
```powershell
gh auth status
```
Deve mostrar `Logged in to github.com account BielmFranco`.

### Git identity (se ainda não configurado)
```powershell
git config --global user.name "Gabriel Franco"
git config --global user.email "gabrielmoraesprincipe@gmail.com"
```

---

## 3. Clone do repo

```powershell
cd C:\Users\<seu-user>
gh repo clone BielmFranco/bi-dashboard-agent bi-agent
cd bi-agent
```

Verifica que está na commit certa:
```powershell
git log -1 --oneline
```
Esperado: `e794879 chore: LICENSE MIT + home redesign + screenshot automation` ou mais recente.

---

## 4. Backend — setup

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
playwright install chromium
```

Dependências instaladas:
- fastapi, uvicorn, pandas, numpy, scipy, openpyxl (core)
- google-genai, groq (LLM providers)
- playwright, httpx (PDF export)
- slowapi (rate limit)
- pytest (testes)
- python-dotenv (env loader)

### Criar `backend/.env`

**IMPORTANTE — arquivo NÃO versionado. Recriar do zero.**

```powershell
Copy-Item .env.example .env
notepad .env
```

Substitui placeholders pelas keys reais:

```env
# Groq (primário) — pega em https://console.groq.com/keys
GROQ_API_KEY=gsk_...

# Gemini (fallback) — pega em https://aistudio.google.com/apikey
GOOGLE_API_KEY=AIzaSy...
```

Se **não** tiver Groq key ainda: cria conta gratis em console.groq.com/keys (login Google/GitHub, 2 clicks).

Se não tiver Gemini key: aistudio.google.com/apikey.

Sem nenhuma das duas, backend sobe mas endpoints LLM retornam 500. Precisa pelo menos uma.

### Rodar backend

```powershell
python main.py
```

Sobe em `http://127.0.0.1:8000`. Verifica:
```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
```

Deve retornar `{ok: true, has_api_key: true, ...}`.

---

## 5. Frontend — setup

Nova janela PowerShell:

```powershell
cd C:\Users\<seu-user>\bi-agent\frontend
npm install
```

### Criar `frontend/.env.local`

Não versionado. Cria manual:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
REPORT_API_URL=http://127.0.0.1:8000
```

Estes 2 apontam pro backend local. Só troca pra URL do tunnel Cloudflare se for testar Vercel remoto.

### Rodar frontend

```powershell
npm run dev
```

Sobe em `http://localhost:3000` com Turbopack. Abre no browser.

---

## 6. Cloudflare Tunnel (opcional — só se for testar demo Vercel)

Terceira janela PowerShell:

```powershell
cloudflared tunnel --url http://localhost:8000
```

Imprime URL tipo `https://xxx-yyy-zzz.trycloudflare.com`. Copia essa URL.

Atualiza no Vercel dashboard:
1. <https://vercel.com/dashboard> → bi-agent → Settings → Environment Variables
2. `NEXT_PUBLIC_API_URL` = URL do tunnel
3. `REPORT_API_URL` = mesma URL
4. Deployments → último → Redeploy

**Nota**: URL do tunnel muda toda vez que reinicia `cloudflared`. Pendência conhecida — migrar pra named tunnel resolve.

---

## 7. Rodar testes

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
pytest
```

Esperado: `17 passed`.

---

## 8. Executar screenshots (opcional)

Depois de backend + frontend rodando:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python ..\docs\capture_screenshots.py
```

Regenera 10 PNGs em `docs/screenshots/`.

---

## 9. pre-commit hook (recomendado)

Bloqueia commits com secrets acidentalmente:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
pip install pre-commit detect-secrets
cd ..
pre-commit install
```

Roda automático em cada `git commit`. Baseline em `.secrets.baseline` (versionado).

---

## 10. Graft (code-graph skill) — opcional

Se usa Claude Code no novo PC e quer graft skill ativa:

```powershell
npm install -g @nanonets/graft
cd C:\Users\<seu-user>\bi-agent
graft build
```

Skill já wired em `.claude/skills/graft/SKILL.md` (versionado). `graft build` regenera cache local em `graft/` (gitignored).

---

## 11. Ambiente rodando (checklist final)

Três janelas PowerShell:

**Janela 1 — Backend**
```powershell
cd C:\Users\<seu-user>\bi-agent\backend
.\.venv\Scripts\Activate.ps1
python main.py
```

**Janela 2 — Frontend**
```powershell
cd C:\Users\<seu-user>\bi-agent\frontend
npm run dev
```

**Janela 3 — Tunnel (opcional)**
```powershell
cloudflared tunnel --url http://localhost:8000
```

Testa:
- Backend: <http://127.0.0.1:8000/health>
- Frontend: <http://localhost:3000>
- Tunnel URL: printada pelo cloudflared

---

## 12. O que fazer em seguida (próxima tarefa)

Estado da roadmap deixada em aberto:

### Alta prioridade (bloqueia lançamento LinkedIn)
- [ ] **Passo 2**: Description + Topics + About no GitHub (você faz na UI)
  - Description: `Turn any spreadsheet into a professional BI dashboard with AI-powered insights. FastAPI + Next.js 16 + Groq + Gemini. Anti-hallucination by design.`
  - Website: `https://bi-agent-rosy.vercel.app`
  - Topics: `python, fastapi, nextjs, react, typescript, pandas, gemini, groq, llm, data-visualization, business-intelligence, dashboard, analytics, open-source, portuguese, tailwindcss, shadcn-ui, sse, streaming`
- [ ] **Passo 4**: README.md killer (Claude termina)
  - Hero image (usar `docs/screenshots/01-home-dark.png`)
  - Badges (build, license MIT, Python, Next, Vercel deploy)
  - Live demo link no topo
  - Features com screenshots (`docs/screenshots/*`)
  - Quick start 3 comandos
  - Architecture diagram mermaid
  - Stack list

### Média
- [ ] CONTRIBUTING.md
- [ ] SECURITY.md
- [ ] `.github/ISSUE_TEMPLATE/`
- [ ] GitHub Actions CI (pytest + lint)
- [ ] CHANGELOG.md

### Backlog LLM (documentado)
- [ ] Circuit breaker (Groq caído → skip por N min)
- [ ] Health mostra chain status
- [ ] E2E tests via TestClient
- [ ] Prompt cache

### Segurança
- [x] Rotate keys — feito antes de public
- [x] Rate limit slowapi — feito
- [x] pre-commit + detect-secrets — feito
- [ ] Named tunnel Cloudflare (URL fixa, sobrevive reboot)
- [ ] cloudflared como Windows service

---

## 13. Troubleshooting

| Problema | Fix |
|---|---|
| `python main.py` falha com `ModuleNotFoundError` | venv não ativo. Roda `.\.venv\Scripts\Activate.ps1` |
| `has_api_key: false` no `/health` | `.env` não tem key ou dotenv não carrega. Confirma path `backend/.env` |
| Frontend mostra "Falha de rede" | Backend não subiu ou porta 8000 ocupada. Kill processo: `Get-Process python \| Stop-Process -Force` |
| `playwright install chromium` falha | Firewall bloqueando download. Roda com VPN off ou baixa manual |
| Tests falham em `test_llm_chain` | Verifica se `groq` package instalado: `pip show groq` |
| Rate limit dispara em dev | Reduz limites em `main.py` ou usa `LLM_MAX_RETRIES=1` no `.env` |
| Cloudflared tunnel morre sozinho | Backend caiu → cloudflared perde upstream e sai. Restart backend + tunnel |
| Pre-commit block com "secret detected" | Falso positivo? Adiciona ao baseline: `detect-secrets scan --update .secrets.baseline` |

---

## 14. Arquivos NÃO versionados que precisa recriar

- `backend/.env` — API keys (Groq + Gemini)
- `frontend/.env.local` — URLs API (localhost por default)
- `backend/.venv/` — Python virtualenv (`python -m venv .venv`)
- `frontend/node_modules/` — npm deps (`npm install`)
- `backend/uploads/` — arquivos upload runtime (auto-cria)
- `backend/cache/` — JSON cache runtime (auto-cria)
- `graft/` — code-graph local (`graft build`)
- `docs/node_modules/` — deps do script build_doc.js (ignorar se não regerar docx)

---

## 15. Onde tá tudo documentado

- `README.md` — visão geral (mínimo por enquanto, Claude vai reescrever)
- `DEPLOY.md` — guia de deploy Railway/Vercel/Cloudflare
- `docs/Documentacao_Tecnica_BI_Agent.docx` — doc técnica completa (19 seções, 700 linhas)
- `docs/HANDOFF_NOVO_PC.md` — este arquivo
- `backend/.env.example` — todos parâmetros de config
- `.claude/skills/graft/SKILL.md` — como usar graft

---

## 16. Contexto Claude Code (se retomar sessão no novo PC)

Ao abrir Claude Code em `C:\Users\<seu-user>\bi-agent`:
1. Claude carrega automático: `.claude/settings.json`, `.mcp.json`, skill `graft`
2. Graft indexa 222 nodes / 526 edges do repo
3. Memory files ficam em `C:\Users\<seu-user>\.claude\projects\...\memory\`
   - Copiar do PC antigo se quiser preservar contexto: `MEMORY.md` + arquivos `.md` da mesma pasta

Reinicia sessão Claude Code após configurar tudo → MCP graft loads automático → pergunta prompt permission (escolhe opção 1 "Use this and all future MCP servers").

---

**Fim do handoff**. Se qualquer passo travar, arquivo `docs/HANDOFF_NOVO_PC.md` no repo público serve de referência.
