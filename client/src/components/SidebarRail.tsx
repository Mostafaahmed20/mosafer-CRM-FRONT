import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { canAccessAnalytics, canManageGlobalUsers } from "@/lib/authz";
import { useLocation } from "wouter";
import {
  BarChart3,
  Briefcase,
  Building2,
  ClipboardList,
  Inbox,
  LayoutGrid,
  Receipt,
  Search,
  Settings,
  Shield,
  Users,
} from "lucide-react";

const primaryItems = [
  { id: "cases", icon: Inbox, label: "Cases", path: "/tickets" },
  { id: "pipeline", icon: LayoutGrid, label: "Pipeline", path: "/dashboard" },
  { id: "accounting", icon: Receipt, label: "Accounting", path: "/orders?view=accounting" },
  { id: "customers", icon: Users, label: "Customers", path: "/workspace/customers" },
];

const moreItems = [
  { id: "orders", icon: Briefcase, label: "Orders", path: "/orders", adminOnly: false },
  { id: "suppliers", icon: Building2, label: "Suppliers", path: "/workspace/suppliers", adminOnly: false },
  { id: "search", icon: Search, label: "Search", path: "/workspace/search", adminOnly: false },
  { id: "analytics", icon: BarChart3, label: "Analytics", path: "/workspace/analytics", analyticsOnly: true },
  { id: "confirmed-leads-report", icon: ClipboardList, label: "Confirmed leads", path: "/workspace/confirmed-leads-report", adminOnly: true },
  { id: "admin-users", icon: Shield, label: "Users", path: "/workspace/admin-users", adminOnly: true },
  { id: "settings", icon: Settings, label: "Settings", path: "/workspace/settings", adminOnly: false },
];

function pathMatches(location: string, path: string) {
  const [pathname, search = ""] = location.split("?");
  const [itemPath, itemSearch = ""] = path.split("?");
  if (pathname !== itemPath && !pathname.startsWith(`${itemPath}/`)) return false;
  if (!itemSearch) {
    if (itemPath === "/tickets") return !search.includes("view=accounting");
    return true;
  }
  return search.includes(itemSearch);
}

export default function SidebarRail() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();

  const visibleMoreItems = moreItems.filter((item) => {
    if (item.analyticsOnly) return canAccessAnalytics(user);
    if (item.adminOnly) return canManageGlobalUsers(user);
    return true;
  });

  return (
    <aside className="flex w-[76px] shrink-0 flex-col border-r border-[#14243A] bg-[#091525] px-3 py-5 text-white md:w-[232px] md:px-4">
      <button
        type="button"
        title="Cases"
        onClick={() => setLocation("/tickets")}
        className="flex h-12 w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-br from-[#17B897] via-[#1493B8] to-[#2063E9] text-base font-bold text-white shadow-[0_18px_34px_rgba(23,184,151,0.28)] md:justify-start md:px-3"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20">T</span>
        <span className="hidden text-sm tracking-[0.12em] md:inline">TRAVEL DESK</span>
      </button>

      <div className="mt-5 h-px w-10 bg-white/10" />

      <div className="mt-5 hidden px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6F86A8] md:block">
        Work
      </div>
      <div className="mt-3 flex flex-col items-center gap-2 md:items-stretch">
        {primaryItems.map((item) => (
          <button
            key={item.id}
            title={item.label}
            onClick={() => setLocation(item.path)}
            className={cn(
              "flex h-11 w-11 items-center justify-center gap-3 rounded-xl border border-transparent text-[#88A0C3] transition hover:border-white/10 hover:bg-white/6 hover:text-white md:w-full md:justify-start md:px-3",
              pathMatches(location, item.path) &&
                "border-[#2B6FE8]/50 bg-[#132239] text-white shadow-[0_14px_30px_rgba(32,99,233,0.22)] hover:border-[#2B6FE8]/60 hover:bg-[#132239] hover:text-white"
            )}
          >
            <item.icon className="h-5 w-5" />
            <span className="hidden text-sm font-medium md:inline">{item.label}</span>
          </button>
        ))}
      </div>

      <div className="mt-auto h-px w-10 bg-white/10" />

      <div className="mt-5 hidden px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6F86A8] md:block">
        More
      </div>
      <div className="mt-3 flex flex-col items-center gap-2 md:items-stretch">
        {visibleMoreItems.map((item) => (
          <button
            key={item.id}
            title={item.label}
            onClick={() => setLocation(item.path)}
            className={cn(
              "flex h-11 w-11 items-center justify-center gap-3 rounded-xl border border-transparent text-[#88A0C3] transition hover:border-white/10 hover:bg-white/6 hover:text-white md:w-full md:justify-start md:px-3",
              pathMatches(location, item.path) &&
                "border-[#2B6FE8]/50 bg-[#132239] text-white shadow-[0_14px_30px_rgba(32,99,233,0.22)]"
            )}
          >
            <item.icon className="h-5 w-5" />
            <span className="hidden text-sm font-medium md:inline">{item.label}</span>
          </button>
        ))}
        <div className="hidden items-center gap-2 px-3 pt-2 text-[11px] text-[#6F86A8] md:flex">
          <ClipboardList className="h-3.5 w-3.5" />
          Lead → close → accounts
        </div>
      </div>
    </aside>
  );
}
