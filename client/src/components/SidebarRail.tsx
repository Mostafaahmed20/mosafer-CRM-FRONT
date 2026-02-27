import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { canAccessAnalytics, canManageGlobalUsers } from "@/lib/authz";
import { useLocation } from "wouter";
import {
  BarChart3,
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
  { id: "analytics", icon: BarChart3, label: "Analytics", path: "/workspace/analytics" },
  { id: "customers", icon: Users, label: "Customers", path: "/workspace/customers" },
  { id: "search", icon: Search, label: "Search", path: "/workspace/search" },
  { id: "chat", icon: MessageSquare, label: "Chat", path: "/workspace/chat" },
];

const bottomItems = [
  { id: "admin-tickets", icon: Inbox, label: "Admin Tickets", path: "/workspace/admin-tickets" },
  { id: "admin-users", icon: Shield, label: "Admin Users", path: "/workspace/admin-users" },
  { id: "support", icon: LifeBuoy, label: "Support", path: "/workspace/support" },
  { id: "settings", icon: Settings, label: "Settings", path: "/workspace/settings" },
];

export default function SidebarRail() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const visibleNavItems = navItems.filter((item) => item.id !== "analytics" || canAccessAnalytics(user));
  const visibleBottomItems = bottomItems.filter((item) => {
    if (item.id === "admin-users" || item.id === "admin-tickets") return canManageGlobalUsers(user);
    return true;
  });

  return (
    <aside className="w-16 bg-white border-r border-slate-200 flex flex-col items-center py-4 gap-4">
      <button
        type="button"
        title="Dashboard"
        onClick={() => setLocation("/dashboard")}
        className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white font-bold shadow-sm"
      >
        T
      </button>

      <div className="flex flex-col items-center gap-3 mt-2">
        {visibleNavItems.map((item) => (
          <button
            key={item.id}
            title={item.label}
            onClick={() => item.path && setLocation(item.path)}
            className={cn(
              "h-10 w-10 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition",
              item.path && location.startsWith(item.path) && "bg-slate-900 text-white hover:bg-slate-900 hover:text-white"
            )}
          >
            <item.icon className="w-5 h-5" />
          </button>
        ))}
      </div>

      <div className="mt-auto flex flex-col items-center gap-3">
        {visibleBottomItems.map((item) => (
          <button
            key={item.id}
            type="button"
            title={item.label}
            onClick={() => setLocation(item.path)}
            className={cn(
              "h-10 w-10 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition",
              location.startsWith(item.path) && "bg-slate-900 text-white hover:bg-slate-900 hover:text-white"
            )}
          >
            <item.icon className="w-5 h-5" />
          </button>
        ))}
      </div>
    </aside>
  );
}
