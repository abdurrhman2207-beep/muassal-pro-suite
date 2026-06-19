import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Zap, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/automations")({
  head: () => ({ meta: [{ title: "الأتمتة — Muassal Pro" }] }),
  component: AutomationsPage,
});

const TRIGGERS = [
  { value: "stock_low", label: "عند انخفاض المخزون" },
  { value: "sale_threshold", label: "عند تجاوز مبلغ المبيعات اليومية" },
  { value: "customer_inactive", label: "عند غياب العميل" },
  { value: "high_discount", label: "عند طلب خصم مرتفع" },
];
const ACTIONS = [
  { value: "notify_admin", label: "تنبيه المدير" },
  { value: "create_task", label: "إنشاء مهمة" },
  { value: "require_approval", label: "طلب موافقة" },
  { value: "send_announcement", label: "بث إعلان" },
];

function AutomationsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState("stock_low");
  const [action, setAction] = useState("notify_admin");

  const { data } = useQuery({
    queryKey: ["automations"],
    queryFn: async () => {
      const { data } = await supabase.from("automations").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("not signed in");
      const { error } = await supabase.from("automations").insert({
        name, trigger_type: trigger, rule_json: {}, action_json: { action }, created_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => { setName(""); toast.success("تم إنشاء قاعدة الأتمتة"); qc.invalidateQueries({ queryKey: ["automations"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const toggle = async (id: string, is_active: boolean) => {
    await supabase.from("automations").update({ is_active }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["automations"] });
  };
  const del = async (id: string) => {
    await supabase.from("automations").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["automations"] });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Zap className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">أتمتة سير العمل</h1>
          <p className="text-sm text-muted-foreground">قواعد ذكية: عندما يحدث X اعمل Y</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">قاعدة جديدة</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-4 gap-2">
          <Input placeholder="اسم القاعدة" value={name} onChange={(e) => setName(e.target.value)} />
          <Select value={trigger} onValueChange={setTrigger}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{TRIGGERS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{ACTIONS.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
          </Select>
          <Button onClick={() => create.mutate()} disabled={!name.trim() || create.isPending}>
            <Plus className="h-4 w-4 ml-1" /> إنشاء
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {(data ?? []).map((a: any) => {
          const t = TRIGGERS.find((x) => x.value === a.trigger_type)?.label ?? a.trigger_type;
          const act = ACTIONS.find((x) => x.value === a.action_json?.action)?.label ?? a.action_json?.action;
          return (
            <Card key={a.id}>
              <CardContent className="p-4 flex items-center gap-3">
                <Switch checked={a.is_active} onCheckedChange={(v) => toggle(a.id, v)} />
                <div className="flex-1">
                  <div className="font-semibold">{a.name}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    عندما <Badge variant="secondary" className="mx-1">{t}</Badge>
                    → <Badge className="mx-1">{act}</Badge>
                  </div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => del(a.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </CardContent>
            </Card>
          );
        })}
        {(data ?? []).length === 0 && (
          <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">لا توجد قواعد بعد</CardContent></Card>
        )}
      </div>
    </div>
  );
}