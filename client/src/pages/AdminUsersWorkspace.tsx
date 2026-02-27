import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Shield, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import SidebarRail from "@/components/SidebarRail";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { adminUserApi, AdminUserRecord, GlobalUserRole } from "@/lib/api";
import { canManageGlobalUsers } from "@/lib/authz";

type PendingAction = "role" | "analytics";

export default function AdminUsersWorkspace() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [rows, setRows] = useState<AdminUserRecord[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pending, setPending] = useState<Record<string, PendingAction | undefined>>({});

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/login");
  }, [authLoading, isAuthenticated, setLocation]);

  useEffect(() => {
    if (!authLoading && isAuthenticated && !canManageGlobalUsers(user)) {
      setLocation("/dashboard");
    }
  }, [authLoading, isAuthenticated, user, setLocation]);

  useEffect(() => {
    if (!authLoading && isAuthenticated && canManageGlobalUsers(user)) {
      void loadUsers();
    }
  }, [authLoading, isAuthenticated, user?._id]);

  const loadUsers = async (refresh = false) => {
    try {
      if (refresh) setIsRefreshing(true);
      else setIsLoading(true);
      const data = await adminUserApi.getAll();
      setRows(
        [...data].sort((a, b) => {
          if (a.role !== b.role) return a.role === "admin" ? -1 : 1;
          return a.username.localeCompare(b.username);
        })
      );
    } catch (error: any) {
      toast.error(error?.message || "Failed to load users");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      [row.username, row.email, row.role, row.canViewAllAnalytics ? "analytics" : ""]
        .map((v) => String(v || "").toLowerCase())
        .some((v) => v.includes(q))
    );
  }, [rows, search]);

  const setPendingAction = (userId: string, action?: PendingAction) =>
    setPending((prev) => ({ ...prev, [userId]: action }));

  const updateRow = (nextRow: AdminUserRecord) => {
    setRows((prev) =>
      prev
        .map((row) => (row._id === nextRow._id ? { ...row, ...nextRow } : row))
        .sort((a, b) => {
          if (a.role !== b.role) return a.role === "admin" ? -1 : 1;
          return a.username.localeCompare(b.username);
        })
    );
  };

  const handleRoleChange = async (target: AdminUserRecord, role: GlobalUserRole) => {
    if (target.role === role) return;
    setPendingAction(target._id, "role");
    try {
      const updated = await adminUserApi.setRole(target._id, role);
      updateRow(updated);
      toast.success(`Role updated for ${target.username}`);
    } catch (error: any) {
      toast.error(error?.message || "Failed to update role");
    } finally {
      setPendingAction(target._id);
    }
  };

  const handleAnalyticsToggle = async (target: AdminUserRecord, nextValue: boolean) => {
    if (target.canViewAllAnalytics === nextValue) return;
    setPendingAction(target._id, "analytics");
    try {
      const updated = await adminUserApi.setAnalyticsAccess(target._id, nextValue);
      updateRow(updated);
      toast.success(`Analytics access ${nextValue ? "enabled" : "disabled"} for ${target.username}`);
    } catch (error: any) {
      toast.error(error?.message || "Failed to update analytics access");
    } finally {
      setPendingAction(target._id);
    }
  };

  if (!authLoading && isAuthenticated && !canManageGlobalUsers(user)) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#F5F7FB] dark:bg-slate-950 flex text-slate-900 dark:text-slate-100">
      <SidebarRail />
      <div className="flex-1 p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <Card className="bg-white/90 dark:bg-slate-900/90">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 dark:border-indigo-900/50 dark:bg-indigo-900/20 dark:text-indigo-300">
                    <Shield className="h-3.5 w-3.5" />
                    Global Admin
                  </div>
                  <CardTitle className="text-2xl">User Management</CardTitle>
                  <CardDescription>
                    Manage app-level roles (`admin` / `user`) and analytics dashboard access.
                  </CardDescription>
                </div>
                <Button variant="outline" onClick={() => void loadUsers(true)} disabled={isRefreshing || isLoading}>
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>
          </Card>

          <Card className="bg-white/90 dark:bg-slate-900/90">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Users</CardTitle>
                  <CardDescription>{filteredRows.length} visible</CardDescription>
                </div>
                <div className="relative w-full max-w-sm">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name, email, role..."
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="py-8 text-sm text-slate-500 dark:text-slate-400">Loading users...</div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs uppercase text-slate-500 dark:text-slate-400">
                      <tr>
                        <th className="px-3 py-2 text-left">User</th>
                        <th className="px-3 py-2 text-left">Email</th>
                        <th className="px-3 py-2 text-left">Role</th>
                        <th className="px-3 py-2 text-left">Analytics</th>
                        <th className="px-3 py-2 text-left">Verified</th>
                        <th className="px-3 py-2 text-left">Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.map((row) => {
                        const rowPending = pending[row._id];
                        const isSelf = row._id === user?._id;
                        return (
                          <tr key={row._id} className="border-t border-slate-100 dark:border-slate-800 align-top">
                            <td className="px-3 py-3">
                              <div className="font-medium">{row.username}</div>
                              {isSelf && <div className="text-xs text-indigo-600 dark:text-indigo-300">You</div>}
                            </td>
                            <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{row.email}</td>
                            <td className="px-3 py-3">
                              <select
                                value={row.role}
                                onChange={(e) => void handleRoleChange(row, e.target.value as GlobalUserRole)}
                                disabled={!!rowPending}
                                className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                              >
                                <option value="user">user</option>
                                <option value="admin">admin</option>
                              </select>
                              {rowPending === "role" && (
                                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Saving role...</div>
                              )}
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={row.canViewAllAnalytics}
                                  onCheckedChange={(checked) => void handleAnalyticsToggle(row, !!checked)}
                                  disabled={!!rowPending}
                                />
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                  {row.canViewAllAnalytics ? "Allowed" : "Blocked"}
                                </span>
                              </div>
                              {rowPending === "analytics" && (
                                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Saving access...</div>
                              )}
                            </td>
                            <td className="px-3 py-3">
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                                  row.emailVerified
                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                                    : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                }`}
                              >
                                {row.emailVerified ? "Verified" : "Unverified"}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-xs text-slate-500 dark:text-slate-400">
                              {row.updatedAt ? new Date(row.updatedAt).toLocaleString() : "--"}
                            </td>
                          </tr>
                        );
                      })}
                      {!filteredRows.length && (
                        <tr>
                          <td colSpan={6} className="px-3 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                            No users found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
