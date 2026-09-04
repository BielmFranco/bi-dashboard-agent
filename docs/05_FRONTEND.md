# 05 — Frontend

Next.js 16.2.12, App Router, Turbopack, React 19.2.4, TypeScript, Tailwind CSS 4.

> `frontend/AGENTS.md` avisa: esta versão do Next.js tem breaking changes em relação ao
> conhecimento pré-treinado da maioria dos modelos. Antes de escrever código de framework,
> consulte `frontend/node_modules/next/dist/docs/`.

---

## Rotas

| Rota | Arquivo | Tipo | Função |
|---|---|---|---|
| `/` | `src/app/page.tsx` | Client | Upload + dashboard completo |
| `/history` | `src/app/history/page.tsx` | Client | Lista, abre e apaga análises anteriores |
| `/report/[fileId]` | `src/app/report/[fileId]/page.tsx` | Client | Layout A4 paisagem para PDF |

Não existe `app/api/`. O frontend nunca faz proxy — fala direto com o backend.

## Layout raiz

`src/app/layout.tsx`:

- Fontes `Inter` e `Geist_Mono` via `next/font/google`
- `lang="pt-BR"`, `suppressHydrationWarning`
- Script inline no `<head>` que lê `localStorage.theme` e aplica a classe `dark`
  **antes** da hidratação — evita flash de tema errado
- Envolve tudo em `ThemeProvider` e monta o `Toaster` do sonner

## Tema

`src/components/ThemeProvider.tsx` é uma implementação própria com `createContext`.
Estados: `light`, `dark`, `system`. Persiste em `localStorage["theme"]`.

**O pacote `next-themes` foi desinstalado** no commit `257f439` — não era importado por
nada. Se um agente futuro procurar por ele, não existe mais.

`useTheme()` tem fallback silencioso quando chamado fora do provider (caso da página de
relatório, que não é envolvida pelo `ThemeProvider`).

---

## Camada de API — `src/lib/api.ts`

Ponto único de contato com o backend.

```ts
const BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
```

### `request<T>()` — wrapper genérico

- Timeout padrão de 120 s via `AbortController`
- `AbortError` vira `"Timeout após Ns"`
- `TypeError` (falha de rede) vira `"Falha de rede — backend em ${BASE} não respondeu."`
- Erro HTTP tenta extrair `detail` do JSON, senão usa os primeiros 400 caracteres do texto

### Funções exportadas

| Função | Endpoint | Usada por |
|---|---|---|
| `uploadFile` | `POST /upload` | `Upload.tsx` |
| `analyze` | `POST /analyze/{id}` | `page.tsx` |
| `analyzeFiltered` | `POST /analyze/{id}/filtered` | `page.tsx` |
| `getAnalysis` | `GET /analyze/{id}` | `page.tsx` (restauração de sessão) |
| `deleteFile` | `DELETE /files/{id}` | `page.tsx`, `history/page.tsx` |
| `listFiles` | `GET /files` | `history/page.tsx` |
| `drillDown` | `POST /drill/{id}` | `DrillDownModal.tsx` |
| `insightsStream` | `POST /insights_stream/{id}` | `page.tsx` |
| `chatStream` | `POST /chat_stream/{id}` | `Chat.tsx` |
| `fetchSuggestions` | `GET` ou `POST /suggestions/{id}` | `Chat.tsx` |
| `exportPdf` | `POST /export/{id}` | **ninguém — código morto** |
| `insights` | `POST /insights/{id}` | **ninguém — código morto** |
| `chat` | `POST /chat/{id}` | **ninguém — código morto** |

`fetchSuggestions` escolhe o método pelo payload: sem filtros usa `GET`, com filtros usa
`POST` (o `GET` não aceita body).

### Tipos exportados

`FilterSpec`, `FilterMap`, `ColumnProfile`, `Profile`, `BoxplotStats`, `ChartSpec`, `KPI`,
`Plan`, `ChatMsg`, `DrillResult`, `FileEntry`.

Esses tipos são espelho manual da saída do `analyzer.py` e do `dashboard_planner.py`.
**Não há geração automática de schema** — mudar o backend exige atualizar este arquivo à mão.

### Parsing de SSE

Implementado duas vezes, quase idêntico, em `insightsStream` (linha 183) e `chatStream`
(linha 251). O algoritmo: acumula no buffer, procura `\n\n`, separa linhas `event:` e
`data:`, junta as `data:` com `\n`, despacha por tipo de evento.

