import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Minus, Trash2, Printer, ShoppingCart } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pos")({
  head: () => ({ meta: [{ title: "نقطة البيع — Muassal Pro" }] }),
  component: POSPage,
});

type CartItem = { product_id: string; name: string; quantity: number; unit_price: number; stock: number };

function POSPage() {
  const barcodeRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [customer, setCustomer] = useState<string>("");
  const [payment, setPayment] = useState<"cash" | "card" | "transfer">("cash");
  const [lastSaleId, setLastSaleId] = useState<string | null>(null);

  useEffect(() => { barcodeRef.current?.focus(); }, []);

  const { data: products } = useQuery({
    queryKey: ["pos-products"],
    queryFn: async () => (await supabase.from("products").select("id, name, barcode, sale_price, quantity").order("name")).data ?? [],
  });
  const { data: customers } = useQuery({
    queryKey: ["pos-customers"],
    queryFn: async () => (await supabase.from("customers").select("id, name").order("name")).data ?? [],
  });
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await supabase.from("store_settings").select("*").limit(1).single()).data,
  });

  const filtered = useMemo(() => {
    if (!search) return products?.slice(0, 30) ?? [];
    const s = search.toLowerCase();
    return (products ?? []).filter((p: any) =>
      p.name.toLowerCase().includes(s) || (p.barcode ?? "").includes(search),
    ).slice(0, 30);
  }, [search, products]);

  const addToCart = (p: any) => {
    if (Number(p.quantity) <= 0) { toast.error("المنتج غير متوفر"); return; }
    setCart((prev) => {
      const ex = prev.find((c) => c.product_id === p.id);
      if (ex) {
        if (ex.quantity + 1 > p.quantity) { toast.error("لا توجد كمية كافية"); return prev; }
        return prev.map((c) => c.product_id === p.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { product_id: p.id, name: p.name, quantity: 1, unit_price: Number(p.sale_price), stock: Number(p.quantity) }];
    });
  };

  const handleBarcode = (v: string) => {
    setSearch(v);
    const found = (products ?? []).find((p: any) => p.barcode === v.trim());
    if (found) { addToCart(found); setSearch(""); }
  };

  const updateQty = (id: string, delta: number) => {
    setCart((p) => p.map((c) => {
      if (c.product_id !== id) return c;
      const q = c.quantity + delta;
      if (q <= 0) return c;
      if (q > c.stock) { toast.error("الكمية أكبر من المخزون"); return c; }
      return { ...c, quantity: q };
    }));
  };
  const removeItem = (id: string) => setCart((p) => p.filter((c) => c.product_id !== id));

  const subtotal = cart.reduce((s, c) => s + c.quantity * c.unit_price, 0);
  const taxRate = Number(settings?.tax_rate ?? 0);
  const taxableBase = Math.max(0, subtotal - discount);
  const tax = +(taxableBase * (taxRate / 100)).toFixed(2);
  const total = +(taxableBase + tax).toFixed(2);

  const checkout = async () => {
    if (cart.length === 0) { toast.error("السلة فارغة"); return; }
    const { data, error } = await supabase.rpc("create_sale", {
      _customer_id: customer || null,
      _discount: discount,
      _tax: tax,
      _payment: payment,
      _items: cart.map((c) => ({ product_id: c.product_id, quantity: c.quantity, unit_price: c.unit_price })),
    });
    if (error) { toast.error("فشل إتمام البيع", { description: error.message }); return; }
    toast.success("تم إتمام البيع بنجاح");
    setLastSaleId(data as string);
    setCart([]); setDiscount(0); setSearch("");
    barcodeRef.current?.focus();
  };

  const printInvoice = async () => {
    if (!lastSaleId) return;
    window.print();
  };

  return (
    <div className="grid lg:grid-cols-[1fr_400px] gap-4 h-[calc(100vh-7rem)]">
      <Card className="flex flex-col overflow-hidden">
        <div className="p-3 border-b">
          <Input
            ref={barcodeRef}
            placeholder="ابحث بالاسم أو امسح الباركود..."
            value={search}
            onChange={(e) => handleBarcode(e.target.value)}
            className="text-lg h-12"
          />
        </div>
        <ScrollArea className="flex-1">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 p-3">
            {filtered.map((p: any) => (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                disabled={Number(p.quantity) <= 0}
                className="text-right p-3 rounded-xl border bg-card hover:border-primary hover:shadow-[var(--shadow-soft)] transition disabled:opacity-50"
              >
                <div className="font-semibold text-sm line-clamp-2 min-h-[2.5rem]">{p.name}</div>
                <div className="flex items-center justify-between mt-2">
                  <Badge variant="secondary">المخزون: {p.quantity}</Badge>
                  <span className="font-bold text-primary">{formatCurrency(p.sale_price)}</span>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </Card>

      <Card className="flex flex-col overflow-hidden">
        <CardContent className="p-3 border-b flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-primary" />
          <span className="font-semibold">السلة ({cart.length})</span>
        </CardContent>
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-2">
            {cart.length === 0 && <p className="text-sm text-center text-muted-foreground py-8">أضف منتجات للسلة</p>}
            {cart.map((c) => (
              <div key={c.product_id} className="p-3 rounded-lg border bg-secondary/30">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium flex-1">{c.name}</span>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeItem(c.product_id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(c.product_id, -1)}><Minus className="h-3 w-3" /></Button>
                    <span className="w-10 text-center font-semibold">{c.quantity}</span>
                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(c.product_id, 1)}><Plus className="h-3 w-3" /></Button>
                  </div>
                  <span className="font-bold text-primary">{formatCurrency(c.quantity * c.unit_price)}</span>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        <div className="border-t p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label className="text-xs">العميل</Label>
              <Select value={customer} onValueChange={setCustomer}>
                <SelectTrigger className="h-9"><SelectValue placeholder="عميل نقدي" /></SelectTrigger>
                <SelectContent>{customers?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">طريقة الدفع</Label>
              <Select value={payment} onValueChange={(v) => setPayment(v as any)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">نقدي</SelectItem>
                  <SelectItem value="card">بطاقة</SelectItem>
                  <SelectItem value="transfer">تحويل</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1"><Label className="text-xs">خصم</Label>
            <Input type="number" step="0.01" value={discount} onChange={(e) => setDiscount(Number(e.target.value) || 0)} className="h-9" /></div>
          <div className="text-sm space-y-1 pt-2 border-t">
            <div className="flex justify-between"><span>المجموع</span><span>{formatCurrency(subtotal)}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>الخصم</span><span>- {formatCurrency(discount)}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>الضريبة ({taxRate}%)</span><span>{formatCurrency(tax)}</span></div>
            <div className="flex justify-between text-lg font-bold pt-1 border-t"><span>الإجمالي</span><span className="text-primary">{formatCurrency(total)}</span></div>
          </div>
          <div className="flex gap-2">
            <Button className="flex-1 h-11" onClick={checkout}>إتمام البيع</Button>
            <Button variant="outline" className="h-11" onClick={printInvoice} disabled={!lastSaleId}><Printer className="h-4 w-4" /></Button>
          </div>
        </div>
      </Card>
    </div>
  );
}