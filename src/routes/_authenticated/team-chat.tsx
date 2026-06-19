import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, Send, Plus, Hash } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/team-chat")({
  head: () => ({ meta: [{ title: "دردشة الفريق — Muassal Pro" }] }),
  component: TeamChat,
});

function TeamChat() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const channels = useQuery({
    queryKey: ["chat-channels"],
    queryFn: async () => {
      const { data } = await supabase.from("chat_channels").select("*").order("created_at");
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!activeId && channels.data && channels.data.length > 0) setActiveId(channels.data[0].id);
  }, [channels.data, activeId]);

  const messages = useQuery({
    queryKey: ["chat-messages", activeId],
    queryFn: async () => {
      if (!activeId) return [];
      const { data } = await supabase.from("chat_messages").select("*").eq("channel_id", activeId).order("created_at");
      return data ?? [];
    },
    enabled: !!activeId,
  });

  useEffect(() => {
    if (!activeId) return;
    const ch = supabase
      .channel(`chat-${activeId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `channel_id=eq.${activeId}` },
        () => qc.invalidateQueries({ queryKey: ["chat-messages", activeId] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeId, qc]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.data]);

  const send = async () => {
    if (!text.trim() || !user || !activeId) return;
    const body = text.trim();
    setText("");
    const { error } = await supabase.from("chat_messages").insert({ channel_id: activeId, author_id: user.id, body });
    if (error) toast.error(error.message);
  };

  const createChannel = async () => {
    const name = prompt("اسم القناة:");
    if (!name || !user) return;
    const { error } = await supabase.from("chat_channels").insert({ name, created_by: user.id });
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["chat-channels"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <MessageSquare className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">دردشة الفريق</h1>
          <p className="text-sm text-muted-foreground">تواصل لحظي بين الموظفين</p>
        </div>
      </div>

      <div className="grid md:grid-cols-[220px_1fr] gap-3 h-[calc(100vh-12rem)]">
        <Card className="overflow-hidden flex flex-col">
          <CardContent className="p-2 flex-1 overflow-y-auto space-y-1">
            {(channels.data ?? []).map((c: any) => (
              <button key={c.id} onClick={() => setActiveId(c.id)}
                className={`w-full text-right p-2 rounded-lg text-sm flex items-center gap-2 ${activeId === c.id ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}>
                <Hash className="h-3 w-3" />{c.name}
              </button>
            ))}
            {(channels.data ?? []).length === 0 && <div className="text-xs text-muted-foreground text-center py-4">لا قنوات</div>}
          </CardContent>
          <div className="p-2 border-t">
            <Button size="sm" className="w-full" variant="outline" onClick={createChannel}>
              <Plus className="h-3 w-3 ml-1" /> قناة جديدة
            </Button>
          </div>
        </Card>

        <Card className="flex flex-col overflow-hidden">
          <CardContent ref={scrollRef as any} className="flex-1 overflow-y-auto p-3 space-y-2">
            {(messages.data ?? []).map((m: any) => (
              <div key={m.id} className={`flex ${m.author_id === user?.id ? "justify-start" : "justify-start"}`}>
                <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${m.author_id === user?.id ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                  {m.body}
                </div>
              </div>
            ))}
            {!activeId && <div className="text-sm text-muted-foreground text-center py-8">اختر قناة للبدء</div>}
          </CardContent>
          <div className="border-t p-2 flex gap-2">
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="اكتب رسالة..."
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); send(); } }} disabled={!activeId} />
            <Button onClick={send} size="icon" disabled={!activeId || !text.trim()}><Send className="h-4 w-4" /></Button>
          </div>
        </Card>
      </div>
    </div>
  );
}