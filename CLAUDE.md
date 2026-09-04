# CLAUDE.md

Manual operacional para agentes trabalhando neste repositório.
Conciso por design — a profundidade está em `docs/`.

---

## O projeto

**BI Dashboard Agent** — transforma planilhas (`.csv`, `.xlsx`, `.xls`, `.xlsm`, `.tsv`) em
dashboards de BI com KPIs, gráficos e análise em linguagem natural.

**A premissa central:** todo número exibido é calculado por Pandas. O LLM só interpreta o
resultado já pronto. Nunca inverta isso.

- Repositório público: <https://github.com/BielmFranco/bi-dashboard-agent>
- Demo: <https://bi-agent-rosy.vercel.app>
- Interface e mensagens de erro: **pt-BR**

---

## Stack

| Camada | Tecnologia |
|---|---|
| Backend | FastAPI 0.115.5 · Uvicorn · Pandas · NumPy · SciPy · slowapi |
| LLM | Groq (primário) → Google Gemini (fallback) |
| Frontend | Next.js 16.2.12 (App Router, Turbopack) · React 19 · Tailwind 4 · Recharts |
| Testes | pytest (backend). **Frontend não tem testes.** |
| Deploy | Vercel (frontend) · local + túnel Cloudflare (backend) |

Runtime confirmado: Python 3.14.3, Node 24.19.0, Windows 10.

---

## Comandos

**Ambiente: PowerShell 5.1 — `&&` não funciona. Use `;` ou `; if ($?) { }`.**

```powershell
# Backend
cd backend; .\.venv\Scripts\Activate.ps1; python main.py

# Frontend
cd frontend; npm run dev

# Testes (esperado: 17 passed)
cd backend; .\.venv\Scripts\Activate.ps1; pytest

# Túnel (só para testar o deploy do Vercel)
cloudflared tunnel --url http://localhost:8000
```

`python main.py` **não tem hot reload**. Reinicie depois de alterar o backend.

---

## Estrutura

```
backend/     main.py · analyzer.py · dashboard_planner.py · llm.py
             prompts.py · filters.py · cache.py · pdf_export.py · tests/
frontend/    src/app/ (3 rotas) · src/components/ · src/lib/api.ts
docs/        00_CONTEXT até 15_CONTINUITY · HANDOFF_NOVO_PC · screenshots/
.claude/     settings.json · launch.json · skills/graft · skills/project-context
```

Detalhe em [`docs/02_PROJECT_STRUCTURE.md`](docs/02_PROJECT_STRUCTURE.md).

---

## Documentação

**Comece sempre por aqui:**

1. [`PROGRESS.md`](PROGRESS.md) — estado atual, próximo passo, o que não quebrar
2. [`docs/00_CONTEXT.md`](docs/00_CONTEXT.md) — visão geral em 5 minutos
3. [`docs/15_CONTINUITY.md`](docs/15_CONTINUITY.md) — como retomar o trabalho

**Por área:**

| Área | Documento |
|---|---|
| Arquitetura | [`docs/01_ARCHITECTURE.md`](docs/01_ARCHITECTURE.md) |
| Setup | [`docs/03_SETUP.md`](docs/03_SETUP.md) |
| Backend | [`docs/04_BACKEND.md`](docs/04_BACKEND.md) |
| Frontend | [`docs/05_FRONTEND.md`](docs/05_FRONTEND.md) |
| Pipeline de dados | [`docs/06_DATA_PIPELINE.md`](docs/06_DATA_PIPELINE.md) |
| LLM e prompts | [`docs/07_LLM.md`](docs/07_LLM.md) |
| API | [`docs/08_API.md`](docs/08_API.md) |
| Configuração | [`docs/09_CONFIGURATION.md`](docs/09_CONFIGURATION.md) |
| Testes | [`docs/10_TESTING.md`](docs/10_TESTING.md) |
| Troubleshooting | [`docs/11_TROUBLESHOOTING.md`](docs/11_TROUBLESHOOTING.md) |
| Decisões técnicas | [`docs/12_TECHNICAL_DECISIONS.md`](docs/12_TECHNICAL_DECISIONS.md) |
| Histórico | [`docs/13_DEVELOPMENT_HISTORY.md`](docs/13_DEVELOPMENT_HISTORY.md) |
| Limitações | [`docs/14_KNOWN_LIMITATIONS.md`](docs/14_KNOWN_LIMITATIONS.md) |

---

## Regras

### Investigue antes de alterar

Este projeto tem muita decisão contraintuitiva com motivo documentado. Antes de mudar algo
que parece errado, cheque [`docs/12_TECHNICAL_DECISIONS.md`](docs/12_TECHNICAL_DECISIONS.md).
Cinco tentativas foram gastas só na geração de PDF.

### Não quebre (resumo — lista completa em `PROGRESS.md`)

