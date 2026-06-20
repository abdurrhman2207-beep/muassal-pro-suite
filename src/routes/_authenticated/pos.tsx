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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Minus, Trash2, Printer, ShoppingCart, Wallet, Search, Camera, Package } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import { BarcodeScanner } from "@/components/barcode-scanner";

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
  const [scannerOpen, setScannerOpen] = useState(false);
  const [paidAmount, setPaidAmount] = useState<number | "">("");
  const [currency, setCurrency] = useState<string>("YER");
  const [categoryId, setCategoryId] = useState<string>("all");

  useEffect(() => { barcodeRef.current?.focus(); }, []);

  const { data: products } = useQuery({
    queryKey: ["pos-products"],
    queryFn: async () => (await supabase.from("products").select("id, name, barcode, sale_price, quantity, category_id, image_url").order("name")).data ?? [],
  });
  const { data: customers } = useQuery({
    queryKey: ["pos-customers"],
    queryFn: async () => (await supabase.from("customers").select("id, name, balance, credit_limit").order("name")).data ?? [],
  });
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await supabase.from("store_settings").select("*").limit(1).single()).data,
  });
  const { data: categories } = useQuery({
    queryKey: ["pos-categories"],
    queryFn: async () => (await supabase.from("categories").select("id, name").order("name")).data ?? [],
  });
  const { data: currencies } = useQuery({
    queryKey: ["pos-currencies"],
    queryFn: async () => (await supabase.from("currencies").select("*").order("is_base", { ascending: false })).data ?? [],
  });

  useEffect(() => { if (settings?.currency) setCurrency(settings.currency); }, [settings?.currency]);

  const filtered = useMemo(() => {
    let list = products ?? [];
    if (categoryId !== "all") list = list.filter((p: any) => p.category_id === categoryId);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((p: any) => p.name.toLowerCase().includes(s) || (p.barcode ?? "").includes(search));
    }
    return list.slice(0, 60);
  }, [search, products, categoryId]);

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

  const handleScanned = (code: string) => {
    const found = (products ?? []).find((p: any) => p.barcode === code.trim());
    if (found) { addToCart(found); toast.success(`تمت إضافة: ${found.name}`); }
    else toast.error("لم يتم العثور على المنتج", { description: code });
  };

  const productsRef = useRef(products);
  productsRef.current = products;
  useEffect(() => {
    let buf = "";
    let last = 0;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const now = Date.now();
      if (now - last > 80) buf = "";
      last = now;
      if (e.key === "Enter") {
        if (buf.length >= 3) {
          const code = buf;
          buf = "";
          const list = productsRef.current ?? [];
          const found = list.find((p: any) => p.barcode === code.trim());
          if (found) { addToCart(found); toast.success(`تمت إضافة: ${found.name}`); }
          else toast.error("لم يتم العثور على المنتج", { description: code });
        }
        return;
      }
      if (e.key.length === 1) buf += e.key;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const paid = paidAmount === "" ? total : Number(paidAmount);
  const due = Math.max(0, +(total - paid).toFixed(2));
  const selectedCustomer = customers?.find((c: any) => c.id === customer);
  const overLimit = !!(selectedCustomer && Number(selectedCustomer.credit_limit) > 0
    && (Number(selectedCustomer.balance || 0) + due) > Number(selectedCustomer.credit_limit));

  const checkout = async () => {
    if (cart.length === 0) { toast.error("السلة فارغة"); return; }
    if (due > 0 && !customer) { toast.error("اختر عميلاً للبيع الآجل"); return; }
    if (overLimit) { toast.error("تجاوز حد الائتمان للعميل"); return; }
    const { data, error } = await (supabase.rpc as any)("create_sale", {
      _customer_id: customer || null,
      _discount: discount,
      _tax: tax,
      _payment: payment,
      _items: cart.map((c) => ({ product_id: c.product_id, quantity: c.quantity, unit_price: c.unit_price })),
      _paid_amount: paid,
      _currency: currency,
      _exchange_rate: currencies?.find((cu: any) => cu.code === currency)?.exchange_rate ?? 1,
    });
    if (error) { toast.error("فشل إتمام البيع", { description: error.message }); return; }
    toast.success(due > 0 ? `تم البيع — متبقي ${formatCurrency(due, currency)}` : "تم إتمام البيع بنجاح");
    setLastSaleId(data as string);
    setCart([]); setDiscount(0); setSearch(""); setPaidAmount("");
    barcodeRef.current?.focus();
  };

  const printInvoice = async () => {
    if (!lastSaleId) return;
    window.print();
  };

  return (
    <div className="grid lg:grid-cols-[1fr_400px] gap-3 lg:h-[calc(100vh-7rem)]">
      <Card className="flex flex-col overflow-hidden min-h-[60vh]">
        <div className="p-3 border-b space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
              <Input
                ref={barcodeRef}
                placeholder="ابحث بالاسم أو امسح الباركود..."
                value={search}
                onChange={(e) => handleBarcode(e.target.value)}
                className="text-base h-12 pr-10"
              />
            </div>
            <Button variant="outline" className="h-12 shrink-0" onClick={() => setScannerOpen(true)} title="مسح بالكاميرا">
              <Camera className="h-5 w-5" />
            </Button>
          </div>
          <div className="overflow-x-auto -mx-1 px-1">
            <Tabs value={categoryId} onValueChange={setCategoryId}>
              <TabsList className="h-9 inline-flex">
                <TabsTrigger value="all" className="text-xs">الكل</TabsTrigger>
                {(categories ?? []).map((c: any) => (
                  <TabsTrigger key={c.id} value={c.id} className="text-xs whitespace-nowrap">{c.name}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2 p-3">
            {filtered.map((p: any) => (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                disabled={Number(p.quantity) <= 0}
                className="text-right p-2 rounded-xl border bg-card hover:border-primary hover:shadow-[var(--shadow-soft)] hover:-translate-y-0.5 transition disabled:opacity-50 flex flex-col gap-2"
              >
                {p.image_url ? (
                  <img src={p.image_url} alt="" loading="lazy" className="w-full h-20 object-cover rounded-lg bg-secondary" />
                ) : (
                  <div className="w-full h-20 rounded-lg bg-gradient-to-br from-secondary to-secondary/40 grid place-items-center text-muted-foreground">
                    <Package className="h-7 w-7 opacity-40" />
                  </div>
                )}
                <div className="font-semibold text-xs line-clamp-2 min-h-[2rem]">{p.name}</div>
                <div className="flex items-center justify-between gap-1">
                  <Badge variant={Number(p.quantity) <= 0 ? "destructive" : "secondary"} className="text-[10px] px-1.5">{p.quantity}</Badge>
                  <span className="font-bold text-primary text-xs truncate">{formatCurrency(p.sale_price, currency)}</span>
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full text-center py-10 text-sm text-muted-foreground">لا توجد منتجات</div>
            )}
          </div>
        </ScrollArea>
      </Card>

      <Card className="flex flex-col overflow-hidden">
        <CardContent className="p-3 border-b flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-primary" />
          <span className="font-semibold">السلة ({cart.length})</span>
          {cart.length > 0 && (
            <Button size="sm" variant="ghost" className="mr-auto text-xs text-destructive" onClick={() => setCart([])}>تفريغ</Button>
          )}
        </CardContent>
        <ScrollArea className="flex-1 max-h-[40vh] lg:max-h-none">
          <div className="p-3 space-y-2">
            {cart.length === 0 && <p className="text-sm text-center text-muted-foreground py-8">أضف منتجات للسلة</p>}
            {cart.map((c) => (
              <div key={c.product_id} className="p-3 rounded-lg border bg-secondary/30">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium flex-1 min-w-0">{c.name}</span>
                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => removeItem(c.product_id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(c.product_id, -1)}><Minus className="h-3 w-3" /></Button>
                    <span className="w-10 text-center font-semibold">{c.quantity}</span>
                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(c.product_id, 1)}><Plus className="h-3 w-3" /></Button>
                  </div>
                  <span className="font-bold text-primary">{formatCurrency(c.quantity * c.unit_price, currency)}</span>
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
                <SelectContent>{customers?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}{Number(c.balance) > 0 ? ` (${formatCurrency(c.balance, currency)})` : ""}</SelectItem>)}</SelectContent>
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
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label className="text-xs">خصم</Label>
              <Input type="number" step="0.01" value={discount} onChange={(e) => setDiscount(Number(e.target.value) || 0)} className="h-9" /></div>
            <div className="space-y-1"><Label className="text-xs">العملة</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(currencies ?? []).map((c: any) => <SelectItem key={c.code} value={c.code}>{c.symbol} {c.code}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1"><Label className="text-xs">المدفوع (اتركه فارغًا للدفع الكامل)</Label>
            <Input type="number" step="0.01" placeholder={String(total)} value={paidAmount}
              onChange={(e) => setPaidAmount(e.target.value === "" ? "" : Number(e.target.value))} className="h-9" /></div>
          <div className="text-sm space-y-1 pt-2 border-t">
            <div className="flex justify-between"><span>المجموع</span><span>{formatCurrency(subtotal, currency)}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>الخصم</span><span>- {formatCurrency(discount, currency)}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>الضريبة ({taxRate}%)</span><span>{formatCurrency(tax, currency)}</span></div>
            <div className="flex justify-between text-base font-bold pt-1 border-t"><span>الإجمالي</span><span className="text-primary">{formatCurrency(total, currency)}</span></div>
            {due > 0 && (
              <div className="flex justify-between text-base font-bold text-destructive bg-destructive/10 -mx-3 px-3 py-1 mt-1">
                <span>المتبقي (آجل)</span><span>{formatCurrency(due, currency)}</span>
              </div>
            )}
            {overLimit && (
              <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">⚠️ المبلغ يتجاوز حد ائتمان العميل</div>
            )}
          </div>
          <div className="flex gap-2">
            <Button className="flex-1 h-11" onClick={checkout} disabled={overLimit}>
              {due > 0 ? <><Wallet className="h-4 w-4 ml-1" />بيع جزئي/آجل</> : "إتمام البيع"}
            </Button>
            <Button variant="outline" className="h-11" onClick={printInvoice} disabled={!lastSaleId}><Printer className="h-4 w-4" /></Button>
          </div>
        </div>
      </Card>
      <BarcodeScanner open={scannerOpen} onOpenChange={setScannerOpen} onResult={handleScanned} />
    </div>
  );
}