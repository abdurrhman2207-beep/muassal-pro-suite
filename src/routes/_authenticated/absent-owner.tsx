import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ShieldAlert, Eye, Lock, Unlock, Activity, AlertTriangle, UserX, Plane, Bell, TrendingDown, Gauge } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/absent-owner")({
  head: () => ({ meta: [{ title: "وضع المالك الغائب — Muassal Pro" }] }),
  component: AbsentOwnerPage,
});

function riskColor(level: string) {
  return level === "critical" ? "text-red-500"
    : level === "high" ? "text-orange-500"
    : level === "medium" ? "text-amber-500"
    : "text-emerald-500";
}
function riskBg(level: string) {
  return level === "critical" ? "bg-red-500/10 border-red-500/30"
    : level === "high" ? "bg-orange-500/10 border-orange-500/30"
    : level === "medium" ? "bg-amber-500/10 border-amber-500/30"
    : "bg-emerald-500/10 border-emerald-500/30";
}

function AbsentOwnerPage() {
  const qc = useQueryClient();

  const settings = useQuery({
    queryKey: ["owner-mode"],
    queryFn: async () => {
      const { data } = await supabase.from("owner_mode" as any).select("*").maybeSingle();
      return data as any;
    },
  });

  const risk = useQuery({
    queryKey: ["store-risk"],
    queryFn: async () => {
      const { data } = await supabase.rpc("store_risk_score" as any);
      return data as any;
    },
    refetchInterval: 30000,
  });

  const alerts = useQuery({
    queryKey: ["security-alerts"],
    queryFn: async () => {
      const { data } = await supabase.from("security_alerts" as any)
        .select("*").order("created_at", { ascending: false }).limit(50);
      return (data ?? []) as any[];
    },
    refetchInterval: 15000,
  });

  const events = useQuery({
    queryKey: ["activity-events"],
    queryFn: async () => {
      const { data } = await supabase.from("activity_events" as any)
        .select("*").order("created_at", { ascending: false }).limit(80);
      return (data ?? []) as any[];
    },
    refetchInterval: 15000,
  });

  const trust = useQuery({
    queryKey: ["trust-scores"],
    queryFn: async () => {
      const { data } = await supabase.rpc("employee_trust_scores" as any);
      return (data ?? []) as any[];
    },
  });

  const restrictions = useQuery({
    queryKey: ["restrictions"],
    queryFn: async () => {
      const { data } = await supabase.from("account_restrictions" as any).select("*");
      return (data ?? []) as any[];
    },
  });

  const updateSettings = useMutation({
    mutationFn: async (patch: any) => {
      const { error } = await supabase.from("owner_mode" as any)
        .update({ ...patch, updated_at: new Date().toISOString() }).eq("id", true);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["owner-mode"] }); toast.success("تم التحديث"); },
    onError: (e: any) => toast.error(e?.message ?? "فشل"),
  });

  const ackAlert = async (id: string) => {
    await supabase.from("security_alerts" as any).update({
      acknowledged: true, acknowledged_at: new Date().toISOString(),
    }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["security-alerts"] });
  };

  const toggleRestriction = async (user_id: string, disabled: boolean) => {
    const { error } = await supabase.from("account_restrictions" as any).upsert({
      user_id, disabled, restricted_at: new Date().toISOString(),
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success(disabled ? "تم تعطيل الحساب" : "تم تفعيل الحساب");
    qc.invalidateQueries({ queryKey: ["restrictions"] });
  };

  const s = settings.data ?? {};
  const r = (risk.data ?? { score: 0, level: "low", events_24h: 0, flagged_24h: 0, avg_risk: 0 }) as any;
  const restrictedSet = new Map((restrictions.data ?? []).map((x: any) => [x.user_id, x.disabled]));

  return (
    <div className="space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg">
            <Plane className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">وضع المالك الغائب</h1>
            <p className="text-sm text-muted-foreground">مراقبة ذكية ورقابة آلية أثناء غيابك عن المتجر</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-2xl border bg-card">
          <div className="text-right">
            <div className="text-xs text-muted-foreground">الوضع</div>
            <div className={`font-bold ${s.enabled ? "text-emerald-500" : "text-muted-foreground"}`}>
              {s.enabled ? "مُفعّل" : "متوقف"}
            </div>
          </div>
          <Switch
            checked={!!s.enabled}
            onCheckedChange={(v) => updateSettings.mutate({ enabled: v, enabled_at: v ? new Date().toISOString() : null })}
          />
        </div>
      </div>

      {/* Hero KPIs */}
      <div className="grid md:grid-cols-4 gap-3">
        <Card className={`border-2 ${riskBg(r.level)}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">مؤشر مخاطر المتجر</span>
              <Gauge className={`h-4 w-4 ${riskColor(r.level)}`} />
            </div>
            <div className={`text-4xl font-black ${riskColor(r.level)}`}>{r.score}</div>
            <Badge className="mt-2" variant={r.level === "low" ? "secondary" : "destructive"}>
              {r.level === "critical" ? "خطر حرج" : r.level === "high" ? "مرتفع" : r.level === "medium" ? "متوسط" : "آمن"}
            </Badge>
          </CardContent>
        </Card>
        <Mini label="أحداث 24س" value={String(r.events_24h)} icon={Activity} />
        <Mini label="أنشطة مشبوهة" value={String(r.flagged_24h)} icon={AlertTriangle} accent="text-orange-500" />
        <Mini label="متوسط المخاطرة" value={String(r.avg_risk)} icon={TrendingDown} />
      </div>

      {/* Emergency Lockdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="h-4 w-4 text-destructive" /> أزرار التجميد الفوري
          </CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-3 gap-3">
          <FreezeToggle label="تجميد الخصومات" checked={!!s.freeze_discounts}
            onToggle={(v) => updateSettings.mutate({ freeze_discounts: v })} />
          <FreezeToggle label="تجميد الاسترجاع" checked={!!s.freeze_returns}
            onToggle={(v) => updateSettings.mutate({ freeze_returns: v })} />
          <FreezeToggle label="تجميد تعديل المخزون" checked={!!s.freeze_inventory}
            onToggle={(v) => updateSettings.mutate({ freeze_inventory: v })} />
        </CardContent>
      </Card>

      <Tabs defaultValue="alerts" className="w-full">
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="alerts"><Bell className="h-4 w-4 ml-1" /> التنبيهات</TabsTrigger>
          <TabsTrigger value="activity"><Eye className="h-4 w-4 ml-1" /> النشاط الحي</TabsTrigger>
          <TabsTrigger value="trust"><ShieldAlert className="h-4 w-4 ml-1" /> ثقة الموظفين</TabsTrigger>
          <TabsTrigger value="settings">القواعد</TabsTrigger>
        </TabsList>

        <TabsContent value="alerts" className="mt-4">
          <Card><CardContent className="p-4 space-y-2">
            {(alerts.data ?? []).length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-8">لا توجد تنبيهات حالياً ✓</div>
            )}
            {(alerts.data ?? []).map((a: any) => (
              <div key={a.id} className={`p-3 rounded-xl border ${riskBg(a.severity)} flex items-start justify-between gap-3`}>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className={`h-4 w-4 ${riskColor(a.severity)}`} />
                    <span className="font-semibold text-sm">{a.title}</span>
                    <Badge variant="outline" className="text-[10px]">{a.kind}</Badge>
                    {a.acknowledged && <Badge variant="secondary" className="text-[10px]">تمت المعالجة</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{a.message}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {new Date(a.created_at).toLocaleString("ar")}
                  </div>
                </div>
                {!a.acknowledged && (
                  <Button size="sm" variant="outline" onClick={() => ackAlert(a.id)}>تمت المراجعة</Button>
                )}
              </div>
            ))}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <Card><CardContent className="p-0">
            <div className="divide-y">
              {(events.data ?? []).length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-8">لم يُسجّل أي نشاط بعد</div>
              )}
              {(events.data ?? []).map((e: any) => (
                <div key={e.id} className="p-3 flex items-center justify-between gap-3 hover:bg-secondary/30">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`h-2 w-2 rounded-full ${riskColor(e.risk_level)} bg-current`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {e.event_type} {e.reason ? `— ${e.reason}` : ""}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {new Date(e.created_at).toLocaleString("ar")}
                        {e.amount != null && ` • ${formatCurrency(Number(e.amount))}`}
                      </div>
                    </div>
                  </div>
                  <Badge variant={e.flagged ? "destructive" : "secondary"} className="text-[10px]">
                    {e.risk_score}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="trust" className="mt-4">
          <Card><CardContent className="p-4 space-y-2">
            {(trust.data ?? []).map((t: any) => {
              const isDisabled = restrictedSet.get(t.user_id) === true;
              return (
                <div key={t.user_id} className="p-3 rounded-xl border bg-secondary/30 flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{t.full_name ?? "موظف"}</span>
                      {isDisabled && <Badge variant="destructive" className="text-[10px]">معطّل</Badge>}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      {t.events} نشاط • {t.flagged} مشبوه • متوسط مخاطرة {Math.round(Number(t.avg_risk))}
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full rounded-full bg-primary"
                           style={{ width: `${Math.max(0, Math.min(100, Number(t.trust_score)))}%` }} />
                    </div>
                  </div>
                  <div className="text-right space-y-2">
                    <div className="text-2xl font-bold">{Math.round(Number(t.trust_score))}</div>
                    <Button size="sm" variant={isDisabled ? "default" : "destructive"}
                            onClick={() => toggleRestriction(t.user_id, !isDisabled)}>
                      {isDisabled ? <><Unlock className="h-3 w-3 ml-1" /> تفعيل</> : <><UserX className="h-3 w-3 ml-1" /> تعطيل</>}
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <Card><CardContent className="p-4 space-y-4 max-w-xl">
            <div className="space-y-1.5">
              <Label>الحد الأقصى للخصم بدون موافقة (%)</Label>
              <Input type="number" defaultValue={s.require_approval_discount_pct ?? 15}
                     onBlur={(e) => updateSettings.mutate({ require_approval_discount_pct: Number(e.target.value) })} />
              <p className="text-[11px] text-muted-foreground">أي خصم أعلى يحتاج موافقة المالك.</p>
            </div>
            <div className="space-y-1.5">
              <Label>الحد الأقصى للاسترجاع بدون موافقة</Label>
              <Input type="number" defaultValue={s.require_approval_refund_amount ?? 50000}
                     onBlur={(e) => updateSettings.mutate({ require_approval_refund_amount: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label>ملاحظات</Label>
              <Input defaultValue={s.notes ?? ""} placeholder="سبب التفعيل، مدة الغياب..."
                     onBlur={(e) => updateSettings.mutate({ notes: e.target.value })} />
            </div>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Mini({ label, value, icon: Icon, accent }: { label: string; value: string; icon: any; accent?: string }) {
  return (
    <Card><CardContent className="p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${accent ?? "text-primary"}`} />
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </CardContent></Card>
  );
}

function FreezeToggle({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: (v: boolean) => void }) {
  return (
    <div className={`p-4 rounded-xl border-2 flex items-center justify-between gap-3 ${checked ? "border-destructive/40 bg-destructive/5" : ""}`}>
      <div>
        <div className="font-semibold text-sm">{label}</div>
        <div className="text-[11px] text-muted-foreground">{checked ? "مُجمَّد الآن" : "مسموح"}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onToggle} />
    </div>
  );
}