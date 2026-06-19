import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatNumber } from "@/lib/format";
import { getBusinessHealth, generateDailyStrategy, recordHealthSnapshot } from "@/lib/bos.functions";
import {
  Activity, AlertTriangle, Brain, Gauge, Sparkles, TrendingUp,
  Zap, Shield, RefreshCw, ArrowUpRight, CheckCircle2,
} from "lucide-react";
import { useMemo } from "react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Area, AreaChart } from "recharts";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/command-center")({
  head: () => ({ meta: [{ title: "مركز القيادة — Muassal Pro" }] }),
  component: CommandCenter,
});

function scoreColor(s: number) {
  if (s >= 90) return "text-emerald-500";
  if (s >= 70) return "text-primary";
  if (s >= 50) return "text-amber-500";
  return "text-destructive";
}
function scoreLabel(s: number) {
  if (s >= 90) return "ممتاز";
  if (s >= 70) return "جيد";
  if (s >= 50) return "متوسط";
  return "حرج";
}

function CommandCenter() {
  const qc = useQueryClient();
  const fetchHealth = useServerFn(getBusinessHealth);
  const fetchStrategy = useServerFn(generateDailyStrategy);
  const snapshot = useServerFn(recordHealthSnapshot);

  const health = useQuery({
    queryKey: ["bos-health"],
    queryFn: () => fetchHealth(),
    refetchInterval: 60000,
  });

  const sparkline = useQuery({
    queryKey: ["bos-sparkline"],
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data } = await supabase.from("sales").select("created_at,total").gte("created_at", since);
      const map = new Map<string, number>();
      for (let i = 29; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
        map.set(d, 0);
      }
      (data ?? []).forEach((r: any) => {
        const k = String(r.created_at).slice(0, 10);
        if (map.has(k)) map.set(k, (map.get(k) ?? 0) + Number(r.total));
      });
      return Array.from(map.entries()).map(([day, total]) => ({ day: day.slice(5), total }));
    },
  });

  const recs = useQuery({
    queryKey: ["ai-recs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_recommendations")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  const risks = useQuery({
    queryKey: ["bos-risks"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id,name,quantity,low_stock_threshold")
        .order("quantity", { ascending: true })
        .limit(20);
      return (data ?? []).filter((p: any) => Number(p.quantity) <= Number(p.low_stock_threshold));
    },
  });

  const generate = useMutation({
    mutationFn: () => fetchStrategy(),
    onSuccess: () => {
      toast.success("تم توليد توصيات استراتيجية جديدة");
      qc.invalidateQueries({ queryKey: ["ai-recs"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "تعذر توليد التوصيات"),
  });

  const snap = useMutation({
    mutationFn: () => snapshot(),
    onSuccess: () => toast.success("تم تسجيل لقطة الصحة"),
  });

  const dismissRec = async (id: string) => {
    await supabase.from("ai_recommendations").update({ status: "dismissed" }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["ai-recs"] });
  };
  const applyRec = async (id: string) => {
    await supabase.from("ai_recommendations").update({ status: "applied" }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["ai-recs"] });
  };

  const score = health.data?.score ?? 0;
  const breakdown = health.data?.breakdown ?? {};
  const metrics = health.data?.metrics ?? {};

  const axes = useMemo(() => ([
    { key: "revenue_growth", label: "نمو الإيراد", icon: TrendingUp },
    { key: "profitability", label: "الربحية", icon: Activity },
    { key: "inventory_health", label: "صحة المخزون", icon: Shield },
    { key: "customer_retention", label: "احتفاظ العملاء", icon: Sparkles },
    { key: "employee_performance", label: "أداء الموظفين", icon: Zap },
    { key: "branch_performance", label: "أداء الفروع", icon: Gauge },
  ]), []);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-[image:var(--gradient-gold)] flex items-center justify-center shadow-lg">
            <Brain className="h-6 w-6 text-sidebar" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">مركز القيادة الذكي</h1>
            <p className="text-sm text-muted-foreground">نظام تشغيل الأعمال — Business OS</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => snap.mutate()} disabled={snap.isPending}>
            <RefreshCw className="h-4 w-4 ml-1" /> لقطة
          </Button>
          <Button size="sm" onClick={() => generate.mutate()} disabled={generate.isPending}>
            <Sparkles className="h-4 w-4 ml-1" />
            {generate.isPending ? "جارٍ التحليل..." : "توليد توصيات AI"}
          </Button>
        </div>
      </div>

      {/* Hero: Health Score */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1 relative overflow-hidden bg-gradient-to-br from-card to-secondary/40">
          <CardContent className="p-6">
            <div className="text-xs text-muted-foreground mb-2">مؤشر صحة الأعمال</div>
            <div className="flex items-end gap-2">
              <div className={`text-6xl font-black ${scoreColor(score)}`}>{Math.round(score)}</div>
              <div className="text-xl text-muted-foreground mb-2">/100</div>
            </div>
            <Badge className="mt-2" variant={score >= 70 ? "default" : "destructive"}>{scoreLabel(score)}</Badge>
            <div className="mt-4 h-2 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${score}%`,
                  background: "linear-gradient(90deg, var(--chart-1), var(--chart-2))",
                }}
              />
            </div>
            <div className="mt-4 text-xs text-muted-foreground">
              مبني على 6 محاور: النمو، الربحية، المخزون، العملاء، الموظفون، الفروع.
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> إيراد آخر 30 يوم
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <Mini label="إيراد 30 يوم" value={formatCurrency(Number(metrics.revenue_30d ?? 0))} />
              <Mini label="ربح 30 يوم" value={formatCurrency(Number(metrics.profit_30d ?? 0))} />
              <Mini label="عملاء نشطون" value={formatNumber(Number(metrics.active_customers ?? 0))} />
            </div>
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={sparkline.data ?? []}>
                <defs>
                  <linearGradient id="g-cc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.7} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="day" fontSize={10} />
                <YAxis fontSize={10} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Area type="monotone" dataKey="total" stroke="var(--chart-1)" fill="url(#g-cc)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {axes.map((a) => {
          const v = Number(breakdown[a.key] ?? 0);
          return (
            <Card key={a.key}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-muted-foreground">{a.label}</span>
                  <a.icon className={`h-4 w-4 ${scoreColor(v)}`} />
                </div>
                <div className={`text-2xl font-bold ${scoreColor(v)}`}>{Math.round(v)}</div>
                <div className="mt-2 h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, v)}%` }} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* AI Recommendations */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" /> توصيات الذكاء الاستراتيجي
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(recs.data ?? []).length === 0 && (
              <div className="text-sm text-muted-foreground py-6 text-center">
                لا توجد توصيات حالياً. اضغط "توليد توصيات AI" لتحليل أعمالك الآن.
              </div>
            )}
            {(recs.data ?? []).map((r: any) => (
              <div key={r.id} className="p-3 rounded-xl border bg-secondary/30 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="font-semibold text-sm">{r.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">{r.body}</div>
                  </div>
                  <Badge variant={r.priority === "high" ? "destructive" : r.priority === "low" ? "secondary" : "default"}>
                    {r.priority === "high" ? "عاجل" : r.priority === "low" ? "منخفض" : "متوسط"}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => applyRec(r.id)}>
                    <CheckCircle2 className="h-3 w-3 ml-1" /> تطبيق
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => dismissRec(r.id)}>
                    تجاهل
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Risk Alerts */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" /> تنبيهات المخاطر
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(risks.data ?? []).length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">لا توجد مخاطر حالية ✓</div>
            ) : (
              <div className="space-y-2">
                {risks.data!.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-destructive/5 border border-destructive/20">
                    <div className="text-sm">{p.name}</div>
                    <Badge variant="destructive" className="text-[10px]">
                      {formatNumber(p.quantity)} / {formatNumber(p.low_stock_threshold)}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <div className="text-sm">
            <div className="font-semibold">المستشار التنفيذي للذكاء الاصطناعي</div>
            <div className="text-xs text-muted-foreground">احصل على تحليل تنفيذي مباشر لأعمالك بمحادثة طبيعية.</div>
          </div>
          <Button asChild>
            <a href="/ai-advisor">افتح المستشار <ArrowUpRight className="h-4 w-4 mr-1" /></a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-xl bg-secondary/50">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="text-base font-bold mt-1">{value}</div>
    </div>
  );
}