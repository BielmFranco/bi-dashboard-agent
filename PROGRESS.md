# PROJECT PROGRESS

> Arquivo de estado. **Atualize sempre que o estado do projeto mudar.**
> Última atualização: **2026-09-04** · Correções de análise + CI (bug de data, agregação por grupo, GitHub Actions)

Legenda: ✅ concluído · 🟡 parcial · 🔴 problema · ⚪ não iniciado · ❓ desconhecido

---

## CURRENT STATE

Aplicação funcional de ponta a ponta. Branch `main` limpa, sincronizada com `origin/main`.

| Componente | Estado | Observação |
|---|---|---|
| Backend FastAPI | ✅ | 16 endpoints, roda em `127.0.0.1:8000` |
| Perfilamento Pandas | ✅ | Tipos semânticos, estatísticas, correlação, outliers |
| Planner de dashboard | ✅ | Regras determinísticas, até 8 KPIs e 5 gráficos |
| Cadeia de LLM | ✅ | Groq → Gemini, 4 modelos, retry com backoff |
| Streaming SSE | ✅ | Insights e chat |
| Filtros | ✅ | `in`, `range`, `eq` — cientes de filtro em todos os endpoints de LLM |
| Drill-down | ✅ | Modal com tabela e export CSV |
| Frontend Next.js | ✅ | 3 rotas, deploy automático no Vercel |
| Exportação de PDF | ✅ | `window.print()` — funciona, mas exige confirmação do usuário |
| Testes backend | 🟡 | 26 testes verdes; LLM, filtros, detecção de data e agregação por grupo. Endpoints e `dashboard_planner` ainda descobertos. |
| Testes frontend | ⚪ | Nenhum |
| CI | ✅ | GitHub Actions roda `pytest` a cada push/PR |
| Deploy do backend | 🟡 | Local + túnel Cloudflare. Railway preparado, não confirmado. |
| Documentação | ✅ | `docs/00`–`docs/15` criados em 2026-09-04 |

---

## COMPLETED

### Núcleo
- ✅ Upload de `.csv`, `.xlsx`, `.xls`, `.xlsm`, `.tsv` (máx. 50 MB)
- ✅ Autodetecção de encoding e separador em CSV (12 combinações)
- ✅ Perfil estatístico: tipos semânticos, nulos, quartis, correlação de Pearson, outliers por IQR
- ✅ Detecção conservadora de colunas de identificador
- ✅ Plano de dashboard por regras (line, bar, pie, boxplot, scatter)
- ✅ KPIs determinísticos calculados em Pandas

### IA
- ✅ Cadeia Groq → Gemini com 4 modelos e fallback automático
- ✅ Retry com backoff exponencial, só em erros transitórios
- ✅ Tradução de erros de provider para pt-BR com ação sugerida
- ✅ Reforço de idioma (`PT_BR_ENFORCE`) injetado no Groq
- ✅ Streaming SSE com cancelamento via `AbortController`
- ✅ Sugestões de pergunta geradas dinamicamente
- ✅ Prompts com regras anti-ASCII-art, anti-LaTeX e anti-recálculo

### Interface
- ✅ Upload com drag-and-drop
- ✅ Dashboard com KPIs, gráficos Recharts e boxplot em SVG próprio
- ✅ Heatmap de correlação
- ✅ Barra de filtros com padrão de rascunho e botão "Aplicar"
- ✅ Modal de drill-down com export CSV
- ✅ Painel de insights com markdown (GFM) e botão de copiar
- ✅ Chat com streaming
- ✅ Página `/history` multi-arquivo
- ✅ Página `/report/[fileId]` em A4 paisagem
- ✅ Tema claro/escuro/sistema com provider próprio
- ✅ Restauração de sessão via `localStorage`

