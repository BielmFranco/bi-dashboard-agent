# Changelog

Todas as mudanças relevantes deste projeto.

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).
Este projeto ainda não adota versionamento semântico formal — as seções abaixo agrupam o
histórico por fase de desenvolvimento.

---

## [Não lançado]

### Documentation
- Documentação forense completa em `docs/00_CONTEXT.md` até `docs/15_CONTINUITY.md`
- `CLAUDE.md` como manual operacional do agente
- `PROGRESS.md` com o estado atual, dívidas técnicas e próximos passos
- Este `CHANGELOG.md`
- Skill `.claude/skills/project-context/SKILL.md` para manter documentação e código sincronizados
- `README.md` corrigido: menções obsoletas a Anthropic e Gemini 2.0 Flash substituídas pela
  cadeia real Groq → Gemini
- `docs/HANDOFF_NOVO_PC.md` corrigido: `REPORT_API_URL` removida (não é lida por nenhum arquivo)

---

## 2026-08-27 a 2026-09-04 — Migração da geração de PDF

### Changed
- **PDF passa a ser gerado por `window.print()`** em vez de captura de canvas. O motor de
  impressão do navegador renderiza os SVGs do Recharts nativamente, resolvendo os gráficos
  quebrados (`f3732e7`)
- "Baixar PDF" abre `/report/{fileId}?pdf=1` em nova aba, que dispara a impressão após
  1200 ms (`b143177`)
- Página `/report/[fileId]` convertida de Server Component para Client Component, buscando
  dados via `NEXT_PUBLIC_API_URL` (`876c47b`)

### Removed
- `frontend/src/lib/pdf-client.ts` — utilitário html2canvas + jsPDF (`257f439`)
- Dependências `html2canvas-pro`, `jspdf` e `next-themes` (`257f439`)
- Query param `?api=http://127.0.0.1:8000` da URL de relatório no backend (`257f439`)

### Fixed
- PDF saindo em branco: animações de fade-in começavam com `opacity: 0` (`405e6eb`)
- Timeout do Playwright em `.report-doc` causado por `REPORT_API_URL` desatualizada (`876c47b`)

### Infrastructure
- `next.config.ts` passa a aceitar `API_URL` como alias de `NEXT_PUBLIC_API_URL`, contornando
  a restrição do Vercel a variáveis `NEXT_PUBLIC_` marcadas como secret (`f3b9702`)

---

## 2026-08-26 a 2026-08-27 — Redesign e compatibilidade

### Added
- Redesign da landing page, navbar e favicon; UX de filtros com rótulos "De/Até",
  placeholders com intervalo real e botão explícito "Aplicar filtros" (`5de29af`)
- `.claude/launch.json` para o preview de desenvolvimento (`e269141`)

### Fixed
- Compatibilidade com React 19 e mismatch de hidratação em números pt-BR: `normalizeBR`
  padroniza o separador de milhar entre servidor e cliente (`4251d65`)
- `NaN` em registros de amostra quebrava a serialização JSON; `_safe` passou a converter
  `NaN` e `inf` em `None` (`d7706a9`)

### Performance
- Exportação de PDF reduzida de ~10 s para ~4,5 s (`97db082`)

---

## 2026-08-18 a 2026-08-26 — Documentação e abertura do repositório

### Added
- `LICENSE` MIT (`e794879`)
- `docs/capture_screenshots.py` — automação Playwright que gera 10 PNGs (`e794879`)
- `docs/HANDOFF_NOVO_PC.md` — guia completo de troca de máquina (`53fc5fa`, `12abfdb`)
- `docs/Documentacao_Tecnica_BI_Agent.docx` — documentação técnica em 19 seções (`e0d235d`)

### Infrastructure
- Skill graft + `.mcp.json` expondo o code-graph como servidor MCP (`e0d235d`)

### Changed
- Home redesenhada: container mais largo, faixa de prova social, badge
  "Powered by Groq + Gemini" (`e794879`)

---

## 2026-08-18 — Hardening e cadeia multi-provider

### Added
- **Cadeia multi-provider de LLM**: Groq `gpt-oss-20b` → Groq `gpt-oss-120b` →
  Gemini `flash-latest` → Gemini `flash-lite-latest` (`7205a6c`)
- Retry com backoff exponencial, aplicado só a erros transitórios (`7205a6c`)
- Rate limit com slowapi, chaveado pelo IP real atrás de proxy (`7205a6c`)
- Handler global de exceção que não vaza stack trace (`7205a6c`)
- Limpeza automática de cache com mais de 7 dias, na inicialização e a cada 6 h (`7205a6c`)
- Logs estruturados em JSON, opcionais via `LOG_FORMAT=json` (`7205a6c`)
- `/health` enriquecido: versão, uptime, arquivos em cache, espaço em disco (`7205a6c`)
- Suíte pytest com 17 testes (`c0fd380`)
- `POST /suggestions/{id}` aceitando filtros; o `GET` foi mantido por compatibilidade (`c0fd380`)

