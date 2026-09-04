# 04 — Backend

Oito módulos Python em `backend/`, sem pacotes aninhados. Todos os imports entre eles são
absolutos e planos (`from analyzer import ...`), o que exige que o `cwd` seja `backend/`
ao rodar — daí `python main.py` e não `python -m backend.main`.

---

## main.py

**Responsabilidade:** expor a API HTTP e coordenar os demais módulos.

**Dependências:** FastAPI, slowapi, pandas, pydantic + os módulos locais
`analyzer`, `dashboard_planner`, `filters`, `llm`, `cache`, `pdf_export`.

### Configuração no import

| Bloco | Linhas | O que faz |
|---|---|---|
| `_client_ip` | 30–38 | Resolve o IP real: `cf-connecting-ip` → `x-forwarded-for` → `request.client.host` |
| `JsonFormatter` | 43–57 | Formatter de log opcional; ativado por `LOG_FORMAT=json` |
| Limiter | 41, 81–83 | slowapi com `key_func=_client_ip` |
| Handler global | 86–92 | Captura qualquer `Exception`, loga, devolve 500 com mensagem neutra |
| CORS | 94–108 | `FRONTEND_URL` + localhost; regex opcional `FRONTEND_URL_REGEX` |
| Cache | 113 | `_cache = disk_cache.load_all()` — restaura do disco no import |

### Startup

```python
# main.py:118
@app.on_event("startup")
async def _startup_cleanup():
```

Roda `cleanup_older_than(RETENTION_DAYS)` uma vez e cria uma task que repete a cada 6 horas.
Se algo foi removido, o `_cache` em memória é recarregado do disco.

> `@app.on_event` está deprecado no FastAPI moderno em favor de `lifespan`. Ainda funciona
> na versão fixada (0.115.5). Registrado como dívida técnica.

### Endpoints

Tabela completa com request/response em [`08_API.md`](08_API.md). Resumo:

| Método | Rota | Rate limit | Função |
|---|---|---|---|
| GET | `/health` | — | `health` |
| GET | `/files` | — | `list_files` |
| DELETE | `/files/{file_id}` | — | `delete_file` |
| POST | `/upload` | 20/min | `upload` |
| POST | `/analyze/{file_id}` | 30/min | `analyze` |
| POST | `/analyze/{file_id}/filtered` | 30/min | `analyze_filtered` |
| GET | `/analyze/{file_id}` | — | `get_analysis` |
| GET | `/report_data/{file_id}` | — | `report_data` |
| POST | `/export/{file_id}` | 5/min | `export_pdf` — **sem chamador no frontend** |
| POST | `/drill/{file_id}` | 30/min | `drill` |
| POST | `/insights/{file_id}` | 10/min | `insights` — **sem chamador no frontend** |
| POST | `/insights_stream/{file_id}` | 10/min | `insights_stream` |
| POST | `/chat/{file_id}` | 10/min | `chat_endpoint` — **sem chamador no frontend** |
| POST | `/chat_stream/{file_id}` | 10/min | `chat_stream_endpoint` |
| GET | `/suggestions/{file_id}` | 20/min | `suggestions_endpoint` |
| POST | `/suggestions/{file_id}` | 20/min | `suggestions_post` |

### Regras de negócio

- Upload rejeita extensão fora de `{.csv, .xlsx, .xls, .xlsm, .tsv}` (HTTP 400).
- Upload rejeita arquivo acima de 50 MB (HTTP 400).
- Todo endpoint que precisa de análise levanta HTTP 400 `"Rode /analyze antes."` se
  `profile` ou `plan` não estiverem no cache.
- `file_id` inexistente levanta HTTP 404 `"file_id não encontrado. Faça upload novamente."`.
- Filtro que zera o DataFrame em `/analyze/filtered` levanta HTTP 400. Nos endpoints de
  LLM, o mesmo caso apenas loga um warning e cai para o perfil base.

### Funções críticas

#### `_plan_for_context`

| Campo | Valor |
|---|---|
| **Arquivo** | `main.py:351` |
| **Responsabilidade** | Devolver `(profile, plan)` já refletindo os filtros ativos |
| **Parâmetros** | `entry: dict`, `filters: dict \| None` |
| **Retorno** | `tuple[dict, dict]` |
| **Fluxo** | Sem filtros → devolve o par do cache. Com filtros → relê o arquivo do disco, aplica filtros, reprofila e replaneja. |
| **Chamadores** | `/insights`, `/insights_stream` |
| **Efeitos colaterais** | Nenhum. Não grava no cache. |
| **Tratamento de erro** | Falha de leitura ou DataFrame vazio → loga warning e devolve o par base |
| **Riscos** | Relê o arquivo inteiro a cada chamada. Custo O(tamanho do arquivo) por request de insights com filtro. |

