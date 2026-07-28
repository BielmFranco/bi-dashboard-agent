"use client";

import { UploadCloud } from "lucide-react";
import { useRef, useState } from "react";

type Props = {
  onUploaded: (fileId: string, filename: string) => void;
  disabled?: boolean;
};

export default function Upload({ onUploaded, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const { uploadFile } = await import("@/lib/api");
      const res = await uploadFile(file);
      onUploaded(res.file_id, res.filename);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setUploading(false);
    }
  }

  return (
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
      className={`rounded-2xl border-2 border-dashed transition-colors p-10 text-center ${
        dragOver ? "border-indigo-400 bg-indigo-500/10" : "border-slate-700 bg-slate-900/50"
      } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
    >
      <UploadCloud className="mx-auto h-12 w-12 text-indigo-400" />
      <p className="mt-3 text-lg font-medium">Envie sua planilha</p>
      <p className="text-sm text-slate-400">
        Arraste um arquivo <span className="font-mono">.xlsx</span>,{" "}
        <span className="font-mono">.csv</span> ou clique para selecionar
      </p>
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {uploading ? "Enviando..." : "Selecionar arquivo"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls,.xlsm,.tsv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </div>
  );
}