Registrado como dívida técnica em [`14_KNOWN_LIMITATIONS.md`](14_KNOWN_LIMITATIONS.md).

---

## Página principal — `src/app/page.tsx`

### Estado

Todo o estado da aplicação vive em `useState` nesta página. Não há Redux, Zustand ou Context.

| Estado | Papel |
|---|---|
| `fileId`, `filename` | Identidade da análise atual |
| `profile`, `plan` | Dados **visíveis** (refletem os filtros) |
| `baseProfile`, `basePlan` | Dados **originais** (sem filtro) — usados para restaurar ao limpar filtros e para popular a `FilterBar` |
| `filters` | `FilterMap` ativo |
| `analyzing`, `filtering`, `restoring`, `exporting` | Flags de carregamento |
| `insightsText`, `insightsLoading` | Texto acumulado do stream |
| `insightsAbort` | Ref para o `AbortController` do stream |
| `drill` | `{column, value}` do drill-down aberto |
| `analyzeError` | Erro exibido em banner |

A separação `profile` / `baseProfile` é o que permite limpar filtros sem ida ao servidor.

### Ciclo de vida

```
mount
  → lê localStorage["bi-agent:last-file-id"]
  → se existe: getAnalysis(id) restaura a sessão
  → se falha: remove a chave e mostra o upload

usuário arrasta arquivo
  → Upload.handleFile → uploadFile()
  → page.handleUploaded → analyze()
  → grava localStorage
  → toast de sucesso com linhas × colunas

usuário aplica filtro
  → FilterBar.onChange → page.applyFilters()
  → se vazio: restaura baseProfile/basePlan (sem rede)
  → se não: analyzeFiltered()

usuário clica "Gerar insights"
  → runInsights() → insightsStream(fileId, onChunk, signal, filters)
  → cada chunk é concatenado em insightsText
  → "Parar" chama abort(); o texto ganha o sufixo "[interrompido pelo usuário]"

usuário clica numa barra do gráfico
  → ChartBlock.onDrill → setDrill({column, value})
  → DrillDownModal busca as linhas e permite exportar CSV

usuário clica "Baixar PDF"
  → handleExport() → window.open(`/report/${fileId}?pdf=1`)
```

### `handleExport`

```tsx
function handleExport() {
  if (!fileId || exporting) return;
  setExporting(true);
  window.open(`/report/${fileId}?pdf=1`, "_blank", "noopener,noreferrer");
  toast.success("Relatório aberto — PDF será baixado automaticamente");
  setTimeout(() => setExporting(false), 2000);
}
```

Não faz nenhuma chamada de API. Abre a aba do relatório, que se encarrega do resto.

> A mensagem do toast diz "PDF será baixado automaticamente", mas o que acontece é a
> abertura do **diálogo de impressão** do navegador. O usuário ainda precisa confirmar
> "Salvar como PDF". Divergência de texto registrada em
> [`14_KNOWN_LIMITATIONS.md`](14_KNOWN_LIMITATIONS.md).

---

## Página de relatório — `src/app/report/[fileId]/page.tsx`

Client Component. Lê:

- `fileId` da rota, via `useParams`
- `?api=` — sobrescreve a URL do backend (resíduo da era Playwright; continua funcional)
- `?pdf=1` — dispara a impressão automática

```tsx
useEffect(() => {
  if (autoPdf && data && !loading && !printTriggered.current) {
    printTriggered.current = true;
    setTimeout(() => window.print(), 1200);
  }
}, [autoPdf, data, loading]);
```

O `useRef` garante que a impressão dispare uma vez só, mesmo com re-render.
O atraso de 1200 ms cobre o mount inicial do Recharts e o carregamento das fontes.

Busca dados em `GET /report_data/{fileId}` — endpoint separado do `/analyze` porque
também devolve `insights`.

### `report.css` (504 linhas)

O arquivo que define a qualidade do PDF.

```css
@page { size: A4 landscape; margin: 0; }
```

Animações de fade-in existem **só na web** e são desligadas na impressão:

```css
@media print {
  * { transition: none !important; animation: none !important; }
  .report-doc > * { opacity: 1; animation: none !important; }
}
```

Sem esse bloco o PDF sairia em branco — os elementos começam com `opacity: 0` e só a
animação os revela. Foi exatamente esse o bug do commit `405e6eb`.

