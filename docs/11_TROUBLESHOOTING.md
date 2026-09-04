# 11 — Troubleshooting

Problemas **realmente encontrados** neste projeto, reconstruídos a partir do histórico do
git, de mensagens de erro no código e de sessões de depuração registradas.

Nada aqui é hipotético. Onde a causa não pôde ser confirmada, está marcado.

---

## 1. PDF falha com timeout em `.report-doc`

### Sintoma

```
Page.wait_for_selector: Timeout 15000ms exceeded
```

Toast na interface: "Renderizando PDF em segundo plano..." seguido de erro.

### Causa

O `POST /export/{file_id}` usava Playwright para abrir `{FRONTEND_URL}/report/{file_id}`
e esperar o seletor `.report-doc`. Quando a página de relatório era um Server Component,
ela precisava de `REPORT_API_URL` apontando para a URL **atual** do túnel Cloudflare no
ambiente do Vercel. Como o túnel muda de URL a cada restart, essa variável ficava
desatualizada, a página não conseguia buscar os dados, `.report-doc` nunca era renderizado
e o Playwright estourava o timeout.

### Diagnóstico

1. Abrir manualmente `{FRONTEND_URL}/report/{file_id}` no navegador
2. Se a página mostrar "Análise não encontrada", o problema é a URL do backend
3. Conferir `NEXT_PUBLIC_API_URL` no painel do Vercel contra a URL viva do `cloudflared`

### Solução (aplicada, em quatro etapas)

| Commit | Mudança | Resultado |
|---|---|---|
| `876c47b` | Página de relatório virou Client Component usando `NEXT_PUBLIC_API_URL` | Eliminou `REPORT_API_URL`, mas o Playwright continuava dependendo da rede |
| `342fe5b` | Geração client-side com html2canvas + jsPDF | Removeu o Playwright, mas quebrou os SVGs do Recharts |
| `405e6eb` | Forçar `opacity: 1` antes da captura | Corrigiu páginas em branco, gráficos continuavam quebrados |
| `f3732e7` | **`window.print()` com o `@media print` já existente** | Solução final — o navegador renderiza SVG nativamente |

### Validação

Clicar em "Baixar PDF" → abre a aba do relatório → o diálogo de impressão aparece em ~1,2 s
→ "Salvar como PDF" produz um A4 paisagem com todos os gráficos.

### Observações

`POST /export/{file_id}` e `pdf_export.py` continuam no código, sem chamador. Se alguém
reativá-los, o mesmo modo de falha volta.

---

## 2. Backend rodando com código antigo

### Sintoma

Uma correção foi commitada e deployada, mas o comportamento não muda.

### Causa

O processo do Uvicorn foi iniciado com `python main.py`, que **não tem hot reload**.
Em um caso registrado, o backend rodou 12 horas sem reinício enquanto o código mudava.

### Diagnóstico

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
```

Se `uptime_s` for maior do que o tempo desde a última alteração no código, o processo está
desatualizado.

### Solução

`Ctrl+C` no terminal do backend e subir de novo:

```powershell
cd backend; .\.venv\Scripts\Activate.ps1; python main.py
```

Para desenvolvimento com reload automático:

```powershell
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

### Observações

O `python main.py` chama `uvicorn.run()` sem `reload=True` (`main.py:546`) — por design,
já que `reload` exige o import string em vez do objeto `app`.

---

## 3. `&&` não funciona no PowerShell

### Sintoma

```
O token '&&' não é um separador de instruções válido nesta versão.
```

### Causa

Windows PowerShell 5.1 não tem os operadores de encadeamento `&&` e `||`. Eles só existem
no PowerShell 7+.

### Solução

| Em vez de | Use |
|---|---|
| `A && B` | `A; if ($?) { B }` |
| `A; B` (incondicional) | `A; B` |
| `cd x && npm i` | `Set-Location x; npm i` |

### Observações

