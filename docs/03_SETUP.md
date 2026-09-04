# 03 — Setup de Máquina Nova

Objetivo: sair de uma máquina limpa até backend, frontend e testes rodando.

Todos os comandos abaixo foram escritos para **PowerShell no Windows**, que é o ambiente
de desenvolvimento confirmado. Equivalentes para Linux/macOS estão marcados onde diferem.

Um guia mais narrativo, com contexto de decisões, existe em
[`HANDOFF_NOVO_PC.md`](HANDOFF_NOVO_PC.md). Este documento é a versão executável.

---

## 0. Versões confirmadas

Verificadas na máquina de desenvolvimento em 2026-09-04:

| Ferramenta | Versão em uso | Mínimo recomendado |
|---|---|---|
| Python | 3.14.3 | 3.12 |
| Node.js | 24.19.0 | 20 (LTS) |
| npm | 11.17.0 | 10 |
| Git | 2.55.0.windows.5 | qualquer |
| GitHub CLI | 2.98.0 | 2 |
| cloudflared | 2026.8.2 | qualquer |

Sistema operacional confirmado: **Windows 10 Pro 10.0.19045**.

---

## 1. Pré-requisitos

```powershell
winget install --id Python.Python.3.12
winget install --id OpenJS.NodeJS.LTS
winget install --id Git.Git
winget install --id GitHub.cli
winget install --id Cloudflare.cloudflared
```

> A máquina de referência roda Python **3.14.3** e a suíte passa nela. O comando acima
> instala 3.12 por ser a versão mais conservadora que o projeto suporta. Qualquer versão
> entre 3.12 e 3.14 funciona — `requirements.txt` usa pins mínimos (`>=`) em numpy, pandas
> e scipy exatamente para permitir wheels mais novas.

**Validação:**

```powershell
python --version; node --version; npm --version; git --version; gh --version; cloudflared --version
```

**Resultado esperado:** cada comando imprime uma versão, nenhum erro.

**Erro comum:** `python` não é reconhecido → o instalador não marcou "Add to PATH".
**Solução:** reinstalar marcando a opção, ou adicionar manualmente ao PATH.

---

## 2. Autenticação no GitHub

```powershell
gh auth login
```

Escolha: `GitHub.com` → `HTTPS` → `Yes` (credenciais git) → login pelo navegador.

**Validação:**

```powershell
gh auth status
```

**Resultado esperado:** `Logged in to github.com account BielmFranco`.

Identidade do git, se ainda não configurada:

```powershell
git config --global user.name "Gabriel Moraes Franco"
git config --global user.email "gabrielmoraesprincipe@gmail.com"
```

---

## 3. Clonar o repositório

```powershell
cd $HOME\Documents\GitHub
gh repo clone BielmFranco/bi-dashboard-agent
cd bi-dashboard-agent
```

**Validação:**

```powershell
git log -1 --oneline; git status
```

**Resultado esperado:** um commit recente na branch `main`, working tree limpa.

---

## 4. Backend — ambiente virtual e dependências

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

**Diretório:** `backend/`
**Objetivo:** instalar FastAPI, Pandas, os SDKs de LLM, slowapi, Playwright e pytest.
**Resultado esperado:** `Successfully installed ...` sem erro de compilação.

**Erro comum:** `Activate.ps1 cannot be loaded because running scripts is disabled`.
**Solução:**

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

**Erro comum:** falha ao compilar `numpy` ou `scipy` em Python muito novo.
**Solução:** `requirements.txt` usa pins mínimos (`>=`) justamente para permitir wheels
mais novas. Se falhar mesmo assim, use Python 3.12.

### 4.1 Chromium do Playwright (opcional)

Necessário **apenas** para o endpoint legado `POST /export/{file_id}` e para
`docs/capture_screenshots.py`. O fluxo de PDF usado hoje pela interface **não precisa disso**.

```powershell
playwright install chromium
```

**Erro comum:** download bloqueado por firewall/proxy.
**Solução:** desligar VPN, ou pular — nada do fluxo principal quebra sem o Chromium.

---

## 5. Backend — variáveis de ambiente

O arquivo `backend/.env` **não é versionado** e precisa ser recriado.

```powershell
Copy-Item .env.example .env
notepad .env
```

Preencha ao menos uma das duas chaves:

```env
GROQ_API_KEY=<sua-key-groq>
GOOGLE_API_KEY=<sua-key-google-ai-studio>
```

- Groq (provider primário, gratuito): <https://console.groq.com/keys>
- Google AI Studio (fallback, free tier 1500 req/dia): <https://aistudio.google.com/apikey>

Sem nenhuma das duas o backend sobe normalmente, mas todo endpoint de LLM
(`/insights`, `/chat`, `/suggestions`) retorna HTTP 500.

Lista completa de variáveis em [`09_CONFIGURATION.md`](09_CONFIGURATION.md).

> **Segurança:** nunca commite `backend/.env`. O `.gitignore` já cobre, e o hook
> `detect-secrets` bloqueia commits com chaves reais.

---

