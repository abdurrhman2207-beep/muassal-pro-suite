import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createLovableAiGateway } from "@/lib/ai-gateway.server";

export const Route = createFileRoute("/api/ai-advisor")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { messages } = (await request.json()) as { messages: UIMessage[] };
        if (!Array.isArray(messages)) return new Response("messages required", { status: 400 });

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const gateway = createLovableAiGateway(key);
        const result = streamText({
          model: gateway("google/gemini-3-flash-preview"),
          system: `أنت مستشار تنفيذي ذكي (Executive Advisor) لمنصة Muassal Pro لإدارة متاجر المعسل والشيشة.
- ترد دائمًا بالعربية الفصحى الواضحة.
- تقدم توصيات استراتيجية عملية ومحددة بأرقام.
- ترتب الأولويات: نمو الإيراد، الربحية، صحة المخزون، احتفاظ العملاء.
- تكون موجزًا ومباشرًا (نقاط قصيرة عند الإمكان).`,
          messages: await convertToModelMessages(messages),
        });
        return result.toUIMessageStreamResponse({ originalMessages: messages });
      },
    },
  },
});