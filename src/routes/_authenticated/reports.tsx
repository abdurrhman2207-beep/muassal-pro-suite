import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatNumber, formatDateShort } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "التقارير — Muassal Pro" }] }),
  component: ReportsPage,
});

function ReportsPage() {
  const { data } = useQuery({
    queryKey: ["reports"],
    queryFn: async () => {
      const [sales, items, products] = await Promise.all([
        supabase.from("sales").select("created_at, total, discount, tax"),
        supabase.from("sale_items").select("quantity, unit_price, unit_cost, products(name)"),
        supabase.from("products").select("id, name, quantity, purchase_price, sale_price, low_stock_threshold"),
      ]);
      return { sales: sales.data ?? [], items: items.data ?? [], products: products.data ?? [] };
    },
  });

  // daily
  const dailyMap = new Map<string, { total: number; count: number }>();
  (data?.sales ?? []).forEach((s: any) => {
    const k = s.created_at.slice(0, 10);
    const ex = dailyMap.get(k) ?? { total: 0, count: 0 };
    dailyMap.set(k, { total: ex.total + Number(s.total), count: ex.count + 1 });
  });
  const daily = Array.from(dailyMap.entries()).sort().reverse().slice(0, 30);

  // monthly
  const monthlyMap = new Map<string, { total: number; count: number }>();
  (data?.sales ?? []).forEach((s: any) => {
    const k = s.created_at.slice(0, 7);
    const ex = monthlyMap.get(k) ?? { total: 0, count: 0 };
    monthlyMap.set(k, { total: ex.total + Number(s.total), count: ex.count + 1 });
  });
  const monthly = Array.from(monthlyMap.entries()).sort().reverse();

  // by product
  const prodMap = new Map<string, { qty: number; revenue: number; profit: number }>();
  (data?.items ?? []).forEach((it: any) => {
    const k = it.products?.name ?? "—";
    const ex = prodMap.get(k) ?? { qty: 0, revenue: 0, profit: 0 };
    prodMap.set(k, {
      qty: ex.qty + Number(it.quantity),
      revenue: ex.revenue + Number(it.quantity) * Number(it.unit_price),
      profit: ex.profit + Number(it.quantity) * (Number(it.unit_price) - Number(it.unit_cost)),
    });
  });
  const byProduct = Array.from(prodMap.entries()).sort((a, b) => b[1].revenue - a[1].revenue);

  const inventoryValue = (data?.products ?? []).reduce((s: number, p: any) => s + Number(p.quantity) * Number(p.purchase_price), 0);
  const inventoryRetail = (data?.products ?? []).reduce((s: number, p: any) => s + Number(p.quantity) * Number(p.sale_price), 0);
  const totalProfit = byProduct.reduce((s, [, v]) => s + v.profit, 0);
  const totalRevenue = byProduct.reduce((s, [, v]) => s + v.revenue, 0);

  return (
    <div className="space-y-4">
      <div><h1 className="text-2xl font-bold">التقارير</h1>
        <p className="text-sm text-muted-foreground">تحليل الأداء والمخزون</p></div>

      <Tabs defaultValue="daily" dir="rtl">
        <TabsList>
          <TabsTrigger value="daily">يومي</TabsTrigger>
          <TabsTrigger value="monthly">شهري</TabsTrigger>
          <TabsTrigger value="products">حسب المنتج</TabsTrigger>
          <TabsTrigger value="inventory">المخزون</TabsTrigger>
          <TabsTrigger value="profit">الأرباح</TabsTrigger>
        </TabsList>

        <TabsContent value="daily">
          <Card><CardContent className="p-4">
            <Table><TableHeader><TableRow><TableHead>التاريخ</TableHead><TableHead>عدد الفواتير</TableHead><TableHead>الإجمالي</TableHead></TableRow></TableHeader>
              <TableBody>{daily.map(([d, v]) => (
                <TableRow key={d}><TableCell>{formatDateShort(d)}</TableCell><TableCell>{formatNumber(v.count)}</TableCell><TableCell className="font-bold">{formatCurrency(v.total)}</TableCell></TableRow>
              ))}</TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="monthly">
          <Card><CardContent className="p-4">
            <Table><TableHeader><TableRow><TableHead>الشهر</TableHead><TableHead>عدد الفواتير</TableHead><TableHead>الإجمالي</TableHead></TableRow></TableHeader>
              <TableBody>{monthly.map(([d, v]) => (
                <TableRow key={d}><TableCell>{d}</TableCell><TableCell>{formatNumber(v.count)}</TableCell><TableCell className="font-bold">{formatCurrency(v.total)}</TableCell></TableRow>
              ))}</TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="products">
          <Card><CardContent className="p-4">
            <Table><TableHeader><TableRow><TableHead>المنتج</TableHead><TableHead>الكمية المباعة</TableHead><TableHead>الإيرادات</TableHead><TableHead>الربح</TableHead></TableRow></TableHeader>
              <TableBody>{byProduct.map(([n, v]) => (
                <TableRow key={n}><TableCell>{n}</TableCell><TableCell>{formatNumber(v.qty)}</TableCell><TableCell>{formatCurrency(v.revenue)}</TableCell><TableCell className="text-emerald-600 font-bold">{formatCurrency(v.profit)}</TableCell></TableRow>
              ))}</TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="inventory">
          <div className="grid md:grid-cols-3 gap-3 mb-3">
            <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">قيمة المخزون (تكلفة)</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{formatCurrency(inventoryValue)}</CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">قيمة المخزون (بيع)</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{formatCurrency(inventoryRetail)}</CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">عدد المنتجات</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{formatNumber(data?.products.length ?? 0)}</CardContent></Card>
          </div>
          <Card><CardContent className="p-4">
            <Table><TableHeader><TableRow><TableHead>المنتج</TableHead><TableHead>الكمية</TableHead><TableHead>سعر التكلفة</TableHead><TableHead>قيمة المخزون</TableHead></TableRow></TableHeader>
              <TableBody>{(data?.products ?? []).map((p: any) => (
                <TableRow key={p.id}><TableCell>{p.name}</TableCell><TableCell>{formatNumber(p.quantity)}</TableCell><TableCell>{formatCurrency(p.purchase_price)}</TableCell><TableCell className="font-bold">{formatCurrency(Number(p.quantity) * Number(p.purchase_price))}</TableCell></TableRow>
              ))}</TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="profit">
          <div className="grid md:grid-cols-2 gap-3">
            <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">إجمالي الإيرادات</CardTitle></CardHeader><CardContent className="text-2xl font-bold text-primary">{formatCurrency(totalRevenue)}</CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">صافي الربح</CardTitle></CardHeader><CardContent className="text-2xl font-bold text-emerald-600">{formatCurrency(totalProfit)}</CardContent></Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}