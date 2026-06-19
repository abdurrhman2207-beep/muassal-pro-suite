import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Brain, Send, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ai-advisor")({
  head: () => ({ meta: [{ title: "المستشار التنفيذي — Muassal Pro" }] }),
  component: AdvisorPage,
});

const SUGGESTIONS = [
  "كيف أداء متجري هذا الشهر مقارنة بالشهر الماضي؟",
  "ما المنتجات التي يجب زيادة مخزونها؟",
  "اقترح حملة لاسترجاع العملاء غير النشطين",
  "ما خطوات زيادة هامش الربح خلال 30 يوم؟",
];

function AdvisorPage() {
  const [input, setInput] = useState("");
  const transport = useRef(new DefaultChatTransport({ api: "/api/ai-advisor" })).current;
  const { messages, sendMessage, status } = useChat({ transport });
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  const send = (text: string) => {
    if (!text.trim()) return;
    sendMessage({ text: text.trim() });
    setInput("");
  };

  const loading = status === "submitted" || status === "streaming";

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-3">
        <div className="h-10 w-10 rounded-2xl bg-[image:var(--gradient-gold)] flex items-center justify-center">
          <Brain className="h-5 w-5 text-sidebar" />
        </div>
        <div>
          <h1 className="text-xl font-bold">المستشار التنفيذي</h1>
          <p className="text-xs text-muted-foreground">AI Executive Advisor — مدعوم بـ Lovable AI</p>
        </div>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardContent ref={scrollRef as any} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
              <Sparkles className="h-12 w-12 text-primary opacity-50" />
              <div>
                <div className="font-semibold">مرحبًا — أنا مستشارك التنفيذي</div>
                <div className="text-sm text-muted-foreground mt-1">اسألني عن أداء متجرك، الفرص، أو الاستراتيجية</div>
              </div>
              <div className="grid sm:grid-cols-2 gap-2 w-full max-w-xl">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-right text-xs p-3 rounded-xl border bg-secondary/30 hover:bg-secondary transition"
                  >{s}</button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => {
            const text = m.parts.map((p: any) => (p.type === "text" ? p.text : "")).join("");
            const isUser = m.role === "user";
            return (
              <div key={m.id} className={`flex ${isUser ? "justify-start" : "justify-start"}`}>
                {isUser ? (
                  <div className="max-w-[80%] rounded-2xl bg-primary text-primary-foreground px-4 py-2 text-sm whitespace-pre-wrap">
                    {text}
                  </div>
                ) : (
                  <div className="max-w-[90%] text-sm whitespace-pre-wrap leading-relaxed">{text}</div>
                )}
              </div>
            );
          })}

          {loading && (
            <div className="text-sm text-muted-foreground animate-pulse">المستشار يفكر...</div>
          )}
        </CardContent>

        <div className="border-t p-3 flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="اكتب سؤالك هنا..."
            className="resize-none min-h-[44px] max-h-32"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            disabled={loading}
          />
          <Button onClick={() => send(input)} disabled={loading || !input.trim()} size="icon" className="h-11 w-11 shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}