"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { Brain, Download, FileSpreadsheet, BarChart3, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type Props = {
  onUploaded: (fileId: string, filename: string) => void;
  disabled?: boolean;
};

const REPO_URL = "https://github.com/BielmFranco/bi-dashboard-agent";

export default function Upload({ onUploaded, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const { uploadFile } = await import("@/lib/api");
      const res = await uploadFile(file);
      toast.success("Planilha enviada", { description: file.name });
      onUploaded(res.file_id, res.filename);
    } catch (e) {
      toast.error("Erro no upload", {
        description: e instanceof Error ? e.message : "Falha desconhecida",
      });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="relative">
      <div className="bg-grid glow-emerald pointer-events-none absolute inset-x-0 -top-8 h-[420px]" aria-hidden />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative mx-auto max-w-3xl text-center pt-6 pb-8"
      >
        <div className="mb-5 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)] shadow-[0_0_10px_var(--primary)]" />
          Planilha → Decisão
        </div>
        <h1 className="font-display text-[2.7rem] sm:text-6xl font-medium tracking-[-0.02em] text-[var(--foreground)] leading-[1.02]">
          Seus dados,{" "}
          <span className="text-[var(--primary)] italic">lidos de verdade</span>
          <span className="block text-[var(--muted-foreground)] font-normal">
            em segundos, não em planilhas.
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-sm sm:text-[15px] text-[var(--muted-foreground)] leading-relaxed">
          Envie um <span className="font-mono text-[var(--foreground)]">.xlsx</span> ou{" "}
          <span className="font-mono text-[var(--foreground)]">.csv</span> e receba KPIs, gráficos
          interativos e análise estratégica. Cada número é calculado — nunca chutado pela IA.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto max-w-4xl"
      >
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) handleFile(f);
          }}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          className={`
            group relative overflow-hidden rounded-lg border transition-all cursor-pointer
            ${
              dragOver
                ? "border-[var(--primary)] bg-[color-mix(in_oklab,var(--primary)_9%,var(--card))]"
                : "border-[color-mix(in_oklab,var(--primary)_38%,var(--border))] bg-[var(--card)] hover:border-[color-mix(in_oklab,var(--primary)_65%,var(--border))]"
            }
            ${disabled || uploading ? "opacity-60 pointer-events-none" : ""}
            p-10 sm:p-14
          `}
        >
          {/* Marcas de corte nos cantos — detalhe técnico/editorial */}
          {[
            "left-2 top-2 border-l border-t",
            "right-2 top-2 border-r border-t",
            "left-2 bottom-2 border-l border-b",
            "right-2 bottom-2 border-r border-b",
          ].map((pos) => (
            <span
              key={pos}
              aria-hidden
              className={`pointer-events-none absolute h-3 w-3 transition-colors ${pos} ${
                dragOver ? "border-[var(--primary)]" : "border-[var(--primary)]/60 group-hover:border-[var(--primary)]"
              }`}
            />
          ))}

          <div className="relative flex flex-col items-center gap-5 text-center">
            <div
              className={`relative flex h-14 w-14 items-center justify-center rounded-md transition-all
                ${
                  dragOver
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)] scale-105"
                    : "bg-[var(--primary-dim)] text-[var(--primary)] group-hover:scale-105"
                }`}
            >
              <UploadCloud className="h-6 w-6" strokeWidth={1.75} />
            </div>

            <div>
              <p className="text-base font-medium text-[var(--foreground)]">
                {dragOver ? "Solte para enviar" : "Arraste sua planilha aqui"}
              </p>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                ou clique para selecionar do computador
              </p>
            </div>

            <Button
              variant="default"
              size="sm"
              disabled={uploading}
              onClick={(e) => {
                e.stopPropagation();
                inputRef.current?.click();
              }}
            >
              <UploadCloud className="h-4 w-4" />
              {uploading ? "Enviando..." : "Selecionar arquivo"}
            </Button>

            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xls,.xlsm,.tsv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.currentTarget.value = "";
              }}
            />

            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] text-[var(--muted-foreground)]">
              <span className="font-mono">.xlsx</span>
              <span className="text-[var(--border)]">·</span>
              <span className="font-mono">.csv</span>
              <span className="text-[var(--border)]">·</span>
              <span className="font-mono">.tsv</span>
              <span className="text-[var(--border)]">·</span>
              <span>Máx. 50 MB</span>
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto max-w-4xl mt-10"
      >
        <div className="mb-8 flex items-center justify-center gap-3">
          <span className="h-px w-8 bg-[var(--border)]" />
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
            Como funciona
          </p>
          <span className="h-px w-8 bg-[var(--border)]" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            {
              icon: FileSpreadsheet,
              step: "01",
              title: "Envie sua planilha",
              desc: "Arraste qualquer .xlsx, .csv ou .tsv. Seus dados nunca saem do servidor.",
              img: "/screenshots/step1_upload.png",
            },
            {
              icon: Brain,
              step: "02",
              title: "IA analisa os dados",
              desc: "Pandas calcula. Gemini interpreta. Zero alucinação nos números.",
              img: "/screenshots/step2_analysis.png",
            },
            {
              icon: BarChart3,
              step: "03",
              title: "Dashboard pronto",
              desc: "KPIs, gráficos, correlações e insights estratégicos em segundos.",
              img: "/screenshots/step3_dashboard.png",
            },
            {
              icon: Download,
              step: "04",
              title: "Exporte em PDF",
              desc: "Baixe o relatório completo em PDF com um clique.",
              img: "/screenshots/step4_pdf.png",
            },
          ].map((item) => (
            <div
              key={item.step}
              className="group relative overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)] transition-all hover:border-[color-mix(in_oklab,var(--primary)_50%,var(--border))] hover:shadow-[0_1px_0_var(--primary)]"
            >
              <div className="relative h-40 overflow-hidden border-b border-[var(--border)]">
                <Image
                  src={item.img}
                  alt={item.title}
                  fill
                  className="object-cover object-top transition-transform duration-500 group-hover:scale-105"
                  sizes="(max-width: 640px) 100vw, 33vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[var(--card)] via-transparent to-transparent" />
              </div>
              <div className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--primary-dim)] text-[var(--primary)]">
                    <item.icon className="h-4 w-4" strokeWidth={2} />
                  </div>
                  <span className="text-[10px] font-mono font-semibold text-[var(--muted-foreground)]">
                    {item.step}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-[var(--foreground)] mb-1">
                  {item.title}
                </h3>
                <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="mx-auto max-w-4xl mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] text-[var(--muted-foreground)]"
      >
        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 hover:text-[var(--foreground)] transition-colors"
        >
          <svg viewBox="0 0 16 16" className="h-3 w-3 fill-current" aria-hidden="true">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
          </svg>
          Open Source · MIT
        </a>
        <span className="text-[var(--border)]">·</span>
        <a
          href="https://portfolio-orpin-ten-16.vercel.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-[var(--foreground)] transition-colors"
        >
          Portfólio
        </a>
        <span className="text-[var(--border)]">·</span>
        <a
          href="https://www.linkedin.com/in/gabriel-moraes-franco-935453352/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 hover:text-[var(--foreground)] transition-colors"
        >
          <svg viewBox="0 0 16 16" className="h-3 w-3 fill-current" aria-hidden="true">
            <path d="M0 1.146C0 .513.526 0 1.175 0h13.65C15.474 0 16 .513 16 1.146v13.708c0 .633-.526 1.146-1.175 1.146H1.175C.526 16 0 15.487 0 14.854V1.146zm4.943 12.248V6.169H2.542v7.225h2.401zm-1.2-8.212c.837 0 1.358-.554 1.358-1.248-.015-.709-.52-1.248-1.342-1.248-.822 0-1.359.54-1.359 1.248 0 .694.521 1.248 1.327 1.248h.016zm4.908 8.212V9.359c0-.216.016-.432.08-.586.173-.431.568-.878 1.232-.878.869 0 1.216.662 1.216 1.634v3.865h2.401V9.25c0-2.22-1.184-3.252-2.764-3.252-1.274 0-1.845.7-2.165 1.193v.025h-.016l.016-.025V6.169h-2.4c.03.678 0 7.225 0 7.225h2.4z"/>
          </svg>
          LinkedIn
        </a>
      </motion.div>
    </div>
  );
}
