import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Printer, Eye } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/sales")({
  head: () => ({ meta: [{ title: "المبيعات — Muassal Pro" }] }),
  component: SalesPage,
});

function SalesPage() {
  const [open, setOpen] = useState<any>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["sales-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sales")
        .select("*, customers(name), sale_items(*, products(name))")
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await supabase.from("store_settings").select("*").limit(1).single()).data,
  });

  return (
    <div className="space-y-4">
      <div><h1 className="text-2xl font-bold">سجل المبيعات</h1>
        <p className="text-sm text-muted-foreground">آخر 200 فاتورة مبيعات</p></div>
      <Card className="p-4 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>رقم الفاتورة</TableHead><TableHead>التاريخ</TableHead>
            <TableHead>العميل</TableHead><TableHead>الحالة</TableHead>
            <TableHead>المدفوع / المتبقي</TableHead>
            <TableHead>الإجمالي</TableHead><TableHead>إجراء</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={6} className="text-center py-8">جاري التحميل...</TableCell></TableRow>
              : (data ?? []).map((s: any) => (
              <TableRow key={s.id}>
                <TableCell className="font-mono" dir="ltr">{s.invoice_number}</TableCell>
                <TableCell className="whitespace-nowrap">{formatDate(s.created_at)}</TableCell>
                <TableCell>{s.customers?.name ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={s.status === "paid" ? "default" : s.status === "partial" ? "secondary" : s.status === "credit" ? "destructive" : "outline"}>
                    {s.status === "paid" ? "مدفوعة" : s.status === "partial" ? "جزئي" : s.status === "credit" ? "آجل" : s.status ?? "—"}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs whitespace-nowrap">
                  <span className="text-primary">{formatCurrency(s.paid_amount ?? s.total, s.currency)}</span>
                  {Number(s.due_amount) > 0 && <span className="text-destructive"> / {formatCurrency(s.due_amount, s.currency)}</span>}
                </TableCell>
                <TableCell className="font-bold text-primary whitespace-nowrap">{formatCurrency(s.total, s.currency)}</TableCell>
                <TableCell>
                  <Button size="icon" variant="ghost" onClick={() => setOpen(s)}><Eye className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader><DialogTitle>فاتورة بيع</DialogTitle></DialogHeader>
          {open && (
            <div className="space-y-3 print:p-6" id="invoice-print">
              <div className="text-center border-b pb-3">
                <h2 className="font-bold text-xl">{settings?.store_name}</h2>
                <p className="text-xs text-muted-foreground">{settings?.address}</p>
                <p className="text-xs text-muted-foreground" dir="ltr">{settings?.phone}</p>
              </div>
              <div className="text-sm flex justify-between">
                <span dir="ltr">{open.invoice_number}</span>
                <span>{formatDate(open.created_at)}</span>
              </div>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>المنتج</TableHead><TableHead>كمية</TableHead>
                  <TableHead>سعر</TableHead><TableHead>إجمالي</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {open.sale_items.map((i: any) => (
                    <TableRow key={i.id}>
                      <TableCell>{i.products?.name}</TableCell>
                      <TableCell>{i.quantity}</TableCell>
                      <TableCell>{formatCurrency(i.unit_price)}</TableCell>
                      <TableCell>{formatCurrency(i.subtotal)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
                <div className="space-y-1 text-sm border-t pt-3">
                <div className="flex justify-between"><span>المجموع</span><span>{formatCurrency(open.subtotal, open.currency)}</span></div>
                <div className="flex justify-between"><span>الخصم</span><span>{formatCurrency(open.discount, open.currency)}</span></div>
                <div className="flex justify-between"><span>الضريبة</span><span>{formatCurrency(open.tax, open.currency)}</span></div>
                <div className="flex justify-between font-bold text-base border-t pt-1"><span>الإجمالي</span><span className="text-primary">{formatCurrency(open.total, open.currency)}</span></div>
                <div className="flex justify-between"><span>المدفوع</span><span>{formatCurrency(open.paid_amount ?? open.total, open.currency)}</span></div>
                {Number(open.due_amount) > 0 && (
                  <div className="flex justify-between font-bold text-destructive"><span>المتبقي (آجل)</span><span>{formatCurrency(open.due_amount, open.currency)}</span></div>
                )}
              </div>
              <div className="flex justify-end no-print">
                <Button onClick={() => window.print()}><Printer className="ml-2 h-4 w-4" />طباعة</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}