Este repositório também tem a ferramenta Bash disponível (Git Bash). Scripts POSIX
funcionam lá, mas `cd frontend` a partir da raiz do repositório falhou em um caso porque o
diretório de trabalho do Bash não era o esperado. Prefira caminhos absolutos.

---

## 4. PDF sai em branco

### Sintoma

O download acontece, o PDF abre, todas as páginas estão vazias.

### Causa

`report.css` aplica animação de fade-in começando em `opacity: 0`:

```css
.report-doc > * {
  opacity: 0;
  animation: reportFadeIn 500ms var(--r-ease) forwards;
}
```

Ferramentas de captura que tiram um snapshot do DOM antes da animação terminar capturam
elementos invisíveis.

### Solução

O bloco `@media print` já desliga isso:

```css
@media print {
  * { transition: none !important; animation: none !important; }
  .report-doc > * { opacity: 1; animation: none !important; }
}
```

Como o fluxo atual usa `window.print()`, esse bloco entra em vigor automaticamente.
O commit `405e6eb` fez o mesmo forçando os estilos via JavaScript, na época do html2canvas.

### Validação

Imprimir e conferir que a pré-visualização mostra conteúdo em todas as páginas.

---

## 5. Gráficos quebrados no PDF

### Sintoma

O PDF tem texto e KPIs, mas os gráficos de barra aparecem vazios e o de pizza some.

### Causa

`html2canvas-pro` não renderiza SVG do Recharts de forma confiável. O Recharts monta os
gráficos como SVG inline com elementos posicionados via atributos que a biblioteca de
captura não interpreta.

### Solução

Trocar a captura por `window.print()` (commit `f3732e7`). O motor de impressão do navegador
renderiza SVG nativamente, sem intermediário.

### Observações

`html2canvas-pro` e `jspdf` foram desinstalados no commit `257f439`. Se voltarem, o mesmo
problema volta.

---

## 6. Chat responde com números do dataset inteiro apesar do filtro

### Sintoma

O dashboard mostra 4 registros filtrados; o chat responde falando de 1.500 registros.

### Causa

Os endpoints de chat e insights recebiam o `profile` do cache — o perfil **base**, não
filtrado. O LLM não tinha como saber que o usuário estava vendo um recorte.

### Solução

Introduzidas `_profile_for_context` (`main.py:433`) e `_plan_for_context` (`main.py:351`),
que recomputam perfil e plano quando há filtros ativos. `filters.summarize_active` gera
`profile["active_filters"]`, e o `CHAT_SYSTEM` instrui o modelo a responder sobre o recorte.

Commits `a921d06` e `c0fd380`.

### Validação

Coberto por `tests/test_filters_profile.py::test_filter_in_reduces_rows`, que verifica
`sum(quantidade) == 390` no subconjunto contra `650` no total.

Manualmente: aplicar um filtro e perguntar a soma de uma coluna no chat. O número precisa
bater com o KPI exibido.

---

## 7. CORS bloqueia o frontend

### Sintoma

```
Access to fetch at '...' from origin 'https://...' has been blocked by CORS policy
```

### Causa

`FRONTEND_URL` no backend não bate exatamente com a origem do frontend.

### Diagnóstico

Comparar a origem exata do erro do navegador com o valor de `FRONTEND_URL`. Causas
frequentes: barra final, `http` em vez de `https`, domínio de preview do Vercel em vez do
de produção.

### Solução

```env
FRONTEND_URL=https://bi-agent-rosy.vercel.app
FRONTEND_URL_REGEX=^https://.*\.vercel\.app$
```

O `.rstrip("/")` em `main.py:97` já remove a barra final automaticamente. O regex cobre
todos os deploys de preview.

Reiniciar o backend após alterar.

---

## 8. Mudança de `NEXT_PUBLIC_API_URL` no Vercel não tem efeito

### Sintoma

A variável foi atualizada no painel, mas o site continua chamando a URL antiga.

### Causa

