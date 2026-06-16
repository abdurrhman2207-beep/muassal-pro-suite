import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({ meta: [{ title: "المستخدمين — Muassal Pro" }] }),
  component: UsersPage,
});

function UsersPage() {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();

  const { data } = useQuery({
    queryKey: ["users-list"],
    queryFn: async () => {
      const [profiles, roles] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("*"),
      ]);
      const map = new Map<string, string[]>();
      (roles.data ?? []).forEach((r: any) => {
        map.set(r.user_id, [...(map.get(r.user_id) ?? []), r.role]);
      });
      return (profiles.data ?? []).map((p: any) => ({ ...p, roles: map.get(p.id) ?? [] }));
    },
  });

  const setRole = async (userId: string, role: "admin" | "cashier") => {
    await supabase.from("user_roles").delete().eq("user_id", userId);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
    if (error) return toast.error("فشل التعديل", { description: error.message });
    toast.success("تم تحديث الدور");
    qc.invalidateQueries({ queryKey: ["users-list"] });
  };

  return (
    <div className="space-y-4">
      <div><h1 className="text-2xl font-bold">المستخدمين</h1>
        <p className="text-sm text-muted-foreground">إدارة أدوار المستخدمين</p></div>
      <Card className="p-4 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>الاسم</TableHead><TableHead>الهاتف</TableHead>
            <TableHead>الدور</TableHead><TableHead>تاريخ الانضمام</TableHead>
            {isAdmin && <TableHead>تغيير الدور</TableHead>}
          </TableRow></TableHeader>
          <TableBody>
            {(data ?? []).map((u: any) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.full_name ?? "—"}</TableCell>
                <TableCell dir="ltr">{u.phone ?? "—"}</TableCell>
                <TableCell>
                  {u.roles.map((r: string) => (
                    <Badge key={r} variant={r === "admin" ? "default" : "secondary"} className="ml-1">
                      {r === "admin" ? "مدير" : "كاشير"}
                    </Badge>
                  ))}
                </TableCell>
                <TableCell>{formatDate(u.created_at)}</TableCell>
                {isAdmin && (
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => setRole(u.id, "admin")}>مدير</Button>
                      <Button size="sm" variant="outline" onClick={() => setRole(u.id, "cashier")}>كاشير</Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}