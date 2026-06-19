
# Muassal Pro — Business Operating System (BOS)

تحويل المنصة إلى نظام تشغيل أعمال كامل عبر 5 مراحل. كل مرحلة قابلة للتنفيذ والاختبار باستقلال.

## نظرة عامة على البنية

```text
[Command Center]  ← الواجهة الرئيسية للأدمن
       │
   ┌───┴────────────────────────────────────┐
   │ Health Score │ AI Advisor │ Forecasts │
   │ Strategy     │ Risk Alerts│ Live KPIs │
   └───┬────────────────────────────────────┘
       │
   ┌───┴─── BOS Modules ────────────────────┐
   │ Approvals · Tasks · Chat · Docs · KPIs │
   │ Automations · Webhooks · API · WhiteLbl│
   └────────────────────────────────────────┘
```

---

## المرحلة 1 — قاعدة بيانات BOS الأساسية

جداول جديدة (كلها مع GRANT + RLS + سياسات بحسب الدور):

- `automations` (rule_json, trigger_type, is_active)
- `automation_logs`
- `approvals` (type: discount/purchase/return/price, payload jsonb, status, requested_by, approved_by)
- `tasks` (assigned_to, due_date, status, priority, related_to)
- `task_comments`
- `announcements` (audience: all/role/branch)
- `chat_channels` + `chat_messages` (channel-based realtime)
- `documents` (storage: store-assets bucket, category, related_entity)
- `custom_kpis` (formula_sql definition, target, owner)
- `custom_reports` (definition_json للـ drag-and-drop)
- `webhooks` (url, events[], secret, is_active) + `webhook_deliveries`
- `api_keys` (hashed, scopes, last_used)
- `health_score_snapshots` (تاريخي لرصد التطور)
- `ai_recommendations` (strategy/advisor, payload, status: pending/applied/dismissed)
- `forecasts` (entity: revenue/product, period, predicted_value, confidence)
- `white_label_settings` (logo, brand_name, primary_color, custom_domain)

دوال DB:
- `calculate_business_health()` → يحسب 6 محاور (نمو، ربحية، مخزون، احتفاظ، أداء فروع، أداء موظفين) ويرجع 0-100 + breakdown.
- `record_health_snapshot()` (تشغل يوميًا عبر pg_cron).
- `process_automation_trigger(event jsonb)` لمعالجة قواعد الأتمتة.

## المرحلة 2 — AI الاستراتيجي والمحرك الذكي

Server routes (TanStack):
- `src/routes/api/ai-executive-advisor.ts` — streaming chat بـ `google/gemini-3-flash-preview` مع tools:
  - `get_health_breakdown`, `get_revenue_trend`, `get_top_products`, `get_retention_metrics`, `get_branch_performance`.
- `src/lib/ai-strategy.functions.ts`:
  - `generateDailyStrategy()` — يحلل آخر 7/30 يوم ويولّد 3-5 توصيات استراتيجية.
  - `generateExecutiveAdvice()` — رؤى CEO-level أسبوعية.
  - `forecastRevenue(days)` و `forecastDemand(productId)` — تنبؤ بسيط (regression + AI commentary).
- pg_cron job يومي يستدعي `/api/public/cron/daily-strategy` (مفتاح anon + apikey header).

## المرحلة 3 — وحدات BOS التشغيلية

صفحات جديدة تحت `_authenticated/`:

- `/command-center` (الصفحة الرئيسية الجديدة للأدمن):
  - Health Score gauge كبير + breakdown بالمحاور الستة.
  - Live KPIs (إيرادات/ربح اليوم — realtime).
  - بطاقة AI Advisor (آخر توصية + chat-button).
  - تنبيهات المخاطر (مخزون حرج، انخفاض مبيعات، عملاء فاقدون).
  - رسم Forecast 30 يوم.
  - بطاقات استراتيجية (تطبيق/تجاهل).
- `/approvals` — قائمة طلبات الموافقة + تفاصيل + قبول/رفض (مع سجل).
- `/tasks` — Kanban (todo/in-progress/done) + تكليف + موعد نهائي + تعليقات.
- `/chat` — قنوات + رسائل realtime عبر Supabase Realtime.
- `/announcements` — بث للفريق.
- `/documents` — رفع/تصنيف ملفات (store-assets bucket).
- `/automations` — منشئ قواعد visual (when/then) + سجل تشغيل.
- `/kpi-builder` — تعريف KPI مع target + عرض في Dashboard.
- `/report-builder` — drag-and-drop بسيط (اختر مصدر، أعمدة، فلتر، تجميع) + تصدير.
- `/forecasts` — تنبؤات إيراد/طلب/مخزون.
- `/webhooks` و `/api-keys` — إدارة المطورين.
- `/white-label` — شعار/اسم/لون أساسي/دومين.
- `/investor-dashboard` — مقاييس النمو والاتجاهات.

## المرحلة 4 — Approvals + Automations Integration

ربط الأنظمة الحالية:
- POS: عند خصم > حد معين → ينشئ `approval` تلقائيًا قبل إتمام البيع.
- المشتريات: عند مبلغ > حد → موافقة.
- تغيير سعر منتج → موافقة.
- Trigger DB على `sales`/`products`/`stock_adjustments` → ينفّذ `process_automation_trigger` → ينشئ notification/task/approval حسب القاعدة.

Webhooks: عند events محددة (sale.created, stock.low, approval.requested) → POST موقّع HMAC.

API Platform: `/api/public/v1/*` (products, sales, customers) بمصادقة `apikey` header مقابل `api_keys` (hashed compare).

## المرحلة 5 — White Label + Marketplace + Polish

- White-label: تطبيق ديناميكي للشعار/الاسم/اللون من `white_label_settings` على layout و styles.css (CSS variables override).
- Marketplace shell: صفحة `/marketplace` تعرض plugins (mock placeholder لـ extensions مستقبلية).
- Investor Dashboard: KPIs نمو شهري + valuation indicators (ARR proxy, growth rate).
- Command Center: تحريكات سلسة، تحديث live كل 30 ثانية، responsive للموبايل.
- E2E test (Playwright): فتح Command Center، فتح AI Advisor، إنشاء automation، اختبار approval flow.

## ملاحظات تقنية

- مكتبات إضافية: `@ai-sdk/react`, `ai`, `@ai-sdk/openai-compatible`, `@dnd-kit/core` (للـ Kanban/report builder).
- يستخدم بنية Multi-branch و Loyalty المخططة سابقًا (الخطة الأصلية في `.lovable/plan.md`).
- لا تغيير على ملفات `src/integrations/supabase/*` المولّدة.
- كل ميزة AI تستخدم Lovable AI Gateway (لا مفاتيح إضافية مطلوبة).
- Webhooks تستخدم HMAC-SHA256 + raw body verification.
- Custom domain للـ white-label يتطلب إعداد DNS من المستخدم (سيُطلب لاحقًا عند التفعيل).

## ترتيب التنفيذ المقترح

أبدأ بالمرحلة 1 (قاعدة بيانات BOS كاملة في migration واحد)، ثم 2 (AI + cron)، ثم 3 (واجهات)، ثم 4 (التكامل)، ثم 5 (الصقل).

هل أبدأ بالمرحلة 1؟
