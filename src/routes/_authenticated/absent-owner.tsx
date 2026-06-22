import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  getIntelligenceSummary, refreshAllBaselines, correlateAlerts,
  analyzeClusterContext, updateClusterStatus,
} from "@/lib/intelligence.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ShieldAlert, Brain, RefreshCw, GitMerge, Sparkles, Eye, CheckCheck, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/absent-owner")({
  head: () => ({ meta: [{ title: "وضع الغياب الذكي — Muassal Pro" }] }),
  component: AbsentOwnerPage,
});

const SEV_COLOR: Record<string, string> = {
  critical: "bg-destructive text-destructive-foreground",
  high: "bg-orange-600 text-white",
  warning: "bg-amber-500 text-white",
  info: "bg-secondary text-secondary-foreground",
};
const SEV_LABEL: Record<string, string> = {
  critical: "حرج", high: "مرتفع", warning: "تحذير", info: "معلومة",
};
const CTX_LABEL: Record<string, string> = {
  highly_suspicious: "مشبوه جداً", suspicious: "مشبوه", normal: "طبيعي",
};

function AbsentOwnerPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("clusters");
  const summaryFn = useServerFn(getIntelligenceSummary);
  const refreshFn = useServerFn(refreshAllBaselines);
  const correlateFn = useServerFn(correlateAlerts);
  const analyzeFn = useServerFn(analyzeClusterContext);
  const setStatusFn = useServerFn(updateClusterStatus);

  const summary = useQuery({ queryKey: ["intel-summary"], queryFn: () => summaryFn() });
  const clusters = useQuery({
    queryKey: ["alert-clusters"],
    queryFn: async () => {
      const { data } = await supabase.from("alert_clusters").select("*, profiles:user_id(full_name)").order("created_at", { ascending: false }).limit(50);
      return data ?? [];
    },
  });
  const baselines = useQuery({
    queryKey: ["baselines"],
    queryFn: async () => {
      const { data } = await supabase.from("employee_baselines").select("*, profiles:user_id(full_name)").order("last_computed_at", { ascending: false });
      return data ?? [];
    },
  });
  const rules = useQuery({
    queryKey: ["detection-rules"],
    queryFn: async () => {
      const { data } = await supabase.from("detection_rules").select("*").order("code");
      return data ?? [];
    },
  });
  const sensitivity = useQuery({
    queryKey: ["role-sensitivity"],
    queryFn: async () => (await supabase.from("role_sensitivity").select("*")).data ?? [],
  });

  const learn = useMutation({
    mutationFn: () => refreshFn(),
    onSuccess: (r: any) => { toast.success(`تم تحديث ${r.processed} ملف سلوك`); qc.invalidateQueries({ queryKey: ["baselines"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const group = useMutation({
    mutationFn: () => correlateFn({ data: { window_minutes: 60 } }),
    onSuccess: (r: any) => { toast.success(`تم تجميع ${r.clusters_created} مجموعة`); qc.invalidateQueries({ queryKey: ["alert-clusters"] }); qc.invalidateQueries({ queryKey: ["intel-summary"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const aiAnalyze = useMutation({
    mutationFn: (id: string) => analyzeFn({ data: { cluster_id: id } }),
    onSuccess: () => { toast.success("اكتمل التحليل الذكي"); qc.invalidateQueries({ queryKey: ["alert-clusters"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const setStatus = useMutation({
    mutationFn: (v: { id: string; status: any }) => setStatusFn({ data: v }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["alert-clusters"] }); qc.invalidateQueries({ queryKey: ["intel-summary"] }); },
  });

  const s = summary.data as any;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-[image:var(--gradient-gold,linear-gradient(135deg,#facc15,#f59e0b))] flex items-center justify-center">
            <ShieldAlert className="h-6 w-6 text-background" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">وضع الغياب الذكي</h1>
            <p className="text-sm text-muted-foreground">طبقة استخبارات هجينة: قواعد + سلوك + سياق</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => learn.mutate()} disabled={learn.isPending}>
            <RefreshCw className={`h-4 w-4 ml-1 ${learn.isPending ? "animate-spin" : ""}`} /> تعلّم السلوك
          </Button>
          <Button onClick={() => group.mutate()} disabled={group.isPending}>
            <GitMerge className="h-4 w-4 ml-1" /> تجميع التنبيهات
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPI title="مجموعات مفتوحة" value={s?.open_clusters ?? 0} />
        <KPI title="حرجة" value={s?.critical_clusters ?? 0} tone="destructive" />
        <KPI title="أحداث 24س" value={s?.events_24h ?? 0} />
        <KPI title="مرصودة 24س" value={s?.flagged_24h ?? 0} tone="warning" />
        <KPI title="متوسط المخاطر" value={s?.avg_risk_24h ?? 0} suffix="/100" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="clusters">المجموعات الذكية</TabsTrigger>
          <TabsTrigger value="baselines">سلوك الموظفين</TabsTrigger>
          <TabsTrigger value="rules">قواعد الكشف</TabsTrigger>
          <TabsTrigger value="roles">حساسية الأدوار</TabsTrigger>
        </TabsList>

        <TabsContent value="clusters" className="space-y-3 mt-4">
          {(clusters.data ?? []).length === 0 && (
            <Card><CardContent className="p-8 text-center text-muted-foreground">
              لا توجد مجموعات مشبوهة — استخدم زر "تجميع التنبيهات"
            </CardContent></Card>
          )}
          {(clusters.data ?? []).map((c: any) => (
            <Card key={c.id} className="border-r-4" style={{ borderRightColor: c.severity === "critical" ? "hsl(var(--destructive))" : c.severity === "high" ? "#ea580c" : c.severity === "warning" ? "#f59e0b" : "hsl(var(--border))" }}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4" />
                      {c.title}
                      <Badge className={SEV_COLOR[c.severity]}>{SEV_LABEL[c.severity]}</Badge>
                      {c.context_tag && <Badge variant="outline">{CTX_LABEL[c.context_tag] ?? c.context_tag}</Badge>}
                      <Badge variant="secondary">{c.status}</Badge>
                    </CardTitle>
                    <div className="text-xs text-muted-foreground mt-1">
                      الموظف: {c.profiles?.full_name ?? "—"} • {new Date(c.created_at).toLocaleString("ar")}
                    </div>
                  </div>
                  <div className="text-left">
                    <div className="text-2xl font-bold">{c.risk_score}<span className="text-xs text-muted-foreground">/100</span></div>
                    <div className="text-xs text-muted-foreground">ثقة {c.confidence}%</div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm">{c.summary}</p>
                <Progress value={c.risk_score} className="h-1.5" />
                {c.ai_explanation && (
                  <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-sm">
                    <div className="flex items-center gap-1 text-xs font-semibold text-primary mb-1">
                      <Sparkles className="h-3 w-3" /> تحليل AI سياقي
                    </div>
                    {c.ai_explanation}
                  </div>
                )}
                {c.recommended_action && (
                  <div className="text-sm"><span className="font-semibold">الإجراء الموصى به:</span> {c.recommended_action}</div>
                )}
                {Array.isArray(c.signals) && c.signals.length > 0 && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground">إشارات ({c.signals.length})</summary>
                    <pre className="mt-2 p-2 bg-secondary/40 rounded-lg overflow-auto">{JSON.stringify(c.signals, null, 2)}</pre>
                  </details>
                )}
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => aiAnalyze.mutate(c.id)} disabled={aiAnalyze.isPending}>
                    <Sparkles className="h-3.5 w-3.5 ml-1" /> تحليل AI
                  </Button>
                  {c.status === "open" && <>
                    <Button size="sm" variant="secondary" onClick={() => setStatus.mutate({ id: c.id, status: "reviewed" })}>
                      <Eye className="h-3.5 w-3.5 ml-1" /> مراجعة
                    </Button>
                    <Button size="sm" onClick={() => setStatus.mutate({ id: c.id, status: "action_taken" })}>
                      <CheckCheck className="h-3.5 w-3.5 ml-1" /> اتخذت إجراء
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: c.id, status: "dismissed" })}>
                      <XCircle className="h-3.5 w-3.5 ml-1" /> تجاهل
                    </Button>
                  </>}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="baselines" className="space-y-3 mt-4">
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Brain className="h-4 w-4" /> ملف سلوكي مخصص لكل موظف — يقارن النشاط بقاعدته الشخصية لا بمتوسط عام
          </div>
          {(baselines.data ?? []).length === 0 && (
            <Card><CardContent className="p-8 text-center text-muted-foreground">لم يتم تعلّم السلوك بعد — اضغط "تعلّم السلوك"</CardContent></Card>
          )}
          <div className="grid md:grid-cols-2 gap-3">
            {(baselines.data ?? []).map((b: any) => (
              <Card key={b.user_id}>
                <CardHeader className="pb-2"><CardTitle className="text-base">{b.profiles?.full_name ?? "موظف"}</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-2 text-sm">
                  <Stat label="متوسط الخصم" value={`${b.avg_discount_pct?.toFixed?.(1) ?? 0}%`} />
                  <Stat label="انحراف معياري" value={`${b.stddev_discount_pct?.toFixed?.(1) ?? 0}`} />
                  <Stat label="مبيعات/ساعة" value={b.sales_per_hour?.toFixed?.(2) ?? 0} />
                  <Stat label="استرجاع/ساعة" value={b.refunds_per_hour?.toFixed?.(2) ?? 0} />
                  <Stat label="ساعات النشاط" value={`${b.active_hour_start}:00 - ${b.active_hour_end}:00`} />
                  <Stat label="حجم العينة" value={b.sample_size} />
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="rules" className="space-y-3 mt-4">
          {(rules.data ?? []).map((r: any) => (
            <Card key={r.id}>
              <CardContent className="p-4 flex items-center gap-3 flex-wrap">
                <Badge variant={r.is_active ? "default" : "secondary"}>{r.is_active ? "نشطة" : "موقفة"}</Badge>
                <div className="flex-1 min-w-[200px]">
                  <div className="font-semibold">{r.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.event_type} • دور: {r.applies_to_role}
                    {r.threshold != null && ` • حد: ${r.threshold}`}
                    {r.max_count != null && ` • أقصى ${r.max_count} خلال ${r.window_minutes} د`}
                  </div>
                </div>
                <Badge className={SEV_COLOR[r.severity] ?? ""}>{SEV_LABEL[r.severity] ?? r.severity}</Badge>
                <Badge variant="outline">مخاطر {r.base_risk}</Badge>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="roles" className="space-y-3 mt-4">
          <div className="text-sm text-muted-foreground">حساسية الكشف تتكيف تلقائياً حسب الدور</div>
          <div className="grid md:grid-cols-3 gap-3">
            {(sensitivity.data ?? []).map((r: any) => (
              <Card key={r.role}>
                <CardHeader className="pb-2"><CardTitle className="text-base capitalize">{r.role}</CardTitle></CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <Stat label="معامل الحساسية" value={`${r.sensitivity}×`} />
                  <Stat label="حد الخصم" value={`${r.max_discount_pct}%`} />
                  <Stat label="استرجاع/ساعة" value={r.max_refund_per_hour} />
                  <Stat label="تغيير سعر" value={r.allow_price_change ? "مسموح" : "ممنوع"} />
                  <Stat label="تعديل خارج الدوام" value={r.allow_offhours_adjust ? "مسموح" : "ممنوع"} />
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KPI({ title, value, suffix, tone }: { title: string; value: any; suffix?: string; tone?: "destructive" | "warning" }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{title}</div>
        <div className={`text-2xl font-bold mt-1 ${tone === "destructive" ? "text-destructive" : tone === "warning" ? "text-amber-500" : ""}`}>
          {value}{suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}