O `layout.tsx` da rota força `colorScheme: "light"` e fundo `#f8fafc`, isolando o
relatório do tema escuro do resto do app.

---

## Componentes

### Dashboard

| Componente | Responsabilidade | Detalhe |
|---|---|---|
| `Navbar` | Logo (reseta a sessão ao clicar), links, `ThemeToggle` | — |
| `Upload` | Drag-and-drop + hero da landing page | Importa `lib/api` dinamicamente para reduzir o bundle inicial |
| `KPICard` | Um KPI com animação de entrada | Formatação via `lib/format` |
| `ChartBlock` | Renderiza `bar`, `line`, `pie`, `scatter` (Recharts) e `boxplot` (SVG próprio) | Callback `onDrill` nas barras |
| `Boxplot` | SVG desenhado à mão | Recharts não tem boxplot nativo |
| `CorrelationHeatmap` | Matriz de Pearson | Só aparece com 2+ colunas numéricas |
| `ProfileSummary` | Tabela de perfil por coluna | — |
| `FilterBar` | Filtros com estado de rascunho | Ver abaixo |
| `InsightsPanel` | Markdown via `react-markdown` + `remark-gfm`; botões copiar e parar | — |
| `Chat` | Conversa com streaming e sugestões dinâmicas | Fallback estático de 4 sugestões se a API falhar |
| `DrillDownModal` | Tabela das linhas filtradas + export CSV | Escape de CSV feito à mão em `toCSV()` |

### `FilterBar` — padrão de rascunho

Mantém um `draft: FilterMap` separado do `filters` aplicado. O usuário edita o rascunho e
só ao clicar em **"Aplicar filtros"** o `onChange` dispara. Evita uma requisição por
tecla digitada.

Colunas filtráveis: `categorical`, `boolean`, `numeric`, `datetime`, `datetime_like`.
Cada tipo ganha um ícone e um rótulo em português (`Categórica`, `Numérica`, `Data`,
`Booleana`).

Redesenhado no commit `5de29af` para adicionar rótulos "De/Até", placeholders com o
intervalo real e feedback visual de alteração pendente.

### Primitivas — `src/components/ui/`

`badge`, `button`, `card`, `dialog`, `progress`, `separator`, `skeleton`, `tooltip`.
Padrão shadcn/ui: wrappers de Radix com `class-variance-authority` e o helper `cn()`
(`clsx` + `tailwind-merge`) de `lib/utils.ts`.

---

## Formatação — `src/lib/format.ts`

Três funções. A parte não óbvia:

```ts
// Node 20+ retorna U+202F (narrow no-break space) como separador de milhar em pt-BR;
// browsers/Node antigos podem devolver U+00A0 ou ".". Normaliza pra hidratacao SSR igual.
const normalizeBR = (s: string) => s.replace(/\s/g, ".");
```

Sem essa normalização, servidor e cliente formatavam `1 234` com caracteres de espaço
diferentes, causando erro de hidratação do React. Corrigido no commit `4251d65`.

- `fmtNumberBR` — `1.234,56`
- `fmtCompactBR` — `1,2 mil`, `3,4 Mi`, `5,6 Bi`
- `truncate` — corta com reticências

---

## Relação página → backend

```
page.tsx (estado)
  ↓ chama
lib/api.ts (fetch tipado)
  ↓ HTTP para NEXT_PUBLIC_API_URL
backend/main.py (endpoint)
  ↓ delega
analyzer / dashboard_planner / filters / llm
  ↓ JSON ou SSE
lib/api.ts (parse + tipagem)
  ↓ setState
componentes (render)
```

## Estados de carregamento e erro

| Situação | Tratamento |
|---|---|
| Restaurando sessão | Spinner com "Restaurando sessão anterior..." |
| Analisando | `Skeleton` no lugar dos KPIs |
| Falha na análise | Banner vermelho com a mensagem do backend |
| Falha de rede | Mensagem específica citando a URL do backend |
| Erro no stream | Anexado ao texto como `> **Erro:** ...`, mais um toast |
| Stream interrompido | Sufixo `_[interrompido pelo usuário]_` |
| Filtro sem resultado | Toast de erro vindo do 400 do backend |

## Ausências confirmadas

- Nenhum teste de frontend (sem Jest, Vitest, Playwright ou Testing Library)
- Nenhum error boundary
- Nenhum `loading.tsx` ou `error.tsx` do App Router
- Nenhum middleware
- Nenhuma internacionalização — tudo hardcoded em pt-BR
