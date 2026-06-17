import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatNumber } from "@/lib/format";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { useState, useMemo } from "react";
import { Activity, TrendingUp, ShoppingBag, Target, Clock, CalendarDays } from "lucide-react";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({ meta: [{ title: "التحليلات — Muassal Pro" }] }),
  component: AnalyticsPage,
});

const RANGES = { "7": 7, "30": 30, "90": 90, "365": 365 } as const;
const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
const WEEK_DAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

function AnalyticsPage() {
  const [range, setRange] = useState<keyof typeof RANGES>("30");
  const days = RANGES[range];
  const since = useMemo(() => new Date(Date.now() - days * 86400000).toISOString(), [days]);

  const { data } = useQuery({
    queryKey: ["analytics", days],
    queryFn: async () => {
      const [sales, purchases, items, cats] = await Promise.all([
        supabase.from("sales").select("created_at, total, subtotal, discount, tax").gte("created_at", since),
        supabase.from("purchases").select("created_at, total").gte("created_at", since),
        supabase.from("sale_items").select("quantity, unit_price, unit_cost, products(name, category_id)").gte("created_at", since).limit(5000),
        supabase.from("categories").select("id, name"),
      ]);
      return { sales: sales.data ?? [], purchases: purchases.data ?? [], items: items.data ?? [], cats: cats.data ?? [] };
    },
  });

  const sales = data?.sales ?? [];
  const purchases = data?.purchases ?? [];
  const items = data?.items ?? [];
  const cats = data?.cats ?? [];

  // KPIs
  const totalRevenue = sales.reduce((s, r: any) => s + Number(r.total), 0);
  const totalProfit = items.reduce((s, r: any) => s + (Number(r.unit_price) - Number(r.unit_cost)) * Number(r.quantity), 0);
  const avgInvoice = sales.length ? totalRevenue / sales.length : 0;
  const margin = totalRevenue ? (totalProfit / totalRevenue) * 100 : 0;

  // hourly
  const hourMap = new Map<number, number>();
  for (let h = 0; h < 24; h++) hourMap.set(h, 0);
  sales.forEach((s: any) => {
    const h = new Date(s.created_at).getHours();
    hourMap.set(h, (hourMap.get(h) ?? 0) + Number(s.total));
  });
  const peakHour = Array.from(hourMap.entries()).sort((a, b) => b[1] - a[1])[0];

  // weekday
  const wdMap = new Map<number, number>();
  for (let i = 0; i < 7; i++) wdMap.set(i, 0);
  sales.forEach((s: any) => {
    const d = new Date(s.created_at).getDay();
    wdMap.set(d, (wdMap.get(d) ?? 0) + Number(s.total));
  });
  const peakDay = Array.from(wdMap.entries()).sort((a, b) => b[1] - a[1])[0];

  // daily area
  const dailyMap = new Map<string, { sales: number; purchases: number }>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(5, 10);
    dailyMap.set(d, { sales: 0, purchases: 0 });
  }
  sales.forEach((s: any) => {
    const k = String(s.created_at).slice(5, 10);
    if (dailyMap.has(k)) dailyMap.get(k)!.sales += Number(s.total);
  });
  purchases.forEach((s: any) => {
    const k = String(s.created_at).slice(5, 10);
    if (dailyMap.has(k)) dailyMap.get(k)!.purchases += Number(s.total);
  });
  const dailyChart = Array.from(dailyMap.entries()).map(([day, v]) => ({ day, ...v }));

  // categories pie
  const catMap = new Map<string, number>();
  items.forEach((it: any) => {
    const id = it.products?.category_id ?? "—";
    const name = cats.find((c: any) => c.id === id)?.name ?? "بدون صنف";
    const rev = Number(it.quantity) * Number(it.unit_price);
    catMap.set(name, (catMap.get(name) ?? 0) + rev);
  });
  const catChart = Array.from(catMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);

  // top products
  const prodMap = new Map<string, number>();
  items.forEach((it: any) => {
    const name = it.products?.name ?? "—";
    prodMap.set(name, (prodMap.get(name) ?? 0) + Number(it.quantity) * Number(it.unit_price));
  });
  const topProducts = Array.from(prodMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10).reverse();

  // heatmap weekday x hour
  const heat: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  let heatMax = 0;
  sales.forEach((s: any) => {
    const dt = new Date(s.created_at);
    const v = (heat[dt.getDay()][dt.getHours()] += Number(s.total));
    if (v > heatMax) heatMax = v;
  });

  const kpis = [
    { label: "الإيرادات", value: formatCurrency(totalRevenue), icon: TrendingUp, color: "text-primary" },
    { label: "صافي الربح", value: formatCurrency(totalProfit), icon: ShoppingBag, color: "text-emerald-600" },
    { label: "متوسط الفاتورة", value: formatCurrency(avgInvoice), icon: Target, color: "text-accent-foreground" },
    { label: "هامش الربح", value: `${margin.toFixed(1)}%`, icon: Activity, color: "text-primary" },
    { label: "أعلى ساعة", value: peakHour ? `${peakHour[0]}:00` : "—", icon: Clock, color: "text-accent-foreground" },
    { label: "أفضل يوم", value: peakDay ? WEEK_DAYS[peakDay[0]] : "—", icon: CalendarDays, color: "text-emerald-600" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">التحليلات الذكية</h1>
            <p className="text-sm text-muted-foreground">رؤى أداء المتجر</p>
          </div>
        </div>
        <Tabs value={range} onValueChange={(v) => setRange(v as any)} dir="rtl">
          <TabsList>
            <TabsTrigger value="7">7 أيام</TabsTrigger>
            <TabsTrigger value="30">30 يوم</TabsTrigger>
            <TabsTrigger value="90">90 يوم</TabsTrigger>
            <TabsTrigger value="365">سنة</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {kpis.map((k) => (
          <Card key={k.label} className="shadow-[var(--shadow-soft)]">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-muted-foreground">{k.label}</span>
                <k.icon className={`h-4 w-4 ${k.color}`} />
              </div>
              <div className="text-lg font-bold">{k.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">المبيعات مقابل المشتريات</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={dailyChart}>
                <defs>
                  <linearGradient id="gs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="day" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Legend />
                <Area type="monotone" dataKey="sales" name="مبيعات" stroke="var(--chart-1)" fill="url(#gs)" strokeWidth={2} />
                <Area type="monotone" dataKey="purchases" name="مشتريات" stroke="var(--chart-2)" fill="url(#gp)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">حصة الأصناف</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={catChart} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={2}>
                  {catChart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: any) => formatCurrency(v)} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">أفضل 10 منتجات</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={topProducts} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis type="number" fontSize={11} />
                <YAxis type="category" dataKey="name" fontSize={11} width={120} />
                <Tooltip formatter={(v: any) => formatCurrency(v)} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Bar dataKey="value" fill="var(--chart-2)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">خريطة حرارية — الأيام × الساعات</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <div className="inline-block min-w-full">
                <div className="flex">
                  <div className="w-16 shrink-0" />
                  {Array.from({ length: 24 }).map((_, h) => (
                    <div key={h} className="w-6 text-center text-[9px] text-muted-foreground">{h}</div>
                  ))}
                </div>
                {heat.map((row, d) => (
                  <div key={d} className="flex items-center">
                    <div className="w-16 shrink-0 text-xs text-muted-foreground">{WEEK_DAYS[d]}</div>
                    {row.map((v, h) => {
                      const intensity = heatMax ? v / heatMax : 0;
                      const opacity = v ? 0.15 + intensity * 0.85 : 0.05;
                      return (
                        <div key={h} className="w-6 h-6 m-[1px] rounded-sm"
                          style={{ background: `color-mix(in oklab, var(--primary) ${opacity * 100}%, transparent)` }}
                          title={`${WEEK_DAYS[d]} ${h}:00 — ${formatCurrency(v)}`} />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">كلما كان اللون أعمق، زادت المبيعات في تلك الفترة.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 text-xs text-muted-foreground">
          البيانات لآخر {formatNumber(days)} يوم · {formatNumber(sales.length)} فاتورة · {formatNumber(items.length)} بند مباع.
        </CardContent>
      </Card>
    </div>
  );
}