#### `_profile_for_context`

| Campo | Valor |
|---|---|
| **Arquivo** | `main.py:433` |
| **Responsabilidade** | Mesma ideia da anterior, mas devolve só o `profile` |
| **Chamadores** | `/chat`, `/chat_stream`, `POST /suggestions` |
| **Riscos** | Duplica a lógica de `_plan_for_context`. As duas funções compartilham quatro linhas idênticas de recomputação. |

Essa duplicação é a correção do bug de alucinação do chat: antes, o LLM recebia o perfil
não filtrado e respondia números do dataset inteiro enquanto o usuário via o dashboard
filtrado. Commits `a921d06` e `c0fd380`.

#### `_sse`

| Campo | Valor |
|---|---|
| **Arquivo** | `main.py:390` |
| **Responsabilidade** | Serializar um evento SSE |
| **Fluxo** | Normaliza `\r\n` e `\r` para `\n`, prefixa cada linha com `data: `, monta `event: <nome>` e termina com linha em branco |
| **Por que importa** | Texto de LLM contém quebras de linha; sem essa normalização o stream corrompe no cliente |

---

## analyzer.py

**Responsabilidade:** transformar um arquivo em `DataFrame`, e um `DataFrame` no dicionário
`profile` que é o contrato com todo o resto do sistema.

### `load_dataframe(path) -> pd.DataFrame`

Detecção por extensão:

- `.csv` — tenta o produto cartesiano de 3 encodings (`utf-8`, `latin-1`, `cp1252`) × 4
  separadores (`,`, `;`, `\t`, `|`). Aceita o primeiro resultado com mais de uma coluna.
  Se nenhum der mais de uma coluna, aceita o primeiro com exatamente uma coluna e pelo
  menos uma linha. Senão levanta `ValueError`.
- `.xlsx`, `.xls`, `.xlsm` — `pd.read_excel` (só a primeira aba).
- `.tsv` — `pd.read_csv(sep="\t")`.

**Risco:** planilhas Excel com múltiplas abas perdem tudo além da primeira, sem aviso.

### `_infer_semantic(series, name) -> str`

Classifica cada coluna em um de sete tipos semânticos. **Ordem importa:**

1. `empty` — série toda nula
2. `datetime` — dtype já é datetime
3. `boolean` — dtype é bool
4. `numeric` ou `id` — dtype numérico; vira `id` se `_looks_like_id` der verdadeiro
5. `id` — texto que casa com heurística de identificador
6. `categorical` — `nunique <= max(20, 5% das linhas)`
7. `datetime_like` — mais de 80% da amostra de 50 valores parseia como data
8. `text` — o resto

### `_looks_like_id(name, series) -> bool`

| Campo | Valor |
|---|---|
| **Arquivo** | `analyzer.py:52` |
| **Regra** | O **nome** precisa casar com um dos tokens de `_ID_NAME_HINTS` E a razão de valores únicos precisa ser ≥ 0,6 |
| **Tokens** | `id, codigo, código, cod, matricula, matrícula, cpf, cnpj, registro` |
| **Por que a regra é conservadora** | Cardinalidade sozinha é ambígua: uma coluna numérica única por linha pode ser uma medição (idade, salário, custo), não um identificador. Classificar uma métrica como ID a remove silenciosamente dos KPIs e gráficos. O comentário no código diz exatamente isso. |

Corrigido no commit `256b03d` após falsos positivos.

### `profile_dataframe(df, sample_n=20) -> dict`

Saída:

```python
{
  "rows": int,
  "cols": int,
  "columns": [ <perfil por coluna> ],
  "duplicates": int,          # df.duplicated().sum()
  "empty_columns": [str],     # colunas 100% nulas
  "correlation": {"columns": [...], "matrix": [[...]]} | None,
  "sample": [ {col: valor} ],  # primeiras sample_n linhas, JSON-safe
  "sample_size": int,
}
```

Perfil por coluna sempre tem `name`, `dtype`, `semantic`, `n`, `nulls`, `null_pct`, `unique`.
Além disso, dependendo do `semantic`:

- `numeric` → `min`, `max`, `mean`, `median`, `std`, `q25`, `q75`, `sum`, `outliers_count`
- `categorical` / `text` / `boolean` → `top_values` (top 10, com contagem)
- `datetime` / `datetime_like` → `min_date`, `max_date`

