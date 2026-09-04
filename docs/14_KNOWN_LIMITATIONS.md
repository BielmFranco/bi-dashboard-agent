# 14 — Limitações Conhecidas

Classificação usada:

- **Limitação confirmada** — restrição real, verificada no código, provavelmente por design
- **Problema conhecido** — comportamento indesejado, verificado, ainda sem correção
- **Dívida técnica** — o código funciona, mas a forma dificulta manutenção
- **Funcionalidade futura** — intenção registrada, implementação não iniciada
- **Hipótese** — suspeita não verificada

---

## Dados e ingestão

### Limitação confirmada — Excel: só a primeira aba
`analyzer.load_dataframe` chama `pd.read_excel(path)` sem parâmetro `sheet_name`.
Planilhas com múltiplas abas perdem tudo além da primeira, **sem aviso ao usuário**.

### Limitação confirmada — limite de 50 MB, verificado após ler tudo em memória
```python
data = await file.read()          # main.py:192 — arquivo inteiro em RAM
if len(data) > MAX_MB * 1024 * 1024:
```
Um upload de 500 MB ocupa 500 MB de RAM antes de ser rejeitado.

### Limitação confirmada — sem limite de linhas
Nenhuma checagem de contagem de linhas. Um CSV de 50 MB com milhões de linhas é
integralmente carregado, perfilado e agregado dentro do request HTTP, de forma síncrona.

### Limitação confirmada — validação só por extensão
`main.py:189` verifica apenas o sufixo do nome do arquivo. Não há inspeção de conteúdo,
verificação de magic bytes nem antivírus.

### Limitação confirmada — formatos não suportados
`.ods`, `.parquet`, `.json`, `.txt`, arquivos comprimidos e Google Sheets são rejeitados.

### Problema conhecido — heurística de ID depende do nome da coluna
Uma coluna de identificador chamada `chave` ou `numero` não é detectada e entra em KPIs e
gráficos como se fosse métrica. Trade-off deliberado do commit `256b03d` — ver
[`12_TECHNICAL_DECISIONS.md#d6`](12_TECHNICAL_DECISIONS.md).

---

## Análise e dashboard

### Limitação confirmada — planner escolhe sempre a primeira coluna
`build_plan` pega a **primeira** coluna numérica, categórica e de data na ordem em que
aparecem na planilha. Não há score de relevância, variância ou cardinalidade. Uma planilha
com a coluna interessante na posição 40 produz gráficos ruins.

### Limitação confirmada — teto de 8 KPIs e 5 gráficos
`_build_kpis` trunca em 8. `build_plan` gera no máximo 5 gráficos (line, 2×bar, pie,
boxplot, scatter), pelas regras fixas.

### Limitação confirmada — série temporal só mensal
`_time_series` usa `freq="ME"` fixo. Não há agregação diária, semanal, trimestral ou anual,
nem escolha automática pela amplitude do período.

### Limitação confirmada — dispersão limitada a 500 pontos
`build_plan` faz `.head(500)`. Datasets maiores mostram apenas as 500 primeiras linhas —
não uma amostra aleatória, o que pode enviesar visualmente o gráfico.

### Limitação confirmada — só correlação de Pearson
`profile_dataframe` usa `df.corr(numeric_only=True)`, padrão Pearson. Sem Spearman, sem
Kendall, sem tratamento de relações não lineares.

### Problema conhecido — `_distribution()` é código morto
`dashboard_planner.py:116` define uma função de histograma que **nenhum caller invoca**
desde que o boxplot a substituiu (commit `14a35eb`).

---

## LLM

### Limitação confirmada — sem circuit breaker
Se o Groq estiver fora do ar, **cada requisição** paga a cadeia inteira antes de chegar ao
Gemini: 2 modelos × 3 tentativas, com backoff de 1,5 s + 3 s por modelo (a terceira
tentativa não espera). Espera acumulada ≈ **9 s** por request, fora o tempo das chamadas
que falham.

Já registrado como pendência em `HANDOFF_NOVO_PC.md`.

### Limitação confirmada — sem cache de prompt
Requisições idênticas gastam tokens de novo. Não há memoização por hash de prompt.

