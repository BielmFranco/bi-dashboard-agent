---
name: project-context
description: Manter o contexto do BI Dashboard Agent sincronizado com o código. Use ao iniciar uma sessão neste repositório, antes de investigar ou alterar código, e ao concluir um trabalho — para saber o que ler, como investigar com segurança, o que validar e qual documentação atualizar.
---

# Project Context & Continuity

Este repositório trata documentação como **memória operacional**, não como enfeite.
A conversa acaba; os arquivos permanecem. Sua responsabilidade é manter os dois alinhados.

**Princípio central:** o código é a fonte de verdade sobre comportamento; o git é a fonte
de verdade sobre evolução; os testes são evidência de comportamento validado; a
documentação é a memória. Quando divergirem, o código vence e a documentação se corrige.

---

## Session Initialization

Ao começar a trabalhar neste repositório, antes de qualquer alteração:

1. **Leia `CLAUDE.md`** — regras operacionais, comandos, o que não quebrar.
2. **Leia `PROGRESS.md`** — o que funciona, o que está quebrado, qual é o próximo passo,
   e a lista `DO NOT BREAK`.
3. **Leia `docs/00_CONTEXT.md`** se ainda não conhece o projeto.
4. **Verifique o git:**

   ```powershell
   git log -1 --oneline; git status
   ```

   Alterações não commitadas são um sinal. **Investigue antes de agir; nunca descarte.**

5. **Confirme o ambiente** se for rodar algo: `backend/.env` e `frontend/.env.local`
   existem? Ambos são não versionados.

Não pule esta fase alegando que a tarefa é pequena. `PROGRESS.md` tem dez regras derivadas
de bugs reais, e várias delas parecem arbitrárias sem contexto.

---

## Code Investigation

Antes de alterar qualquer coisa:

### 1. Leia a documentação da área

| Vai mexer em | Leia primeiro |
|---|---|
| Endpoint, lógica de servidor | `docs/04_BACKEND.md`, `docs/08_API.md` |
| Componente, página, estado da UI | `docs/05_FRONTEND.md` |
| Perfilamento, planner, filtros | `docs/06_DATA_PIPELINE.md` |
| Prompt, modelo, cadeia de providers | `docs/07_LLM.md` |
| Variável de ambiente, deploy | `docs/09_CONFIGURATION.md` |

### 2. Consulte as decisões técnicas

`docs/12_TECHNICAL_DECISIONS.md` registra 15 decisões com contexto, alternativas
consideradas e evidência. **Se algo parece errado, provavelmente há um motivo documentado.**

Exemplo real: a geração de PDF passou por cinco abordagens antes da atual. Reintroduzir
`html2canvas` ou reativar o Playwright repetiria um erro já pago.

### 3. Verifique o histórico do arquivo

```powershell
git log --oneline -- <caminho>
git log -p -1 -- <caminho>
```

### 4. Mapeie dependências

Antes de alterar uma assinatura ou um formato de retorno, encontre todos os consumidores.

Atenção especial: os tipos em `frontend/src/lib/api.ts` são **espelho manual** da saída de
`analyzer.py` e `dashboard_planner.py`. Não há geração de schema. Mudou o backend,
`api.ts` precisa mudar no mesmo commit.

### 5. Verifique se há teste

A cobertura é baixa (17 testes, só backend). Endpoints, `dashboard_planner.py`, `cache.py`
e todo o frontend estão descobertos. Assuma que sua mudança **não** está protegida por teste.

---

## Safe Modification

### Regras invioláveis

Da lista `DO NOT BREAK` em `PROGRESS.md`. Cada uma corresponde a um bug já corrigido:

1. O LLM não calcula números — Pandas roda antes
2. Não reative `POST /export` com Playwright sem ler a decisão D9
3. Não traga `html2canvas` de volta
4. Não remova o `@media print` de `report.css`
5. Não relaxe `_looks_like_id` em `analyzer.py`
6. Não remova o `PT_BR_ENFORCE` do Groq
7. Não remova `normalizeBR` de `format.ts`
8. Não remova `_safe` de `analyzer.py`
9. Não rode o backend com múltiplos workers
10. Não pare de passar `filters` aos endpoints de LLM

### Escopo

Mudança pedida é mudança feita. Não refatore de passagem, não "limpe" código adjacente,
não renomeie o que não foi pedido. Se notar algo que merece correção, **registre** em
`docs/14_KNOWN_LIMITATIONS.md` ou em `PROGRESS.md` em vez de expandir o escopo.

### Ambiente

PowerShell 5.1: **`&&` não existe.** Use `;` ou `; if ($?) { }`.
`python main.py` não tem hot reload — reinicie o backend após alterá-lo.

---

## Validation

### Sempre

```powershell
cd backend; .\.venv\Scripts\Activate.ps1; pytest
```

Esperado: 17 testes, exit code 0.

### Conforme a área alterada

| Alterou | Valide |
|---|---|
| Perfilamento ou planner | Faça upload de uma planilha e confira KPIs e gráficos |
| Filtros | Aplique um filtro e pergunte a soma no chat — o número deve bater com o KPI |
| Cadeia de LLM | Gere insights; confirme streaming e resposta em pt-BR |
| Endpoint | Chame direto (`curl` ou `Invoke-RestMethod`) e pela interface |
| PDF | **Imprima e abra o arquivo.** Confira A4 paisagem, gráficos visíveis, nada em branco |
| Qualquer coisa visível | Veja funcionando no navegador antes de declarar pronto |

