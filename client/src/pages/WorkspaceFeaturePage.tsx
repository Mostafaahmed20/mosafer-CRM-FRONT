import { Suspense, lazy, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import SidebarRail from "@/components/SidebarRail";
import { useAuth } from "@/contexts/AuthContext";
import { canAccessAnalytics, canManageGlobalUsers } from "@/lib/authz";
import { BarChart3, Building2, ClipboardList, LifeBuoy, MessageSquare, Search, Settings, Shield, Users } from "lucide-react";
import AdminTicketsInbox from "./AdminTicketsInbox";
import AdminUsersWorkspace from "./AdminUsersWorkspace";
import ChatWorkspace from "./ChatWorkspace";
import CustomersWorkspace from "./CustomersWorkspace";
import DailyOpsWorkspace from "./DailyOpsWorkspace";
import SearchWorkspace from "./SearchWorkspace";
import SettingsWorkspace from "./SettingsWorkspace";
import SupportWorkspace from "./SupportWorkspace";
import SuppliersWorkspace from "./SuppliersWorkspace";
import OrdersWorkspace from "./OrdersWorkspace";

const AnalyticsWorkspace = lazy(() => import("./AnalyticsWorkspace"));
const AuditWorkspace = lazy(() => import("./AuditWorkspace"));

type FeatureKey = "analytics" | "admin-tickets" | "admin-users" | "audit" | "customers" | "orders" | "suppliers" | "daily-ops" | "search" | "chat" | "support" | "settings";

const FEATURE_META: Record<FeatureKey, { title: string; description: string; icon: typeof Users }> = {
  analytics: {
    title: "Analytics",
    description: "Advanced analytics workspace is connected with KPI cards, trend charts, and performance reports.",
    icon: BarChart3,
  },
  "admin-users": {
    title: "Admin Users",
    description: "Global user management for app-level roles and analytics permissions.",
    icon: Shield,
  },
  "admin-tickets": {
    title: "Admin Tickets",
    description: "Global admin inbox for tickets across all boards with server-side filters and detail fetch.",
    icon: Shield,
  },
  audit: {
    title: "Audit",
    description: "Global audit timeline with advanced filters and card event playback.",
    icon: ClipboardList,
  },
  customers: {
    title: "Customers",
    description: "Travel agency profiles, contacts, account flags, and customer-level operating rules.",
    icon: Users,
  },
  orders: {
    title: "Unified Orders",
    description: "The central order workspace for bookings, item fulfillment, margins, and payment tracking.",
    icon: ClipboardList,
  },
  suppliers: { title: "Suppliers", description: "Travel suppliers, pricing sources, contacts, and payment terms.", icon: Building2 },
  "daily-ops": {
    title: "Daily Ops",
    description: "Daily task planning, shift coverage, completion tracking, evidence, replies, and carry-forward handling.",
    icon: ClipboardList,
  },
  search: {
    title: "Search",
    description: "Global search across boards and tickets with direct navigation into the right queue.",
    icon: Search,
  },
  chat: {
    title: "Chat",
    description: "Board-level team conversations collected into one workspace for fast follow-up.",
    icon: MessageSquare,
  },
  support: {
    title: "Support",
    description: "Operational runbooks, support guidance, and quick actions for the main service flows.",
    icon: LifeBuoy,
  },
  settings: {
    title: "Settings",
    description: "Application preferences, appearance, and operational customer rules.",
    icon: Settings,
  },
};

export default function WorkspaceFeaturePage() {
  const params = useParams<{ feature: string }>();
  const feature = (params.feature || "") as FeatureKey;
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [authLoading, isAuthenticated, setLocation]);

  const meta = FEATURE_META[feature];

  useEffect(() => {
    if (!authLoading && isAuthenticated && !meta) {
      setLocation("/404");
    }
  }, [authLoading, isAuthenticated, meta, setLocation]);

  if (!meta) {
    return null;
  }

  if (feature === "analytics" && !authLoading && isAuthenticated && !canAccessAnalytics(user)) {
    return (
      <div className="min-h-screen bg-[#F5F7FB] flex">
        <SidebarRail />
        <div className="flex-1 p-6">
          <div className="max-w-3xl">
            <div className="rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
              <div className="text-sm text-amber-700">Access restricted</div>
              <h1 className="mt-1 text-xl font-semibold text-slate-900">Analytics access is restricted</h1>
              <p className="mt-2 text-sm text-slate-600">
                This workspace requires an admin role and analytics permission (`canViewAllAnalytics`). Backend
                authorization should enforce the same rule.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setLocation("/dashboard")}>
                  Open Boards
                </Button>
                <Button variant="outline" onClick={() => setLocation("/tickets")}>
                  Open Tickets
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if ((feature === "admin-users" || feature === "admin-tickets" || feature === "audit") && !authLoading && isAuthenticated && !canManageGlobalUsers(user)) {
    return (
      <div className="min-h-screen bg-[#F5F7FB] flex">
        <SidebarRail />
        <div className="flex-1 p-6">
          <div className="max-w-3xl">
            <div className="rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
              <div className="text-sm text-amber-700">Access restricted</div>
              <h1 className="mt-1 text-xl font-semibold text-slate-900">
                {feature === "admin-tickets"
                  ? "Admin tickets inbox is restricted"
                  : feature === "audit"
                    ? "Audit workspace is restricted"
                    : "Admin user management is restricted"}
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                This workspace is limited to global admins (`role: "admin"`). Backend authorization should enforce the same rule.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setLocation("/dashboard")}>
                  Open Boards
                </Button>
                <Button variant="outline" onClick={() => setLocation("/tickets")}>
                  Open Tickets
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (feature === "admin-users") {
    return <AdminUsersWorkspace />;
  }

  if (feature === "admin-tickets") {
    return <AdminTicketsInbox />;
  }

  if (feature === "audit") {
    return (
      <Suspense
        fallback={
          <div className="min-h-screen bg-[#F5F7FB] flex">
            <SidebarRail />
            <div className="flex-1 p-6">
              <div className="max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm text-sm text-slate-600">
                Loading audit workspace...
              </div>
            </div>
          </div>
        }
      >
        <AuditWorkspace />
      </Suspense>
    );
  }

  if (feature === "customers") {
    return <CustomersWorkspace />;
  }
  if (feature === "orders") return <OrdersWorkspace />;
  if (feature === "suppliers") return <SuppliersWorkspace />;

  if (feature === "daily-ops") {
    return <DailyOpsWorkspace />;
  }

  if (feature === "search") {
    return <SearchWorkspace />;
  }

  if (feature === "chat") {
    return <ChatWorkspace />;
  }

  if (feature === "support") {
    return <SupportWorkspace />;
  }

  if (feature === "analytics") {
    return (
      <Suspense
        fallback={
          <div className="min-h-screen bg-[#F5F7FB] flex">
            <SidebarRail />
            <div className="flex-1 p-6">
              <div className="max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm text-sm text-slate-600">
                Loading analytics workspace...
              </div>
            </div>
          </div>
        }
      >
        <AnalyticsWorkspace />
      </Suspense>
    );
  }

  if (feature === "settings") {
    return <SettingsWorkspace />;
  }

  const Icon = meta.icon;

  return (
    <div className="min-h-screen bg-[#F5F7FB] flex">
      <SidebarRail />
      <div className="flex-1 p-6">
        <div className="max-w-3xl">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm text-slate-500">Workspace</div>
                <h1 className="text-xl font-semibold text-slate-900">{meta.title}</h1>
              </div>
            </div>

            <p className="text-sm text-slate-600 mb-6">{meta.description}</p>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setLocation("/tickets")}>
                Open Tickets
              </Button>
              <Button variant="outline" onClick={() => setLocation("/dashboard")}>
                Open Boards
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
