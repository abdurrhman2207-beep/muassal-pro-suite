import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { formatDate, formatNumber } from "@/lib/format";
import { Boxes, ArrowDownToLine, ArrowUpFromLine, AlertTriangle, Gift } from "lucide-react";

export const Route = createFileRoute("/_authenticated/inventory")({
  head: () => ({ meta: [{ title: "تحويلات المخزون — Muassal Pro" }] }),
  component: InventoryPage,
});

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  manual: { label: "تسوية يدوية", color: "secondary" },
  damage: { label: "تالف", color: "destructive" },
  gift: { label: "هدية", color: "secondary" },
  transfer_in: { label: "تحويل داخل", color: "default" },
  transfer_out: { label: "تحويل خارج", color: "secondary" },
  count: { label: "جرد", color: "secondary" },
};

function InventoryPage() {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const [productId, setProductId] = useState("");
  const [type, setType] = useState<string>("manual");
  const [qty, setQty] = useState(0);
  const [reason, setReason] = useState("");

  const { data: products } = useQuery({
    queryKey: ["inv-products"],
    queryFn: async () => (await supabase.from("products").select("id, name, quantity").order("name")).data ?? [],
  });

  const { data: adjustments } = useQuery({
    queryKey: ["adjustments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("stock_adjustments")
        .select("*, products(name)")
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  const submit = async () => {
    if (!productId) return toast.error("اختر المنتج");
    if (!qty) return toast.error("أدخل الكمية");
    const isNegative = type === "damage" || type === "gift" || type === "transfer_out";
    const signed = isNegative ? -Math.abs(qty) : Math.abs(qty);
    const { error } = await supabase.from("stock_adjustments").insert({
      product_id: productId, adjustment_type: type as any, quantity: signed, reason,
    });
    if (error) return toast.error("فشل الحفظ", { description: error.message });
    toast.success("تم تسجيل الحركة وتحديث المخزون");
    setQty(0); setReason("");
    qc.invalidateQueries({ queryKey: ["adjustments"] });
    qc.invalidateQueries({ queryKey: ["inv-products"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Boxes className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">تحويلات المخزون</h1>
          <p className="text-sm text-muted-foreground">تسجيل التحويلات، التالف، الهدايا، والجرد</p>
        </div>
      </div>

      {isAdmin && (
        <Card>
          <CardHeader><CardTitle className="text-base">حركة جديدة</CardTitle></CardHeader>
          <CardContent className="grid md:grid-cols-5 gap-3">
            <div className="space-y-1 md:col-span-2"><Label>المنتج</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger><SelectValue placeholder="اختر منتج" /></SelectTrigger>
                <SelectContent>{products?.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.name} ({formatNumber(p.quantity)})</SelectItem>
                ))}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>النوع</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>الكمية</Label>
              <Input type="number" step="0.01" value={qty} onChange={(e) => setQty(Number(e.target.value) || 0)} />
            </div>
            <div className="space-y-1"><Label>السبب</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثال: مخزن فرع الرياض" />
            </div>
            <div className="md:col-span-5">
              <Button onClick={submit}>تسجيل الحركة</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-4 gap-3">
        {[
          { t: "تالف", icon: AlertTriangle, color: "text-destructive", count: (adjustments ?? []).filter((a: any) => a.adjustment_type === "damage").length },
          { t: "هدايا", icon: Gift, color: "text-accent-foreground", count: (adjustments ?? []).filter((a: any) => a.adjustment_type === "gift").length },
          { t: "تحويلات داخل", icon: ArrowDownToLine, color: "text-emerald-600", count: (adjustments ?? []).filter((a: any) => a.adjustment_type === "transfer_in").length },
          { t: "تحويلات خارج", icon: ArrowUpFromLine, color: "text-primary", count: (adjustments ?? []).filter((a: any) => a.adjustment_type === "transfer_out").length },
        ].map((s) => (
          <Card key={s.t}><CardContent className="p-4 flex items-center justify-between">
            <div><p className="text-xs text-muted-foreground">{s.t}</p>
              <p className="text-2xl font-bold">{formatNumber(s.count)}</p></div>
            <s.icon className={`h-8 w-8 ${s.color}`} />
          </CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">سجل الحركات</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>التاريخ</TableHead><TableHead>المنتج</TableHead>
              <TableHead>النوع</TableHead><TableHead>الكمية</TableHead><TableHead>السبب</TableHead>
            </TableRow></TableHeader>
            <TableBody>{(adjustments ?? []).map((a: any) => (
              <TableRow key={a.id}>
                <TableCell className="text-xs">{formatDate(a.created_at)}</TableCell>
                <TableCell className="font-medium">{a.products?.name ?? "—"}</TableCell>
                <TableCell><Badge variant={TYPE_LABELS[a.adjustment_type]?.color as any}>{TYPE_LABELS[a.adjustment_type]?.label}</Badge></TableCell>
                <TableCell className={Number(a.quantity) < 0 ? "text-destructive font-bold" : "text-emerald-600 font-bold"}>
                  {Number(a.quantity) > 0 ? "+" : ""}{formatNumber(a.quantity)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{a.reason ?? "—"}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}