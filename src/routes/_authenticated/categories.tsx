import { createFileRoute } from "@tanstack/react-router";
import { CrudPage } from "@/components/crud-page";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/categories")({
  head: () => ({ meta: [{ title: "الأصناف — Muassal Pro" }] }),
  component: () => (
    <CrudPage
      title="الأصناف"
      description="تصنيفات المنتجات في المتجر"
      table="categories"
      adminOnly
      cols={[
        { key: "name", label: "الاسم" },
        { key: "description", label: "الوصف" },
      ]}
      searchKeys={["name", "description"]}
      emptyState={{ name: "", description: "" }}
      renderForm={(s, set) => (
        <>
          <div className="space-y-1.5"><Label>الاسم</Label>
            <Input value={s.name ?? ""} onChange={(e) => set({ ...s, name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>الوصف</Label>
            <Textarea value={s.description ?? ""} onChange={(e) => set({ ...s, description: e.target.value })} /></div>
        </>
      )}
    />
  ),
});