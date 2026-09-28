import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { canAccessAnalytics, canManageGlobalUsers } from "@/lib/authz";
import { useLocation } from "wouter";
import {
  BarChart3,
  ClipboardList,
  ClipboardPenLine,
  Inbox,
  LayoutGrid,
  MessageSquare,
  Search,
  Settings,
  Users,
  Building2,
  LifeBuoy,
  Shield,
  Plane,
  Hotel,
  CreditCard,
  PackageSearch,
  Receipt,
} from "lucide-react";

const navItems = [
  { id: "inbox", icon: Inbox, label: "Ticket inbox", path: "/tickets" },
  { id: "boards", icon: LayoutGrid, label: "Work queues", path: "/dashboard" },
  { id: "daily-ops", icon: ClipboardPenLine, label: "Daily Ops", path: "/workspace/daily-ops" },
  { id: "analytics", icon: BarChart3, label: "Analytics", path: "/workspace/analytics" },
  { id: "customers", icon: Users, label: "Customers", path: "/workspace/customers" },
  { id: "orders", icon: ClipboardList, label: "Orders", path: "/orders" },
  { id: "suppliers", icon: Building2, label: "Suppliers", path: "/workspace/suppliers" },
  { id: "search", icon: Search, label: "Global search", path: "/workspace/search" },
  { id: "chat", icon: MessageSquare, label: "Chat", path: "/workspace/chat" },
];

const bottomItems = [
  { id: "admin-tickets", icon: Inbox, label: "Admin Tickets", path: "/workspace/admin-tickets" },
  { id: "admin-users", icon: Shield, label: "Admin Users", path: "/workspace/admin-users" },
  { id: "audit", icon: ClipboardList, label: "Audit", path: "/workspace/audit" },
  { id: "support", icon: LifeBuoy, label: "Support", path: "/workspace/support" },
  { id: "settings", icon: Settings, label: "Settings", path: "/workspace/settings" },
];

export default function SidebarRail() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const activeOrderView = new URLSearchParams(location.split("?")[1] || "").get("view") || "all";
  const visibleNavItems = navItems.filter((item) => item.id !== "analytics" || canAccessAnalytics(user));
  const visibleBottomItems = bottomItems.filter((item) => {
    if (item.id === "admin-users" || item.id === "admin-tickets" || item.id === "audit") return canManageGlobalUsers(user);
    return true;
  });

  return (
    <aside className="flex w-[76px] shrink-0 flex-col border-r border-[#14243A] bg-[#091525] px-3 py-5 text-white md:w-[232px] md:px-4">
      <button
        type="button"
        title="Dashboard"
        onClick={() => setLocation("/dashboard")}
        className="flex h-12 w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-br from-[#17B897] via-[#1493B8] to-[#2063E9] text-base font-bold text-white shadow-[0_18px_34px_rgba(23,184,151,0.28)] md:justify-start md:px-3"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20">T</span>
        <span className="hidden text-sm tracking-[0.12em] md:inline">TRAVEL DESK</span>
      </button>

      <div className="mt-5 h-px w-10 bg-white/10" />

      <div className="mt-5 hidden px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6F86A8] md:block">
        Operations
      </div>
      <div className="mt-3 flex flex-col items-center gap-2 md:items-stretch">
        {visibleNavItems.map((item) => (
          <button
            key={item.id}
            title={item.label}
            onClick={() => item.path && setLocation(item.path)}
            className={cn(
              "flex h-11 w-11 items-center justify-center gap-3 rounded-xl border border-transparent text-[#88A0C3] transition hover:border-white/10 hover:bg-white/6 hover:text-white md:w-full md:justify-start md:px-3",
              item.path &&
                location.startsWith(item.path) &&
                "border-[#2B6FE8]/50 bg-[#132239] text-white shadow-[0_14px_30px_rgba(32,99,233,0.22)] hover:border-[#2B6FE8]/60 hover:bg-[#132239] hover:text-white"
            )}
          >
            <item.icon className="w-5 h-5" />
            <span className="hidden text-sm font-medium md:inline">{item.label}</span>
          </button>
        ))}
      </div>

      <div className="mt-6 hidden px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6F86A8] md:block">
        Booking desk
      </div>
      <div className="mt-3 hidden flex-col gap-2 md:flex">
        {[
          { label: "Orders", icon: ClipboardList, path: "/orders", view: "all" },
          { label: "Flight orders", icon: Plane, path: "/orders?view=flight", view: "flight" },
          { label: "Hotel orders", icon: Hotel, path: "/orders?view=hotel", view: "hotel" },
          { label: "Packages", icon: PackageSearch, path: "/orders?view=packages", view: "packages" },
          { label: "Payments", icon: CreditCard, path: "/orders?view=payments", view: "payments" },
          { label: "Supplier invoices", icon: Receipt, path: "/orders?view=supplier-payables", view: "supplier-payables" },
        ].map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => setLocation(item.path)}
            className={cn(
              "flex h-10 items-center gap-3 rounded-xl px-3 text-left text-sm text-[#88A0C3] transition hover:bg-white/6 hover:text-white",
              location.startsWith("/orders") && activeOrderView === item.view && "bg-white/10 text-white"
            )}
          >
            <item.icon className="h-4 w-4" />
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      <div className="mt-auto h-px w-10 bg-white/10" />

      <div className="mt-5 flex flex-col items-center gap-2 md:items-stretch">
        {visibleBottomItems.map((item) => (
          <button
            key={item.id}
            type="button"
            title={item.label}
            onClick={() => setLocation(item.path)}
            className={cn(
              "flex h-11 w-11 items-center justify-center gap-3 rounded-xl border border-transparent text-[#88A0C3] transition hover:border-white/10 hover:bg-white/6 hover:text-white md:w-full md:justify-start md:px-3",
              location.startsWith(item.path) &&
                "border-[#2B6FE8]/50 bg-[#132239] text-white shadow-[0_14px_30px_rgba(32,99,233,0.22)] hover:border-[#2B6FE8]/60 hover:bg-[#132239] hover:text-white"
            )}
          >
            <item.icon className="w-5 h-5" />
            <span className="hidden text-sm font-medium md:inline">{item.label}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}
