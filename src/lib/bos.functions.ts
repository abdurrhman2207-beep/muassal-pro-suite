import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getBusinessHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("calculate_business_health" as any);
    if (error) throw new Error(error.message);
    return data as { score: number; breakdown: Record<string, number>; metrics: Record<string, number> };
  });

export const recordHealthSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("record_health_snapshot" as any);
    if (error) throw new Error(error.message);
    return { id: data };
  });

export const generateDailyStrategy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const { data: health } = await context.supabase.rpc("calculate_business_health" as any);
    const { generateText } = await import("ai");
    const { createLovableAiGateway } = await import("./ai-gateway.server");
    const gateway = createLovableAiGateway(key);

    const prompt = `أنت مستشار استراتيجي تنفيذي لمتجر معسل وشيشة. حلل بيانات الأعمال التالية واقترح 4 توصيات استراتيجية عملية باللغة العربية، كل توصية في سطر واحد قصير ومحدد.

بيانات الصحة:
${JSON.stringify(health, null, 2)}

أرجع النتيجة بصيغة JSON صارمة فقط بدون أي شرح إضافي:
{"recommendations":[{"title":"...","body":"...","priority":"high|medium|low"}]}`;

    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      prompt,
    });

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return { recommendations: [] };
    let parsed: any;
    try { parsed = JSON.parse(match[0]); } catch { return { recommendations: [] }; }
    const recs = (parsed.recommendations ?? []).slice(0, 5);

    for (const r of recs) {
      await context.supabase.from("ai_recommendations").insert({
        kind: "strategy",
        title: String(r.title ?? "توصية"),
        body: String(r.body ?? ""),
        priority: ["low","medium","high"].includes(r.priority) ? r.priority : "medium",
        status: "pending",
      });
    }
    return { recommendations: recs };
  });

export const decideApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; decision: "approved" | "rejected"; note?: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("approvals")
      .update({
        status: data.decision,
        decision_note: data.note ?? null,
        approved_by: context.userId,
        decided_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });