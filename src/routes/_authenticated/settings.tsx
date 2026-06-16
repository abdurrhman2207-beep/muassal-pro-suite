import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Download, Upload } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "الإعدادات — Muassal Pro" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { data } = useQuery({
    queryKey: ["settings-full"],
    queryFn: async () => (await supabase.from("store_settings").select("*").limit(1).single()).data,
  });
  const [form, setForm] = useState<any>({});
  useEffect(() => { if (data) setForm(data); }, [data]);

  const save = async () => {
    const { id, updated_at, ...payload } = form;
    const { error } = await supabase.from("store_settings").update(payload).eq("id", id);
    if (error) return toast.error("فشل الحفظ", { description: error.message });
    toast.success("تم حفظ الإعدادات");
  };

  const backup = async () => {
    const tables = ["store_settings", "categories", "products", "suppliers", "customers", "purchases", "purchase_items", "sales", "sale_items", "user_roles", "profiles"];
    const dump: Record<string, any> = {};
    for (const t of tables) {
      const { data } = await (supabase.from(t as any).select("*") as any);
      dump[t] = data ?? [];
    }
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), tables: dump }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `muassal-backup-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
    toast.success("تم تصدير النسخة الاحتياطية");
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div><h1 className="text-2xl font-bold">الإعدادات</h1>
        <p className="text-sm text-muted-foreground">معلومات المتجر والضريبة والنسخ الاحتياطي</p></div>

      <Card>
        <CardHeader><CardTitle>معلومات المتجر</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>اسم المتجر</Label>
              <Input value={form.store_name ?? ""} onChange={(e) => setForm({ ...form, store_name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>الهاتف</Label>
              <Input dir="ltr" value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5"><Label>العنوان</Label>
            <Textarea value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>البريد</Label>
            <Input dir="ltr" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>رابط الشعار</Label>
            <Input dir="ltr" value={form.logo_url ?? ""} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>إعدادات الضريبة والفواتير</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5"><Label>نسبة الضريبة %</Label>
              <Input type="number" step="0.01" value={form.tax_rate ?? 0} onChange={(e) => setForm({ ...form, tax_rate: Number(e.target.value) })} /></div>
            <div className="space-y-1.5"><Label>العملة</Label>
              <Input value={form.currency ?? ""} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>بادئة الفاتورة</Label>
              <Input dir="ltr" value={form.invoice_prefix ?? ""} onChange={(e) => setForm({ ...form, invoice_prefix: e.target.value })} /></div>
          </div>
        </CardContent>
      </Card>

      <Button onClick={save}>حفظ الإعدادات</Button>

      <Card>
        <CardHeader><CardTitle>النسخ الاحتياطي</CardTitle></CardHeader>
        <CardContent className="flex gap-2">
          <Button variant="outline" onClick={backup}><Download className="ml-2 h-4 w-4" />تصدير نسخة احتياطية (JSON)</Button>
        </CardContent>
      </Card>
    </div>
  );
}