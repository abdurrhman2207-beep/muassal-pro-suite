# Muassal Pro — Build Plan

A full Arabic RTL management system for tobacco & shisha stores, built on TanStack Start + Lovable Cloud (Supabase). Admin & Cashier roles, modern dashboard, POS, inventory, reports.

## Scope confirmation
Before I build, two quick assumptions to confirm:
1. **Language**: Arabic-first UI, RTL by default. English not included unless you ask.
2. **Currency / tax**: Configurable in Settings (default: SAR, 15% VAT). Tell me if you want different defaults.
3. **Payments**: Cash + card (recorded as payment method only — no real payment processor integration).
4. **Printing**: Browser print (A4 + 80mm thermal CSS). No hardware driver integration.

## Tech stack
- TanStack Start (already scaffolded), React 19, Tailwind v4, shadcn
- Lovable Cloud (Postgres + Auth + Storage) for DB, auth, logo upload, backups
- RTL via `dir="rtl"`, Arabic font (Cairo / IBM Plex Sans Arabic via `<link>` in `__root.tsx`)
- Dark mode toggle (class-based)
- Recharts for dashboard charts

## Roles
- **admin**: full access (users, settings, reports, purchases, all CRUD)
- **cashier**: POS + customers + view own sales only
- Roles stored in separate `user_roles` table with `has_role()` security-definer function (no role on profile)

## Modules & routes
```
/auth                      login
/_authenticated/
  /                        dashboard (KPIs + daily/monthly charts + low-stock list)
  /pos                     point of sale (barcode scan, cart, discount, print)
  /products                list + CRUD + low-stock badge
  /categories              CRUD
  /suppliers               CRUD + purchase history drawer
  /customers               CRUD + purchase history drawer
  /purchases               list + new purchase invoice (multi-line, auto stock in)
  /sales                   sales history + invoice view/print
  /reports                 daily / monthly / by-product / inventory / profit
  /settings                store info, logo, tax, backup/restore (admin only)
  /users                   user & role management (admin only)
```

## Database schema (public)
Every table: GRANTs + RLS + policies in same migration.

- `profiles` (id → auth.users, full_name, phone, avatar_url)
- `app_role` enum: `admin`, `cashier`
- `user_roles` (user_id, role) + `has_role()` SECURITY DEFINER
- `store_settings` (singleton: name, logo_url, address, phone, tax_rate, currency, invoice_prefix)
- `categories` (id, name, description)
- `products` (id, name, barcode UNIQUE, category_id, purchase_price, sale_price, quantity, low_stock_threshold, image_url)
- `suppliers` (id, name, phone, email, address, notes)
- `customers` (id, name, phone, email, notes)
- `purchases` (id, supplier_id, invoice_number, total, paid, notes, created_by, created_at)
- `purchase_items` (id, purchase_id, product_id, quantity, unit_cost, subtotal)
- `sales` (id, customer_id NULL, invoice_number, subtotal, discount, tax, total, payment_method, cashier_id, created_at)
- `sale_items` (id, sale_id, product_id, quantity, unit_price, subtotal)
- DB triggers: stock auto-increment on purchase_items insert, auto-decrement on sale_items insert, auto invoice numbering
- Views: `daily_sales_view`, `monthly_sales_view`, `product_sales_view`, `inventory_value_view`, `profit_view`

## RLS summary
- `products`, `categories`, `suppliers`, `customers`: read for authenticated, write for admin only (cashier can read)
- `sales`, `sale_items`: cashier can insert (own only), admin reads all
- `purchases`, `purchase_items`: admin only
- `store_settings`, `user_roles`: read authenticated / write admin
- `profiles`: user reads/updates own; admin reads all

## Server functions (createServerFn)
All under `src/lib/*.functions.ts`, protected with `requireSupabaseAuth`:
- `dashboard.functions.ts` → KPIs, charts data
- `products.functions.ts` → list/search/CRUD, lookup by barcode
- `pos.functions.ts` → `createSale({ items, discount, customer_id, payment_method })` (atomic via RPC)
- `purchases.functions.ts` → `createPurchase(...)` atomic
- `reports.functions.ts` → daily/monthly/product/inventory/profit
- `users.functions.ts` → admin-only list, set role, deactivate
- `settings.functions.ts` → read/update store settings, upload logo to Storage
- `backup.functions.ts` → export full JSON dump; restore from JSON (admin only)

## UI / design
- Sidebar layout (RTL: sidebar on right), top bar with store name, user menu, theme toggle
- Color palette: deep teal primary + warm gold accent (shisha-inspired, not generic SaaS purple)
- Cairo font for Arabic; semantic tokens in `src/styles.css` (oklch)
- shadcn Table, Dialog, Form, Sheet, Card; Recharts for charts
- POS: large product grid + barcode input autofocus + cart on side + numpad for discount
- Print stylesheets for invoices (A4 and 80mm thermal)

## Seed data (migration)
- Default admin role assignment helper (first signup auto-promoted to admin if no admins exist)
- Sample categories: معسل، فحم، شيشة، إكسسوارات
- Sample products (10), 2 suppliers, 2 customers, default store_settings row

## Deliverables
1. Enable Lovable Cloud
2. Migrations: schema + RLS + triggers + views + seed
3. Auth pages + role gate
4. All 10 modules above with full CRUD + RTL UI
5. Dark mode + responsive (mobile POS works)
6. Print-ready invoices
7. Backup/restore (JSON export/import)

## Out of scope (tell me to add if needed)
- Real card payment processor (Stripe/Paddle)
- Multi-branch / multi-warehouse
- Loyalty points, gift cards
- WhatsApp/SMS invoice send
- Barcode label printing (PDF generation)
- Native mobile app

Approve to proceed, or tell me what to change.
