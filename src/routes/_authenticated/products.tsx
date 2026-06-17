import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CrudPage } from "@/components/crud-page";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Barcode } from "lucide-react";
import { printBarcodeLabel } from "@/lib/print-barcode";

export const Route = createFileRoute("/_authenticated/products")({
  head: () => ({ meta: [{ title: "المنتجات — Muassal Pro" }] }),
  component: ProductsPage,
});

function ProductsPage() {
  const { data: cats } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await supabase.from("categories").select("id, name").order("name")).data ?? [],
  });
  const catName = (id: string) => cats?.find((c: any) => c.id === id)?.name ?? "-";

  return (
    <CrudPage
      title="المنتجات"
      description="إدارة منتجات المتجر والمخزون"
      table="products"
      adminOnly
      orderBy="name"
      cols={[
        { key: "name", label: "الاسم" },
        { key: "barcode", label: "الباركود", render: (r: any) => <span dir="ltr">{r.barcode ?? "-"}</span> },
        { key: "category_id", label: "الصنف", render: (r: any) => catName(r.category_id) },
        { key: "purchase_price", label: "سعر الشراء", render: (r: any) => formatCurrency(r.purchase_price) },
        { key: "sale_price", label: "سعر البيع", render: (r: any) => formatCurrency(r.sale_price) },
        { key: "quantity", label: "الكمية", render: (r: any) => {
          const low = Number(r.quantity) <= Number(r.low_stock_threshold);
          return <Badge variant={low ? "destructive" : "secondary"}>{formatNumber(r.quantity)}</Badge>;
        } },
        { key: "actions", label: "إجراءات", render: (r: any) => r.barcode ? (
          <Button size="sm" variant="outline" onClick={() => printBarcodeLabel({ code: r.barcode, name: r.name, price: formatCurrency(r.sale_price) })}>
            <Barcode className="h-3.5 w-3.5 ml-1" /> طباعة
          </Button>
        ) : <span className="text-xs text-muted-foreground">—</span> },
      ]}
      searchKeys={["name", "barcode"]}
      emptyState={{ name: "", barcode: "", category_id: null, purchase_price: 0, sale_price: 0, quantity: 0, low_stock_threshold: 5 }}
      renderForm={(s, set) => (
        <>
          <div className="space-y-1.5"><Label>اسم المنتج</Label>
            <Input value={s.name ?? ""} onChange={(e) => set({ ...s, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>الباركود</Label>
              <Input dir="ltr" value={s.barcode ?? ""} onChange={(e) => set({ ...s, barcode: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>الصنف</Label>
              <Select value={s.category_id ?? ""} onValueChange={(v) => set({ ...s, category_id: v })}>
                <SelectTrigger><SelectValue placeholder="اختر صنف" /></SelectTrigger>
                <SelectContent>{cats?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>سعر الشراء</Label>
              <Input type="number" step="0.01" value={s.purchase_price ?? 0}
                onChange={(e) => set({ ...s, purchase_price: Number(e.target.value) })} /></div>
            <div className="space-y-1.5"><Label>سعر البيع</Label>
              <Input type="number" step="0.01" value={s.sale_price ?? 0}
                onChange={(e) => set({ ...s, sale_price: Number(e.target.value) })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>الكمية الحالية</Label>
              <Input type="number" step="0.01" value={s.quantity ?? 0}
                onChange={(e) => set({ ...s, quantity: Number(e.target.value) })} /></div>
            <div className="space-y-1.5"><Label>حد التنبيه</Label>
              <Input type="number" step="0.01" value={s.low_stock_threshold ?? 5}
                onChange={(e) => set({ ...s, low_stock_threshold: Number(e.target.value) })} /></div>
          </div>
        </>
      )}
    />
  );
}