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
  LifeBuoy,
  Shield,
} from "lucide-react";

const navItems = [
  { id: "inbox", icon: Inbox, label: "Tickets", path: "/tickets" },
  { id: "boards", icon: LayoutGrid, label: "Boards", path: "/dashboard" },
  { id: "daily-ops", icon: ClipboardPenLine, label: "Daily Ops", path: "/workspace/daily-ops" },
  { id: "analytics", icon: BarChart3, label: "Analytics", path: "/workspace/analytics" },
  { id: "customers", icon: Users, label: "Customers", path: "/workspace/customers" },
  { id: "search", icon: Search, label: "Search", path: "/workspace/search" },
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
  const visibleNavItems = navItems.filter((item) => item.id !== "analytics" || canAccessAnalytics(user));
  const visibleBottomItems = bottomItems.filter((item) => {
    if (item.id === "admin-users" || item.id === "admin-tickets" || item.id === "audit") return canManageGlobalUsers(user);
    return true;
  });

  return (
    <aside className="flex w-[76px] flex-col items-center border-r border-[#14243A] bg-[#091525] px-3 py-5 text-white">
      <button
        type="button"
        title="Dashboard"
        onClick={() => setLocation("/dashboard")}
        className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#17B897] via-[#1493B8] to-[#2063E9] text-base font-bold text-white shadow-[0_18px_34px_rgba(23,184,151,0.28)]"
      >
        T
      </button>

      <div className="mt-5 h-px w-10 bg-white/10" />

      <div className="mt-5 flex flex-col items-center gap-3">
        {visibleNavItems.map((item) => (
          <button
            key={item.id}
            title={item.label}
            onClick={() => item.path && setLocation(item.path)}
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-2xl border border-transparent text-[#88A0C3] transition hover:border-white/10 hover:bg-white/6 hover:text-white",
              item.path &&
                location.startsWith(item.path) &&
                "border-[#2B6FE8]/50 bg-[#132239] text-white shadow-[0_14px_30px_rgba(32,99,233,0.22)] hover:border-[#2B6FE8]/60 hover:bg-[#132239] hover:text-white"
            )}
          >
            <item.icon className="w-5 h-5" />
          </button>
        ))}
      </div>

      <div className="mt-auto h-px w-10 bg-white/10" />

      <div className="mt-5 flex flex-col items-center gap-3">
        {visibleBottomItems.map((item) => (
          <button
            key={item.id}
            type="button"
            title={item.label}
            onClick={() => setLocation(item.path)}
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-2xl border border-transparent text-[#88A0C3] transition hover:border-white/10 hover:bg-white/6 hover:text-white",
              location.startsWith(item.path) &&
                "border-[#2B6FE8]/50 bg-[#132239] text-white shadow-[0_14px_30px_rgba(32,99,233,0.22)] hover:border-[#2B6FE8]/60 hover:bg-[#132239] hover:text-white"
            )}
          >
            <item.icon className="w-5 h-5" />
          </button>
        ))}
      </div>
    </aside>
  );
}
