import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import {
  Inbox,
  LayoutGrid,
  MessageSquare,
  Search,
  Settings,
  Users,
  LifeBuoy,
} from "lucide-react";

const navItems = [
  { id: "inbox", icon: Inbox, label: "Tickets", path: "/tickets" },
  { id: "boards", icon: LayoutGrid, label: "Boards", path: "/dashboard" },
  { id: "customers", icon: Users, label: "Customers" },
  { id: "search", icon: Search, label: "Search" },
  { id: "chat", icon: MessageSquare, label: "Chat" },
];

export default function SidebarRail() {
  const [location, setLocation] = useLocation();

  return (
    <aside className="w-16 bg-white border-r border-slate-200 flex flex-col items-center py-4 gap-4">
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white font-bold shadow-sm">
        T
      </div>

      <div className="flex flex-col items-center gap-3 mt-2">
        {navItems.map((item) => (
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
        <button
          className="h-10 w-10 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
          title="Support"
        >
          <LifeBuoy className="w-5 h-5" />
        </button>
        <button
          className="h-10 w-10 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
          title="Settings"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </aside>
  );
}