### Limitação confirmada — cortes em caracteres, não em tokens
`llm._build_insights_prompt` trunca em 40.000 / 10.000 / 15.000 **caracteres**. A relação
caractere-token varia com o conteúdo, então o orçamento real de tokens é aproximado.

### Problema conhecido — `has_api_key` ignora o Groq
```python
# main.py:159
"has_api_key": bool(os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY"))
```
Um backend rodando só com `GROQ_API_KEY` reporta `has_api_key: false` no `/health` e
funciona perfeitamente. Confunde o diagnóstico.

### Problema conhecido — padrão de `MODEL_ID` divergente
| Local | Padrão |
|---|---|
| `llm.py:153` | `gemini-2.0-flash` |
| `main.py:162` (só exibição) | `gemini-flash-latest` |
| `.env.example` | `gemini-flash-latest` |

Sem efeito prático quando o `.env` está presente, mas é uma inconsistência real.

### Limitação confirmada — `/health` não mostra o estado da cadeia
Não há como saber, sem ler os logs, qual provider respondeu à última requisição, nem se
algum está degradado.

### Limitação confirmada — nenhum teste faz chamada real de API
Toda a suíte de `test_llm_chain.py` usa mocks. Uma mudança de contrato na API do Groq ou do
Gemini passaria despercebida até quebrar em produção.

---

## PDF

### Problema conhecido — o toast promete download automático, mas abre um diálogo
```tsx
toast.success("Relatório aberto — PDF será baixado automaticamente");
```
`window.print()` abre o **diálogo de impressão**. O usuário precisa escolher
"Salvar como PDF" e confirmar. O texto do toast não corresponde ao comportamento.

### Limitação confirmada — resultado depende do navegador
Chrome, Firefox e Safari têm motores de impressão diferentes. Só o Chrome foi verificado.

### Limitação confirmada — atraso fixo de 1200 ms antes de imprimir
```tsx
setTimeout(() => window.print(), 1200);
```
Número mágico que cobre o mount do Recharts e o carregamento de fontes. Em uma máquina
lenta ou com dataset grande, pode não ser suficiente. Não há verificação de prontidão.

### Dívida técnica — `POST /export` e `pdf_export.py` órfãos
O endpoint e o módulo Playwright continuam no código, sem nenhum chamador. Mantêm
`playwright>=1.49.0` no `requirements.txt` e a imagem base de ~1 GB no `Dockerfile`.

**Decisão pendente:** remover, ou manter como caminho alternativo documentado.

### Limitação confirmada — o PDF não inclui os insights
O commit `1845cc1` removeu deliberadamente a seção de insights do relatório. O PDF é só o
dashboard. `InsightsGrid.tsx` ficou órfão desde então.

---

## Frontend

### Dívida técnica — parser de SSE duplicado
`insightsStream` (`api.ts:183`) e `chatStream` (`api.ts:251`) contêm blocos praticamente
idênticos de ~25 linhas. Uma correção precisa ser aplicada nos dois lugares.

### Dívida técnica — funções mortas em `api.ts`
`exportPdf()`, `insights()` e `chat()` não têm chamador. Correspondem às versões não
streaming, substituídas pelas de stream.

### Dívida técnica — componente `InsightsGrid` órfão
`frontend/src/components/report/InsightsGrid.tsx` não é importado por nenhum arquivo.

### Limitação confirmada — nenhum teste no frontend
Sem Jest, Vitest, Testing Library ou Playwright. Zero cobertura.

### Limitação confirmada — todo o estado em uma única página
`page.tsx` concentra 16 chamadas de `useState`. Sem store, sem reducer. Cresce mal.

### Limitação confirmada — sem error boundary
Um erro de render em qualquer componente derruba a página inteira. Não há `error.tsx`
nem `loading.tsx` do App Router.

### Limitação confirmada — tipos duplicados manualmente
Os tipos em `api.ts` são espelho manual da saída do `analyzer.py`. Não há geração de
schema. Mudanças no backend só aparecem em runtime.

**Divergência já existente:** o backend devolve `q25` e `q75` para colunas numéricas, mas
`ColumnProfile` em `api.ts` não declara esses campos.

### Limitação confirmada — sem internacionalização
Toda string está hardcoded em pt-BR, espalhada pelos componentes.

---

## Infraestrutura e deploy