`NEXT_PUBLIC_*` é inlinada no bundle durante o `next build`. Salvar a variável não
reconstrói nada.

### Solução

Vercel → Deployments → último deploy → **Redeploy**.

Em desenvolvimento: reiniciar o `npm run dev`.

### Observações

Este é o problema recorrente número um do projeto, porque a URL do túnel Cloudflare muda a
cada restart. Um *named tunnel* eliminaria a causa raiz.

---

## 9. URL do túnel Cloudflare muda a cada restart

### Sintoma

Depois de reiniciar o `cloudflared`, o frontend em produção para de funcionar.

### Causa

`cloudflared tunnel --url http://localhost:8000` cria um túnel efêmero com hostname
aleatório em `trycloudflare.com`.

### Solução atual (manual)

1. Copiar a nova URL impressa pelo `cloudflared`
2. Atualizar `NEXT_PUBLIC_API_URL` no Vercel
3. **Redeploy**

### Solução definitiva (não implementada)

Um *named tunnel* do Cloudflare, com hostname fixo, sobrevive a restarts. Está na lista de
pendências desde o `HANDOFF_NOVO_PC.md`.

---

## 10. `has_api_key: false` no `/health`

### Sintoma

O backend sobe, mas `/health` reporta `has_api_key: false` e os endpoints de LLM dão 500.

### Causa

`backend/.env` não existe, está no diretório errado, ou não contém `GOOGLE_API_KEY`
nem `GEMINI_API_KEY`.

### Diagnóstico

Conferir se o caminho é exatamente `backend/.env`. O `load_dotenv()` resolve a partir do
diretório de trabalho, que precisa ser `backend/`.

### Solução

```powershell
cd backend
Copy-Item .env.example .env
notepad .env   # preencher GOOGLE_API_KEY ou GROQ_API_KEY
```

Não precisa reiniciar o backend — `load_dotenv(override=True)` é chamado a cada request de LLM.

### Observações importantes

**`has_api_key` só verifica as chaves do Gemini.** Um backend rodando apenas com
`GROQ_API_KEY` reporta `false` e funciona perfeitamente. É uma imprecisão do endpoint,
não um erro de configuração.

---

## 11. Frontend mostra "Falha de rede"

### Sintoma

> Falha de rede — backend em http://127.0.0.1:8000 não respondeu. Confira se o servidor está rodando.

### Causa

Mensagem gerada por `api.ts:36` quando o `fetch` levanta `TypeError`. Significa que o
backend não está acessível na URL configurada.

