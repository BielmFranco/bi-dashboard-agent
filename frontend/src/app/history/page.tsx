"use client";

import { motion } from "framer-motion";
import { ArrowRight, Clock, Database, FileText, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { deleteFile, listFiles, type FileEntry } from "@/lib/api";

const LS_KEY = "bi-agent:last-file-id";

function formatDate(ts: number | null) {
  if (!ts) return "—";
  const d = new Date(ts * 1000);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function HistoryPage() {
  const router = useRouter();
  const [files, setFiles] = useState<FileEntry[] | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function reload() {
    try {
      const r = await listFiles();
      setFiles(r.files);
    } catch (e) {
      toast.error("Erro ao carregar histórico", {
        description: e instanceof Error ? e.message : String(e),
      });
      setFiles([]);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  function open(f: FileEntry) {
    localStorage.setItem(LS_KEY, f.file_id);
    router.push("/");
  }

  async function remove(f: FileEntry, e: React.MouseEvent) {
    e.stopPropagation();
    setDeleting(f.file_id);
    try {
      await deleteFile(f.file_id);
      toast.success("Análise removida");
      const currentSaved = localStorage.getItem(LS_KEY);
      if (currentSaved === f.file_id) localStorage.removeItem(LS_KEY);
      reload();
    } catch (err) {
      toast.error("Falha ao remover", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setDeleting(null);
    }
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-5xl w-full px-4 sm:px-6 py-8 flex-1">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-6"
        >
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold tracking-tight">Histórico</h1>
            <Link href="/">
              <Button variant="outline" size="sm">
                Voltar
              </Button>
            </Link>
          </div>
          <p className="text-sm text-[var(--muted-foreground)]">
            Suas análises anteriores. Clique para restaurar.
          </p>
        </motion.div>

        {files === null && (
          <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </div>
        )}

        {files && files.length === 0 && (
          <Card className="p-12 text-center">
            <Database className="h-8 w-8 mx-auto mb-3 text-[var(--muted-foreground)]" />
            <p className="text-sm font-medium">Nenhuma análise armazenada</p>
            <p className="text-xs text-[var(--muted-foreground)] mt-1">
              Envie uma planilha na tela inicial pra começar.
            </p>
            <Link href="/">
              <Button size="sm" className="mt-4">
                Nova análise
              </Button>
            </Link>
          </Card>
        )}

        {files && files.length > 0 && (
          <div className="space-y-2">
            {files.map((f, i) => (
              <motion.div
                key={f.file_id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.03 }}
                role="button"
                tabIndex={0}
                onClick={() => open(f)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    open(f);
                  }
                }}
                className="group w-full text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] rounded-xl"
              >
                <Card className="p-4 hover:border-[var(--muted-foreground)]/40 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--muted)] shrink-0">
                      <FileText className="h-5 w-5 text-[var(--muted-foreground)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-sm truncate">
                        {f.filename ?? f.file_id}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-[var(--muted-foreground)]">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(f.uploaded_at)}
                        </span>
                        {f.rows !== null && (
                          <>
                            <span className="w-px h-3 bg-[var(--border)]" />
                            <span className="tabular-nums">
                              {f.rows.toLocaleString("pt-BR")} linhas
                            </span>
                            <span className="w-px h-3 bg-[var(--border)]" />
                            <span className="tabular-nums">{f.cols} colunas</span>
                          </>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => remove(f, e)}
                      disabled={deleting === f.file_id}
                      className="p-2 rounded-md text-[var(--muted-foreground)] hover:text-[var(--destructive)] hover:bg-[var(--muted)] transition-colors disabled:opacity-50"
                      title="Remover"
                      aria-label={`Remover ${f.filename ?? f.file_id}`}
                    >
                      {deleting === f.file_id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                    <ArrowRight className="h-4 w-4 text-[var(--muted-foreground)] group-hover:text-[var(--foreground)] transition-colors" />
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