### Problema conhecido — URL do túnel muda a cada restart
`cloudflared tunnel --url` gera hostname efêmero. Cada restart exige atualizar a variável
no Vercel **e fazer redeploy**. É a causa raiz da maioria dos incidentes.

**Correção conhecida:** named tunnel do Cloudflare. Não implementada.

### Limitação confirmada — `NEXT_PUBLIC_API_URL` é de tempo de build
Alterar a variável no painel do Vercel não afeta o site publicado até um novo build.

### Limitação confirmada — backend depende da máquina local
Enquanto o backend rodar localmente atrás do túnel, a demo só funciona com a máquina de
desenvolvimento ligada.

### Limitação confirmada — sem volume, o container perde os dados
`uploads/` e `cache/` vivem no filesystem do container. Sem volume montado, cada redeploy
apaga tudo. `DEPLOY.md` documenta, mas não é obrigatório na configuração.

### Limitação confirmada — um único processo
O cache em memória (`main.py:113`) não tem lock nem sincronização. Rodar com
`--workers > 1` produziria estado inconsistente entre processos.

### Limitação confirmada — sem CI
Nenhum GitHub Actions. `pytest` só roda quando alguém executa manualmente. O deploy do
Vercel acontece sem gate de teste.

### Dívida técnica — `@app.on_event` deprecado
`main.py:118` usa `@app.on_event("startup")`, deprecado no FastAPI em favor do handler
`lifespan`. Funciona na versão fixada (0.115.5); quebrará em um upgrade maior.

---

## Segurança

### Limitação confirmada — sem autenticação
Qualquer pessoa com a URL do backend pode fazer upload, analisar e apagar arquivos.
Rate limit é a única barreira.

### Limitação confirmada — sem isolamento entre usuários
Todos os `file_id` ficam no mesmo cache. `GET /files` lista **todos** os arquivos de
todos os usuários. `DELETE /files/{id}` apaga o de qualquer um.

### Limitação confirmada — sem criptografia em repouso
Planilhas ficam em texto claro em `backend/uploads/`.

### Limitação confirmada — `x-forwarded-for` é confiável por padrão
`_client_ip` aceita o header sem validar a cadeia de proxy. Se o backend for exposto
diretamente, o rate limit pode ser burlado forjando o header. Aceitável enquanto só o túnel
alcança o backend.

### Hipótese — planilhas grandes como vetor de negação de serviço
Um arquivo de 50 MB com muitas colunas de alta cardinalidade poderia consumir CPU e memória
suficientes para travar o processo único. **Não testado.**

---

## Documentação e ferramentas

### Problema conhecido — `test-data/` não existe em clone limpo
`docs/capture_screenshots.py` referencia `test-data/T5_vendas_semicolon.csv`, mas
`test-data/` está no `.gitignore`. O script falha em uma máquina nova.

### Problema conhecido — servidor MCP graft com timeout de conexão
```
graft (CONNECT_TIMEOUT): "MCP server graft connection timed out after 30000ms"
```
Causa `UNKNOWN — necessita investigação.` Sem impacto na aplicação.

### Dívida técnica — documentação técnica em `.docx`
`docs/Documentacao_Tecnica_BI_Agent.docx` tem 19 seções, mas é binário: não versiona bem,
não é diffável e exige `docs/build_doc.js` para regenerar. Os arquivos markdown desta
operação cobrem o mesmo terreno de forma rastreável.

---

## Funcionalidades futuras registradas

De `HANDOFF_NOVO_PC.md` seção 12 e do backlog do projeto:

| Item | Prioridade declarada |
|---|---|
| README com hero, badges e diagrama | Alta |
| Description, topics e about no GitHub | Alta |
| `CONTRIBUTING.md`, `SECURITY.md`, templates de issue | Média |
| CI com GitHub Actions (pytest + lint) | Média |
| Circuit breaker na cadeia de LLM | Backlog |
| `/health` exibindo o estado da cadeia | Backlog |
| Testes E2E via `TestClient` | Backlog |
| Cache de prompt | Backlog |
| Named tunnel do Cloudflare | Segurança |
| `cloudflared` como serviço do Windows | Segurança |

Concluídos e marcados no handoff: rotação de chaves, rate limit slowapi, pre-commit com
detect-secrets.
