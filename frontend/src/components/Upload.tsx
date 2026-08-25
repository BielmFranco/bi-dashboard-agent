"use client";

import { motion } from "framer-motion";
import { Sparkles, UploadCloud } from "lucide-react";
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
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto max-w-4xl text-center pt-4 pb-6"
      >
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 text-xs text-[var(--muted-foreground)]">
          <Sparkles className="h-3 w-3 text-[var(--primary)]" />
          Powered by Groq + Gemini
        </div>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[var(--foreground)]">
          Da planilha ao insight em segundos.
        </h1>
        <p className="mt-3 text-sm sm:text-base text-[var(--muted-foreground)] max-w-md mx-auto">
          Envie seu arquivo e receba dashboard automático com KPIs, gráficos e
          análise estratégica.
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
            relative overflow-hidden rounded-2xl border-2 border-dashed transition-all cursor-pointer
            ${
              dragOver
                ? "border-[var(--primary)] bg-[color-mix(in_oklab,var(--primary)_8%,transparent)] scale-[1.01]"
                : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--muted-foreground)]/40"
            }
            ${disabled || uploading ? "opacity-60 pointer-events-none" : ""}
            p-10 sm:p-14
          `}
        >
          <div className="relative flex flex-col items-center gap-5 text-center">
            <div
              className={`relative flex h-16 w-16 items-center justify-center rounded-2xl transition-all
                ${
                  dragOver
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)] scale-110"
                    : "bg-[var(--muted)] text-[var(--muted-foreground)]"
                }`}
            >
              <UploadCloud className="h-7 w-7" strokeWidth={1.75} />
              <div className="absolute -inset-2 rounded-2xl border border-[var(--primary)]/20 opacity-0 group-hover:opacity-100 transition-opacity" />
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
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
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
        <span>100% dos números vêm do Pandas</span>
        <span className="text-[var(--border)]">·</span>
        <span>Seus dados nunca deixam sua sessão</span>
      </motion.div>
    </div>
  );
}
