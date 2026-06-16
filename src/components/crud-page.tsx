import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export type Col<T> = { key: keyof T | string; label: string; render?: (row: T) => React.ReactNode };

export function CrudPage<T extends { id: string }>(props: {
  title: string;
  description?: string;
  table: string;
  cols: Col<T>[];
  searchKeys: string[];
  renderForm: (state: any, set: (s: any) => void) => React.ReactNode;
  emptyState?: any;
  adminOnly?: boolean;
  orderBy?: string;
}) {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [form, setForm] = useState<any>(props.emptyState ?? {});
  const [del, setDel] = useState<T | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: [props.table],
    queryFn: async () => {
      const { data, error } = await (supabase.from(props.table as any).select("*").order(props.orderBy ?? "created_at", { ascending: false }) as any);
      if (error) throw error;
      return (data ?? []) as T[];
    },
  });

  const filtered = (data ?? []).filter((row: any) =>
    !search || props.searchKeys.some((k) => String(row[k] ?? "").toLowerCase().includes(search.toLowerCase())),
  );

  const openCreate = () => { setEditing(null); setForm(props.emptyState ?? {}); setOpen(true); };
  const openEdit = (row: T) => { setEditing(row); setForm(row); setOpen(true); };

  const save = async () => {
    const payload = { ...form };
    delete payload.id; delete payload.created_at; delete payload.updated_at;
    if (editing) {
      const { error } = await (supabase.from(props.table as any).update(payload).eq("id", editing.id) as any);
      if (error) return toast.error("فشل التعديل", { description: error.message });
      toast.success("تم التعديل");
    } else {
      const { error } = await (supabase.from(props.table as any).insert(payload) as any);
      if (error) return toast.error("فشل الإضافة", { description: error.message });
      toast.success("تمت الإضافة");
    }
    setOpen(false);
    qc.invalidateQueries({ queryKey: [props.table] });
  };

  const confirmDelete = async () => {
    if (!del) return;
    const { error } = await (supabase.from(props.table as any).delete().eq("id", del.id) as any);
    if (error) return toast.error("فشل الحذف", { description: error.message });
    toast.success("تم الحذف");
    setDel(null);
    qc.invalidateQueries({ queryKey: [props.table] });
  };

  const canEdit = !props.adminOnly || isAdmin;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">{props.title}</h1>
          {props.description && <p className="text-sm text-muted-foreground">{props.description}</p>}
        </div>
        {canEdit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}><Plus className="ml-2 h-4 w-4" /> إضافة</Button>
            </DialogTrigger>
            <DialogContent dir="rtl">
              <DialogHeader><DialogTitle>{editing ? "تعديل" : "إضافة جديد"}</DialogTitle></DialogHeader>
              <div className="space-y-3">{props.renderForm(form, setForm)}</div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
                <Button onClick={save}>حفظ</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card className="p-4">
        <div className="relative mb-3">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="بحث..." className="pr-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {props.cols.map((c) => <TableHead key={String(c.key)}>{c.label}</TableHead>)}
                {canEdit && <TableHead className="w-20">إجراءات</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={props.cols.length + 1} className="text-center text-muted-foreground py-8">جاري التحميل...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={props.cols.length + 1} className="text-center text-muted-foreground py-8">لا توجد بيانات</TableCell></TableRow>
              ) : filtered.map((row: any) => (
                <TableRow key={row.id}>
                  {props.cols.map((c) => (
                    <TableCell key={String(c.key)}>{c.render ? c.render(row) : String(row[c.key] ?? "")}</TableCell>
                  ))}
                  {canEdit && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(row)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => setDel(row)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <AlertDialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>هل أنت متأكد من حذف هذا العنصر؟ لا يمكن التراجع.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}