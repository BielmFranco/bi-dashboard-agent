# 10 — Testes

**Estado confirmado em 2026-09-04:** 17 testes, todos passando, exit code 0.
Cobertura: apenas backend. Frontend não tem suíte.

---

## Como rodar

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
pytest
```

Configuração em `backend/pytest.ini`:

```ini
[pytest]
testpaths = tests
addopts = -q --tb=short
```

### Saída esperada

```
.................                                                        [100%]
============================== warnings summary ===============================
.venv\Lib\site-packages\google\genai\types.py:42
  DeprecationWarning: '_UnionGenericAlias' is deprecated and slated for removal in Python 3.17
```

17 pontos, um `DeprecationWarning` do `google-genai` no Python 3.14. O warning é esperado
e não indica falha.

---

## Frameworks

| Camada | Framework | Estado |
|---|---|---|
| Backend | pytest ≥8.0.0 | 17 testes |
| Backend — mocks | `unittest.mock` (stdlib) | Usado em todo o `test_llm_chain.py` |
| Frontend | — | **Nenhum** |
| E2E | — | **Nenhum** |

Não há relatório de cobertura configurado (`pytest-cov` não está em `requirements.txt`).

---

## `tests/test_llm_chain.py` — 12 testes

Todos usam `patch` — **nenhuma chamada real de API**. As variáveis
`GOOGLE_API_KEY` e `GROQ_API_KEY` recebem valores fictícios no topo do arquivo, e
`LLM_RETRY_BASE_DELAY` vira `0.01` para o backoff não travar a suíte.

### Detecção de erro transitório

| Teste | Objetivo | Entrada | Esperado |
|---|---|---|---|
| `test_is_transient_503` | 503 do Gemini deve retentar | `ServerError(503, UNAVAILABLE)` | `True` |
| `test_is_transient_401_not` | Erro de auth não deve retentar | `ClientError(401, unauthenticated)` | `False` |
| `test_is_transient_timeout_string` | Exceção genérica com "timeout" | `Exception("Connection timeout after 30s")` | `True` |
| `test_groq_transient_503` | 503 do Groq deve retentar | `APIStatusError(503)` | `True` |
| `test_groq_transient_401_not` | Auth do Groq não deve retentar | `APIStatusError(401)` | `False` |

### Cadeia de providers

| Teste | Objetivo | Esperado |
|---|---|---|
| `test_call_groq_success_no_gemini` | Sucesso no Groq não deve tocar o Gemini | `_try_generate` nunca chamado |
| `test_call_groq_all_fail_falls_to_gemini` | Falha total do Groq cai para o Gemini | Retorna `"from gemini"` |
| `test_call_gemini_success_when_no_groq_key` | Sem cliente Groq, vai direto ao Gemini | `_try_generate` chamado 1× |
| `test_call_all_fail_raises` | Falha total de todos os providers | `RuntimeError` com mensagem em pt-BR |
| `test_groq_models_chain_has_fallback` | A cadeia Groq tem modelos distintos | `models[0] != models[1]` |

### Normalização entre providers

| Teste | Objetivo | Esperado |
|---|---|---|
| `test_pt_br_enforce_injected_in_groq_messages` | Reforço de idioma vai na mensagem de sistema do Groq | Mensagem contém "portugues" ou "pt-br" |
| `test_iter_groq_stream_yields_content` | Iterador de stream pula deltas nulos | `["hello ", "world"]` — o chunk vazio some |

---

## `tests/test_filters_profile.py` — 5 testes

Fixture compartilhada — um DataFrame de 6 linhas com colunas `mes`, `produto`,
`quantidade`, `valor`:

```python
SAMPLE = pd.DataFrame({
    "mes":        ["janeiro", "janeiro", "fevereiro", "fevereiro", "marco", "marco"],
    "produto":    ["A", "B", "A", "B", "A", "B"],
    "quantidade": [100, 80, 120, 90, 150, 110],
    "valor":      [5000, 6400, 6000, 7200, 7500, 8800],
})
```

| Teste | Entrada | Esperado | Por que importa |
|---|---|---|---|
| `test_no_filter_returns_full_stats` | Sem filtro | `sum(quantidade) == 650`, `rows == 6` | Baseline do perfil |
| `test_filter_in_reduces_rows` | `mes ∈ [janeiro, fevereiro]` | 4 linhas, `sum(quantidade) == 390`, `sum(valor) == 24600` | **Este é o teste do bug de alucinação do chat.** Garante que o perfil recomputado reflete o filtro. |
| `test_filter_range` | `quantidade ∈ [100, 130]` e `[140, 200]` | 3 linhas e 1 linha | Cobre limites numéricos inclusivos |
| `test_summarize_active_produces_readable_strings` | `mes ∈ [janeiro]` | Lista contendo "mes" | Garante que o rótulo que chega ao LLM é legível |
| `test_empty_filter_dict_returns_all` | `{}` | Todas as linhas | Dict vazio não deve filtrar nada |

---

## O que NÃO está coberto

Lacunas confirmadas por inspeção. Nenhuma é bug — são áreas sem teste.

| Área | Risco |
|---|---|
| Endpoints do FastAPI | **Alto.** Nenhum teste com `TestClient`. Mudanças de contrato não são detectadas. |
| `dashboard_planner.py` | **Alto.** Nenhum teste. A lógica de seleção de gráfico é toda regra e seria fácil de testar. |
| `analyzer.load_dataframe` | **Médio.** A cascata de encoding/separador do CSV não tem teste. |
| `analyzer._infer_semantic` | **Médio.** A heurística de ID é sutil e já teve regressão (commit `256b03d`). |
| `cache.py` | **Médio.** Escrita atômica, limpeza por idade e cache corrompido não são testados. |
| `pdf_export.py` | **Baixo.** Requer Chromium; o endpoint está sem uso. |
| Frontend inteiro | **Alto.** Zero testes. |
| Parsing de SSE | **Alto.** Duplicado no frontend, sem teste dos dois lados. |

---

# SMOKE TEST

Sequência mínima para validar uma instalação nova. Executar na ordem.

### Pré-condições

- `backend/.env` com ao menos uma chave de LLM
- `frontend/.env.local` com `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000`
- Backend e frontend rodando

### 1. Backend responde

```bash
curl http://127.0.0.1:8000/health
```

**Passa se:** JSON com `"ok": true` e `"has_api_key": true`.
**Falha comum:** `has_api_key: false` → `.env` ausente ou fora de `backend/`.

### 2. Testes unitários

```bash
cd backend && pytest
```

**Passa se:** 17 testes, exit code 0.

### 3. Upload

Abrir <http://localhost:3000> e arrastar um `.csv` ou `.xlsx`.

**Passa se:** aparece um toast "Planilha enviada" seguido de "Análise concluída" com a
contagem de linhas e colunas.
**Falha comum:** "Falha de rede" → backend fora do ar ou `NEXT_PUBLIC_API_URL` errada.

### 4. Dashboard renderiza

**Passa se:** aparecem KPIs (pelo menos "Total de Registros"), ao menos um gráfico e a
tabela de perfil da base.
**Falha comum:** nenhum gráfico → a planilha não tem coluna numérica nem categórica
reconhecida. Testar com outra base.

### 5. Filtros

Abrir a barra de filtros, selecionar um valor, clicar em **"Aplicar filtros"**.

**Passa se:** KPIs e gráficos se atualizam e um badge de filtro ativo aparece.
**Falha comum:** 400 "Filtros resultaram em 0 registros" — comportamento correto se a
combinação realmente não retorna nada.

### 6. Insights (valida a cadeia de LLM)

Clicar em **"Gerar insights"**.

**Passa se:** o texto aparece progressivamente (streaming) e traz as 5 seções em português.
**Falha comum:** erro de quota ou key inválida — a mensagem já vem traduzida e diz o que fazer.

### 7. Chat

Perguntar algo como "Qual a soma da coluna X?".

**Passa se:** a resposta usa o número exato do perfil. Se um filtro estiver ativo, a
resposta deve refletir o subconjunto.
**Este passo valida a correção do bug de alucinação.**

### 8. Drill-down

Clicar em uma barra de um gráfico de barras.

**Passa se:** abre um modal com as linhas correspondentes e um botão de exportar CSV.

### 9. PDF

Clicar em **"Baixar PDF"**.

**Passa se:** abre uma aba nova com o relatório e, após ~1,2 s, o diálogo de impressão do
navegador. Escolher "Salvar como PDF".
**Verificar no PDF:** A4 paisagem, paleta creme, KPIs e gráficos visíveis, nada em branco.

### 10. Persistência de sessão

Recarregar a página `/`.

**Passa se:** a análise é restaurada automaticamente (via `localStorage`), sem novo upload.

### 11. Histórico

Ir para `/history`.

**Passa se:** o arquivo aparece na lista com linhas e colunas. Clicar abre a análise;
a lixeira apaga.

---

## Dados de teste

`docs/capture_screenshots.py` referencia `test-data/T5_vendas_semicolon.csv`, mas
`test-data/` está no `.gitignore` e **não existe em um clone limpo**.

Para o smoke test serve qualquer planilha com pelo menos:
- uma coluna numérica (gera KPIs, boxplot)
- uma coluna categórica com poucos valores distintos (gera bar e pie)
- opcionalmente uma coluna de data (gera a série temporal)

---

## Próximos passos sugeridos para testes

Em ordem de custo-benefício:

1. **`TestClient` do FastAPI** cobrindo `/upload → /analyze → /report_data` com um CSV
   pequeno em fixture. Pegaria toda quebra de contrato.
2. **Testes de `dashboard_planner.build_plan`** com DataFrames sintéticos — lógica pura,
   fácil de testar, hoje totalmente descoberta.
3. **Testes de `analyzer._infer_semantic`** para cada tipo semântico, incluindo os casos
   de borda da heurística de ID.
4. **Extrair o parser de SSE** para um módulo único no frontend e testá-lo.
5. **GitHub Actions** rodando `pytest` a cada push — o repositório ainda não tem CI.
