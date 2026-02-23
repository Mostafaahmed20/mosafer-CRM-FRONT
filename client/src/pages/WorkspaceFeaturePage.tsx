import { useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import SidebarRail from "@/components/SidebarRail";
import { useAuth } from "@/contexts/AuthContext";
import { LifeBuoy, MessageSquare, Search, Settings, Users } from "lucide-react";
import CustomersWorkspace from "./CustomersWorkspace";
import SettingsWorkspace from "./SettingsWorkspace";

type FeatureKey = "customers" | "search" | "chat" | "support" | "settings";

const FEATURE_META: Record<FeatureKey, { title: string; description: string; icon: typeof Users }> = {
  customers: {
    title: "Customers",
    description: "Customer workspace is now connected. Use this page as the entry point for customer-related work.",
    icon: Users,
  },
  search: {
    title: "Search",
    description: "Search workspace is now connected. Use quick links below while the full global search view is being expanded.",
    icon: Search,
  },
  chat: {
    title: "Chat",
    description: "Chat workspace is now connected. Start from a board to access board-specific conversations.",
    icon: MessageSquare,
  },
  support: {
    title: "Support",
    description: "Support workspace is now connected. Keep docs and troubleshooting links here.",
    icon: LifeBuoy,
  },
  settings: {
    title: "Settings",
    description: "Settings workspace is now connected. Add account and app preferences here.",
    icon: Settings,
  },
};

export default function WorkspaceFeaturePage() {
  const params = useParams<{ feature: string }>();
  const feature = (params.feature || "") as FeatureKey;
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

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

  if (feature === "customers") {
    return <CustomersWorkspace />;
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
