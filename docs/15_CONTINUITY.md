# 15 — Continuidade

> "Acabei de clonar esse projeto em outro computador. O que faço agora?"

---

## Primeira inicialização

Siga em ordem. Cada passo depende do anterior.

### 1. Leia o contexto (10 minutos)

| Ordem | Arquivo | O que você aprende |
|---|---|---|
| 1 | [`CLAUDE.md`](../CLAUDE.md) | Regras operacionais, comandos, o que não quebrar |
| 2 | [`PROGRESS.md`](../PROGRESS.md) | O que funciona, o que está quebrado, qual é o próximo passo |
| 3 | [`docs/00_CONTEXT.md`](00_CONTEXT.md) | O que é o projeto, stack, fluxo principal |

Só isso já basta para responder: o que é, o que funciona, o que fazer em seguida.

### 2. Verifique o estado do git

```powershell
git log -1 --oneline
git status
git branch -a
```

Working tree limpa e `main` sincronizada com `origin/main` é o estado esperado.
Se houver alterações não commitadas, **investigue antes de qualquer coisa** — não descarte.

### 3. Configure o ambiente

Siga [`docs/03_SETUP.md`](03_SETUP.md) do passo 1 ao 9. Resumo:

```powershell
# Backend
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env     # preencher GROQ_API_KEY ou GOOGLE_API_KEY

# Frontend
cd ..\frontend
npm install
# criar .env.local com NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

### 4. Valide as variáveis

Nenhum dos dois arquivos é versionado. Confira:

- [ ] `backend/.env` existe e tem ao menos uma chave de LLM
- [ ] `frontend/.env.local` existe com `NEXT_PUBLIC_API_URL`

Detalhe de cada variável em [`docs/09_CONFIGURATION.md`](09_CONFIGURATION.md).

### 5. Suba o backend

```powershell
cd backend; .\.venv\Scripts\Activate.ps1; python main.py
```

Valide: `Invoke-RestMethod http://127.0.0.1:8000/health` → `ok: true`, `has_api_key: true`.

> Se você configurou só a `GROQ_API_KEY`, `has_api_key` virá `false` e o backend
> funcionará mesmo assim. É uma imprecisão conhecida do endpoint.

### 6. Suba o frontend

```powershell
cd frontend; npm run dev
```

Valide: <http://localhost:3000> mostra a tela de upload.

### 7. Rode os testes

```powershell
cd backend; .\.venv\Scripts\Activate.ps1; pytest
```

Esperado: 26 testes, exit code 0.

### 8. Execute o smoke test

