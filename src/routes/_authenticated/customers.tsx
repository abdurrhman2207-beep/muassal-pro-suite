import { createFileRoute } from "@tanstack/react-router";
import { CrudPage } from "@/components/crud-page";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/customers")({
  head: () => ({ meta: [{ title: "العملاء — Muassal Pro" }] }),
  component: () => (
    <CrudPage
      title="العملاء"
      description="قاعدة بيانات عملاء المتجر"
      table="customers"
      cols={[
        { key: "name", label: "الاسم" },
        { key: "phone", label: "الهاتف" },
        { key: "email", label: "البريد" },
      ]}
      searchKeys={["name", "phone", "email"]}
      emptyState={{ name: "", phone: "", email: "", notes: "" }}
      renderForm={(s, set) => (
        <>
          <div className="space-y-1.5"><Label>الاسم</Label>
            <Input value={s.name ?? ""} onChange={(e) => set({ ...s, name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>الهاتف</Label>
            <Input dir="ltr" value={s.phone ?? ""} onChange={(e) => set({ ...s, phone: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>البريد</Label>
            <Input dir="ltr" value={s.email ?? ""} onChange={(e) => set({ ...s, email: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>ملاحظات</Label>
            <Textarea value={s.notes ?? ""} onChange={(e) => set({ ...s, notes: e.target.value })} /></div>
        </>
      )}
    />
  ),
});