import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Wallet, CreditCard, Receipt } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/customer-accounts")({
  head: () => ({ meta: [{ title: "حسابات العملاء — Muassal Pro" }] }),
  component: CustomerAccountsPage,
});

function CustomerAccountsPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<any>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [pay, setPay] = useState({ amount: 0, method: "cash", sale_id: "", notes: "" });
  const [search, setSearch] = useState("");

  const { data: customers } = useQuery({
    queryKey: ["customer-accounts"],
    queryFn: async () => (await supabase.from("customers").select("*").order("balance", { ascending: false })).data ?? [],
  });
  const { data: dueSales } = useQuery({
    enabled: !!selected,
    queryKey: ["customer-due", selected?.id],
    queryFn: async () => (await supabase.from("sales").select("id, invoice_number, total, paid_amount, due_amount, status, created_at")
      .eq("customer_id", selected.id).gt("due_amount", 0).order("created_at", { ascending: false })).data ?? [],
  });
  const { data: payments } = useQuery({
    enabled: !!selected,
    queryKey: ["customer-payments", selected?.id],
    queryFn: async () => (await supabase.from("customer_payments").select("*, sales(invoice_number)")
      .eq("customer_id", selected.id).order("created_at", { ascending: false })).data ?? [],
  });

  const totalOwed = (customers ?? []).reduce((s, c: any) => s + Number(c.balance || 0), 0);
  const overLimit = (customers ?? []).filter((c: any) => c.credit_limit > 0 && c.balance > c.credit_limit).length;

  const filtered = (customers ?? []).filter((c: any) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.phone ?? "").includes(search));

  const submitPayment = async () => {
    if (pay.amount <= 0) { toast.error("أدخل مبلغًا صحيحًا"); return; }
    const { error } = await (supabase.rpc as any)("record_customer_payment", {
      _customer_id: selected.id,
      _sale_id: pay.sale_id || null,
      _amount: pay.amount,
      _method: pay.method,
      _notes: pay.notes || null,
    });
    if (error) { toast.error("فشل تسجيل الدفعة", { description: error.message }); return; }
    toast.success("تم تسجيل الدفعة");
    setPayOpen(false);
    setPay({ amount: 0, method: "cash", sale_id: "", notes: "" });
    qc.invalidateQueries({ queryKey: ["customer-accounts"] });
    qc.invalidateQueries({ queryKey: ["customer-due", selected.id] });
    qc.invalidateQueries({ queryKey: ["customer-payments", selected.id] });
    const updated = (await supabase.from("customers").select("*").eq("id", selected.id).single()).data;
    setSelected(updated);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 grid place-items-center rounded-xl bg-primary/10 text-primary"><Wallet className="h-5 w-5" /></div>
          <div><div className="text-xs text-muted-foreground">إجمالي الذمم</div>
            <div className="font-bold text-lg">{formatCurrency(totalOwed)}</div></div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 grid place-items-center rounded-xl bg-destructive/10 text-destructive"><CreditCard className="h-5 w-5" /></div>
          <div><div className="text-xs text-muted-foreground">عملاء تجاوزوا الحد</div>
            <div className="font-bold text-lg">{overLimit}</div></div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 grid place-items-center rounded-xl bg-accent/10 text-accent"><Receipt className="h-5 w-5" /></div>
          <div><div className="text-xs text-muted-foreground">عدد العملاء</div>
            <div className="font-bold text-lg">{customers?.length ?? 0}</div></div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-4">
        <Card className="p-3">
          <Input placeholder="بحث بالاسم أو الجوال..." value={search} onChange={(e) => setSearch(e.target.value)} className="mb-3" />
          <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>العميل</TableHead><TableHead>الهاتف</TableHead>
              <TableHead>الرصيد</TableHead><TableHead>الحد</TableHead><TableHead>إجراء</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.map((c: any) => {
                const over = c.credit_limit > 0 && c.balance > c.credit_limit;
                return (
                  <TableRow key={c.id} className={selected?.id === c.id ? "bg-accent/30" : ""}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell dir="ltr" className="text-xs">{c.phone ?? "—"}</TableCell>
                    <TableCell><Badge variant={c.balance > 0 ? (over ? "destructive" : "secondary") : "outline"}>
                      {formatCurrency(c.balance)}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.credit_limit > 0 ? formatCurrency(c.credit_limit) : "—"}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => setSelected(c)}>عرض</Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">لا يوجد عملاء</TableCell></TableRow>}
            </TableBody>
          </Table>
          </div>
        </Card>

        <Card className="p-4 space-y-3">
          {!selected ? (
            <div className="text-center text-muted-foreground py-12 text-sm">اختر عميلاً لعرض تفاصيله</div>
          ) : (
            <>
              <div>
                <h3 className="font-bold text-lg">{selected.name}</h3>
                <p className="text-xs text-muted-foreground" dir="ltr">{selected.phone ?? ""}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="p-2 rounded-lg bg-secondary/40">
                  <div className="text-xs text-muted-foreground">الرصيد المستحق</div>
                  <div className="font-bold text-primary">{formatCurrency(selected.balance)}</div>
                </div>
                <div className="p-2 rounded-lg bg-secondary/40">
                  <div className="text-xs text-muted-foreground">حد الائتمان</div>
                  <div className="font-bold">{formatCurrency(selected.credit_limit)}</div>
                </div>
              </div>
              <Button className="w-full" onClick={() => setPayOpen(true)}>
                <Wallet className="h-4 w-4 ml-1" /> تسجيل دفعة
              </Button>
              <div>
                <h4 className="font-semibold text-sm mb-2">فواتير غير مدفوعة</h4>
                <div className="space-y-1 max-h-48 overflow-auto">
                  {(dueSales ?? []).map((s: any) => (
                    <div key={s.id} className="flex items-center justify-between text-xs p-2 rounded bg-secondary/30">
                      <span dir="ltr">{s.invoice_number}</span>
                      <span className="text-destructive font-semibold">{formatCurrency(s.due_amount)}</span>
                    </div>
                  ))}
                  {(!dueSales || dueSales.length === 0) && <p className="text-xs text-muted-foreground text-center py-2">لا توجد مستحقات</p>}
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-sm mb-2">سجل الدفعات</h4>
                <div className="space-y-1 max-h-48 overflow-auto">
                  {(payments ?? []).map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between text-xs p-2 rounded border">
                      <span>{formatDate(p.created_at)}</span>
                      <span className="text-primary font-semibold">{formatCurrency(p.amount)}</span>
                    </div>
                  ))}
                  {(!payments || payments.length === 0) && <p className="text-xs text-muted-foreground text-center py-2">لا يوجد سجل</p>}
                </div>
              </div>
            </>
          )}
        </Card>
      </div>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>تسجيل دفعة من {selected?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>المبلغ</Label>
              <Input type="number" step="0.01" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: Number(e.target.value) || 0 })} /></div>
            <div className="space-y-1.5"><Label>طريقة الدفع</Label>
              <Select value={pay.method} onValueChange={(v) => setPay({ ...pay, method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">نقدي</SelectItem>
                  <SelectItem value="card">بطاقة</SelectItem>
                  <SelectItem value="transfer">تحويل</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>تخصيص لفاتورة (اختياري)</Label>
              <Select value={pay.sale_id} onValueChange={(v) => setPay({ ...pay, sale_id: v })}>
                <SelectTrigger><SelectValue placeholder="بدون تخصيص" /></SelectTrigger>
                <SelectContent>
                  {(dueSales ?? []).map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.invoice_number} — {formatCurrency(s.due_amount)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>ملاحظات</Label>
              <Textarea value={pay.notes} onChange={(e) => setPay({ ...pay, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>إلغاء</Button>
            <Button onClick={submitPayment}>تسجيل</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}