### Fixed
- **Alucinação do chat com filtros ativos**: os endpoints de LLM recebiam o perfil não
  filtrado e respondiam números do dataset inteiro. `_profile_for_context` e
  `_plan_for_context` passaram a recomputar perfil e plano quando há filtros
  (`a921d06`, `c0fd380`)

### Security
- Rotação das chaves de API antes de tornar o repositório público
- `pre-commit` com `detect-secrets` e baseline versionado
- Remoção do `cloudflared.exe` (51 MB) do repositório (`b7ace32`)

---

## 2026-08-10 a 2026-08-11 — Recursos analíticos

### Added
- **Filtros funcionais (slicers)** com operações `in`, `range` e `eq` (`14a35eb`)
- **Modal de drill-down**: clicar numa barra abre a tabela filtrada, com export CSV (`14a35eb`)
- **Chat com streaming SSE** (`6686f2b`)
- Cancelamento da geração de insights via `AbortController` (`6686f2b`)
- Sugestões de pergunta geradas dinamicamente pelo LLM (`6686f2b`)
- Heatmap de correlação (`6686f2b`)
- Página `/history` para navegar entre múltiplas análises (`6686f2b`)

### Changed
- Boxplot substituiu o histograma na distribuição numérica (`14a35eb`)

### Fixed
- Hydration error por botão aninhado em `/history` (`d067b49`)

---

## 2026-08-03 a 2026-08-04 — Exportação de PDF, primeira geração

### Added
- **Exportação de PDF via Playwright**: rota `/report/[fileId]` + `POST /export/{id}` (`f99904d`)
- Página de relatório dedicada, com capa em gradiente e tabela de perfil (`4af7e02`)

### Changed
- Layout A4 paisagem com cabeçalho compacto e split perfil + gráficos (`0507164`)
- Insights renderizados como grid de cards por seção `##` (`9653ec5`)
- **PDF passou a conter apenas o dashboard**; a seção de insights foi removida (`1845cc1`)
- Identidade visual SaaS: paleta creme, seções em caixa alta, animações de fade-in (`6fdc978`)

### Fixed
- Overflow do layout multi-coluna dos insights (`82f402b`)
- Tooltip do Recharts ilegível no tema escuro (`a851664`)
- Tabela de perfil com overflow e KPIs esticados (`1c0f8f7`, `5c1e263`)

---

## 2026-07-29 — Streaming e persistência

### Added
- **SSE para insights** — streaming incremental com cursor animado (`db94785`)
- **Cache persistido em disco**, um JSON por `file_id`; `GET` e `DELETE /files`;
  restauração de sessão via `localStorage` (`a729a4e`)
- Redesign premium da interface: primitivas shadcn, framer-motion, sonner, navbar fixa (`a489d5d`)
- Clicar no logo reseta a sessão (`7bc8380`)

---

## 2026-07-29 a 2026-08-03 — Qualidade do perfilamento

### Added
- Detecção de colunas de identificador (`d2c8156`)
- Formatação numérica pt-BR compacta e truncamento de rótulos longos (`d2c8156`)
- Suporte a GFM no markdown via `remark-gfm` (`be867a8`)

### Changed
- `max_output_tokens` elevado para 8000: o Gemini 2.5 consome ~2500 tokens em raciocínio
  interno e truncava a saída (`58c1612`)
- Prompt passou a proibir explicitamente ASCII art e LaTeX (`be867a8`)
- Heurística de ID endurecida: exige match no nome da coluna, não só cardinalidade (`256b03d`)

### Fixed
- Warning do dateutil no pandas; `format="mixed"` para datas no padrão brasileiro (`0e9b6ae`)
- CSV legitimamente unicolunar deixou de levantar erro (`256b03d`)
- Semantic incorreto em colunas 100% vazias (`be867a8`)
- KPIs de colunas totalmente nulas deixaram de ser gerados (`d2c8156`)

---

## 2026-07-28 a 2026-07-29 — Migração de provider de LLM

### Changed
- **Migração de Anthropic para Google Gemini 2.0 Flash** — free tier de 1500 req/dia sem
  cartão de crédito (`3813010`)
- Mudança para `gemini-flash-latest`; `.env` recarregado a cada chamada, permitindo trocar
  a API key sem reiniciar o backend (`b71e2a2`)

### Fixed
- Incompatibilidade de `proxies` no httpx com o SDK da Anthropic (`35e74e7`)
- Detecção de erro de saldo de crédito com mensagem amigável (`e6e7f7a`)
- Aviso de hidratação e erros de fetch mais robustos (`49d4901`)

---

## 2026-07-28 — Scaffold inicial

### Added
- Backend FastAPI com upload, perfilamento Pandas e planner de dashboard por regras
- Frontend Next.js 16 com App Router, Tailwind e Recharts
- Integração inicial com a API da Anthropic (`d1b1e1a`)