### Infraestrutura
- ✅ Rate limit por IP real (respeita `cf-connecting-ip`)
- ✅ Handler global de exceção sem vazar stack trace
- ✅ Cache em disco com escrita atômica e limpeza por idade
- ✅ CORS configurável por env, com regex para previews
- ✅ Logs estruturados opcionais em JSON
- ✅ `pre-commit` com `detect-secrets`
- ✅ Dockerfile e `railway.json`
- ✅ Deploy automático do frontend no Vercel
- ✅ LICENSE MIT, repositório público

### Documentação
- ✅ `docs/00_CONTEXT.md` até `docs/15_CONTINUITY.md`
- ✅ `CLAUDE.md`, `PROGRESS.md`, `CHANGELOG.md`
- ✅ `.claude/skills/project-context/SKILL.md`
- ✅ `DEPLOY.md` e `HANDOFF_NOVO_PC.md` preservados

---

## IN PROGRESS

Nada em andamento no momento. A última tarefa (migração do PDF + limpeza de código morto)
foi concluída no commit `257f439`.

---

## BLOCKED

Nada bloqueado.

---

## KNOWN ISSUES

Lista completa em [`docs/14_KNOWN_LIMITATIONS.md`](docs/14_KNOWN_LIMITATIONS.md).
Os que mais impactam o dia a dia:

| # | Problema | Impacto |
|---|---|---|
| 🔴 1 | URL do túnel Cloudflare muda a cada restart; `NEXT_PUBLIC_API_URL` é de tempo de build | Exige redeploy do Vercel a cada restart do túnel. Causa raiz de "o site parou". |
| 🔴 2 | Toast promete "PDF será baixado automaticamente", mas abre o diálogo de impressão | Expectativa incorreta para o usuário |
| 🟡 3 | `has_api_key` no `/health` ignora `GROQ_API_KEY` | Diagnóstico confuso quando só há key do Groq |
| 🟡 4 | Sem circuit breaker: Groq fora do ar custa ~9 s de backoff por request | Latência alta em degradação parcial |
| 🟡 5 | Planner sempre usa a primeira coluna de cada tipo | Gráficos ruins se a ordem das colunas for ruim |
| 🟡 6 | `test-data/` referenciado por `capture_screenshots.py` não existe em clone limpo | O script de screenshots falha em máquina nova |
| 🟡 7 | Padrão de `MODEL_ID` divergente entre `llm.py` e `.env.example` | Sem efeito prático com `.env` presente |
| ❓ 8 | Servidor MCP graft com `CONNECT_TIMEOUT` | Sem impacto na aplicação |

---

## TECHNICAL DEBT

| Item | Local | Nota |
|---|---|---|
| Parser de SSE duplicado | `api.ts:183` e `:251` | ~25 linhas idênticas |
| `exportPdf()`, `insights()`, `chat()` sem chamador | `api.ts` | Versões não streaming |
| `InsightsGrid.tsx` órfão | `components/report/` | Sem importadores desde `1845cc1` |
| `_distribution()` órfã | `dashboard_planner.py:116` | Substituída pelo boxplot em `14a35eb` |
| `POST /export` + `pdf_export.py` sem chamador | `main.py:282`, `pdf_export.py` | Sustentam `playwright` e a imagem base de ~1 GB |
| `@app.on_event` deprecado | `main.py:118` | Migrar para `lifespan` |
| `_plan_for_context` e `_profile_for_context` duplicam lógica | `main.py:351` e `:433` | 4 linhas idênticas |
| Tipos TypeScript espelhados à mão | `api.ts` | `q25`/`q75` já divergem do backend |
| Todo o estado em `page.tsx` | `app/page.tsx` | 16 chamadas de `useState` em um componente |
| Doc técnica em `.docx` binário | `docs/` | Não diffável |

---

## RECENT CHANGES

Datas conferidas com `git log --date=short`.

