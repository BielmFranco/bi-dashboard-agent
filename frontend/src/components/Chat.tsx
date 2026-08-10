"use client";

import { motion } from "framer-motion";
import { MessageSquare, Send, Sparkles, StopCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ChatMsg } from "@/lib/api";
import { chatStream, fetchSuggestions } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

const FALLBACK_SUGGESTIONS = [
  "Sugira KPIs adicionais",
  "Existe sazonalidade?",
  "Quais outliers valem investigar?",
  "Como filtrar por período?",
];

export default function Chat({ fileId }: { fileId: string }) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>(FALLBACK_SUGGESTIONS);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { suggestions: s } = await fetchSuggestions(fileId);
        if (!cancelled && s.length > 0) setSuggestions(s);
      } catch {
        /* keep fallback */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fileId]);

  async function send(text?: string) {
    const t = (text ?? input).trim();
    if (!t || busy) return;
    setBusy(true);
    const nextHistory = [...msgs, { role: "user" as const, content: t }];
    setMsgs([...nextHistory, { role: "assistant", content: "" }]);
    setInput("");
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      await chatStream(
        fileId,
        msgs,
        t,
        (delta) => {
          setMsgs((prev) => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            if (last && last.role === "assistant") {
              copy[copy.length - 1] = { ...last, content: last.content + delta };
            }
            return copy;
          });
        },
        ctrl.signal,
      );
    } catch (e) {
      const isAbort = e instanceof DOMException && e.name === "AbortError";
      if (!isAbort) {
        setMsgs((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last && last.role === "assistant") {
            const msg = e instanceof Error ? e.message : String(e);
            copy[copy.length - 1] = {
              ...last,
              content: last.content + `\n\n> **Erro:** ${msg}`,
            };
          }
          return copy;
        });
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
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

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {msgs.length === 0 && (
            <div className="flex flex-col items-center text-center py-6">
              <Sparkles className="h-4 w-4 text-[var(--muted-foreground)] mb-2" />
              <p className="text-xs text-[var(--muted-foreground)] mb-3">
                Perguntas sugeridas com base nos seus dados.
              </p>
              <div className="flex flex-wrap justify-center gap-1.5">
                {suggestions.map((s) => (
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
                <p className="whitespace-pre-wrap">
                  {m.content}
                  {busy && i === msgs.length - 1 && m.role === "assistant" && (
                    <span className="inline-block w-1.5 h-3 ml-0.5 bg-[var(--muted-foreground)] animate-pulse align-middle" />
                  )}
                </p>
              </div>
            </motion.div>
          ))}
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
            {busy ? (
              <Button
                size="icon"
                variant="destructive"
                onClick={stop}
                className="h-7 w-7"
                title="Parar geração"
              >
                <StopCircle className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                size="icon"
                onClick={() => send()}
                disabled={!input.trim()}
                className="h-7 w-7"
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
