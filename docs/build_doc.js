// Gera Documentacao_Tecnica_BI_Agent.docx seguindo template das 38 secoes.
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle,
  PageBreak, PageOrientation, LevelFormat, convertInchesToTwip
} = require('docx');

// ---------- helpers ----------
const COLOR_PRIMARY = '4F46E5';
const COLOR_TEXT = '1F2937';
const COLOR_MUTED = '6B7280';
const COLOR_BORDER = 'E5E7EB';

const H1 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 },
  children: [new TextRun({ text, bold: true, size: 32, color: COLOR_PRIMARY })],
});
const H2 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 },
  children: [new TextRun({ text, bold: true, size: 26, color: COLOR_TEXT })],
});
const H3 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 100 },
  children: [new TextRun({ text, bold: true, size: 22, color: COLOR_TEXT })],
});
const P = (text, opts = {}) => new Paragraph({
  spacing: { before: 60, after: 60 },
  children: [new TextRun({ text, size: 20, color: COLOR_TEXT, ...opts })],
});
const Mono = (text) => new Paragraph({
  spacing: { before: 60, after: 60 },
  children: [new TextRun({ text, font: 'Consolas', size: 18, color: COLOR_TEXT })],
});
const Bullet = (text, level = 0) => new Paragraph({
  numbering: { reference: 'bullets', level },
  spacing: { before: 40, after: 40 },
  children: [new TextRun({ text, size: 20, color: COLOR_TEXT })],
});
const Callout = (label, text) => new Paragraph({
  spacing: { before: 100, after: 100 },
  border: { left: { style: BorderStyle.SINGLE, size: 12, color: COLOR_PRIMARY, space: 8 } },
  indent: { left: 200 },
  children: [
    new TextRun({ text: label + ': ', bold: true, size: 20, color: COLOR_PRIMARY }),
    new TextRun({ text, size: 20, color: COLOR_TEXT }),
  ],
});
const Space = () => new Paragraph({ children: [new TextRun('')] });

// table helper with fixed columnWidths (DXA)
function T(headers, rows, colWidths) {
  const total = colWidths.reduce((a, b) => a + b, 0);
  const headerCells = headers.map((h, i) => new TableCell({
    width: { size: colWidths[i], type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F3F4F6' },
    children: [new Paragraph({
      children: [new TextRun({ text: h, bold: true, size: 18, color: COLOR_TEXT })],
    })],
  }));
  const bodyRows = rows.map((r) => new TableRow({
    children: r.map((cell, i) => new TableCell({
      width: { size: colWidths[i], type: WidthType.DXA },
      children: [new Paragraph({
        children: [new TextRun({ text: String(cell), size: 18, color: COLOR_TEXT })],
      })],
    })),
  }));
  return new Table({
    columnWidths: colWidths,
    width: { size: total, type: WidthType.DXA },
    rows: [new TableRow({ children: headerCells, tableHeader: true }), ...bodyRows],
  });
}

// ---------- content ----------
const doc = new Document({
  creator: 'BI Dashboard Agent',
  title: 'Documentacao Tecnica — BI Dashboard Agent',
  styles: {
    default: {
      document: { run: { font: 'Calibri', size: 20 } },
    },
  },
  numbering: {
    config: [{
      reference: 'bullets',
      levels: [
        { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 360, hanging: 260 } } } },
        { level: 1, format: LevelFormat.BULLET, text: '◦', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 260 } } } },
      ],
    }],
  },
  sections: [{
    properties: { page: { margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 } } },
    children: buildContent(),
  }],
});

