import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import SidebarRail from "@/components/SidebarRail";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { getAppSettings, saveAppSettings } from "@/lib/appSettings";
import { Moon, Settings, Sun } from "lucide-react";
import { toast } from "sonner";

export default function SettingsWorkspace() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { theme, setTheme, toggleTheme, switchable } = useTheme();
  const [settings, setSettings] = useState(() => getAppSettings());

  const updateCustomerRules = (patch: Partial<typeof settings.customerRules>) => {
    setSettings((prev) => {
      const next = {
        ...prev,
        customerRules: { ...prev.customerRules, ...patch },
      };
      saveAppSettings(next);
      return next;
    });
  };

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [authLoading, isAuthenticated, setLocation]);

  return (
    <div className="min-h-screen bg-[#F5F7FB] dark:bg-slate-950 flex text-slate-900 dark:text-slate-100">
      <SidebarRail />
      <div className="flex-1 p-6">
        <div className="max-w-4xl space-y-6">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center">
                <Settings className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm text-slate-500 dark:text-slate-400">Workspace</div>
                <h1 className="text-xl font-semibold">Settings</h1>
              </div>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Control your app appearance and preferences.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="font-semibold">Appearance</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  Switch between light mode and dark mode.
                </div>
              </div>
              <div className="text-xs font-semibold px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800">
                Current: {theme}
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={theme === "light" ? "default" : "outline"}
                  onClick={() => setTheme("light")}
                  disabled={!switchable}
                  className="gap-2"
                >
                  <Sun className="w-4 h-4" />
                  Light Mode
                </Button>
                <Button
                  type="button"
                  variant={theme === "dark" ? "default" : "outline"}
                  onClick={() => setTheme("dark")}
                  disabled={!switchable}
                  className="gap-2"
                >
                  <Moon className="w-4 h-4" />
                  Dark Mode
                </Button>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <span className="text-slate-600 dark:text-slate-300">Quick toggle</span>
                <Switch
                  checked={theme === "dark"}
                  onCheckedChange={() => toggleTheme?.()}
                  disabled={!switchable}
                  aria-label="Toggle dark mode"
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="font-semibold">Customer Rules</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  Control duplicate policy, required fields, and admin-only actions for travel agencies.
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  saveAppSettings(settings);
                  toast.success("Customer rules saved");
                }}
              >
                Save
              </Button>
            </div>

            <div className="mt-5 grid gap-6 lg:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Duplicate behavior</label>
                  <select
                    value={settings.customerRules.duplicateMode}
                    onChange={(e) =>
                      updateCustomerRules({ duplicateMode: e.target.value as "block" | "warn" })
                    }
                    className="w-full h-10 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm"
                  >
                    <option value="block">Block duplicates</option>
                    <option value="warn">Warn only (allow save)</option>
                  </select>
                </div>

                <div className="space-y-3">
                  <div className="text-sm font-medium">Required fields</div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-600 dark:text-slate-300">Email required</span>
                    <Switch
                      checked={settings.customerRules.requireEmail}
                      onCheckedChange={(checked) => updateCustomerRules({ requireEmail: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-600 dark:text-slate-300">Location required</span>
                    <Switch
                      checked={settings.customerRules.requireLocation}
                      onCheckedChange={(checked) => updateCustomerRules({ requireLocation: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-600 dark:text-slate-300">Decision role required</span>
                    <Switch
                      checked={settings.customerRules.requireDecisionRole}
                      onCheckedChange={(checked) => updateCustomerRules({ requireDecisionRole: checked })}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="text-sm font-medium">Permissions (frontend)</div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-slate-600 dark:text-slate-300">Admin-only edit</span>
                  <Switch
                    checked={settings.customerRules.adminOnlyEdit}
                    onCheckedChange={(checked) => updateCustomerRules({ adminOnlyEdit: checked })}
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-slate-600 dark:text-slate-300">Admin-only delete</span>
                  <Switch
                    checked={settings.customerRules.adminOnlyDelete}
                    onCheckedChange={(checked) => updateCustomerRules({ adminOnlyDelete: checked })}
                  />
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-900/10 p-3 text-xs text-amber-800 dark:text-amber-200">
                  These rules are currently saved in browser storage. For production security, enforce the same rules in your backend API.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