`correlation` só existe com 2+ colunas numéricas; é Pearson arredondado a 3 casas.

`outliers_count` usa a regra do IQR: fora de `[q1 − 1,5·IQR, q3 + 1,5·IQR]`.

### `_safe(v) -> Any`

Converte tipos NumPy/Pandas em tipos JSON-nativos. Trata `NaN` e `inf` como `None`.
Sem isso, `json.dumps` quebra. Corrigido no commit `d7706a9`.

É importado também por `dashboard_planner.py` e por `main.py` (dentro de `drill`).

---

## dashboard_planner.py

**Responsabilidade:** escolher e calcular os KPIs e gráficos. **Zero LLM.**

### `build_plan(df, profile) -> dict`

Regras, na ordem em que os gráficos são adicionados:

| Condição | Gráfico gerado | Tipo |
|---|---|---|
| há coluna de data **e** coluna numérica | Evolução mensal da primeira métrica | `line` |
| há categórica **e** numérica | Top 10 por categoria, para até 2 categóricas | `bar` |
| há categórica | Participação (top 8) da primeira categórica | `pie` |
| há numérica | Distribuição (quartis + outliers) da primeira | `boxplot` |
| há 2+ numéricas | Dispersão das duas primeiras, máx. 500 pontos | `scatter` |

`filters_suggested` = até 3 categóricas + até 1 coluna de data.

### `_build_kpis(profile) -> list[dict]`

- Sempre inclui `{"id": "rows", "label": "Total de Registros"}`.
- Para as **4 primeiras** colunas numéricas, adiciona `Soma de X` e `Média de X`.
- Pula colunas com zero valores não-nulos.
- Trunca em **8 KPIs**.

### Funções de agregação

| Função | Linha | O que calcula |
|---|---|---|
| `_agg_by` | 55 | `groupby(dim)[metric].agg(...)`, ordenado desc, top N |
| `_time_series` | 65 | Reamostragem mensal (`freq="ME"`) com soma |
| `_boxplot_stats` | 76 | q1, mediana, q3, whiskers dentro das cercas, até 50 outliers listados |
| `_distribution` | 116 | `pd.cut` em 12 bins com rótulos formatados |
| `_pie` | 128 | `value_counts` top N |
| `_fmt_bin` | 103 | Formata limites de bin como `1.5k`, `2.3M`, `1.1B` |

`_distribution` existe no arquivo mas **não é chamada por `build_plan`** — o histograma
foi substituído pelo boxplot no commit `14a35eb`. Código morto residual.

### Riscos

- Escolhe sempre a **primeira** coluna numérica/categórica/de data. Se a ordem das colunas
  na planilha for ruim, o gráfico escolhido é ruim. Não há score de relevância.
- Nenhum teste cobre este módulo.

---

## llm.py

Documentado em detalhe em [`07_LLM.md`](07_LLM.md). Resumo estrutural:

| Função | Linha | Papel |
|---|---|---|
| `groq_client()` | 51 | Cliente Groq preguiçoso; recarrega `.env` a cada chamada |
| `client()` | 138 | Cliente Gemini; levanta `RuntimeError` se não houver key |
| `_call()` | 184 | Cadeia síncrona Groq → Gemini com retry |
| `_open_stream()` | 323 | Mesma cadeia, versão streaming |
| `_is_transient()` / `_groq_is_transient()` | 119 / 75 | Decidem se vale retentar |
| `_translate_error()` | 274 | Converte erro de SDK em `RuntimeError` legível em pt-BR |
| `generate_insights()` / `_stream` | 268 / 386 | Insights |
| `chat()` / `chat_stream()` | 415 / 422 | Chat |
| `suggest_questions()` | 437 | 4 perguntas curtas |

**Detalhe relevante:** `load_dotenv(override=True)` é chamado dentro de `client()` e
`groq_client()`, ou seja, a cada request. Isso permite trocar a API key no `.env` sem
reiniciar o backend. Custa uma leitura de arquivo por chamada.

---

## filters.py

**Responsabilidade:** aplicar filtros ao DataFrame antes do reprofiling.

### `apply_filters(df, filters) -> pd.DataFrame`

Formato do payload (documentado no docstring do próprio módulo):

```json
{
  "categoria":  {"op": "in",    "values": ["Eletrônicos", "Roupas"]},
  "data":       {"op": "range", "min": "2025-01-01", "max": "2025-06-30"},
  "quantidade": {"op": "range", "min": 100, "max": null}
}
```

Operações suportadas: `in`, `range`, `eq`.

