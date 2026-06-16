import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatNumber } from "@/lib/format";
import { TrendingUp, ShoppingBag, DollarSign, AlertTriangle } from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [{ title: "الرئيسية — Muassal Pro" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [salesAll, purchasesAll, salesProfit, lowStock, daily, monthly] = await Promise.all([
        supabase.from("sales").select("total"),
        supabase.from("purchases").select("total"),
        supabase.from("sale_items").select("quantity, unit_price, unit_cost"),
        supabase.from("products").select("id, name, quantity, low_stock_threshold").order("quantity"),
        supabase.from("sales").select("created_at, total").gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString()),
        supabase.from("sales").select("created_at, total").gte("created_at", new Date(Date.now() - 365 * 86400000).toISOString()),
      ]);
      const totalSales = (salesAll.data ?? []).reduce((s: number, r: any) => s + Number(r.total), 0);
      const totalPurchases = (purchasesAll.data ?? []).reduce((s: number, r: any) => s + Number(r.total), 0);
      const totalProfit = (salesProfit.data ?? []).reduce(
        (s: number, r: any) => s + (Number(r.unit_price) - Number(r.unit_cost)) * Number(r.quantity), 0,
      );
      const low = (lowStock.data ?? []).filter((p: any) => Number(p.quantity) <= Number(p.low_stock_threshold));

      const dailyMap = new Map<string, number>();
      for (let i = 29; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
        dailyMap.set(d, 0);
      }
      (daily.data ?? []).forEach((r: any) => {
        const k = String(r.created_at).slice(0, 10);
        if (dailyMap.has(k)) dailyMap.set(k, (dailyMap.get(k) ?? 0) + Number(r.total));
      });
      const dailyChart = Array.from(dailyMap.entries()).map(([d, t]) => ({ day: d.slice(5), total: t }));

      const monthlyMap = new Map<string, number>();
      for (let i = 11; i >= 0; i--) {
        const d = new Date(); d.setMonth(d.getMonth() - i);
        monthlyMap.set(d.toISOString().slice(0, 7), 0);
      }
      (monthly.data ?? []).forEach((r: any) => {
        const k = String(r.created_at).slice(0, 7);
        if (monthlyMap.has(k)) monthlyMap.set(k, (monthlyMap.get(k) ?? 0) + Number(r.total));
      });
      const monthlyChart = Array.from(monthlyMap.entries()).map(([m, t]) => ({ month: m, total: t }));

      return { totalSales, totalPurchases, totalProfit, low, dailyChart, monthlyChart };
    },
  });

  const kpis = [
    { label: "إجمالي المبيعات", value: formatCurrency(stats?.totalSales ?? 0), icon: TrendingUp, color: "text-primary" },
    { label: "إجمالي المشتريات", value: formatCurrency(stats?.totalPurchases ?? 0), icon: ShoppingBag, color: "text-accent-foreground" },
    { label: "صافي الربح", value: formatCurrency(stats?.totalProfit ?? 0), icon: DollarSign, color: "text-emerald-600" },
    { label: "منتجات منخفضة", value: formatNumber(stats?.low.length ?? 0), icon: AlertTriangle, color: "text-destructive" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">لوحة التحكم</h1>
        <p className="text-sm text-muted-foreground">نظرة عامة على أداء المتجر</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <Card key={k.label} className="shadow-[var(--shadow-soft)] border-border/60">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                  <p className="text-2xl font-bold mt-1">{k.value}</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center">
                  <k.icon className={`h-5 w-5 ${k.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">مبيعات آخر 30 يوم</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={stats?.dailyChart ?? []}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="day" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Line type="monotone" dataKey="total" stroke="oklch(0.45 0.07 190)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">مبيعات آخر 12 شهر</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={stats?.monthlyChart ?? []}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="month" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Bar dataKey="total" fill="oklch(0.78 0.13 80)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">منتجات تحتاج تموين</CardTitle></CardHeader>
        <CardContent>
          {(stats?.low.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">جميع المنتجات بكميات كافية ✓</p>
          ) : (
            <div className="space-y-2">
              {stats!.low.slice(0, 8).map((p: any) => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                  <span className="font-medium">{p.name}</span>
                  <Badge variant="destructive">{formatNumber(p.quantity)} / {formatNumber(p.low_stock_threshold)}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}