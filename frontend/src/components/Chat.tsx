"use client";

import { Send } from "lucide-react";
import { useState } from "react";
import type { ChatMsg } from "@/lib/api";
import { chat } from "@/lib/api";

export default function Chat({ fileId }: { fileId: string }) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    const nextHistory = [...msgs, { role: "user" as const, content: text }];
    setMsgs(nextHistory);
    setInput("");
    try {
      const { reply } = await chat(fileId, msgs, text);
      setMsgs([...nextHistory, { role: "assistant", content: reply }]);
    } catch (e) {
      setMsgs([
        ...nextHistory,
        { role: "assistant", content: `Erro: ${e instanceof Error ? e.message : e}` },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 flex flex-col h-96">
      <h3 className="font-semibold mb-3">Pergunte sobre a base</h3>
      <div className="flex-1 overflow-y-auto space-y-3 pr-2">
        {msgs.length === 0 && (
          <p className="text-sm text-slate-400">
            Ex: &quot;Qual categoria cresce mais?&quot;, &quot;Há sazonalidade?&quot;, &quot;Sugira KPIs adicionais&quot;.
          </p>
        )}
        {msgs.map((m, i) => (
          <div
            key={i}
            className={`rounded-lg p-2 text-sm ${
              m.role === "user"
                ? "bg-indigo-600/30 border border-indigo-600/50 ml-8"
                : "bg-slate-800/60 border border-slate-700 mr-8"
            }`}
          >
            <p className="text-xs text-slate-400 mb-1">{m.role === "user" ? "Você" : "Gemini"}</p>
            <div className="whitespace-pre-wrap">{m.content}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
          placeholder="Digite sua pergunta..."
          disabled={busy}
          className="flex-1 rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-indigo-500"
        />
        <button
          onClick={send}
          disabled={busy}
          className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-2 text-sm disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
