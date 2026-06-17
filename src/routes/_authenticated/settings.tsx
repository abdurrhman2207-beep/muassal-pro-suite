import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Download, Upload, ImageIcon } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "الإعدادات — Muassal Pro" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { isAdmin } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const restoreRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [restoring, setRestoring] = useState(false);
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

  const uploadLogo = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("store-assets").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage.from("store-assets").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      const url = signed?.signedUrl ?? "";
      setForm((f: any) => ({ ...f, logo_url: url }));
      const { error } = await supabase.from("store_settings").update({ logo_url: url }).eq("id", form.id);
      if (error) throw error;
      toast.success("تم رفع الشعار");
    } catch (e: any) {
      toast.error("فشل رفع الشعار", { description: e.message });
    } finally {
      setUploading(false);
    }
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

  const restore = async (file: File) => {
    if (!confirm("سيتم استبدال البيانات الحالية بمحتوى النسخة الاحتياطية. هل تريد المتابعة؟")) return;
    setRestoring(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const tables = parsed.tables ?? {};
      // Order matters due to FKs: children before parents on delete, parents before children on insert
      const insertOrder = ["categories", "suppliers", "customers", "products", "purchases", "purchase_items", "sales", "sale_items"];
      const deleteOrder = [...insertOrder].reverse();
      for (const t of deleteOrder) {
        await (supabase.from(t as any).delete().not("id", "is", null) as any);
      }
      for (const t of insertOrder) {
        const rows = tables[t];
        if (Array.isArray(rows) && rows.length) {
          const { error } = await (supabase.from(t as any).insert(rows) as any);
          if (error) throw new Error(`${t}: ${error.message}`);
        }
      }
      if (tables.store_settings?.[0]) {
        const s = tables.store_settings[0];
        const { id, ...rest } = s;
        await supabase.from("store_settings").update(rest).eq("id", form.id);
      }
      toast.success("تمت الاستعادة بنجاح");
    } catch (e: any) {
      toast.error("فشل الاستعادة", { description: e.message });
    } finally {
      setRestoring(false);
    }
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
          <div className="flex items-center gap-3">
            {form.logo_url ? (
              <img src={form.logo_url} alt="شعار" className="h-16 w-16 rounded-md object-cover border" />
            ) : (
              <div className="h-16 w-16 rounded-md border flex items-center justify-center bg-muted text-muted-foreground">
                <ImageIcon className="h-6 w-6" />
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); e.target.value = ""; }} />
            <Button type="button" variant="outline" disabled={!isAdmin || uploading} onClick={() => fileRef.current?.click()}>
              <Upload className="ml-2 h-4 w-4" />{uploading ? "جاري الرفع..." : "رفع شعار"}
            </Button>
          </div>
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
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={backup}><Download className="ml-2 h-4 w-4" />تصدير نسخة احتياطية (JSON)</Button>
          <input ref={restoreRef} type="file" accept="application/json" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) restore(f); e.target.value = ""; }} />
          <Button variant="outline" disabled={!isAdmin || restoring} onClick={() => restoreRef.current?.click()}>
            <Upload className="ml-2 h-4 w-4" />{restoring ? "جاري الاستعادة..." : "استعادة من ملف JSON"}
          </Button>
          {!isAdmin && <p className="text-xs text-muted-foreground w-full">الاستعادة ورفع الشعار للمدير فقط</p>}
        </CardContent>
      </Card>
    </div>
  );
}