| Data | Commit | Mudança |
|---|---|---|
| 2026-09-04 | `c6b9098` | Correção de afirmações desatualizadas em `README.md`, `DEPLOY.md` e `HANDOFF_NOVO_PC.md` |
| 2026-09-04 | `dac2c8b` | **Documentação forense** (`CLAUDE.md`, `PROGRESS.md`, `CHANGELOG.md`, `docs/00`–`15`) + skill `project-context` |
| 2026-09-04 | `257f439` | Remoção de código morto da migração de PDF: `pdf-client.ts` apagado; `html2canvas-pro`, `jspdf` e `next-themes` desinstalados; `?api=` removido do backend |
| 2026-08-28 | `f3732e7` | **PDF passou a usar `window.print()`** em vez de html2canvas |
| 2026-08-28 | `405e6eb` | Desligar animações antes da captura |
| 2026-08-28 | `b143177` | Auto-download a partir da página de relatório |
| 2026-08-28 | `342fe5b` | Geração client-side com html2canvas + jsPDF |
| 2026-08-27 | `4e048a6` | `?api=` na URL do Playwright |
| 2026-08-27 | `876c47b` | Página de relatório convertida em Client Component |
| 2026-08-27 | `f3b9702` | Alias `API_URL` para contornar restrição do Vercel |

Histórico completo em [`docs/13_DEVELOPMENT_HISTORY.md`](docs/13_DEVELOPMENT_HISTORY.md)
e [`CHANGELOG.md`](CHANGELOG.md).

---

## LAST VALIDATED

**2026-09-04**

| Verificação | Comando | Resultado |
|---|---|---|
| Testes backend | `pytest` em `backend/` | ✅ 26 passaram, exit code 0 |
| Bug data → série temporal | `/analyze` do smoke_vendas.csv | ✅ `data` = `datetime_like`, gráfico `line` presente |
| Agregação por grupo | `/analyze` | ✅ `group_summaries` com categoria/regiao/produto |
| Chat/insights ao vivo | `/chat_stream` neste desktop | ⚠️ bloqueado — keys Groq+Gemini do desktop retornam 401. Funciona no notebook (keys válidas). |
| Versão do Python | `python --version` | ✅ 3.14.3 |
| Versão do Node | `node --version` | ✅ v24.19.0 |
| Estado do git | `git status` | ✅ Limpo, `main` = `origin/main` |
| Deploy do Vercel | API do Vercel | ✅ `dpl_2JUsHKqy...` READY, produção, commit `f3732e7` |
| Código morto | `grep` por importadores | ✅ Confirmado: `InsightsGrid`, `exportPdf`, `insights`, `chat`, `_distribution` |
| `REPORT_API_URL` | `grep` em `frontend/src` | ✅ Confirmado sem uso |
| Links relativos da documentação | script de verificação | ✅ 120 links, 0 quebrados |
| Contagem de endpoints | `grep "^@app\."` | ✅ 16 |
| Rate limits | `grep "limiter.limit"` | ✅ 11 decoradores, batem com `docs/08_API.md` |
| Contagem de testes por arquivo | `grep -c "^def test_"` | ✅ 12 em `test_llm_chain`, 5 em `test_filters_profile` |
| Linhas de código | `wc -l` | ✅ 1.769 backend + 179 testes + 4.048 frontend |
| Datas dos commits | `git log --date=short` | ✅ Projeto vai de 2026-07-28 a 2026-09-04 |
| Backoff da cadeia de LLM | leitura de `llm.py:195-206` | ✅ 1,5 s + 3 s por modelo (a 3ª tentativa não espera) |

**Não validado nesta sessão:** upload real, geração de insights, chat, PDF, `/history`,
drill-down. Requerem backend com API key e interação manual — ver o SMOKE TEST em
[`docs/10_TESTING.md`](docs/10_TESTING.md).

---

## NEXT STEP

Concluído em 2026-09-04:
- ✅ **CI com GitHub Actions** (`.github/workflows/test.yml`)
- ✅ **Bug de data em texto** — `datetime_like` antes de `categorical`
- ✅ **Agregação por grupo no chat** — `group_summaries` no perfil

