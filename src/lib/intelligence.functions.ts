import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getIntelligenceSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any).rpc("intelligence_summary");
    if (error) throw new Error(error.message);
    return data;
  });

export const refreshAllBaselines = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any).rpc("refresh_all_baselines");
    if (error) throw new Error(error.message);
    return { processed: data };
  });

export const correlateAlerts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { window_minutes?: number }) => d)
  .handler(async ({ data, context }) => {
    const { data: n, error } = await (context.supabase as any).rpc("correlate_alerts", {
      _window_minutes: data.window_minutes ?? 60,
    });
    if (error) throw new Error(error.message);
    return { clusters_created: n };
  });

export const analyzeClusterContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cluster_id: string }) => d)
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const { data: cluster, error } = await context.supabase
      .from("alert_clusters").select("*").eq("id", data.cluster_id).single();
    if (error) throw new Error(error.message);

    const { generateText } = await import("ai");
    const { createLovableAiGateway } = await import("./ai-gateway.server");
    const gateway = createLovableAiGateway(key);

    const prompt = `أنت محلل أمني ذكي لمتجر معسل/شيشة. حلّل هذه المجموعة من الأحداث المشبوهة، خذ بالاعتبار السياق التجاري (عروض، جرد، أعياد).
بيانات المجموعة:
${JSON.stringify({ severity: cluster.severity, risk: cluster.risk_score, confidence: cluster.confidence, signals: cluster.signals, summary: cluster.summary }, null, 2)}

أعد JSON صارم فقط:
{"context_tag":"normal|suspicious|highly_suspicious","confidence":0-100,"explanation":"شرح قصير بالعربية","recommended_action":"إجراء محدد"}`;

    const { text } = await generateText({ model: gateway("google/gemini-3-flash-preview"), prompt });
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return { ok: false };
    let parsed: any;
    try { parsed = JSON.parse(match[0]); } catch { return { ok: false }; }

    await context.supabase.from("alert_clusters").update({
      context_tag: parsed.context_tag ?? cluster.context_tag,
      confidence: Math.min(100, Math.max(cluster.confidence, parsed.confidence ?? cluster.confidence)),
      ai_explanation: parsed.explanation ?? null,
      recommended_action: parsed.recommended_action ?? cluster.recommended_action,
    }).eq("id", cluster.id);

    return { ok: true, ...parsed };
  });

export const updateClusterStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status: "open" | "reviewed" | "dismissed" | "action_taken" }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("alert_clusters")
      .update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });