# 13 — Histórico de Desenvolvimento

Reconstruído de `git log`. **51 commits** na branch `main`, do scaffold inicial ao commit
`257f439`.

Commits triviais foram agrupados. A ênfase está nas mudanças que explicam por que o
projeto está no estado atual.

> **As fases são agrupamentos temáticos, não janelas cronológicas estritas.** Commits de
> fases diferentes se sobrepõem no tempo — por exemplo, as fases 3 e 4 acontecem quase no
> mesmo dia. As datas em cada cabeçalho são o intervalo real dos commits daquela fase,
> conferidas com `git log --date=short`.
>
> O projeto vai de **2026-07-28** (scaffold) a **2026-09-04** (último commit).

---

## Fase 1 — Scaffold e primeiro provider de LLM · 2026-07-28

| Commit | Mudança |
|---|---|
| `d1b1e1a` | Scaffold inicial: backend FastAPI + frontend Next.js, com a Anthropic como provider |
| `49d4901` | Correção de aviso de hidratação, erros de fetch mais robustos, tratamento de erro da Anthropic |
| `35e74e7` | Bump do SDK da Anthropic para 0.120 (incompatibilidade de `proxies` no httpx) |
| `e6e7f7a` | Detecção de erro de saldo de crédito com mensagem amigável |

Já nesta fase apareceu o atrito que motivaria a troca de provider: a cobrança por crédito
interrompia o uso.

---

## Fase 2 — Migração para o Gemini · 2026-07-28 a 2026-07-29

| Commit | Mudança |
|---|---|
| `3813010` | **Migração de Anthropic para Google Gemini 2.0 Flash** (free tier, 1500 req/dia) |
| `b71e2a2` | Mudança para `gemini-flash-latest`; hot-reload do `.env` no cliente de LLM |

O hot-reload (`load_dotenv(override=True)` a cada chamada) permite trocar a API key sem
reiniciar o backend. Continua no código.

---

## Fase 3 — Qualidade do perfilamento e do output · 2026-07-29 a 2026-08-03

| Commit | Mudança |
|---|---|
| `d2c8156` | Detecção de colunas de ID, descarte de KPIs nulos, formatação numérica pt-BR compacta, truncamento de rótulos longos |
| `be867a8` | Correção do semantic de colunas vazias; prompt passou a proibir ASCII art e LaTeX; adição de `remark-gfm` e CSS de markdown |
| `0e9b6ae` | Silenciado o warning do dateutil no pandas; `format="mixed"` para datas no padrão brasileiro |
| `256b03d` | **Loader de CSV unicolunar; heurística de ID passou a exigir match no nome; verificação de ID antes de categorical** |
| `58c1612` | `max_output_tokens` elevado para 8000 — o Gemini 2.5 consome ~2500 em raciocínio interno e truncava a saída |

O commit `be867a8` é reação direta a um comportamento observado: o modelo desenhava
dashboards em ASCII art e usava LaTeX, que quebrava o renderizador de markdown.

O `256b03d` corrigiu falsos positivos na detecção de ID que faziam métricas legítimas
sumirem dos gráficos.

---

## Fase 4 — Streaming e persistência · 2026-07-29 a 2026-08-03

| Commit | Mudança |
|---|---|
| `db94785` | **SSE para insights** — API de stream do Gemini + reader no fetch + cursor animado |
| `a729a4e` | **Cache persistido em disco** (um JSON por `file_id`), endpoints `GET`/`DELETE /files`, restauração de sessão via `localStorage` |
| `a489d5d` | Redesign premium da interface: primitivas shadcn, `next-themes`, framer-motion, sonner, navbar fixa, hero de upload |
| `7bc8380` | Clicar no logo reseta a sessão |

---

## Fase 5 — Exportação de PDF, primeira geração · 2026-08-03 a 2026-08-04

| Commit | Mudança |
|---|---|
| `f99904d` | **PDF via Playwright** — rota `/report/[fileId]` no Next.js + `POST /export/{id}` + botão "Baixar PDF" |
| `4af7e02` | Página de relatório premium; clicar em "Baixar PDF" abre o relatório em nova aba **e** baixa o PDF |
| `0507164` | Layout A4 paisagem: cabeçalho compacto, faixa de estatísticas escura, split perfil + gráficos |
| `82f402b` | Correção de overflow do multi-coluna dos insights |
| `515d5d6` | Layout compacto: 3 colunas de gráficos, split 34/66 |
| `9653ec5` | Insights redesenhados como grid de cards por seção `##` |
| `1845cc1` | **PDF passou a ser só do dashboard** (seção de insights removida); KPIs maiores |
| `5c1e263` | 7 KPIs em linha única; corpo do gráfico com 175 px |
| `1c0f8f7` | Tabela de perfil compacta (4 colunas); KPI com largura fixa |
| `6fdc978` | Identidade visual SaaS: paleta creme quente, barra horizontal de insight, animações de fade-in |
| `a851664` | Correção do tooltip do Recharts ilegível no tema escuro |

Dez commits de ajuste do relatório em PDF, mais um de tooltip do dashboard (`a851664`).
É o subsistema com mais iterações do projeto.

O `1845cc1` deixou `InsightsGrid.tsx` órfão — o componente ainda existe e ninguém importa.

O `6fdc978` introduziu as animações de fade-in com `opacity: 0`, que mais tarde causariam
PDFs em branco.

---

## Fase 6 — Recursos analíticos · 2026-08-10 a 2026-08-11

| Commit | Mudança |
|---|---|
| `6686f2b` | **Chat com streaming SSE**, cancelamento de insights via `AbortController`, sugestões dinâmicas de pergunta, heatmap de correlação, página `/history` |
| `14a35eb` | **Filtros funcionais (slicers)**, boxplot substituindo o histograma, modal de drill-down com export CSV |
| `d067b49` | Correção de hydration error por botão aninhado em `/history` |

O `14a35eb` trouxe a maior expansão de funcionalidade de uma vez só.

---

## Fase 7 — Deploy e hardening · 2026-08-10 a 2026-08-18

| Commit | Mudança |
|---|---|
| `a9dae16` | `Dockerfile` (base Playwright) + `railway.json` + `vercel.json` + `DEPLOY.md`; CORS por `FRONTEND_URL(_REGEX)` |
| `b7ace32` | Remoção do `cloudflared.exe` do repositório (51 MB) |
| `7205a6c` | **Hardening do backend + cadeia multi-provider de LLM**: rate limit slowapi, retry com fallback, handler global de erro, limpeza >7 dias, logs JSON opcionais, `/health` enriquecido |
| `a921d06` | **Correção: propagar filtros ativos do dashboard para o chat** |
| `c0fd380` | **Endpoints de insights e sugestões cientes de filtro + suíte pytest** (17 testes) |

Os commits `a921d06` e `c0fd380` corrigem a mesma classe de bug: o LLM recebia o perfil
não filtrado e respondia números do dataset inteiro enquanto o usuário via um recorte.

O `c0fd380` é o único commit que adiciona testes ao projeto.

---

## Fase 8 — Documentação e abertura do repositório · 2026-08-18 a 2026-08-27

| Commit | Mudança |
|---|---|
| `e0d235d` | Skill graft + `.mcp.json` + documentação técnica em `.docx` (19 seções) |
| `e794879` | LICENSE MIT, redesign da home, automação de screenshots (`capture_screenshots.py`) |
| `53fc5fa` / `12abfdb` | `HANDOFF_NOVO_PC.md` — guia completo de troca de máquina |
| `d7706a9` | **Sanitização de `NaN` em registros de amostra**; pins numéricos relaxados para Python 3.13+ |
| `4251d65` | **Compatibilidade com React 19 + correção do mismatch de hidratação em pt-BR** |
| `97db082` | Otimização do PDF: ~10 s → ~4,5 s |
| `e269141` | `.claude/launch.json` para o preview de dev |
| `5de29af` | Redesign da landing page, navbar, favicon e UX de filtros |

O `d7706a9` corrigiu o crash de serialização com `NaN`.
O `4251d65` corrigiu o erro de hidratação com separadores de milhar.

---

## Fase 9 — A saga do PDF (a mais recente) · 2026-08-27 a 2026-09-04

Oito commits em sequência, todos sobre o mesmo problema.

| Commit | Abordagem | Resultado |
|---|---|---|
| `f3b9702` | Alias `API_URL` → `NEXT_PUBLIC_API_URL` no `next.config.ts` | Contorna a restrição do Vercel para variáveis `NEXT_PUBLIC_` |
| `876c47b` | Página de relatório vira **Client Component** | Elimina `REPORT_API_URL`; Playwright ainda falhava |
| `4e048a6` | Playwright passa `?api=http://127.0.0.1:8000` na URL | Não ajudou — o frontend não roda local no cenário real |
| `342fe5b` | **html2canvas-pro + jsPDF** no cliente | Remove o Playwright; SVGs do Recharts quebram |
| `b143177` | "Baixar PDF" abre `/report/{id}?pdf=1` e captura na aba nova | Fluxo certo, captura ainda errada |
| `405e6eb` | Desligar animações antes da captura | Corrige páginas em branco; gráficos continuam quebrados |
| `f3732e7` | **`window.print()` com o `@media print` existente** | **Funciona.** O navegador renderiza SVG nativamente. |
| `257f439` | Remoção do código morto da migração | `pdf-client.ts` apagado; `html2canvas-pro`, `jspdf` e `next-themes` desinstalados; `?api=` removido do backend |

Cinco tentativas até acertar. A solução final foi a mais simples: o `report.css` já tinha
um `@media print` completo desde o `0507164`; bastava usá-lo.

---

## Padrões observados no histórico

**Correções guiadas por observação, não por especulação.** Quase toda regra do prompt
existe porque o modelo fez algo errado: ASCII art, LaTeX, respostas em inglês, recálculo
de somas.

**Fallback em camadas em todo ponto de falha externo.** Encoding de CSV (12 combinações),
providers de LLM (4 modelos), retry com backoff em cada um.

**O layout e a geração de PDF concentram 18 dos 51 commits** — mais de um terço do projeto.
É o subsistema mais frágil.

**Testes chegaram tarde e cobrem pouco.** Único commit com testes é o `c0fd380`, na fase 7.
Não há teste de endpoint nem de frontend.

**Código morto se acumula após refatorações.** `InsightsGrid.tsx`, `_distribution()`,
`exportPdf()`, `insights()`, `chat()`, `POST /export`. O `257f439` limpou parte, mas não tudo.

---

## Linha do tempo por área

A categorização abaixo é subjetiva — alguns commits tocam mais de uma área. Só a contagem
de PDF foi verificada commit a commit.

| Área | Commits | Concentração |
|---|---|---|
| Layout e geração de PDF | 18 (verificado) | Fases 5 e 9 |
| Interface e redesign | ~8 | Fases 4, 6, 8 |
| LLM e prompts | ~7 | Fases 1, 2, 3, 7 |
| Perfilamento e análise | ~6 | Fase 3 |
| Deploy e infraestrutura | ~5 | Fases 7, 9 |
| Documentação | ~4 | Fase 8 |
| Testes | 1 (verificado) | Fase 7 |

---

## Contexto para um agente novo

Se você está lendo isto sem ter visto o código:

1. **Não reative `POST /export`** sem entender a fase 9. Playwright abrindo o frontend
   pela rede é exatamente o modo de falha que a migração eliminou.
2. **Não adicione `html2canvas` de volta.** Não renderiza SVG do Recharts.
3. **Não relaxe a heurística de ID** em `analyzer._looks_like_id`. O commit `256b03d`
   endureceu essa regra de propósito.
4. **Não remova o `PT_BR_ENFORCE`** do Groq. Os modelos `gpt-oss` respondem em inglês sem ele.
5. **Não mexa no `@media print`** de `report.css` sem imprimir para conferir. Ele é a
   única coisa que faz o PDF sair com conteúdo.