Em ordem de prioridade, o que resta:

### 1. Testes de endpoint com `TestClient`
Cobrir `/upload → /analyze → /report_data` com um CSV pequeno em fixture. Hoje qualquer
quebra de contrato entre backend e frontend só aparece em runtime.

### 2. Corrigir o texto do toast de PDF
Trocar "PDF será baixado automaticamente" por algo como "Escolha *Salvar como PDF* no
diálogo de impressão". Uma linha em `frontend/src/app/page.tsx:146`.

### 3. Decidir sobre `POST /export` e `pdf_export.py`
Remover (e tirar `playwright` do `requirements.txt`, trocar a imagem base do Dockerfile) ou
documentar como caminho alternativo. Manter código morto que sustenta uma imagem de 1 GB
é caro.

### 4. Named tunnel do Cloudflare
Elimina a causa raiz do problema operacional mais frequente do projeto.

### 5. README com hero, badges e diagrama
Pendência de alta prioridade herdada do `HANDOFF_NOVO_PC.md`, para o lançamento no LinkedIn.

---

## DO NOT BREAK

Regras derivadas de bugs reais já corrigidos. Quebrar qualquer uma reintroduz um problema
conhecido.

1. **Não deixe o LLM calcular números.** `profile_dataframe` e `build_plan` rodam antes de
   qualquer chamada de LLM. É a promessa central do produto.

2. **Não reative `POST /export` com Playwright** sem entender por que foi abandonado.
   Ver [`docs/12_TECHNICAL_DECISIONS.md#d9`](docs/12_TECHNICAL_DECISIONS.md).

3. **Não adicione `html2canvas` de volta.** Não renderiza SVG do Recharts.

4. **Não remova o bloco `@media print`** de `report.css`. Sem ele, o PDF sai em branco —
   os elementos começam com `opacity: 0`.

5. **Não relaxe `_looks_like_id`** em `analyzer.py`. Exigir match no nome é deliberado
   (commit `256b03d`); afrouxar faz métricas legítimas sumirem dos gráficos.

6. **Não remova o `PT_BR_ENFORCE`** do Groq. Os modelos `gpt-oss` respondem em inglês sem ele.

7. **Não remova `normalizeBR`** de `format.ts`. Sem ele, volta o erro de hidratação com
   separadores de milhar.

8. **Não remova `_safe`** de `analyzer.py`. `NaN` quebra o `json.dumps`.

9. **Não rode o backend com múltiplos workers.** O cache em memória não tem lock.

10. **Não pare de passar `filters`** para os endpoints de LLM. Foi o que causou o bug de
    alucinação do chat (commits `a921d06` e `c0fd380`).

---

## IMPORTANT CONTEXT

### Ambiente
- Desenvolvimento em **Windows 10 Pro**, PowerShell 5.1 — **`&&` não funciona**, use `;`
- Python 3.14.3, Node 24.19.0
- O desenvolvedor **não roda o frontend localmente** no fluxo normal — testa pelo Vercel
- O backend roda local, exposto por túnel Cloudflare

### Deploy
- Vercel: projeto `bi-agent`, time `bielmfrancos-projects` (`team_wY2WX8LEV0xWvtYoKzOcs4Id`)
- Produção: <https://bi-agent-rosy.vercel.app>
- Deploy automático a cada push em `main`
- **Trocar `NEXT_PUBLIC_API_URL` exige redeploy** — a variável é de tempo de build

### Convenções
- Toda a interface e todas as mensagens de erro em **pt-BR**
- Commits seguem Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `perf:`)
- Comentários de código em português ou inglês, misturados — sem padrão definido

### Ao trocar de máquina
Siga [`docs/03_SETUP.md`](docs/03_SETUP.md). Recrie `backend/.env` e `frontend/.env.local` —
nenhum dos dois é versionado.
