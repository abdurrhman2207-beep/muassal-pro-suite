import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, ShoppingCart, Package, Tags, Truck, Users, FileText,
  Receipt, BarChart3, Settings, UserCog, LogOut, Flame, Moon, Sun, Boxes, Activity,
  Brain, FileCheck, ListTodo, MessageSquare, Zap, Wallet, ShieldAlert,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarFooter, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

type NavItem = { title: string; url: string; icon: any; role: "any" | "admin" };
const mainItems: NavItem[] = [
  { title: "الرئيسية", url: "/dashboard", icon: LayoutDashboard, role: "any" as const },
  { title: "نقطة البيع", url: "/pos", icon: ShoppingCart, role: "any" as const },
  { title: "المبيعات", url: "/sales", icon: Receipt, role: "any" as const },
];
const inventoryItems: NavItem[] = [
  { title: "المنتجات", url: "/products", icon: Package, role: "any" as const },
  { title: "الأصناف", url: "/categories", icon: Tags, role: "any" as const },
  { title: "تحويلات المخزون", url: "/inventory", icon: Boxes, role: "admin" as const },
  { title: "المشتريات", url: "/purchases", icon: FileText, role: "admin" as const },
];
const peopleItems: NavItem[] = [
  { title: "الموردين", url: "/suppliers", icon: Truck, role: "any" as const },
  { title: "العملاء", url: "/customers", icon: Users, role: "any" as const },
  { title: "حسابات العملاء", url: "/customer-accounts", icon: Wallet, role: "any" as const },
];
const adminItems: NavItem[] = [
  { title: "التحليلات", url: "/analytics", icon: Activity, role: "admin" as const },
  { title: "التقارير", url: "/reports", icon: BarChart3, role: "admin" as const },
  { title: "المستخدمين", url: "/users", icon: UserCog, role: "admin" as const },
  { title: "الإعدادات", url: "/settings", icon: Settings, role: "admin" as const },
];
const bosItems: NavItem[] = [
  { title: "مركز القيادة", url: "/command-center", icon: Brain, role: "admin" as const },
  { title: "المستشار التنفيذي", url: "/ai-advisor", icon: Brain, role: "admin" as const },
  { title: "الموافقات", url: "/approvals", icon: FileCheck, role: "any" as const },
  { title: "المهام", url: "/tasks", icon: ListTodo, role: "any" as const },
  { title: "دردشة الفريق", url: "/team-chat", icon: MessageSquare, role: "any" as const },
  { title: "الأتمتة", url: "/automations", icon: Zap, role: "admin" as const },
  { title: "وضع الغياب الذكي", url: "/absent-owner", icon: ShieldAlert, role: "admin" as const },
];

export function AppSidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const isDark = localStorage.getItem("theme") === "dark";
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);
  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const renderGroup = (label: string, items: NavItem[]) => {
    const visible = items.filter((i) => i.role === "any" || isAdmin);
    if (visible.length === 0) return null;
    return (
      <SidebarGroup>
        <SidebarGroupLabel>{label}</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {visible.map((item) => (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton asChild isActive={path === item.url}>
                  <Link to={item.url as any} className="flex items-center gap-2">
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  };

  return (
    <Sidebar side="right" collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="h-9 w-9 rounded-xl bg-[image:var(--gradient-gold)] flex items-center justify-center shadow-md">
            <Flame className="h-5 w-5 text-sidebar" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-base">Muassal Pro</span>
            <span className="text-[10px] text-sidebar-foreground/60">إدارة المعسل والشيشة</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {renderGroup("الرئيسية", mainItems)}
        {renderGroup("نظام الأعمال الذكي", bosItems)}
        {renderGroup("المخزون", inventoryItems)}
        {renderGroup("جهات الاتصال", peopleItems)}
        {renderGroup("الإدارة", adminItems)}
      </SidebarContent>
      <SidebarFooter>
        <div className="px-2 pb-2 space-y-2">
          <div className="text-xs text-sidebar-foreground/70 truncate">{user?.email}</div>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" className="flex-1 text-sidebar-foreground hover:bg-sidebar-accent" onClick={toggleTheme}>
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button size="sm" variant="ghost" className="flex-1 text-sidebar-foreground hover:bg-sidebar-accent" onClick={logout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}