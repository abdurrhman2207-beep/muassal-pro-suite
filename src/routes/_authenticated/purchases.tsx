import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/purchases")({
  head: () => ({ meta: [{ title: "المشتريات — Muassal Pro" }] }),
  component: PurchasesPage,
});

type Line = { product_id: string; quantity: number; unit_cost: number };

function PurchasesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [supplier, setSupplier] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([]);

  const { data: list, isLoading } = useQuery({
    queryKey: ["purchases-list"],
    queryFn: async () => (await supabase.from("purchases").select("*, suppliers(name), purchase_items(*, products(name))").order("created_at", { ascending: false }).limit(100)).data ?? [],
  });
  const { data: products } = useQuery({
    queryKey: ["products-min"],
    queryFn: async () => (await supabase.from("products").select("id, name, purchase_price").order("name")).data ?? [],
  });
  const { data: suppliers } = useQuery({
    queryKey: ["suppliers-min"],
    queryFn: async () => (await supabase.from("suppliers").select("id, name").order("name")).data ?? [],
  });

  const addLine = () => setLines((l) => [...l, { product_id: "", quantity: 1, unit_cost: 0 }]);
  const updateLine = (i: number, patch: Partial<Line>) => setLines((l) => l.map((x, idx) => idx === i ? { ...x, ...patch } : x));
  const removeLine = (i: number) => setLines((l) => l.filter((_, idx) => idx !== i));

  const total = lines.reduce((s, l) => s + l.quantity * l.unit_cost, 0);

  const save = async () => {
    if (lines.length === 0 || lines.some((l) => !l.product_id)) { toast.error("أضف بنود صحيحة"); return; }
    const { error } = await (supabase.rpc as any)("create_purchase", {
      _supplier_id: supplier || null, _notes: notes, _items: lines,
    });
    if (error) return toast.error("فشل الحفظ", { description: error.message });
    toast.success("تمت إضافة فاتورة الشراء");
    setOpen(false); setLines([]); setSupplier(""); setNotes("");
    qc.invalidateQueries({ queryKey: ["purchases-list"] });
    qc.invalidateQueries({ queryKey: ["products"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div><h1 className="text-2xl font-bold">المشتريات</h1>
          <p className="text-sm text-muted-foreground">فواتير شراء البضاعة من الموردين</p></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="ml-2 h-4 w-4" />فاتورة جديدة</Button></DialogTrigger>
          <DialogContent className="max-w-2xl" dir="rtl">
            <DialogHeader><DialogTitle>فاتورة شراء جديدة</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>المورد</Label>
                  <Select value={supplier} onValueChange={setSupplier}>
                    <SelectTrigger><SelectValue placeholder="اختر مورد" /></SelectTrigger>
                    <SelectContent>{suppliers?.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>ملاحظات</Label>
                  <Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
              </div>
              <div className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Label>البنود</Label>
                  <Button size="sm" variant="outline" onClick={addLine}><Plus className="ml-1 h-3 w-3" />بند</Button>
                </div>
                {lines.length === 0 && <p className="text-sm text-muted-foreground text-center py-2">لا توجد بنود</p>}
                {lines.map((l, i) => (
                  <div key={i} className="grid grid-cols-[1fr_90px_120px_36px] gap-2 items-end">
                    <Select value={l.product_id} onValueChange={(v) => {
                      const p = products?.find((x: any) => x.id === v);
                      updateLine(i, { product_id: v, unit_cost: Number(p?.purchase_price ?? 0) });
                    }}>
                      <SelectTrigger><SelectValue placeholder="منتج" /></SelectTrigger>
                      <SelectContent>{products?.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input type="number" min={0.01} step="0.01" value={l.quantity} onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })} />
                    <Input type="number" min={0} step="0.01" value={l.unit_cost} onChange={(e) => updateLine(i, { unit_cost: Number(e.target.value) })} />
                    <Button size="icon" variant="ghost" onClick={() => removeLine(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                ))}
              </div>
              <div className="flex justify-end text-lg font-bold">الإجمالي: <span className="text-primary mr-2">{formatCurrency(total)}</span></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
              <Button onClick={save}>حفظ</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="p-4 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>رقم</TableHead><TableHead>التاريخ</TableHead>
            <TableHead>المورد</TableHead><TableHead>عدد البنود</TableHead><TableHead>الإجمالي</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={5} className="text-center py-8">جاري التحميل...</TableCell></TableRow>
              : (list ?? []).map((p: any) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono" dir="ltr">{p.invoice_number}</TableCell>
                <TableCell>{formatDate(p.created_at)}</TableCell>
                <TableCell>{p.suppliers?.name ?? "—"}</TableCell>
                <TableCell>{p.purchase_items?.length ?? 0}</TableCell>
                <TableCell className="font-bold">{formatCurrency(p.total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}