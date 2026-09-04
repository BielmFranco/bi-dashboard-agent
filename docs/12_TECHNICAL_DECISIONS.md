# 12 — Decisões Técnicas

Reconstruídas a partir de mensagens de commit, comentários no código e da documentação
existente. Onde o motivo não pôde ser confirmado, está escrito `Motivo não confirmado.`

---

## D1 — Números calculados por Pandas, nunca pelo LLM

### Contexto
O produto se propõe a gerar dashboards a partir de planilhas usando IA.

### Problema
LLMs erram aritmética e inventam números com confiança. Um dashboard de BI com números
alucinados é pior que nenhum dashboard.

### Alternativas
1. Pedir ao LLM que calcule tudo a partir dos dados brutos
2. Pedir ao LLM que gere código Pandas e executá-lo
3. Calcular tudo em Pandas e usar o LLM só para interpretar

### Decisão adotada
Alternativa 3. `profile_dataframe` e `build_plan` rodam antes de qualquer chamada de LLM.
O modelo recebe o resultado pronto.

### Justificativa
É a única opção em que um número errado é um bug reproduzível, não uma amostragem
aleatória do modelo. Também elimina a execução de código gerado por LLM, que traria risco
de segurança.

### Impacto
- Todos os KPIs e pontos de gráfico são determinísticos
- O prompt precisa ser explícito sobre não recalcular nada
- O `CHAT_SYSTEM` teve que ganhar instruções específicas ("NUNCA multiplique média × n
  para estimar soma — a `sum` já vem calculada")

### Riscos
O modelo ainda pode interpretar mal um número correto. Mitigado, não eliminado.

### Evidência
`backend/prompts.py` (regras de dados), `backend/main.py:204` (ordem das chamadas),
`README.md`.

### Commit relacionado
Presente desde o scaffold inicial `d1b1e1a`.

---

## D2 — Migração de Anthropic para Google Gemini

### Contexto
A primeira versão usava a API da Anthropic.

### Problema
Erros de saldo de crédito interrompiam o uso. Commit `e6e7f7a` chegou a implementar
detecção específica de "credit-balance error" para mostrar mensagem amigável.

### Alternativas
1. Continuar com a Anthropic e exigir cartão
2. Migrar para um provider com free tier sem cartão

### Decisão adotada
Migrar para Google Gemini 2.0 Flash — free tier de 1500 requisições/dia sem cartão.

### Justificativa
Explícita na mensagem do commit: `feat: migrate from Anthropic to Google Gemini 2.0 Flash (free tier)`.

### Impacto
- SDK trocado para `google-genai`
- Prompts mantidos praticamente iguais
- `README.md` ficou desatualizado mencionando `ANTHROPIC_API_KEY` (corrigido nesta operação)

### Commit relacionado
`3813010`, seguido de `b71e2a2` (mudança para `gemini-flash-latest` e hot-reload do `.env`).

---

## D3 — Groq como provider primário, Gemini como fallback

### Contexto
Depois da migração para Gemini, sobrecarga (503) e limite de quota diária continuavam
derrubando a funcionalidade.

### Problema
Um único provider é ponto único de falha.

### Alternativas
1. Só Gemini, com mais retries
2. Só Groq
3. Cadeia Groq → Gemini com fallback automático

### Decisão adotada
Alternativa 3. Cadeia de quatro modelos: Groq `gpt-oss-20b` → Groq `gpt-oss-120b` →
Gemini `flash-latest` → Gemini `flash-lite-latest`.

### Justificativa
Groq é mais rápido e tem free tier generoso; Gemini cobre quando o Groq falha. Falha total
exige que quatro modelos caiam ao mesmo tempo.

### Impacto
- `llm.py` precisou de uma camada de normalização entre a API estilo OpenAI (Groq) e a do
  Gemini (`types.Content`)
- Os modelos `gpt-oss` respondiam em inglês, o que exigiu o `PT_BR_ENFORCE` injetado só no
  Groq
- 429 é tratado como transitório no Groq (quota por minuto) mas não no Gemini (quota diária)

### Riscos
Sem circuit breaker: se o Groq estiver fora, cada request paga 6 tentativas antes de chegar
ao Gemini. Registrado como pendência.

### Evidência
`backend/llm.py:184` e `:323`; `backend/.env.example`.

### Commit relacionado
`7205a6c`.

---

## D4 — Cache persistido em disco, sem banco de dados

### Contexto
Reiniciar o backend perdia todas as análises, forçando novo upload.

### Problema
Perfilar um arquivo grande custa tempo. Perder isso a cada restart é inaceitável em
desenvolvimento.

### Alternativas
1. SQLite
2. Redis
3. Um JSON por `file_id` no sistema de arquivos

### Decisão adotada
Alternativa 3. `backend/cache/{file_id}.json` guarda metadata, `profile` e `plan`.
O arquivo original fica em `backend/uploads/`.

### Justificativa
Sem dependência nova, sem migration, sem serviço extra. Escrita atômica via `.tmp` +
`replace()`. Adequado à escala do projeto (um usuário, poucos arquivos).

### Impacto
- Restart do backend preserva as análises
- Limpeza automática por idade (`CACHE_RETENTION_DAYS`, padrão 7) na inicialização e a
  cada 6 horas
- Em container, exige volume montado — senão o redeploy apaga tudo

### Riscos
- Cache em memória sem lock: rodar com múltiplos workers do Uvicorn quebraria a consistência
- Cache corrompido é silenciosamente ignorado, escondendo problemas de disco

### Evidência
`backend/cache.py`, docstring do módulo.

### Commit relacionado
`a729a4e`.

---

## D5 — SSE em vez de WebSocket para streaming

### Contexto
Insights levam dezenas de segundos. Esperar em silêncio dá impressão de travamento.

### Problema
Como entregar texto incrementalmente.

### Alternativas
1. WebSocket
2. Server-Sent Events
3. Polling

### Decisão adotada
SSE, via `StreamingResponse` do FastAPI com `media_type="text/event-stream"`.

### Justificativa
O fluxo é unidirecional (servidor → cliente). SSE roda sobre HTTP comum, atravessa
proxies e não precisa de biblioteca no cliente — o parser cabe em ~20 linhas.

### Impacto
- Dois endpoints de streaming: `/insights_stream` e `/chat_stream`
- Headers anti-buffering necessários: `X-Accel-Buffering: no`, `Cache-Control: no-transform`
- Erros durante o stream viram `event: error` com HTTP 200, porque os headers já foram enviados
- `AbortController` no cliente permite cancelar a geração

### Riscos
O parser está duplicado em `insightsStream` e `chatStream`. Dívida técnica registrada.

### Evidência
`backend/main.py:390` (`_sse`), `frontend/src/lib/api.ts:183` e `:251`.

### Commit relacionado
`db94785` (insights), `6686f2b` (chat).

---

## D6 — Heurística de ID exige match no nome da coluna

### Contexto
Colunas identificadoras (CPF, matrícula, código) poluem KPIs e gráficos.

### Problema
Como detectar identificadores automaticamente.

### Alternativas
1. Cardinalidade alta = ID
2. Nome da coluna = ID
3. Nome **e** cardinalidade

### Decisão adotada
Alternativa 3. Exige match do nome com `_ID_NAME_HINTS` **e** razão de únicos ≥ 0,6.

### Justificativa
Está escrita como comentário no próprio código:

> "Cardinalidade sozinha é ambígua — uma coluna numérica única por linha pode ser uma
> medição (idade, salário, custo), não um identificador. Classificar erradamente uma
> métrica como ID a remove silenciosamente dos KPIs e gráficos."

O custo de um falso positivo (perder uma métrica real) é muito maior que o de um falso
negativo (um ID aparecer como métrica).

### Impacto
Colunas de ID sem nome sugestivo passam despercebidas e viram `numeric`. Aceito.

### Evidência
`backend/analyzer.py:52`, comentário nas linhas 54–58.

### Commit relacionado
`256b03d`.

---

## D7 — Boxplot no lugar do histograma

### Contexto
O planner gerava um histograma de distribuição para a primeira coluna numérica.

### Problema
`Motivo não confirmado.` A mensagem do commit `14a35eb` diz apenas
"boxplot substitui histograma", sem justificar.

### Decisão adotada
Boxplot desenhado como SVG próprio (`Boxplot.tsx`), porque o Recharts não tem boxplot nativo.

### Impacto
- `_boxplot_stats` calcula quartis, whiskers dentro das cercas e lista até 50 outliers
- `_distribution` (o histograma) **continua no código** mas não é mais chamada por
  `build_plan` — código morto
- Um componente SVG a mais para manter

### Evidência
`backend/dashboard_planner.py:116` (`_distribution`, órfã) e `:176` (o boxplot é gerado);
`frontend/src/components/Boxplot.tsx`.

### Commit relacionado
`14a35eb`.

---

## D8 — Página de relatório convertida em Client Component

### Contexto
`/report/[fileId]` era um Server Component que buscava dados no servidor do Next.js.

### Problema
Isso exigia `REPORT_API_URL` configurada no ambiente do Vercel, apontando para a URL atual
do túnel Cloudflare. O túnel muda de URL a cada restart, então a variável ficava
desatualizada e a página falhava — o que quebrava a exportação de PDF via Playwright.

### Alternativas
1. Manter Server Component e disciplinar a atualização de `REPORT_API_URL`
2. Converter para Client Component usando `NEXT_PUBLIC_API_URL`, a mesma que o dashboard
   já usa

### Decisão adotada
Alternativa 2.

### Justificativa
Da mensagem do commit: elimina a dependência de uma segunda variável de ambiente. O
navegador do usuário já consegue alcançar o backend (o dashboard funciona), então o
relatório também consegue.

### Impacto
- Uma variável de ambiente a menos
- A página passou a ter estado de carregamento e de erro próprios
- Abriu caminho para o `window.print()` client-side adotado depois

### Riscos
`REPORT_API_URL` ficou órfã na documentação. Corrigido nesta operação.

### Evidência
`frontend/src/app/report/[fileId]/page.tsx:1` (`"use client"`).

### Commit relacionado
`876c47b`.

---

## D9 — `window.print()` em vez de geração programática de PDF

### Contexto
Três tentativas anteriores de gerar PDF falharam de formas diferentes.

### Problema
Produzir um PDF fiel ao layout do relatório, com os gráficos do Recharts visíveis.

### Alternativas testadas, em ordem

| Abordagem | Resultado |
|---|---|
| Playwright no servidor (`POST /export`) | Timeout em `.report-doc`; depende da rede e da URL do frontend |
| html2canvas + jsPDF no cliente | Páginas em branco (animação com `opacity: 0`) |
| html2canvas com estilos forçados | Páginas visíveis, **mas SVGs do Recharts quebrados** |
| **`window.print()` com `@media print`** | **Funciona** |

### Decisão adotada
`window.print()`, disparado automaticamente quando a rota recebe `?pdf=1`.

### Justificativa
O `report.css` já tinha um `@media print` completo com `@page { size: A4 landscape; margin: 0; }`.
O motor de impressão do navegador renderiza SVG nativamente — o problema de todas as
abordagens de captura de canvas simplesmente não existe.

### Impacto
- Removidas as dependências `html2canvas-pro` e `jspdf`
- Sem dependência de rede: nenhum servidor precisa alcançar o frontend
- **Custo de UX:** o usuário precisa confirmar "Salvar como PDF" no diálogo. Não é mais um
  download automático.
- `POST /export/{file_id}` e `pdf_export.py` ficaram sem chamador

### Riscos
O resultado depende do motor de impressão do navegador. Chrome, Firefox e Safari podem
produzir saídas ligeiramente diferentes. Não testado além do Chrome.

### Evidência
`frontend/src/app/report/[fileId]/page.tsx:41`;
`frontend/src/app/report/[fileId]/report.css:7` e `:483`.

### Commit relacionado
`f3732e7`, limpeza em `257f439`.

---

## D10 — `ThemeProvider` próprio em vez de `next-themes`

### Contexto
O commit `a489d5d` adotou `next-themes` no redesign da interface.

### Problema
`Motivo não confirmado.` Em algum ponto o `next-themes` deixou de ser importado e um
`ThemeProvider` próprio com `createContext` tomou seu lugar. Nenhuma mensagem de commit
explica a troca.

### Decisão adotada
Implementação própria em `frontend/src/components/ThemeProvider.tsx`, com script inline no
`<head>` do layout raiz para evitar flash de tema errado.

### Impacto
- Uma dependência a menos (`next-themes` desinstalado em `257f439`)
- `useTheme()` ganhou fallback silencioso para uso fora do provider — necessário porque a
  página de relatório não é envolvida pelo provider

### Evidência
`frontend/src/components/ThemeProvider.tsx`; ausência de qualquer import de `next-themes`
em `frontend/src/`.

### Commit relacionado
`257f439` (remoção do pacote). A substituição em si ocorreu antes, sem commit dedicado.

---

## D11 — `max_output_tokens` alto por causa dos tokens de raciocínio

### Contexto
Os insights vinham truncados no meio de uma frase.

### Problema
O Gemini 2.5+ consome tokens de *thinking* (cadeia de raciocínio interna) dentro do mesmo
orçamento de `max_output_tokens`, sem que isso apareça na resposta.

### Alternativas
1. `thinking_budget=0` para desligar o raciocínio
2. Aumentar `max_output_tokens`

### Decisão adotada
Alternativa 2 — 8000 tokens para insights, 4000 para chat.

### Justificativa
Documentada como comentário em `llm.py:156`:

> "Definir `thinking_budget=0` é rejeitado pelo `gemini-flash-latest` com
> 400 INVALID_ARGUMENT. O Gemini flash usa ~2500-3000 tokens em raciocínio, então o
> orçamento fica generoso."

A alternativa 1 foi testada e rejeitada pela API.

### Impacto
Custo maior por chamada. Irrelevante no free tier.

### Evidência
`backend/llm.py:156-169`.

### Commit relacionado
`58c1612`.

---

## D12 — Normalização de separador de milhar para evitar erro de hidratação

### Contexto
React reportava mismatch entre HTML do servidor e do cliente em valores numéricos.

### Problema
`toLocaleString("pt-BR")` devolve caracteres de espaço diferentes conforme o runtime:
Node 20+ usa U+202F, navegadores mais antigos usam U+00A0 ou `.`.

### Decisão adotada
Normalizar todo caractere de espaço para ponto:

```ts
const normalizeBR = (s: string) => s.replace(/\s/g, ".");
```

### Justificativa
Comentário no código:

> "Node 20+ retorna U+202F (narrow no-break space) como separador de milhar em pt-BR;
> browsers/Node antigos podem devolver U+00A0 ou '.'. Normaliza pra hidratacao SSR igual."

### Impacto
Formatação consistente entre servidor e cliente. `1.234,56` sempre com ponto.

### Evidência
`frontend/src/lib/format.ts:1-3`.

### Commit relacionado
`4251d65`.

---

## D13 — Alias `API_URL` para contornar restrição do Vercel

### Contexto
Deploy no Vercel precisava de `NEXT_PUBLIC_API_URL`.

### Problema
O Vercel bloqueia salvar variáveis com prefixo `NEXT_PUBLIC_` como *secret*.

### Decisão adotada
Bloco `env` no `next.config.ts` que lê `API_URL` e reexporta como `NEXT_PUBLIC_API_URL`:

```ts
env: {
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "",
}
```

### Justificativa
Da mensagem do commit: permite definir uma variável comum no painel e ainda assim
disponibilizá-la ao bundle do cliente.

### Impacto
Duas variáveis fazem a mesma coisa. Confuso, mas funcional.
`NEXT_PUBLIC_API_URL` tem precedência.

### Evidência
`frontend/next.config.ts:5-7`.

### Commit relacionado
`f3b9702`.

---

## D14 — Rate limit por IP real atrás de proxy

### Contexto
Repositório público, backend exposto por túnel.

### Problema
Atrás do Cloudflare, `request.client.host` é o IP do proxy — todos os usuários
compartilhariam o mesmo balde de rate limit.

### Decisão adotada
`_client_ip` resolve na ordem: `cf-connecting-ip` → primeiro item de `x-forwarded-for` →
`request.client.host`.

### Justificativa
Docstring da função: "Real client IP behind Cloudflare Tunnel / proxy chain."

### Impacto
Rate limit funciona por usuário.

### Riscos
`x-forwarded-for` pode ser forjado se o backend for exposto diretamente, sem proxy
confiável na frente. Aceitável no cenário atual (só o túnel alcança o backend).

### Evidência
`backend/main.py:30-38`.

### Commit relacionado
`7205a6c`.

---

## D15 — Windows + túnel Cloudflare em vez de backend hospedado

### Contexto
O frontend está no Vercel; o backend precisa ser alcançável pela internet.

### Problema
Hospedar o backend custa dinheiro. A imagem base do Playwright tem ~1 GB.

### Alternativas
1. Railway ($5/mês, Dockerfile pronto)
2. Fly.io (mais barato, Playwright mais difícil)
3. Render (free tier hiberna)
4. Rodar local e expor por túnel Cloudflare

### Decisão adotada
Alternativa 4 no dia a dia. A alternativa 1 está **preparada mas não confirmada em
produção** — `Dockerfile` e `railway.json` existem e estão versionados.

### Justificativa
Custo zero para demonstração. `DEPLOY.md` documenta as alternativas com preços.

### Impacto
- A URL do túnel muda a cada restart, exigindo redeploy do Vercel
- O backend só está no ar quando a máquina de desenvolvimento está ligada
- É a causa raiz da maioria dos incidentes registrados em
  [`11_TROUBLESHOOTING.md`](11_TROUBLESHOOTING.md)

### Riscos
Não é uma configuração de produção. Um *named tunnel* resolveria a instabilidade da URL,
mas não a dependência da máquina local.

### Evidência
`DEPLOY.md`, `docs/HANDOFF_NOVO_PC.md` seção 6, `backend/railway.json`.

---

## D16 — Detecção de data em texto antes de categórica

### Contexto
Encontrado ao rodar o smoke test com um CSV real: a coluna `data` (texto) foi classificada
como `categorical` e o dashboard saiu com "Top data por quantidade" (barras de datas soltas)
em vez de série temporal.

### Problema
Em `_infer_semantic`, o teste de `categorical` (`nunique <= max(20, 5%)`) rodava antes do
teste de `datetime_like`. Uma coluna de data em texto quase sempre tem poucos valores
distintos, então caía em `categorical` e nunca chegava ao teste de data. Verificado: 20/5000
linhas com 10/12/84 datas distintas — todas viravam `categorical`; só dtype `datetime64`
escapava.

### Decisão adotada
Mover o teste `datetime_like` para **antes** do `categorical`, mantendo o limiar de 80% de
uma amostra de 50 valores.

### Justificativa
O limiar de 80% é forte o bastante para não capturar categóricas reais (nomes, códigos,
meses por extenso não parseiam como data). Datas, sim.

### Impacto
- CSV com coluna de data volta a gerar o gráfico `line` de evolução mensal
- Excel já escapava, porque o pandas costuma entregar `datetime64`
- Risco pequeno: anos como texto ("2020".."2023") passam a virar `datetime_like` — aceitável

### Evidência
`backend/analyzer.py` (`_infer_semantic`, ordem dos ramos). Coberto por
`tests/test_analyzer_semantic.py` (6 testes de detecção + o de ponta a ponta do gráfico).

### Commit relacionado
2026-09-04.

---

## D17 — Agregados por grupo no perfil

### Contexto
No chat, "Qual produto tem maior média?" era respondido com "seria necessário agrupar os
registros por produto" — recusa correta, mas frustrante.

### Problema
O perfil enviado ao LLM só tinha estatística **por coluna** (soma/média da coluna inteira),
não **por grupo**. Sem o número, o modelo se recusava a inventar — a guarda anti-alucinação
funcionando, mas entregando uma resposta inútil.

### Alternativas
1. Deixar o LLM calcular a partir da amostra (arriscaria alucinação, viola D1)
2. Adicionar agregados por grupo já calculados ao perfil

### Decisão adotada
Alternativa 2. `analyzer._group_summaries` calcula, para cada dimensão categórica de baixa
cardinalidade (até 4 dims, `unique <= 20`), o `count` e o `sum`/`mean` de cada numérica
(até 4 métricas, top 15 grupos). Vai em `profile["group_summaries"]`. O `CHAT_SYSTEM`
instrui o modelo a usar.

### Justificativa
Mantém a regra D1 (número calculado por Pandas, não pelo LLM) e resolve a classe inteira de
perguntas de ranking/comparação por categoria. Compacto para não estourar o prompt.

### Impacto
- Chat e insights passam a responder "qual X tem maior média/soma de Y"
- Prompt cresce um pouco; limitado por dims/grupos/métricas
- `q25`/`q75` continuam divergentes no `api.ts` (não relacionado); `group_summaries` foi
  adicionado ao tipo `Profile`

### Evidência
`backend/analyzer.py` (`_group_summaries`), `backend/prompts.py` (bloco no `CHAT_SYSTEM`),
`frontend/src/lib/api.ts` (tipo `GroupSummary`). Coberto por `tests/test_analyzer_semantic.py`.

### Commit relacionado
2026-09-04.

---

## D18 — CI com GitHub Actions

### Contexto
26 testes verdes que só rodavam quando alguém lembrava. Deploy do Vercel acontecia sem
gate de teste.

### Decisão adotada
Workflow `.github/workflows/test.yml` rodando `pytest` a cada push e PR em `main`, com
Python 3.12 e chaves de LLM dummy (nenhum teste faz chamada real).

### Justificativa
Baixo custo, protege contra regressão. Era o `NEXT STEP` documentado.

### Impacto
- Toda alteração passa a ser testada automaticamente
- Não bloqueia o deploy do Vercel (são pipelines separados) — é sinal, não gate rígido

### Evidência
`.github/workflows/test.yml`.

### Commit relacionado
2026-09-04.

---

## Decisões pendentes de registro

Itens em que a intenção é conhecida mas a implementação não começou. Detalhe em
[`PROGRESS.md`](../PROGRESS.md).

- Circuit breaker para a cadeia de LLM
- Named tunnel do Cloudflare
- Remoção ou reativação de `POST /export` e `pdf_export.py`
