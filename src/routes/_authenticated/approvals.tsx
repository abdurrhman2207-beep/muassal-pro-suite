import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { decideApproval } from "@/lib/bos.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, XCircle, FileCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/approvals")({
  head: () => ({ meta: [{ title: "الموافقات — Muassal Pro" }] }),
  component: ApprovalsPage,
});

function ApprovalsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");
  const decide = useServerFn(decideApproval);

  const { data } = useQuery({
    queryKey: ["approvals", tab],
    queryFn: async () => {
      const { data } = await supabase.from("approvals").select("*").eq("status", tab).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const m = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: "approved" | "rejected" }) => decide({ data: { id, decision } }),
    onSuccess: () => {
      toast.success("تم تحديث الطلب");
      qc.invalidateQueries({ queryKey: ["approvals"] });
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <FileCheck className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">نظام الموافقات</h1>
          <p className="text-sm text-muted-foreground">إدارة طلبات الخصم والمشتريات والتغييرات</p>
        </div>
      </div>
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} dir="rtl">
        <TabsList>
          <TabsTrigger value="pending">معلّقة</TabsTrigger>
          <TabsTrigger value="approved">موافق عليها</TabsTrigger>
          <TabsTrigger value="rejected">مرفوضة</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="grid gap-3">
        {(data ?? []).length === 0 && (
          <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">لا توجد طلبات</CardContent></Card>
        )}
        {(data ?? []).map((a: any) => (
          <Card key={a.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                <span>{a.title}</span>
                <Badge variant="outline">{a.type}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <pre className="text-xs bg-secondary/40 p-3 rounded-lg overflow-auto">{JSON.stringify(a.payload, null, 2)}</pre>
              {tab === "pending" && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => m.mutate({ id: a.id, decision: "approved" })}>
                    <CheckCircle2 className="h-4 w-4 ml-1" /> موافقة
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => m.mutate({ id: a.id, decision: "rejected" })}>
                    <XCircle className="h-4 w-4 ml-1" /> رفض
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}