1. O LLM **não calcula números.** Pandas roda antes.
2. Não reative `POST /export` com Playwright sem ler a decisão D9.
3. Não traga `html2canvas` de volta — não renderiza SVG do Recharts.
4. Não remova o `@media print` de `report.css` — o PDF sai em branco.
5. Não relaxe `_looks_like_id` em `analyzer.py`.
6. Não remova o `PT_BR_ENFORCE` do Groq — os modelos respondem em inglês sem ele.
7. Não remova `normalizeBR` de `format.ts` — volta erro de hidratação.
8. Não remova `_safe` de `analyzer.py` — `NaN` quebra o JSON.
9. Não rode o backend com múltiplos workers — o cache em memória não tem lock.
10. Não pare de passar `filters` aos endpoints de LLM — causa alucinação no chat.

### Contratos manuais

Os tipos em `frontend/src/lib/api.ts` são espelho **manual** da saída do `analyzer.py` e do
`dashboard_planner.py`. Não há geração de schema. Mudou o backend, atualize `api.ts` no
mesmo commit.

### Next.js 16

`frontend/AGENTS.md` avisa: esta versão tem breaking changes em relação ao conhecimento
pré-treinado. Antes de escrever código de framework, consulte
`frontend/node_modules/next/dist/docs/`.

---

## Segurança

- **Repositório público.** Nada que entre no histórico sai dele.
- Nunca commite `backend/.env` ou `frontend/.env.local`
- Use placeholders em exemplos: `GROQ_API_KEY=<sua-key>`
- Chave vazada: **rotacione no console do provider**, não basta apagar do arquivo
- Mantenha o `pre-commit` instalado (`detect-secrets`)
- A aplicação **não tem autenticação**. `GET /files` lista os arquivos de todos os usuários.

---

## Testes

```powershell
cd backend; .\.venv\Scripts\Activate.ps1; pytest
```

17 testes, todos passando. Cobrem a cadeia de LLM (12) e filtros/perfil (5).

**Sem cobertura:** endpoints, `dashboard_planner.py`, `cache.py`, frontend inteiro.

Smoke test manual de 11 passos em [`docs/10_TESTING.md`](docs/10_TESTING.md#smoke-test).
Use-o depois de qualquer mudança relevante — a suíte automatizada não protege muita coisa.

---

## Continuidade

**A conversa não é memória permanente.** Ao terminar um trabalho relevante:

| Se você… | Atualize |
|---|---|
| Concluiu ou iniciou uma tarefa | `PROGRESS.md` |
| Fez mudança visível ao usuário | `CHANGELOG.md` |
| Tomou decisão de arquitetura | `docs/12_TECHNICAL_DECISIONS.md` |
| Resolveu um bug | `docs/11_TROUBLESHOOTING.md` |
| Encontrou um bug sem resolver | `docs/14_KNOWN_LIMITATIONS.md` + `PROGRESS.md` |
| Alterou a API | `docs/08_API.md` + `frontend/src/lib/api.ts` |
| Adicionou variável de ambiente | `docs/09_CONFIGURATION.md` + `backend/.env.example` |

Se não puder confirmar algo pelo código, git ou testes, escreva
`UNKNOWN — necessita investigação.` **Não invente justificativa.**

A skill `.claude/skills/project-context/SKILL.md` detalha esse fluxo.

---

## Graft

O repositório é indexado pelo graft (code-graph). `.mcp.json` expõe o servidor MCP e
`.claude/skills/graft/SKILL.md` explica as ferramentas.

Regenerar o índice local: `graft build`.

> O servidor MCP pode falhar com `CONNECT_TIMEOUT`. Sem impacto — as ferramentas normais de
> leitura e busca continuam funcionando.

---

## Deploy

| Componente | Onde | Como |
|---|---|---|
| Frontend | Vercel, projeto `bi-agent` | Automático a cada push em `main` |
| Backend | Local + túnel Cloudflare | Manual: `python main.py` |
| Backend (alternativa) | Railway | `Dockerfile` + `railway.json` prontos, **não confirmado em produção** |

> **`NEXT_PUBLIC_API_URL` é lida em tempo de build.** Alterar a variável no painel do Vercel
> não muda nada até um **redeploy**. Como a URL do túnel muda a cada restart do
> `cloudflared`, esta é a causa raiz mais frequente de "o site parou de funcionar".

Guia completo em [`DEPLOY.md`](DEPLOY.md).

---

## Estado atual

**Aplicação funcional de ponta a ponta.** Branch `main` limpa em `257f439`.

Último trabalho: migração da geração de PDF de Playwright para `window.print()`, seguida de
remoção do código morto.

Próximo passo recomendado: **CI com GitHub Actions rodando `pytest`.** Detalhe e alternativas
em [`PROGRESS.md`](PROGRESS.md#next-step).
