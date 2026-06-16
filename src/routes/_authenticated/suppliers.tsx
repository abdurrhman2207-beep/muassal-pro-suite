import { createFileRoute } from "@tanstack/react-router";
import { CrudPage } from "@/components/crud-page";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/suppliers")({
  head: () => ({ meta: [{ title: "الموردين — Muassal Pro" }] }),
  component: () => (
    <CrudPage
      title="الموردين"
      description="إدارة موردي المتجر"
      table="suppliers"
      adminOnly
      cols={[
        { key: "name", label: "الاسم" },
        { key: "phone", label: "الهاتف" },
        { key: "email", label: "البريد" },
        { key: "address", label: "العنوان" },
      ]}
      searchKeys={["name", "phone", "email"]}
      emptyState={{ name: "", phone: "", email: "", address: "", notes: "" }}
      renderForm={(s, set) => (
        <>
          <div className="space-y-1.5"><Label>الاسم</Label>
            <Input value={s.name ?? ""} onChange={(e) => set({ ...s, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>الهاتف</Label>
              <Input dir="ltr" value={s.phone ?? ""} onChange={(e) => set({ ...s, phone: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>البريد</Label>
              <Input dir="ltr" value={s.email ?? ""} onChange={(e) => set({ ...s, email: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5"><Label>العنوان</Label>
            <Input value={s.address ?? ""} onChange={(e) => set({ ...s, address: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>ملاحظات</Label>
            <Textarea value={s.notes ?? ""} onChange={(e) => set({ ...s, notes: e.target.value })} /></div>
        </>
      )}
    />
  ),
});