Os 11 passos em [`docs/10_TESTING.md`](10_TESTING.md#smoke-test). Cobre upload, dashboard,
filtros, insights, chat, drill-down, PDF, persistência e histórico.

Só depois de o smoke test passar você tem certeza de que o ambiente está íntegro.

---

## Antes de modificar

**Investigue primeiro.** O código é a fonte de verdade sobre comportamento; o git é a fonte
de verdade sobre evolução.

### Checklist antes de qualquer alteração

1. **Leia a documentação da área** que vai tocar:

   | Vai mexer em | Leia |
   |---|---|
   | Endpoint ou lógica de backend | [`04_BACKEND.md`](04_BACKEND.md), [`08_API.md`](08_API.md) |
   | Componente ou página | [`05_FRONTEND.md`](05_FRONTEND.md) |
   | Perfilamento ou planner | [`06_DATA_PIPELINE.md`](06_DATA_PIPELINE.md) |
   | Prompt ou cadeia de LLM | [`07_LLM.md`](07_LLM.md) |
   | Variável de ambiente ou deploy | [`09_CONFIGURATION.md`](09_CONFIGURATION.md) |

2. **Confira `DO NOT BREAK`** em [`PROGRESS.md`](../PROGRESS.md). São dez regras derivadas
   de bugs reais. Quebrar qualquer uma reintroduz um problema conhecido.

3. **Consulte as decisões técnicas.** Se algo parece estranho, provavelmente há um motivo.
   [`12_TECHNICAL_DECISIONS.md`](12_TECHNICAL_DECISIONS.md) registra 15 decisões com contexto.

4. **Verifique o histórico do arquivo:**

   ```powershell
   git log --oneline -- <caminho/do/arquivo>
   ```

5. **Encontre quem depende do que você vai mudar.** Grep pelo símbolo antes de alterar
   assinaturas. Os tipos TypeScript em `api.ts` são espelho manual do backend — mudanças no
   `profile` precisam ser refletidas lá à mão.

### Perguntas que evitam retrabalho

- Isso já foi tentado? (Cheque `13_DEVELOPMENT_HISTORY.md` — a saga do PDF teve 5 tentativas)
- Existe teste cobrindo isso? (Provavelmente não — a cobertura é baixa)
- Isso muda o contrato entre backend e frontend? (Se sim, atualize `api.ts` junto)
- Isso quebra o PDF? (`report.css` é frágil — imprima para conferir)

---

## Depois de modificar

### Teste

```powershell
cd backend; .\.venv\Scripts\Activate.ps1; pytest
```

E rode o smoke test relevante à sua mudança. Se mexeu no PDF, **imprima e abra o arquivo**.
Se mexeu em filtros, aplique um filtro e pergunte a soma no chat.

### Verifique no navegador

O desenvolvedor deste projeto valida a interface no navegador, não por inspeção de código.
Se sua mudança é visível, veja-a funcionando antes de declarar pronto.

### Cheque o que vai commitar

```powershell
git status
git diff
```

Nunca commite `backend/.env`, `frontend/.env.local` ou qualquer arquivo com chave de API.
O hook `pre-commit` bloqueia, mas não confie só nele.

---

## Depois de testar

### Documente

| Se você… | Atualize |
|---|---|
| Adicionou ou alterou um endpoint | `docs/08_API.md` |
| Mudou o formato de `profile` ou `plan` | `docs/06_DATA_PIPELINE.md` e `frontend/src/lib/api.ts` |
| Mudou prompt, modelo ou cadeia de LLM | `docs/07_LLM.md` |
| Adicionou variável de ambiente | `docs/09_CONFIGURATION.md` e `backend/.env.example` |
| Tomou uma decisão de arquitetura | `docs/12_TECHNICAL_DECISIONS.md` |
| Encontrou e resolveu um bug | `docs/11_TROUBLESHOOTING.md` |
| Encontrou um bug e **não** resolveu | `docs/14_KNOWN_LIMITATIONS.md` e `PROGRESS.md` |
| Concluiu ou iniciou uma tarefa | `PROGRESS.md` |
| Fez qualquer mudança visível ao usuário | `CHANGELOG.md` |

### Commit

Conventional Commits, corpo em inglês (convenção do repositório):

```
fix(pdf): use window.print() instead of html2canvas

html2canvas cannot render Recharts SVGs properly. Using browser native
print with existing @media print CSS produces perfect A4 landscape PDF
with all charts rendered correctly.
```

Prefixos em uso no repositório: `feat`, `fix`, `chore`, `docs`, `refactor`, `perf`.

### Deploy

Push em `main` dispara o deploy do frontend no Vercel automaticamente.
O backend precisa ser reiniciado à mão — `python main.py` não tem hot reload.

---

## Lidando com informação desconhecida

Se você não conseguir confirmar algo pelo código, pelo git ou pelos testes:

1. **Escreva `UNKNOWN — necessita investigação.`** na documentação
2. **Não invente uma justificativa.** `12_TECHNICAL_DECISIONS.md` usa
   `Motivo não confirmado.` em dois lugares por isso
3. **Registre em `PROGRESS.md`** na seção `KNOWN ISSUES` com o marcador ❓

Documentação errada é pior que documentação ausente — a primeira faz o próximo agente
tomar decisões baseadas em falsidade.

---

## Segurança

### Nunca

- Commitar `backend/.env` ou `frontend/.env.local`
- Colar chaves de API em documentação, comentários ou mensagens de commit
- Expor o backend diretamente na internet sem proxy (o rate limit confia em
  `x-forwarded-for`)
- Rodar com múltiplos workers do Uvicorn (o cache em memória não tem lock)

### Sempre

- Manter o `pre-commit` instalado: `pre-commit install`
- Usar placeholders em exemplos: `GROQ_API_KEY=<sua-key>`
- **Rotacionar** uma chave vazada no console do provider — apagar do arquivo não basta, o
  histórico do git preserva o valor
- Revisar `git status` depois de um `git add` amplo

### Contexto de exposição

O repositório é **público**. Tudo que entra no histórico fica visível para sempre.

---

## Handoff para outro agente ou outra máquina

Antes de encerrar uma sessão de trabalho relevante:

1. `PROGRESS.md` reflete o estado real (`LAST VALIDATED` atualizado)
2. `CHANGELOG.md` tem a mudança
3. Decisões novas estão em `12_TECHNICAL_DECISIONS.md`
4. Bugs encontrados estão em `11_TROUBLESHOOTING.md` ou `14_KNOWN_LIMITATIONS.md`
5. Tudo commitado e pushado
6. Se o ambiente muda de máquina: [`03_SETUP.md`](03_SETUP.md) continua correto?

**A conversa não é memória permanente.** Se algo importante só existe no histórico do chat,
transfira para o repositório antes de terminar.

---

## Mapa rápido da documentação

| Preciso de… | Vá para |
|---|---|
| Entender o projeto em 5 minutos | [`00_CONTEXT.md`](00_CONTEXT.md) |
| Saber como as peças se encaixam | [`01_ARCHITECTURE.md`](01_ARCHITECTURE.md) |
| Achar um arquivo | [`02_PROJECT_STRUCTURE.md`](02_PROJECT_STRUCTURE.md) |
| Instalar em máquina nova | [`03_SETUP.md`](03_SETUP.md) |
| Mexer no backend | [`04_BACKEND.md`](04_BACKEND.md) |
| Mexer no frontend | [`05_FRONTEND.md`](05_FRONTEND.md) |
| Entender o processamento de dados | [`06_DATA_PIPELINE.md`](06_DATA_PIPELINE.md) |
| Mexer em IA ou prompts | [`07_LLM.md`](07_LLM.md) |
| Consumir ou alterar a API | [`08_API.md`](08_API.md) |
| Configurar variáveis ou deploy | [`09_CONFIGURATION.md`](09_CONFIGURATION.md) |
| Rodar ou escrever testes | [`10_TESTING.md`](10_TESTING.md) |
| Resolver um erro | [`11_TROUBLESHOOTING.md`](11_TROUBLESHOOTING.md) |
| Entender por que algo é assim | [`12_TECHNICAL_DECISIONS.md`](12_TECHNICAL_DECISIONS.md) |
| Ver como o projeto evoluiu | [`13_DEVELOPMENT_HISTORY.md`](13_DEVELOPMENT_HISTORY.md) |
| Saber o que não funciona | [`14_KNOWN_LIMITATIONS.md`](14_KNOWN_LIMITATIONS.md) |
| Retomar o trabalho | este arquivo |
| Saber o estado atual | [`PROGRESS.md`](../PROGRESS.md) |
| Ver o que mudou | [`CHANGELOG.md`](../CHANGELOG.md) |
| Guia narrativo de troca de máquina | [`HANDOFF_NOVO_PC.md`](HANDOFF_NOVO_PC.md) |
| Deploy em Railway e Vercel | [`DEPLOY.md`](../DEPLOY.md) |

---

# TRANSFER CHECKLIST

Estado em 2026-09-04, ao final da operação de documentação forense.

- [x] CLAUDE.md atualizado
- [x] Contexto geral documentado
- [x] Arquitetura documentada
- [x] Estrutura documentada
- [x] Setup documentado
- [x] Backend documentado
- [x] Frontend documentado
- [x] Pipeline documentado
- [x] LLM documentado
- [x] APIs documentadas
- [x] Configurações documentadas
- [x] Secrets protegidos
- [x] Testes documentados
- [x] Smoke test documentado
- [x] Troubleshooting documentado
- [x] Decisões técnicas documentadas
- [x] Histórico documentado
- [x] Limitações documentadas
- [x] PROGRESS.md atualizado
- [x] CHANGELOG.md atualizado
- [x] Skill de continuidade criada
- [x] Documentação comparada com o código
- [x] Documentação comparada com o git
- [x] Transferência simulada