### Diagnóstico

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
```

Compare a URL da mensagem com o valor real de `NEXT_PUBLIC_API_URL`.

### Solução

- Backend fora do ar → subir
- Porta ocupada → `Get-Process python | Stop-Process -Force` e subir de novo
- URL errada → corrigir `.env.local` **e reiniciar o `npm run dev`**

---

## 12. Erro de hidratação com números em pt-BR

### Sintoma

```
Text content does not match server-rendered HTML
```

Em valores numéricos formatados.

### Causa

`Number.toLocaleString("pt-BR")` usa separadores de milhar diferentes conforme a versão do
runtime: Node 20+ devolve U+202F (narrow no-break space), navegadores mais antigos devolvem
U+00A0 ou `.`. Servidor e cliente geravam strings distintas.

### Solução

`frontend/src/lib/format.ts`:

```ts
const normalizeBR = (s: string) => s.replace(/\s/g, ".");
```

Normaliza qualquer caractere de espaço para ponto. Commit `4251d65`.

---

## 13. `JSON serializable` falha com `NaN`

### Sintoma

500 no `/analyze` com erro de serialização.

### Causa

O Pandas devolve `NaN` para valores ausentes; `json.dumps` não serializa `NaN` como JSON
válido.

### Solução

`analyzer._safe` (`analyzer.py:26`) converte `NaN` e `inf` em `None`, além de normalizar
tipos NumPy. Aplicado em `_clean_records`, nos perfis de coluna e no endpoint `/drill`.
Commit `d7706a9`.

---

## 14. Coluna numérica desaparece dos KPIs e gráficos

### Sintoma

Uma coluna importante (idade, salário, custo) não aparece em nenhum KPI nem gráfico.

### Causa

Foi classificada como `id` por `analyzer._looks_like_id`, e colunas `id` são excluídas do
planner.

### Diagnóstico

Inspecionar `profile.columns` e conferir o campo `semantic` da coluna.

### Solução

A heurística **exige que o nome case** com um token de `_ID_NAME_HINTS`
(`id, codigo, cod, matricula, cpf, cnpj, registro`). Renomear a coluna na planilha resolve.

Commit `256b03d` tornou a regra conservadora exatamente por causa de falsos positivos —
antes, cardinalidade alta sozinha bastava para classificar como ID.

---

## 15. CSV carregado como coluna única

### Sintoma

O perfil mostra `cols: 1` e todo o conteúdo em uma coluna só.

### Causa

Nenhuma combinação de encoding × separador produziu mais de uma coluna. Separador exótico
(`^`, `~`) ou arquivo genuinamente unicolunar.

### Solução

`load_dataframe` tenta `,` `;` `\t` `|` × `utf-8` `latin-1` `cp1252`. Fora disso, converta
o arquivo para um separador suportado antes do upload.

Commit `256b03d` adicionou o fallback que aceita um resultado unicolunar em vez de levantar
erro, já que existem CSVs legitimamente com uma coluna.

---

## 16. `Activate.ps1` bloqueado

### Sintoma

```
Activate.ps1 cannot be loaded because running scripts is disabled on this system.
```

### Solução

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

Escopo `CurrentUser` não requer privilégios de administrador.

---

## 17. `playwright install chromium` falha

### Sintoma

O download do Chromium falha ou trava.

### Causa

Firewall corporativo ou VPN bloqueando o CDN do Playwright.

### Solução

Desligar a VPN e tentar de novo. **Ou simplesmente pular:** nada do fluxo principal da
aplicação depende do Chromium. Ele só é necessário para `POST /export/{file_id}`
(sem uso) e para `docs/capture_screenshots.py`.

---

## 18. pre-commit bloqueia por "secret detected"

### Sintoma

O commit é rejeitado pelo hook `detect-secrets`.

### Diagnóstico

**Primeiro verifique se é mesmo um segredo.** Se for uma chave real, remova-a do arquivo e
**rotacione no console do provider** — o histórico do git preserva o valor mesmo depois de
apagado.

### Solução para falso positivo

```powershell
detect-secrets scan --update .secrets.baseline
git add .secrets.baseline
```

---

## 19. Servidor MCP graft falha ao conectar

### Sintoma

```
graft (CONNECT_TIMEOUT): "MCP server graft connection timed out after 30000ms"
```

### Causa

`UNKNOWN — necessita investigação.` O `.mcp.json` invoca `npx -y @nanonets/graft mcp`.
Falha possivelmente ligada a rede, a um `npx` sem cache, ou ao pacote não instalado.

### Impacto

Nenhum sobre a aplicação. Apenas as ferramentas `graft_*` do Claude Code ficam
indisponíveis; leitura de arquivos e busca continuam funcionando normalmente.

### Contorno

```powershell
npm install -g @nanonets/graft
graft build
```

Depois reiniciar a sessão do Claude Code.

---

## 20. Rate limit dispara durante o desenvolvimento

### Sintoma

HTTP 429 em uso normal.

### Causa

Limites baixos por endpoint: 5/min no `/export`, 10/min nos endpoints de LLM.

### Solução

Aguardar a janela de um minuto, ou reduzir `LLM_MAX_RETRIES=1` no `.env` para diminuir a
amplificação de chamadas por retry.

Para desenvolvimento pesado, os decoradores `@limiter.limit(...)` podem ser afrouxados em
`main.py` — mas **não commite** esse afrouxamento.