Constrói uma máscara booleana acumulada com `&`. Comportamento defensivo:

- Coluna inexistente → warning, filtro ignorado (não levanta erro)
- `op` desconhecida → warning, filtro ignorado
- `range` em coluna não-numérica → tenta parsear como datetime; se falhar, warning
- `values` vazio em `in` → ignorado

### `summarize_active(filters) -> list[str]`

Gera rótulos legíveis (`"mes ∈ [janeiro, fevereiro]"`, `"valor ≥ 100"`) que vão para
`profile["active_filters"]` e chegam ao LLM. O `CHAT_SYSTEM` instrui o modelo a mencionar
o filtro ativo nas respostas.

**Testes:** `tests/test_filters_profile.py` cobre `in`, `range`, dict vazio e `summarize_active`.

---

## cache.py

**Responsabilidade:** persistir metadata + análise em disco, um JSON por `file_id`.

| Função | Linha | Papel |
|---|---|---|
| `load_all()` | 29 | Lê todos os `cache/*.json`. Descarta entradas cujo arquivo raw sumiu. |
| `save(file_id, entry)` | 51 | Escrita atômica: grava `.json.tmp` e faz `replace()` |
| `delete(file_id, entry)` | 58 | Remove o JSON e o arquivo raw |
| `cleanup_older_than(days)` | 74 | Remove entradas com `uploaded_at` além do corte |
| `summary(file_id, entry)` | 93 | Projeção usada por `GET /files` |

O que é persistido: `path`, `filename`, `uploaded_at`, `profile`, `plan` e — quando
`POST /export` recebe insights — `insights`.

**Risco:** cache corrompido é apenas logado e ignorado, nunca propaga erro. Isso é
resiliente, mas esconde problemas de disco.

---

## pdf_export.py

**Responsabilidade:** renderizar uma URL em PDF A4 paisagem com Chromium headless.

```python
# pdf_export.py:22
def render_pdf(url: str, wait_ms: int = 400) -> bytes:
```

Fluxo: lança Chromium → viewport 1754×1240 (A4 paisagem a 150 dpi) → `goto(wait_until="domcontentloaded")`
→ `wait_for_selector(".report-doc", timeout=15000)` → aguarda fontes → `page.pdf(...)`.

Erros viram `PdfExportError`.

**Estado:** este módulo só é usado por `POST /export/{file_id}`, que **não tem chamador no
frontend** desde o commit `f3732e7`. O `wait_for_selector(".report-doc")` era exatamente
a origem dos timeouts que motivaram a migração. Ver
[`12_TECHNICAL_DECISIONS.md`](12_TECHNICAL_DECISIONS.md) e
[`11_TROUBLESHOOTING.md`](11_TROUBLESHOOTING.md).

---

## prompts.py

Três constantes, todas em pt-BR:

| Constante | Uso |
|---|---|
| `SYSTEM_PROMPT` | Persona de especialista sênior em BI; regras de dados e de formatação; estrutura fixa de 5 seções |
| `INSIGHTS_USER_TEMPLATE` | Template com `{profile_json}`, `{plan_json}`, `{sample_json}`, `{sample_n}` |
| `CHAT_SYSTEM` | `SYSTEM_PROMPT` + instruções de modo chat |

Regras de formatação notáveis, todas fruto de problemas reais observados:

- proibição explícita de ASCII art (o modelo desenhava dashboards com `+---+`)
- proibição de LaTeX (`$...$` quebrava o renderizador markdown)
- números no padrão pt-BR (`1.857`, `50,28`, `12,5%`)
- instrução para **não** repetir KPIs que o motor já renderiza

Regras anti-alucinação no `CHAT_SYSTEM`:

> "Use esses números DIRETAMENTE quando perguntarem soma/média/mínimo/máximo/desvio/registros."
> "NUNCA multiplique média × n para estimar soma — a `sum` já vem calculada."

---

## Tratamento de erro — resumo

| Camada | Mecanismo |
|---|---|
| Validação de entrada | `HTTPException(400, ...)` com mensagem em pt-BR |
| Recurso ausente | `HTTPException(404, ...)` |
| Falha de LLM | `llm._translate_error()` → `RuntimeError` → `HTTPException(500, str(e))` |
| Falha em stream | Emitida como `event: error` no SSE, não como status HTTP |
| Qualquer outra | Handler global em `main.py:86` → 500 com mensagem neutra, stack só no log |

Mensagens de erro de LLM traduzidas para o usuário incluem instrução acionável, por exemplo:

> "Quota Gemini atingida (1500 req/dia no free tier). Aguarde ou faça upgrade."
