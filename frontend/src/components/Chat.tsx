"use client";

import { motion } from "framer-motion";
import { MessageSquare, Send, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ChatMsg } from "@/lib/api";
import { chat } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

const SUGGESTIONS = [
  "Sugira KPIs adicionais",
  "Existe sazonalidade?",
  "Quais outliers valem investigar?",
  "Como filtrar por período?",
];

export default function Chat({ fileId }: { fileId: string }) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs]);

  async function send(text?: string) {
    const t = (text ?? input).trim();
    if (!t || busy) return;
    setBusy(true);
    const nextHistory = [...msgs, { role: "user" as const, content: t }];
    setMsgs(nextHistory);
    setInput("");
    try {
      const { reply } = await chat(fileId, msgs, t);
      setMsgs([...nextHistory, { role: "assistant", content: reply }]);
    } catch (e) {
      setMsgs([
        ...nextHistory,
        {
          role: "assistant",
          content: `> **Erro:** ${e instanceof Error ? e.message : String(e)}`,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
    >
      <Card className="flex flex-col h-[26rem]">
        <CardHeader className="pb-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-cyan-400/20 to-blue-500/20 border border-cyan-500/30">
              <MessageSquare className="h-3.5 w-3.5 text-cyan-500" />
            </div>
            <CardTitle className="text-sm">Pergunte sobre a base</CardTitle>
          </div>
        </CardHeader>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-5 py-4 space-y-3"
        >
          {msgs.length === 0 && (
            <div className="flex flex-col items-center text-center py-6">
              <Sparkles className="h-4 w-4 text-[var(--muted-foreground)] mb-2" />
              <p className="text-xs text-[var(--muted-foreground)] mb-3">
                Faça perguntas específicas sobre os dados.
              </p>
              <div className="flex flex-wrap justify-center gap-1.5">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-full border border-[var(--border)] bg-[var(--muted)]/40 hover:bg-[var(--muted)] px-2.5 py-1 text-[10.5px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {msgs.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`
                  max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed
                  ${
                    m.role === "user"
                      ? "bg-[var(--primary)] text-[var(--primary-foreground)] rounded-br-md"
                      : "bg-[var(--muted)] text-[var(--foreground)] rounded-bl-md border border-[var(--border)]"
                  }
                `}
              >
                <p className="whitespace-pre-wrap">{m.content}</p>
              </div>
            </motion.div>
          ))}
          {busy && (
            <div className="flex justify-start">
              <div className="bg-[var(--muted)] border border-[var(--border)] rounded-2xl rounded-bl-md px-3.5 py-2.5 flex gap-1">
                <span className="w-1.5 h-1.5 bg-[var(--muted-foreground)] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-[var(--muted-foreground)] rounded-full animate-bounce" style={{ animationDelay: "120ms" }} />
                <span className="w-1.5 h-1.5 bg-[var(--muted-foreground)] rounded-full animate-bounce" style={{ animationDelay: "240ms" }} />
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-[var(--border)] p-3">
          <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--muted)]/40 focus-within:border-[var(--ring)] focus-within:ring-2 focus-within:ring-[var(--ring)]/20 transition-all pl-3 pr-1 py-1">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Faça uma pergunta..."
              disabled={busy}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--muted-foreground)] py-1.5"
            />
            <Button
              size="icon"
              onClick={() => send()}
              disabled={busy || !input.trim()}
              className="h-7 w-7"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