function buildContent() {
  const c = [];

  // ===================== CAPA =====================
  c.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 2400, after: 200 },
    children: [new TextRun({ text: 'DOCUMENTAÇÃO TÉCNICA', bold: true, size: 24, color: COLOR_MUTED })],
  }));
  c.push(new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { before: 200, after: 200 },
    children: [new TextRun({ text: 'BI Dashboard Agent', bold: true, size: 56, color: COLOR_PRIMARY })],
  }));
  c.push(new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { before: 100, after: 800 },
    children: [new TextRun({ text: 'Da planilha ao insight em segundos', italics: true, size: 22, color: COLOR_MUTED })],
  }));
  c.push(new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { before: 200, after: 100 },
    children: [new TextRun({ text: 'Autor: Gabriel Franco (@BielmFranco)', size: 20, color: COLOR_TEXT })],
  }));
  c.push(new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { before: 40, after: 40 },
    children: [new TextRun({ text: 'Repositório: github.com/BielmFranco/bi-dashboard-agent (privado)', size: 20, color: COLOR_TEXT })],
  }));
  c.push(new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { before: 40, after: 40 },
    children: [new TextRun({ text: 'Período analisado: 28/07/2026 → 11/08/2026', size: 20, color: COLOR_TEXT })],
  }));
  c.push(new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { before: 40, after: 40 },
    children: [new TextRun({ text: 'Versão do documento: 1.0 · Emitido em 12/08/2026', size: 20, color: COLOR_TEXT })],
  }));
  c.push(new Paragraph({ children: [new PageBreak()] }));

  // ===================== RESUMO EXECUTIVO =====================
  c.push(H1('Resumo Executivo'));
  c.push(P('BI Dashboard Agent é uma aplicação web que transforma planilhas Excel/CSV em dashboards profissionais completos com KPIs, gráficos interativos, heatmap de correlação, boxplot, drill-down e análise estratégica gerada por IA (Google Gemini). O usuário faz upload de um arquivo e recebe, em segundos, um dashboard tipo Power BI simplificado — sem precisar configurar nada.'));
  c.push(P('O projeto foi construído em 15 dias corridos (28/07 a 11/08/2026) totalizando 31 commits em main, evoluindo de scaffold inicial até deploy híbrido em produção (frontend Vercel + backend local via Cloudflare Tunnel).'));
  c.push(H3('Números do projeto'));
  c.push(T(
    ['Métrica', 'Valor'],
    [
      ['Commits', '31'],
      ['Endpoints backend', '15'],
      ['Linhas Python (backend)', '1.343'],
      ['Linhas TypeScript/TSX (frontend)', '~3.700'],
      ['Componentes React', '~30'],
      ['Módulos Python', '8'],
      ['Duração do projeto', '15 dias (28/07 a 11/08)'],
      ['Custo mensal (infra)', 'R$ 0 (free tiers) + ~R$ 15 (eletricidade)'],
    ],
    [3600, 5400],
  ));
  c.push(Space());
  c.push(H3('Estado atual'));
  c.push(Bullet('Frontend em produção: https://bi-agent-rosy.vercel.app'));
  c.push(Bullet('Backend em produção via Cloudflare Tunnel (URL descartável no free tier)'));
  c.push(Bullet('Upload, análise, KPIs, charts, heatmap, boxplot, filtros, drill-down, insights streaming, chat streaming, sugestões dinâmicas, export PDF, histórico multi-file — tudo funcionando'));
  c.push(Bullet('Sem autenticação, sem rate limit, sem TTL de cache — pendências conhecidas'));
  c.push(new Paragraph({ children: [new PageBreak()] }));

  // ===================== 1. VISÃO GERAL =====================
  c.push(H1('1. Identificação Geral do Projeto'));
  c.push(H3('Nome'));
  c.push(P('BI Dashboard Agent'));
  c.push(H3('Descrição'));
  c.push(P('Aplicação web full-stack que analisa arquivos tabulares (xlsx, xls, xlsm, csv, tsv) e produz automaticamente um dashboard de Business Intelligence completo, com interpretação em linguagem natural via LLM.'));
  c.push(H3('Objetivo'));
  c.push(P('Reduzir a barreira de entrada de análise de dados. Usuários não-técnicos (analistas de negócio, gestores, empreendedores) obtêm em segundos o que exigiria horas em Power BI ou Excel avançado.'));
  c.push(H3('Público-alvo'));
  c.push(Bullet('Analistas de negócio que precisam de análise exploratória rápida'));
  c.push(Bullet('Gestores que recebem planilhas e querem visão consolidada instantânea'));
  c.push(Bullet('Desenvolvedores/consultores como ferramenta de portfolio/demo'));
  c.push(Bullet('Estudantes de Data Analytics/BI'));
  c.push(H3('Contexto'));
  c.push(P('O projeto nasceu como um agente especialista em BI (Business Intelligence, Ciência de Dados, Estatística e Visualização) inspirado em padrões Power BI, mas com interface moderna estilo SaaS (Stripe, Linear, Vercel, Notion). A motivação foi criar uma ferramenta que combinasse análise determinística (Pandas, regras estatísticas) com interpretação inteligente (LLM) sem alucinações — todos os números vêm do processamento local, e a IA apenas contextualiza.'));
  c.push(H3('Status atual'));
  c.push(Callout('Classificação', 'MVP em produção (deploy híbrido). Todas as features planejadas para os primeiros 3 sprints estão implementadas e funcionando end-to-end. Falta hardening (auth, rate limit, migração backend para cloud dedicada) para produção multi-usuário séria.'));

  // ===================== 2. HISTÓRIA =====================
  c.push(new Paragraph({ children: [new PageBreak()] }));
  c.push(H1('2. História do Projeto'));
  c.push(P('Reconstruído a partir do histórico Git completo (31 commits, branch main, sem tags).'));
  c.push(H3('Linha do tempo'));
  c.push(T(
    ['Data', 'Evento', 'Impacto'],
    [
      ['28/07/2026', 'Scaffold inicial (commit d1b1e1a). FastAPI + Pandas + Next.js 16 + Anthropic Claude', 'Base do projeto criada'],
      ['28/07/2026', 'Migração Anthropic → Google Gemini (3813010). Motivo: conta Anthropic sem créditos.', 'Redução de custo, free tier viável'],
      ['29/07/2026', 'Pacote 1 (d2c8156): detecção de colunas ID, format pt-BR, truncate labels', 'Precisão semântica dos KPIs'],
      ['29/07/2026', 'Pacote 2 (db94785): SSE streaming para insights', 'UX real-time, percepção de velocidade'],
      ['29/07/2026', 'Pacote 3 (a729a4e): cache em disco JSON + restore de sessão via localStorage', 'Persistência entre restarts do backend'],
      ['29/07/2026', 'Redesign UI premium (a489d5d): shadcn/ui, next-themes, framer-motion, sonner, hero upload', 'Salto visual — de dev-quality para SaaS-quality'],
      ['03/08/2026', 'Fixes em analyzer.py (0e9b6ae, 256b03d): parse datas BR, single-column loader, heurística ID mais rigorosa', 'Robustez em edge cases reais'],
      ['03/08/2026', 'Feature reset via logo (7bc8380)', 'UX menor mas essencial'],
      ['03/08/2026', 'Fix crítico Gemini 2.5 thinking tokens (58c1612): max_tokens 3000 → 8000', 'Resolveu insights truncados no meio'],
      ['03/08/2026', 'PDF export via Playwright (f99904d): rota /report/[fileId] + Chromium headless', 'Feature core: download de relatório'],
      ['03/08/2026', 'Report page premium redesign (4af7e02)', 'Layout dedicado para PDF (diferente do dashboard)'],
      ['03/08/2026', 'A4 landscape (0507164)', 'Melhor uso do espaço horizontal'],
      ['04/08/2026', '5 iterações consecutivas de fix no report/PDF (82f402b, 515d5d6, 9653ec5, 1845cc1, a851664)', 'Polimento até layout aceitável'],
      ['04/08/2026', 'Perfil compact + KPIs alinhados (5c1e263, 1c0f8f7)', 'Sem overflow, tabela cabe em 4 colunas'],
      ['04/08/2026', 'Identidade SaaS warm cream (6fdc978)', 'Nova paleta neutra inspirada em referência do usuário'],
      ['10/08/2026', 'Chat streaming + cancel + sugestões dinâmicas + heatmap + histórico (6686f2b)', 'Sprint completa de features de valor'],
      ['10/08/2026', 'Deploy files: Dockerfile, railway.json, vercel.json, DEPLOY.md (a9dae16)', 'Pronto para deploy'],
      ['10/08/2026', 'Fix hydration (d067b49): motion.button → div[role=button]', 'React 19 mais estrito com HTML válido'],
      ['11/08/2026', 'Sprint 2: filtros, boxplot, drill-down (14a35eb)', 'Features tipo Power BI'],
      ['11/08/2026', 'Remove cloudflared.exe do repo (b7ace32)', 'Repo limpo — 51MB'],
    ],
    [1500, 4200, 3300],
  ));

  // ===================== 3. EVOLUÇÃO POR FASES =====================
  c.push(new Paragraph({ children: [new PageBreak()] }));
  c.push(H1('3. Evolução por Fases'));

  c.push(H2('Fase 1 — Scaffold + integração inicial (28/07)'));
  c.push(P('Estrutura inicial com FastAPI + Pandas + Next.js 16 + Anthropic Claude. Endpoints básicos (upload, analyze, insights, chat). Frontend com KPIs, charts (Recharts) e chat.'));
  c.push(Callout('Tecnologia inicial', 'Anthropic Claude Haiku 4.5 para análise. Migrado no mesmo dia para Google Gemini após problemas de crédito.'));

  c.push(H2('Fase 2 — Refinamento analítico (29/07)'));
  c.push(P('Três pacotes rápidos que consolidaram qualidade do output:'));
  c.push(Bullet('Detecção semântica de colunas (numeric/id/categorical/datetime/empty)'));
  c.push(Bullet('SSE streaming (Gemini) para insights aparecem em tempo real'));
  c.push(Bullet('Cache disco JSON — sessões sobrevivem restart do backend'));

  c.push(H2('Fase 3 — Redesign UI premium (29/07)'));
  c.push(P('Grande refatoração visual: adotado shadcn/ui + Radix primitives, framer-motion animations, next-themes com dark/light toggle, sonner toasts, hero upload style Vercel. Transformou o app de dev-quality em SaaS-quality.'));

  c.push(H2('Fase 4 — Robustez em edge cases (03/08)'));
  c.push(P('Bug hunting em casos reais: parse de datas brasileiras (dd/mm/yyyy), CSVs com 1 única coluna que quebravam o loader, heurística de ID falsamente marcando salários/idades. Também descoberto bug crítico: Gemini 2.5 usa até 2.500 tokens em "thinking" invisível — insights vinham truncados sem explicação. Fix: max_tokens 3000 → 8000.'));

  c.push(H2('Fase 5 — PDF export via Playwright (03-04/08)'));
  c.push(P('Feature grande: gerar relatório PDF do dashboard. Solução: rota /report/[fileId] no Next.js com layout print-friendly + backend usa Playwright headless Chromium para renderizar essa rota e capturar como PDF. Grande vantagem: reutiliza componentes React em vez de gerar PDF do zero (matplotlib/reportlab). Passou por 6+ iterações de layout (portrait → landscape → compact grid → warm cream identity).'));

  c.push(H2('Fase 6 — Features avançadas (10/08)'));
  c.push(P('Sprint compacta: chat também streaming, cancelamento de geração via AbortController, sugestões de perguntas geradas dinamicamente pelo Gemini, heatmap de correlação Pearson visual, página /history multi-file para restaurar análises antigas.'));

  c.push(H2('Fase 7 — Deploy híbrido (10-11/08)'));
  c.push(P('Tentativa inicial: Railway (backend Docker) + Vercel (frontend). Railway falhou em build por não pegar Root Directory. Migrou para arquitetura híbrida: Vercel para frontend estático + Cloudflare Tunnel expondo backend do PC local. Zero custo mensal, mantém Playwright funcionando (sem limite de CPU/RAM de plano free).'));

  c.push(H2('Fase 8 — Sprint 2: BI real (11/08)'));
  c.push(P('Features tipo Power BI implementadas em uma única sessão:'));
  c.push(Bullet('Filtros funcionais (slicers): usuário seleciona valores → KPIs/charts/heatmap recalculam'));
  c.push(Bullet('Boxplot substitui histograma — visualização estatística superior para outliers'));
  c.push(Bullet('Drill-down: click em barra abre modal com rows filtradas + export CSV'));

  // ===================== 4. ARQUITETURA =====================
  c.push(new Paragraph({ children: [new PageBreak()] }));
  c.push(H1('4. Arquitetura do Sistema'));
  c.push(H3('Visão em camadas'));
  c.push(Mono([
    'Usuário (browser)',
    '   ↓ HTTPS',
    'Vercel Edge (Next.js 16 SSR/static)',
    '   ↓ NEXT_PUBLIC_API_URL',
    'Cloudflare Tunnel (proxy encrypted)',
    '   ↓ QUIC/HTTP2',
    'cloudflared (processo local no PC)',
    '   ↓ HTTP loopback',
    'FastAPI (backend Python, localhost:8000)',
    '   ├── analyzer.py    → Pandas profiling',
    '   ├── dashboard_planner.py → Rules KPIs/charts',
    '   ├── filters.py     → Aplica filtros',
    '   ├── llm.py         → Google Gemini SDK',
    '   ├── pdf_export.py  → Playwright headless',
    '   └── cache.py       → JSON persistente disco',
  ].join('\n')));
  c.push(H3('Fluxo principal de dados'));
  c.push(Bullet('Upload → salva bytes em uploads/{uuid}.ext + metadata em cache/{uuid}.json'));
  c.push(Bullet('Analyze → load_dataframe → profile_dataframe (semantic types + stats + correlação) → build_plan (KPIs + charts)'));
  c.push(Bullet('Insights → llm.generate_insights_stream (SSE) → Gemini interpreta perfil calculado'));
  c.push(Bullet('Chat → llm.chat_stream (SSE) → Gemini responde com contexto do perfil'));
  c.push(Bullet('Export PDF → Playwright abre /report/{id} no Vercel → renderiza → captura PDF → devolve blob'));
  c.push(H3('Princípios arquiteturais'));
  c.push(Callout('Anti-alucinação', 'Todos os números vêm de Pandas (determinístico). Gemini apenas interpreta o perfil já calculado — não gera nem transforma valores.'));
  c.push(Callout('Isolamento LLM', 'llm.py é o único módulo que fala com Gemini. Substituir provider (OpenAI, DeepSeek, Ollama) exige mudar só esse arquivo.'));
  c.push(Callout('Cache write-through', 'main.py mantém _cache in-memory, mas grava disco a cada mutação via _persist(). Sobrevive restart, sem sync manual.'));

  // ===================== 5. ESTRUTURA DE PASTAS =====================
  c.push(new Paragraph({ children: [new PageBreak()] }));
  c.push(H1('5. Estrutura de Pastas'));
  c.push(Mono([
    'bi-agent/',
    '├── backend/',
    '│   ├── main.py                  # FastAPI + 15 endpoints + CORS + SSE',
    '│   ├── analyzer.py              # Pandas profile + inferência semântica',
    '│   ├── dashboard_planner.py     # Regras KPIs + escolha de charts',
    '│   ├── filters.py               # Aplicação de filtros no DataFrame',
    '│   ├── llm.py                   # Cliente Gemini + streaming',
    '│   ├── prompts.py               # System prompt BI em pt-BR',
    '│   ├── cache.py                 # Persistência JSON por file_id',
    '│   ├── pdf_export.py            # Playwright wrapper',
    '│   ├── requirements.txt         # 11 deps Python',
    '│   ├── Dockerfile               # Base Playwright + Chromium',
    '│   ├── railway.json             # Config Railway (não usado atualmente)',
    '│   ├── .env                     # Não versionado — GOOGLE_API_KEY',
    '│   ├── .env.example             # Template placeholders',
    '│   ├── uploads/                 # Raw files (gitignored)',
    '│   └── cache/                   # JSON metadata (gitignored)',
    '│',
    '├── frontend/',
    '│   ├── src/app/',
    '│   │   ├── page.tsx             # Dashboard principal',
    '│   │   ├── layout.tsx           # Root + ThemeProvider + Toaster',
    '│   │   ├── globals.css          # Tokens CSS + markdown styles',
    '│   │   ├── history/page.tsx     # Lista análises anteriores',
    '│   │   └── report/[fileId]/     # Rota SSR para PDF/print',
    '│   ├── src/components/          # ~25 componentes',
    '│   │   ├── ui/                  # Primitives shadcn',
    '│   │   ├── report/              # Componentes dedicados do PDF',
    '│   │   └── ...                  # KPICard, ChartBlock, Chat, Boxplot, etc.',
    '│   ├── src/lib/',
    '│   │   ├── api.ts               # Fetch client tipado + SSE reader',
    '│   │   ├── format.ts            # fmtNumberBR, fmtCompactBR',
    '│   │   └── utils.ts             # cn() (clsx + tailwind-merge)',
    '│   ├── vercel.json              # Config Vercel',
    '│   └── package.json             # Deps Next.js 16 + shadcn stack',
    '│',
    '├── test-data/                   # 6 CSVs de teste (gitignored)',
    '├── docs/                        # Documentação técnica (esta pasta)',
    '├── DEPLOY.md                    # Guia de deploy',
    '├── README.md                    # Overview + comandos rápidos',
    '└── .gitignore',
  ].join('\n')));

  // ===================== 6. TECNOLOGIAS =====================
  c.push(new Paragraph({ children: [new PageBreak()] }));
  c.push(H1('6. Tecnologias'));
  c.push(H2('Backend'));
  c.push(T(
    ['Categoria', 'Tecnologia', 'Papel'],
    [
      ['Linguagem', 'Python 3.12', 'Runtime'],
      ['Framework', 'FastAPI 0.115', 'HTTP API + validação'],
      ['Servidor', 'uvicorn 0.32 (standard)', 'ASGI production-grade'],
      ['Data', 'Pandas 2.2 + NumPy 2.1 + SciPy 1.14', 'Perfil estatístico + agregações'],
      ['I/O', 'openpyxl 3.1', 'Leitura Excel'],
      ['LLM', 'google-genai ≥1.0', 'Gemini API (streaming)'],
      ['PDF', 'Playwright ≥1.49', 'Chromium headless para renderização'],
      ['HTTP', 'httpx ≥0.28', 'Requests cliente (Gemini)'],
      ['Multipart', 'python-multipart 0.0.17', 'Upload de arquivos'],
      ['Env', 'python-dotenv 1.0', 'Carrega .env com hot-reload'],
    ],
    [2000, 3400, 3600],
  ));
  c.push(Space());
  c.push(H2('Frontend'));
  c.push(T(
    ['Categoria', 'Tecnologia', 'Papel'],
    [
      ['Framework', 'Next.js 16 (App Router, Turbopack)', 'React SSR + edge'],
      ['UI Runtime', 'React 19.2', 'Componentes'],
      ['CSS', 'Tailwind CSS 4', 'Utility-first'],
      ['Componentes', 'shadcn/ui (Radix primitives)', 'Button, Dialog, Tooltip, etc.'],
      ['Charts', 'Recharts 2.15', 'Bar, Line, Pie, Scatter (Boxplot é SVG custom)'],
      ['Motion', 'Framer Motion 12', 'Fade/slide, cascatas'],
      ['Theme', 'next-themes 0.4', 'Dark/light com toggle sem flash'],
      ['Toasts', 'Sonner 2.0', 'Notificações'],
      ['Markdown', 'react-markdown + remark-gfm', 'Render insights + tabelas'],
      ['Icons', 'lucide-react 1.27', 'Ícones SVG'],
      ['Language', 'TypeScript 5', 'Type safety'],
    ],
    [2000, 3400, 3600],
  ));
  c.push(Space());
  c.push(H2('Infraestrutura / DevOps'));
  c.push(T(
    ['Item', 'Uso'],
    [
      ['GitHub', 'Repo privado (BielmFranco/bi-dashboard-agent)'],
      ['Vercel (Hobby)', 'Frontend em produção'],
      ['Cloudflare Tunnel', 'Backend exposto sem porta aberta'],
      ['Windows (PC local)', 'Host do backend'],
      ['Docker + Playwright base image', 'Preparado (não em uso atualmente)'],
      ['Railway config', 'Preparado (deploy abandonado por falha de setup)'],
    ],
    [3200, 5800],
  ));

  // ===================== 7. FUNCIONALIDADES =====================
  c.push(new Paragraph({ children: [new PageBreak()] }));
  c.push(H1('7. Funcionalidades'));

  const feats = [
    ['Upload de planilha', 'Aceita xlsx, xls, xlsm, csv, tsv (max 50 MB). Auto-detect separador (,;|\\t) e encoding (utf-8, latin-1, cp1252).', 'Upload.tsx + main.py::upload', 'Funcionando'],
    ['Perfil estatístico', 'Detecção semântica por coluna (numeric/id/categorical/datetime/empty), quartis, outliers IQR, correlação Pearson, amostra.', 'analyzer.py', 'Funcionando'],
    ['KPIs automáticos', 'Total registros + soma/média de até 4 numeric cols. Filtra nulls e IDs.', 'dashboard_planner.py::_build_kpis + KPICard.tsx', 'Funcionando'],
    ['Charts adaptativos', 'Line (data+numeric), Bar ranking (categ+numeric), Pie (categ), Scatter (2+ numeric), Boxplot (distribution).', 'dashboard_planner.py + ChartBlock.tsx + Boxplot.tsx', 'Funcionando'],
    ['Heatmap correlação', 'Matriz Pearson com cores divergentes, tooltip com valor exato.', 'CorrelationHeatmap.tsx', 'Funcionando'],
    ['Filtros funcionais', 'Slicers por coluna categórica. Recalcula tudo (KPIs, charts, heatmap, boxplot).', 'FilterBar.tsx + filters.py + /analyze/{id}/filtered', 'Funcionando'],
    ['Drill-down', 'Click em barra abre modal com rows filtradas + export CSV.', 'DrillDownModal.tsx + /drill/{id}', 'Funcionando'],
    ['Insights IA (streaming)', 'SSE do Gemini. 5 seções (Resumo, EDA, Dashboard, Insights, Próximas).', 'llm.py::generate_insights_stream + InsightsPanel.tsx', 'Funcionando'],
    ['Cancelar geração', 'AbortController no browser + botão Parar (destructive) enquanto loading.', 'page.tsx + InsightsPanel.tsx', 'Funcionando'],
    ['Chat streaming', 'SSE. Contexto = perfil resumido. Sugestões de perguntas geradas dinamicamente por Gemini.', 'llm.py::chat_stream + Chat.tsx + /suggestions', 'Funcionando'],
    ['Export PDF', 'Playwright abre /report/[fileId] no Vercel, renderiza, captura A4 landscape.', 'pdf_export.py + /export/{id} + report/page.tsx', 'Funcionando'],
    ['Histórico multi-file', 'Página /history lista análises cacheadas. Click restaura sessão.', '/files + history/page.tsx', 'Funcionando'],
    ['Restore automático', 'localStorage guarda file_id. Ao abrir /, restaura análise anterior via GET /analyze/{id}.', 'page.tsx::useEffect', 'Funcionando'],
    ['Dark/Light theme', 'Toggle via next-themes. Sem flash de tema errado.', 'ThemeProvider.tsx + ThemeToggle.tsx', 'Funcionando'],
  ];
  c.push(T(
    ['Feature', 'Descrição', 'Arquivos', 'Status'],
    feats,
    [1800, 3900, 2400, 900],
  ));

  // ===================== 8. ENDPOINTS =====================
  c.push(new Paragraph({ children: [new PageBreak()] }));
  c.push(H1('8. APIs / Endpoints'));
  c.push(T(
    ['Método', 'Rota', 'Objetivo'],
    [
      ['GET', '/health', 'Ping + has_api_key + cached_files'],
      ['POST', '/upload', 'Recebe arquivo, retorna file_id'],
      ['POST', '/analyze/{id}', 'Perfil Pandas + plano dashboard'],
      ['GET', '/analyze/{id}', 'Recupera análise cacheada (restore)'],
      ['POST', '/analyze/{id}/filtered', 'Recalcula com filtros aplicados'],
      ['GET', '/report_data/{id}', 'Dados JSON para rota /report SSR'],
      ['POST', '/insights/{id}', 'Insights sync (fallback)'],
      ['POST', '/insights_stream/{id}', 'Insights SSE (streaming)'],
      ['POST', '/chat/{id}', 'Chat sync'],
      ['POST', '/chat_stream/{id}', 'Chat SSE'],
      ['GET', '/suggestions/{id}', 'Gemini gera 4 perguntas contextuais'],
      ['POST', '/drill/{id}', 'Rows filtradas por col+valor (drill-down)'],
      ['POST', '/export/{id}', 'Playwright renderiza + retorna PDF bytes'],
      ['GET', '/files', 'Lista todos file_ids cacheados'],
      ['DELETE', '/files/{id}', 'Remove entrada cache + raw + JSON'],
    ],
    [1200, 3400, 4400],
  ));

  // ===================== 9. IA =====================
  c.push(new Paragraph({ children: [new PageBreak()] }));
  c.push(H1('9. Inteligência Artificial'));
  c.push(H3('Modelo utilizado'));
  c.push(P('Google Gemini via SDK google-genai. Modelo: gemini-flash-latest (não gemini-2.0-flash — projeto do usuário tem quota 0 nesse modelo específico).'));
  c.push(H3('Onde entra no sistema'));
  c.push(Bullet('Insights estratégicos: recebe perfil calculado + plano de dashboard, gera 5 seções em markdown streamado via SSE'));
  c.push(Bullet('Chat: recebe perfil resumido + histórico + pergunta, responde em streaming'));
  c.push(Bullet('Sugestões dinâmicas: recebe perfil, retorna 4 perguntas curtas contextuais'));
  c.push(H3('Prompt strategy'));
  c.push(P('System prompt (prompts.py::SYSTEM_PROMPT) instrui: especialista sênior BI em pt-BR, formato markdown com 5 seções fixas, proíbe ASCII art, proíbe LaTeX, exige números do perfil (não inventa), estrutura estruturada.'));
  c.push(H3('Anti-alucinação'));
  c.push(P('LLM nunca vê o DataFrame diretamente. Recebe apenas o perfil (JSON com estatísticas já calculadas) e o plano (JSON com KPIs+charts já escolhidos). Não pode inventar valores — só interpretá-los.'));
  c.push(H3('Gotchas do Gemini 2.5'));
  c.push(Callout('Thinking tokens invisíveis', 'Gemini 2.5+ gasta até 2.500 tokens em chain-of-thought interno que NÃO aparecem no output. Config max_output_tokens deve considerar isso. Definido 8000 (vs 3000 inicial que truncava insights).'));
  c.push(Callout('thinking_budget=0', 'Rejeitado por gemini-flash-latest com 400 INVALID_ARGUMENT. Não é possível desabilitar thinking nesse modelo.'));
  c.push(H3('Custo'));
  c.push(P('Free tier: 15 requests/minuto, 1.500/dia, 1M tokens/dia. Cobre uso pessoal e demos. Zero R$/mês.'));

  // ===================== 10. CONFIGS/ENV =====================
  c.push(new Paragraph({ children: [new PageBreak()] }));
  c.push(H1('10. Configurações e Variáveis de Ambiente'));
  c.push(H3('Backend (.env)'));
  c.push(T(
    ['Variável', 'Finalidade'],
    [
      ['GOOGLE_API_KEY', 'Chave da Google AI Studio (Variável sensível identificada e omitida por segurança)'],
      ['MODEL_ID', 'Modelo Gemini (padrão gemini-flash-latest)'],
      ['FRONTEND_URL', 'Origem CORS explícita para exports de PDF'],
      ['FRONTEND_URL_REGEX', 'Regex CORS opcional (default ^https://.*\\.vercel\\.app$)'],
    ],
    [3400, 5600],
  ));
  c.push(Space());
  c.push(H3('Frontend (Vercel Env Variables)'));
  c.push(T(
    ['Variável', 'Finalidade'],
    [
      ['NEXT_PUBLIC_API_URL', 'URL pública do backend (client-side fetch)'],
      ['REPORT_API_URL', 'URL do backend para SSR de /report/[fileId]'],
    ],
    [3400, 5600],
  ));

  // ===================== 11. SEGURANÇA =====================
  c.push(new Paragraph({ children: [new PageBreak()] }));
  c.push(H1('11. Segurança'));
  c.push(H3('Camadas TLS'));
  c.push(Bullet('Browser ↔ Vercel: HTTPS (cert Vercel)'));
  c.push(Bullet('Vercel ↔ Cloudflare tunnel URL: HTTPS (cert Cloudflare)'));
  c.push(Bullet('Cloudflare ↔ cloudflared local: TLS mútuo com cert de tunnel'));
  c.push(Bullet('cloudflared ↔ FastAPI: HTTP loopback (só localhost)'));
  c.push(H3('CORS'));
  c.push(P('Backend FastAPI usa CORSMiddleware com allow_origins fixo (localhost:3000, 127.0.0.1:3000) + FRONTEND_URL e allow_origin_regex opcional. Aceita *.vercel.app para preview deploys.'));
  c.push(H3('Riscos identificados'));
  c.push(T(
    ['Nível', 'Risco', 'Mitigação atual/planejada'],
    [
      ['Alto', 'Backend público sem auth', 'Nenhuma ainda. Planejado: API key header ou basic auth.'],
      ['Alto', 'Sem rate limit', 'Nenhuma. Planejado: slowapi.'],
      ['Médio', 'Uploads acumulam disco (sem TTL)', 'Manual. Planejado: cron cleanup > 7 dias.'],
      ['Médio', 'Cloudflared em foreground', 'Fix: named tunnel + service Windows.'],
      ['Baixo', 'Prompt injection via chat', 'Baixa exposição (LLM não executa código).'],
    ],
    [1100, 3800, 4100],
  ));

  // ===================== 12. PROBLEMAS/CORREÇÕES =====================
  c.push(new Paragraph({ children: [new PageBreak()] }));
  c.push(H1('12. Histórico de Problemas e Correções'));

  const bugs = [
    {
      title: 'anthropic 0.39 quebra com httpx 0.28',
      cause: 'SDK antigo passa param proxies removido em httpx recente',
      fix: 'Upgrade anthropic para 0.68+ (35e74e7). Depois migrado para Gemini de qualquer forma.',
      files: 'backend/requirements.txt',
    },
    {
      title: 'Anthropic sem crédito',
      cause: 'Free tier zerado',
      fix: 'Migração completa para Google Gemini (3813010)',
      files: 'backend/llm.py + prompts.py',
    },
    {
      title: 'Pandas UserWarning em datas ambíguas BR',
      cause: 'pd.to_datetime sem format= detecta linha-a-linha e emite warning',
      fix: 'format="mixed" + warnings.catch_warnings() em _try_parse_dates (0e9b6ae)',
      files: 'backend/analyzer.py',
    },
    {
      title: 'CSV single-column loader inventa separador',
      cause: 'Sniffer Python engine usa letra do header como separador quando não encontra delim',
      fix: 'Aceita 1 col válida como resultado + tenta 3 encodings (256b03d)',
      files: 'backend/analyzer.py',
    },
    {
      title: 'Heurística ID falso-positivo',
      cause: 'unique_ratio ≥0.95 marcava salário/idade/custo como ID',
      fix: 'Exige name_hit em lista de tokens (id, cpf, matricula, etc.) + check ID antes de categorical (256b03d)',
      files: 'backend/analyzer.py',
    },
    {
      title: 'Insights truncados no meio (Gemini)',
      cause: 'Gemini 2.5 gasta 2.500 tokens em thinking invisível, comendo budget',
      fix: 'max_output_tokens 3000 → 8000 (58c1612)',
      files: 'backend/llm.py',
    },
    {
      title: 'Recharts tooltip preto no dark theme',
      cause: 'contentStyle.color só afeta wrapper; text de items/labels usa cor default (preto)',
      fix: 'itemStyle + labelStyle explícitos (a851664)',
      files: 'frontend/src/components/ChartBlock.tsx',
    },
    {
      title: 'CSS columns dos insights com colunas vazias',
      cause: 'break-inside: avoid em h2 + column-fill: balance interagem mal em page break',
      fix: 'Rewrite: parse markdown por ##, cada seção vira card em grid auto-fit (9653ec5)',
      files: 'report/[fileId]/page.tsx + report.css',
    },
    {
      title: 'PDF page 3 quase vazia (chart órfão)',
      cause: 'page-break-inside em section forçava quebra ruim',
      fix: 'Layout compact 3-col charts + insights 3-col, remove page-break-inside (515d5d6, 1c0f8f7)',
      files: 'report.css',
    },
    {
      title: 'React hydration: motion.button com button interno',
      cause: 'HTML inválido (<button> dentro de <button>) causa hydration mismatch',
      fix: 'Trocar motion.button por div[role=button] com keyDown handler (d067b49)',
      files: 'frontend/src/app/history/page.tsx',
    },
    {
      title: 'Cloudflare quick tunnel URL descartável',
      cause: 'Cloudflare recicla URL random periodicamente',
      fix: 'Migração planejada para named tunnel (URL fixa) — não executada ainda',
      files: 'DEPLOY.md',
    },
    {
      title: 'Vercel report page mostra "Análise não encontrada"',
      cause: 'SSR chama process.env.REPORT_API_URL (não NEXT_PUBLIC_*), sem env cai em localhost',
      fix: 'Adicionar REPORT_API_URL no Vercel env vars + redeploy',
      files: 'Vercel dashboard config',
    },
    {
      title: 'Railway build falhou (Railpack)',
      cause: 'Root Directory não configurado → Railpack analisa raiz do repo e não sabe qual buildar',
      fix: 'Deploy abandonado. Migrado para Cloudflare Tunnel + Vercel híbrido.',
      files: 'DEPLOY.md',
    },
  ];
  bugs.forEach((b) => {
    c.push(H3(b.title));
    c.push(P('Causa: ' + b.cause));
    c.push(P('Solução: ' + b.fix));
    c.push(P('Arquivos: ' + b.files, { italics: true, color: COLOR_MUTED }));
  });

  // ===================== 13. ESTADO ATUAL =====================
  c.push(new Paragraph({ children: [new PageBreak()] }));
  c.push(H1('13. Estado Atual do Projeto'));
  c.push(T(
    ['Área', 'Estado', 'Observação'],
    [
      ['Frontend', 'Funcionando em produção', 'Vercel: bi-agent-rosy.vercel.app'],
      ['Backend', 'Funcionando (via tunnel)', 'Rodando no PC local, exposto por Cloudflare Tunnel'],
      ['Upload/Analyze', 'Funcionando', 'Todos formatos testados em 6 CSVs'],
      ['Insights IA', 'Funcionando', 'Streaming SSE, cancelamento, sugestões dinâmicas'],
      ['Chat', 'Funcionando', 'Streaming SSE, cancelamento via botão Parar'],
      ['PDF Export', 'Funcionando', 'Landscape A4, layout SaaS premium'],
      ['Filtros', 'Funcionando', 'Recalcula tudo (KPIs, charts, heatmap, boxplot)'],
      ['Drill-down', 'Funcionando', 'Modal + export CSV'],
      ['Heatmap correlação', 'Funcionando', 'SVG grid custom com escala divergente'],
      ['Boxplot', 'Funcionando', 'SVG custom, substituiu histograma'],
      ['Histórico multi-file', 'Funcionando', 'Página /history'],
      ['Dark/Light theme', 'Funcionando', 'Toggle sem flash'],
      ['Cache disco', 'Funcionando', 'JSON por file_id, sobrevive restart'],
      ['Autenticação', 'Não implementada', 'URL pública, sem controle de acesso'],
      ['Rate limit', 'Não implementado', 'Vulnerável a abuso de quota Gemini'],
      ['Testes automatizados', 'Não implementados', 'Zero pytest, zero Vitest'],
      ['CI/CD', 'Parcial', 'Vercel deploy automático em push. Backend manual.'],
      ['Deploy backend cloud', 'Fallback local', 'Railway falhou, tunnel funciona mas exige PC ligado'],
    ],
    [2400, 2400, 4200],
  ));

  // ===================== 14. PENDÊNCIAS =====================
  c.push(new Paragraph({ children: [new PageBreak()] }));
  c.push(H1('14. O Que Ainda Precisa Ser Feito'));
  c.push(H2('Alta prioridade'));
  c.push(Bullet('Named tunnel Cloudflare (URL fixa que não recicla)'));
  c.push(Bullet('cloudflared como Windows service (sobrevive reboot)'));
  c.push(Bullet('Rotate keys expostas (Anthropic antiga + Gemini atual)'));
  c.push(Bullet('Rate limit no backend (slowapi ou middleware manual)'));
  c.push(Bullet('Autenticação básica (API key header ou basic auth)'));
  c.push(H2('Média prioridade'));
  c.push(Bullet('TTL de cache/uploads (cron cleanup > 7 dias)'));
  c.push(Bullet('Meta x Realizado com input do usuário'));
  c.push(Bullet('Forecast simples (linregress ou média móvel)'));
  c.push(Bullet('Export Excel (openpyxl já instalado)'));
  c.push(Bullet('Comparação entre 2 planilhas'));
  c.push(Bullet('Testes automatizados (pytest backend + Vitest frontend)'));
  c.push(H2('Baixa prioridade'));
  c.push(Bullet('Migração para deploy cloud (Fly.io — evita PC 24/7)'));
  c.push(Bullet('Redis para cache multi-instance'));
  c.push(Bullet('Anonimização LGPD auto (CPF, emails)'));
  c.push(Bullet('Logs estruturados + Sentry'));
  c.push(Bullet('PWA / installable'));
  c.push(Bullet('Comparação temporal (diff entre 2 análises da mesma base)'));

  // ===================== 15. COMO EXECUTAR =====================
  c.push(new Paragraph({ children: [new PageBreak()] }));
  c.push(H1('15. Como Executar o Projeto'));
  c.push(H3('Pré-requisitos'));
  c.push(Bullet('Windows/Linux/macOS'));
  c.push(Bullet('Python 3.12+'));
  c.push(Bullet('Node.js 20+'));
  c.push(Bullet('Chave Google AI Studio (grátis em aistudio.google.com/apikey)'));
  c.push(H3('Backend'));
  c.push(Mono([
    'cd backend',
    'python -m venv .venv',
    '.venv\\Scripts\\activate            # Windows',
    'pip install -r requirements.txt',
    'playwright install chromium',
    'cp .env.example .env',
    '# editar .env e colar GOOGLE_API_KEY',
    'python main.py',
    '# backend em http://127.0.0.1:8000',
  ].join('\n')));
  c.push(H3('Frontend'));
  c.push(Mono([
    'cd frontend',
    'npm install',
    '# criar frontend/.env.local com:',
    '# NEXT_PUBLIC_API_URL=http://127.0.0.1:8000',
    'npm run dev',
    '# frontend em http://localhost:3000',
  ].join('\n')));
  c.push(H3('Uso'));
  c.push(Bullet('Abrir http://localhost:3000'));
  c.push(Bullet('Arrastar planilha (xlsx/csv) para área de upload'));
  c.push(Bullet('Aguardar análise (1-3s)'));
  c.push(Bullet('Explorar KPIs, charts, filtros, drill-down, boxplot, heatmap'));
  c.push(Bullet('Clicar "Gerar com Gemini" para insights em linguagem natural'));
  c.push(Bullet('Perguntar no chat sobre a base'));
  c.push(Bullet('Baixar PDF do dashboard'));

  // ===================== 16. GUIA PARA DEV NOVO =====================
  c.push(new Paragraph({ children: [new PageBreak()] }));
  c.push(H1('16. Guia para Novos Desenvolvedores'));
  c.push(H2('Por onde começar'));
  c.push(Bullet('Ler DEPLOY.md para entender arquitetura de infra'));
  c.push(Bullet('Rodar backend + frontend local (seção 15)'));
  c.push(Bullet('Subir uma planilha de test-data/ e explorar o dashboard'));
  c.push(H2('Arquivos essenciais a estudar (nessa ordem)'));
  c.push(Bullet('backend/main.py — mapa completo de endpoints e fluxos'));
  c.push(Bullet('backend/analyzer.py — coração da lógica de perfil'));
  c.push(Bullet('backend/dashboard_planner.py — regras que escolhem KPIs e charts'));
  c.push(Bullet('backend/llm.py — integração Gemini (streaming + config)'));
  c.push(Bullet('frontend/src/app/page.tsx — orquestração do dashboard'));
  c.push(Bullet('frontend/src/lib/api.ts — cliente REST tipado + SSE'));
  c.push(H2('Como adicionar uma nova feature'));
  c.push(Bullet('Backend: novo endpoint em main.py + lógica em módulo dedicado'));
  c.push(Bullet('Frontend: novo componente + método em api.ts + integração em page.tsx'));
  c.push(Bullet('Se envolve LLM: só llm.py + prompt em prompts.py'));
  c.push(Bullet('Commit convencional (feat/fix/chore/refactor)'));

  // ===================== 17. DECISÕES TÉCNICAS =====================
  c.push(new Paragraph({ children: [new PageBreak()] }));
  c.push(H1('17. Decisões Técnicas'));
  const decisions = [
    ['Anthropic → Gemini', 'Free tier real (1500 req/dia) vs. Anthropic exigindo crédito.', 'Alternativas: OpenAI (pago), DeepSeek (barato), Ollama local (grátis mas sem qualidade).', 'Gemini foi a escolha.'],
    ['Next.js 16 + Turbopack', 'App Router com SSR para /report + estático para dashboard.', 'Vite+React, Remix, SvelteKit.', 'Next 16 escolhido pela integração Vercel + Turbopack.'],
    ['shadcn/ui', 'Componentes copy-paste com Radix. Zero lock-in.', 'Mantine (biblioteca full), MUI (pesado), HeroUI, Tailwind puro.', 'shadcn — padrão Vercel/Linear.'],
    ['Recharts', 'React-friendly, SSR-safe, boa base para custom charts.', 'D3 (verbose), Chart.js (imperativo), Nivo (pesado).', 'Recharts para bar/line/pie/scatter; SVG custom para boxplot e heatmap.'],
    ['Cache JSON disco', 'Zero deps, transparente, debugável.', 'SQLite, Redis, in-memory only.', 'JSON para MVP; Redis planejado se multi-user.'],
    ['Playwright para PDF', 'Reutiliza componentes React em vez de gerar PDF do zero.', 'reportlab (Python nativo), matplotlib+FPDF, WeasyPrint, Puppeteer.', 'Playwright: perfeita paridade com o dashboard visual.'],
    ['Deploy híbrido (Vercel + tunnel)', 'Railway falhou; local + tunnel é grátis e mantém Playwright leve.', 'Fly.io, Render, VPS próprio, self-hosted apenas.', 'Cloudflare Tunnel + PC local — trade-off aceitável.'],
    ['SSE (vs WebSocket)', 'One-way LLM output; simples; HTTP/2-friendly; sem handshake.', 'WebSocket, long polling.', 'SSE — menor complexidade.'],
    ['Semantic types no analyzer', 'Isolamento entre "tipo de dado" e "métrica útil"; evita KPIs sem sentido.', 'Usar dtypes Pandas direto.', 'Semantic types resolveram bugs reais (ID como métrica).'],
  ];
  c.push(T(
    ['Decisão', 'Contexto', 'Alternativas', 'Escolha'],
    decisions,
    [1800, 3600, 2400, 1200],
  ));

  // ===================== 18. DIAGNÓSTICO =====================
  c.push(new Paragraph({ children: [new PageBreak()] }));
  c.push(H1('18. Diagnóstico Técnico Final'));
  c.push(T(
    ['Aspecto', 'Avaliação', 'Justificativa'],
    [
      ['Arquitetura', 'Boa', 'Separação clara backend/frontend, isolamento LLM, cache write-through'],
      ['Organização', 'Boa', 'Módulos pequenos e coesos (max 380 linhas), componentes React organizados por escopo'],
      ['Código', 'Bom', 'Type hints Python, TypeScript strict, comentários JSDoc onde necessário'],
      ['Escalabilidade', 'Precisa melhorar', 'Cache in-memory + PC único = single instance apenas. Redis+cloud resolve.'],
      ['Segurança', 'Precisa melhorar', 'Sem auth, sem rate limit, keys já foram expostas em transcript'],
      ['Manutenibilidade', 'Boa', 'Commits descritivos, features isoladas, dev experience decente'],
      ['Performance', 'Adequada', 'Streaming, cache disco, tabular-nums. Playwright é o gargalo (5-8s por PDF).'],
      ['Testes', 'Crítico', 'Zero automated tests. Só testes manuais com 6 CSVs.'],
      ['Documentação', 'Boa', 'README + DEPLOY.md + agora este documento. Códigos comentados onde necessário.'],
      ['Infraestrutura', 'Adequada', 'Deploy funciona. Depende de PC ligado. Sem monitoramento.'],
      ['IA', 'Boa', 'Anti-alucinação por design. Streaming responsivo. Prompts em pt-BR bem estruturados.'],
    ],
    [2400, 2000, 4600],
  ));

  // ===================== 19. ESTADO ATUAL RESUMIDO =====================
  c.push(new Paragraph({ children: [new PageBreak()] }));
  c.push(H1('19. Estado Atual (Resumo Executivo)'));
  c.push(H3('O que é'));
  c.push(P('BI Dashboard Agent — aplicação web que transforma qualquer planilha em dashboard profissional com KPIs, gráficos, boxplot, heatmap de correlação, drill-down, filtros funcionais e análise em linguagem natural via IA.'));
  c.push(H3('Como começou'));
  c.push(P('Scaffold inicial em 28/07/2026 com Anthropic Claude. Migrado no mesmo dia para Google Gemini por questão de crédito.'));
  c.push(H3('Como evoluiu'));
  c.push(P('15 dias, 31 commits, 8 sprints/fases. Evoluiu de MVP funcional → premium SaaS UI → BI real com filtros e drill-down → deploy híbrido em produção.'));
  c.push(H3('O que existe atualmente'));
  c.push(P('15 endpoints backend, ~30 componentes React, 6 tipos de visualização, streaming SSE em insights e chat, export PDF via Playwright, cache disco persistente, histórico multi-file, dark/light theme.'));
  c.push(H3('O que está funcionando'));
  c.push(P('Tudo listado na seção 13 (marcado como "Funcionando"). Fluxo end-to-end de upload até PDF export está operacional em produção via Vercel + Cloudflare Tunnel.'));
  c.push(H3('O que está incompleto'));
  c.push(P('Autenticação, rate limit, TTL de cache, testes automatizados, cleanup de uploads, named tunnel Cloudflare, deploy backend em cloud dedicada.'));
  c.push(H3('Principais problemas'));
  c.push(P('Backend depende de PC ligado 24/7. Quick tunnel Cloudflare recicla URL periodicamente exigindo update manual do Vercel env. Sem controle de acesso, o backend público pode ter quota Gemini queimada por qualquer um.'));
  c.push(H3('Próximos passos'));
  c.push(P('1) Named tunnel (URL fixa) + service Windows para eliminar frágeis. 2) Auth básica + rate limit. 3) Testes automatizados. 4) Eventualmente migrar backend para Fly.io e liberar o PC.'));

  return c;
}

// ---------- write ----------
Packer.toBuffer(doc).then((buf) => {
  const outPath = path.join(__dirname, 'Documentacao_Tecnica_BI_Agent.docx');
  fs.writeFileSync(outPath, buf);
  console.log('Written:', outPath, buf.length, 'bytes');
}).catch((e) => {
  console.error('ERROR:', e);
  process.exit(1);
});
