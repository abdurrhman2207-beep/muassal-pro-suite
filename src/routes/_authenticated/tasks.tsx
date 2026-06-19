import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListTodo, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({ meta: [{ title: "المهام — Muassal Pro" }] }),
  component: TasksPage,
});

const COLUMNS = [
  { id: "todo", label: "قيد الانتظار" },
  { id: "in_progress", label: "قيد التنفيذ" },
  { id: "done", label: "مكتمل" },
] as const;

function TasksPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");

  const { data } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data } = await supabase.from("tasks").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("not signed in");
      const { error } = await supabase.from("tasks").insert({
        title, priority, created_by: user.id, assigned_to: user.id, status: "todo",
      });
      if (error) throw error;
    },
    onSuccess: () => { setTitle(""); toast.success("تمت إضافة المهمة"); qc.invalidateQueries({ queryKey: ["tasks"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const move = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("tasks").update({ status: status as any }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <ListTodo className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">إدارة المهام</h1>
          <p className="text-sm text-muted-foreground">تكليف المهام وتتبع الإنجاز</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap gap-2">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان المهمة..." className="flex-1 min-w-[200px]" />
          <Select value={priority} onValueChange={(v) => setPriority(v as any)}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="low">منخفض</SelectItem>
              <SelectItem value="medium">متوسط</SelectItem>
              <SelectItem value="high">عالي</SelectItem>
              <SelectItem value="urgent">عاجل</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => create.mutate()} disabled={!title.trim() || create.isPending}>
            <Plus className="h-4 w-4 ml-1" /> إضافة
          </Button>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-3 gap-4">
        {COLUMNS.map((col) => {
          const items = (data ?? []).filter((t: any) => t.status === col.id);
          return (
            <Card key={col.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>{col.label}</span>
                  <Badge variant="secondary">{items.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {items.map((t: any) => (
                  <div key={t.id} className="p-3 rounded-lg border bg-secondary/30 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-medium">{t.title}</div>
                      <Badge variant={t.priority === "urgent" || t.priority === "high" ? "destructive" : "outline"} className="text-[10px]">{t.priority}</Badge>
                    </div>
                    <div className="flex gap-1">
                      {COLUMNS.filter((c) => c.id !== col.id).map((c) => (
                        <Button key={c.id} size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => move.mutate({ id: t.id, status: c.id })}>
                          → {c.label}
                        </Button>
                      ))}
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-destructive" onClick={() => del.mutate(t.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
                {items.length === 0 && <div className="text-xs text-muted-foreground text-center py-4">—</div>}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}