## 6. Backend — rodar

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python main.py
```

**Resultado esperado:** log `Uvicorn running on http://127.0.0.1:8000`.

**Validação (em outra janela):**

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
```

**Resultado esperado:** objeto com `ok: True` e `has_api_key: True`.

**Erro comum:** `has_api_key: False`.
**Causa:** `.env` ausente, ou salvo fora de `backend/`.
**Solução:** confirme que o caminho é exatamente `backend/.env`.

**Erro comum:** `[WinError 10048] address already in use`.
**Solução:**

```powershell
Get-Process python | Stop-Process -Force
```

---

## 7. Frontend — dependências

```powershell
cd frontend
npm install
```

**Resultado esperado:** `added N packages`. Avisos de peer dependency do
`@napi-rs/wasm-runtime` são conhecidos e inofensivos.

---

## 8. Frontend — variáveis de ambiente

Crie `frontend/.env.local` (não versionado):

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

Só isso. `REPORT_API_URL` aparece em documentação antiga mas **não é mais lida por
nenhum arquivo** — confirmado por busca em `frontend/src/`.

---

## 9. Frontend — rodar

```powershell
cd frontend
npm run dev
```

**Resultado esperado:** `Ready in ...`, servindo em <http://localhost:3000> com Turbopack.

**Validação:** abrir <http://localhost:3000>, arrastar uma planilha, ver KPIs aparecerem.

**Erro comum:** interface mostra "Falha de rede — backend em ... não respondeu".
**Causa:** backend não está no ar, ou `NEXT_PUBLIC_API_URL` aponta para o lugar errado.
**Solução:** confira o `/health` do backend e o conteúdo de `.env.local`. Após alterar
`.env.local`, **reinicie o `npm run dev`** — a variável é lida no build.

---

## 10. Testes

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
pytest
```

**Resultado esperado (validado em 2026-09-04):**

```
.................                                                        [100%]
```

26 testes, exit code 0. Um `DeprecationWarning` vindo de `google/genai/types.py` é
esperado no Python 3.14 e não indica falha.

Detalhes e smoke test manual em [`10_TESTING.md`](10_TESTING.md).

---

## 11. Túnel Cloudflare (só para testar o deploy do Vercel)

```powershell
cloudflared tunnel --url http://localhost:8000
```

Imprime uma URL do tipo `https://xxx-yyy-zzz.trycloudflare.com`.

Para conectar o frontend no Vercel a esse backend:

1. <https://vercel.com/dashboard> → projeto `bi-agent` → Settings → Environment Variables
2. Definir `NEXT_PUBLIC_API_URL` com a URL do túnel
3. Deployments → último → **Redeploy**

> O redeploy é obrigatório. `NEXT_PUBLIC_API_URL` entra no bundle em tempo de build;
> salvar a variável sozinha não muda nada no site já publicado.

**Limitação conhecida:** a URL muda a cada restart do `cloudflared`. Um *named tunnel*
resolveria, mas ainda não foi configurado.

---

## 12. pre-commit (recomendado)

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
pip install pre-commit detect-secrets
cd ..
pre-commit install
```

**Resultado esperado:** `pre-commit installed at .git/hooks/pre-commit`.

Passa a rodar em todo `git commit`, bloqueando secrets acidentais.

**Erro comum:** falso positivo de secret.
**Solução:** `detect-secrets scan --update .secrets.baseline` e commitar o baseline.

---

## 13. graft (opcional — só para Claude Code)

```powershell
npm install -g @nanonets/graft
cd C:\Users\<user>\...\bi-dashboard-agent
graft build
```

A skill já está versionada em `.claude/skills/graft/SKILL.md`. O `graft build` regenera
o cache local em `graft/`, que é gitignored.

**Nota observada:** o servidor MCP `graft` pode falhar com `CONNECT_TIMEOUT` na
inicialização da sessão. Isso não impede nada — é só a busca por code-graph que fica
indisponível; as ferramentas normais de leitura e busca continuam funcionando.

---

## 14. Checklist de ambiente rodando

Três terminais:

**Terminal 1 — backend**
```powershell
cd backend; .\.venv\Scripts\Activate.ps1; python main.py
```

**Terminal 2 — frontend**
```powershell
cd frontend; npm run dev
```

**Terminal 3 — túnel (opcional)**
```powershell
cloudflared tunnel --url http://localhost:8000
```

Verificar:

- Backend: <http://127.0.0.1:8000/health> → `ok: true`
- Frontend: <http://localhost:3000> → tela de upload
- Túnel: URL impressa pelo cloudflared

---

## 15. Desligar o ambiente

`Ctrl+C` em cada terminal. Se algum processo ficar preso:

```powershell
Get-Process python | Stop-Process -Force
Get-Process node | Stop-Process -Force
Get-Process cloudflared | Stop-Process -Force
```

> **Atenção:** esses comandos matam **todos** os processos Python/Node da máquina,
> não só os deste projeto. Se houver outro trabalho em andamento, feche os terminais
> individualmente em vez de usar `Stop-Process`.