O smoke test completo (11 passos) está em `docs/10_TESTING.md`.

**Nunca declare pronto sem verificar.** Se um teste falhou, diga que falhou e mostre a saída.
Se um passo foi pulado, diga que foi pulado.

---

## Documentation Synchronization

Depois que a mudança funcionar, atualize a memória. Este passo não é opcional.

| Se você… | Atualize |
|---|---|
| Adicionou ou alterou endpoint | `docs/08_API.md` |
| Mudou o formato de `profile` ou `plan` | `docs/06_DATA_PIPELINE.md` **e** `frontend/src/lib/api.ts` |
| Mudou prompt, modelo ou cadeia | `docs/07_LLM.md` |
| Adicionou variável de ambiente | `docs/09_CONFIGURATION.md` **e** `backend/.env.example` |
| Tomou decisão de arquitetura | `docs/12_TECHNICAL_DECISIONS.md` |
| Resolveu um bug | `docs/11_TROUBLESHOOTING.md` |
| Encontrou bug e não resolveu | `docs/14_KNOWN_LIMITATIONS.md` **e** `PROGRESS.md` |
| Adicionou ou removeu arquivo | `docs/02_PROJECT_STRUCTURE.md` |
| Concluiu ou iniciou tarefa | `PROGRESS.md` |
| Fez mudança visível ao usuário | `CHANGELOG.md` |
| Mudou o processo de setup | `docs/03_SETUP.md` |

### Formato dos registros

**Decisão técnica** — use o gabarito existente: Contexto, Problema, Alternativas, Decisão
adotada, Justificativa, Impacto, Riscos, Evidência, Commit relacionado.

**Troubleshooting** — Sintoma, Causa, Diagnóstico, Solução, Validação, Observações.
Só registre problemas **realmente encontrados**. Não invente cenários.

**Limitação** — classifique: limitação confirmada, problema conhecido, dívida técnica,
funcionalidade futura, ou hipótese.

### `PROGRESS.md` é o arquivo mais importante

É o primeiro que um agente novo lê. Mantenha `LAST VALIDATED` honesto: liste o que você
realmente rodou, com o resultado real, e diga explicitamente o que **não** foi validado.

---

## Handoff

Antes de encerrar uma sessão de trabalho relevante:

- [ ] `PROGRESS.md` reflete o estado real, com `LAST VALIDATED` atualizado
- [ ] `CHANGELOG.md` tem a mudança
- [ ] Decisões novas registradas em `docs/12_TECHNICAL_DECISIONS.md`
- [ ] Bugs encontrados registrados em `docs/11_TROUBLESHOOTING.md` ou `docs/14_KNOWN_LIMITATIONS.md`
- [ ] Nada importante existe apenas no histórico da conversa
- [ ] `git status` limpo, ou as pendências explicadas ao usuário
- [ ] Commits seguem Conventional Commits, corpo em inglês

### Formato de commit

```
fix(pdf): use window.print() instead of html2canvas

html2canvas cannot render Recharts SVGs properly. Using browser native
print with existing @media print CSS produces perfect A4 landscape PDF
with all charts rendered correctly.
```

Prefixos em uso: `feat`, `fix`, `chore`, `docs`, `refactor`, `perf`.

---

## Unknown Information Handling

Quando não conseguir confirmar algo pelo código, pelo git ou pelos testes:

1. Escreva **`UNKNOWN — necessita investigação.`**
2. Para decisões sem motivo rastreável, escreva **`Motivo não confirmado.`**
3. Registre em `PROGRESS.md` sob `KNOWN ISSUES` com o marcador ❓

**Nunca invente uma justificativa plausível.** Documentação errada é pior que documentação
ausente: ela faz o próximo agente tomar decisões baseadas em falsidade, com confiança.

Exemplos reais no repositório de coisas marcadas como não confirmadas:

- Por que o boxplot substituiu o histograma (decisão D7)
- Por que `next-themes` foi trocado por um provider próprio (decisão D10)
- Causa do `CONNECT_TIMEOUT` do servidor MCP graft

---

## Security

### Nunca

- Commitar `backend/.env` ou `frontend/.env.local`
- Colar chaves de API em documentação, comentários ou mensagens de commit
- Assumir que apagar uma chave de um arquivo resolve — o histórico do git preserva o valor

### Sempre

- Usar placeholders: `GROQ_API_KEY=<sua-key>`
- Manter o `pre-commit` instalado (`detect-secrets` com baseline versionado)
- Revisar `git status` e `git diff --cached` depois de um `git add` amplo
- Ao encontrar uma chave vazada: avisar o usuário e recomendar **rotação no console do
  provider**, não só remoção do arquivo

### Contexto

O repositório é **público**. A aplicação **não tem autenticação** — `GET /files` lista os
arquivos de todos os usuários e `DELETE /files/{id}` apaga o de qualquer um. Tenha isso em
mente ao avaliar qualquer mudança que amplie a superfície exposta.
