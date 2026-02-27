import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Activity, BarChart3, Clock3, RefreshCw, TrendingUp } from "lucide-react";
import SidebarRail from "@/components/SidebarRail";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { canAccessAnalytics } from "@/lib/authz";
import {
  analyticsApi,
  AnalyticsDashboardData,
  AnalyticsRange,
  AnalyticsReportStatus,
} from "@/lib/api";

type WidgetKey = "kpis" | "trends" | "teams" | "reports";

type Preferences = {
  range: AnalyticsRange;
  autoRefresh: boolean;
  visible: Record<WidgetKey, boolean>;
};

const PREFS_KEY = "crm_analytics_prefs_v1";
const DEFAULT_PREFS: Preferences = {
  range: "7d",
  autoRefresh: true,
  visible: { kpis: true, trends: true, teams: true, reports: true },
};

function loadPrefs(): Preferences {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw);
    return {
      range: ["24h", "7d", "30d"].includes(parsed?.range) ? parsed.range : DEFAULT_PREFS.range,
      autoRefresh: typeof parsed?.autoRefresh === "boolean" ? parsed.autoRefresh : DEFAULT_PREFS.autoRefresh,
      visible: { ...DEFAULT_PREFS.visible, ...(parsed?.visible || {}) },
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

function savePrefs(prefs: Preferences) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

function statusClass(status: AnalyticsReportStatus) {
  if (status === "good") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
  if (status === "watch") return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
  return "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300";
}

function deltaClass(delta: number) {
  return delta >= 0
    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
    : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300";
}

export default function AnalyticsWorkspace() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [prefs, setPrefs] = useState<Preferences>(() => loadPrefs());
  const [tick, setTick] = useState(1);
  const [data, setData] = useState<AnalyticsDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/login");
  }, [authLoading, isAuthenticated, setLocation]);

  useEffect(() => {
    if (!authLoading && isAuthenticated && !canAccessAnalytics(user)) {
      setLocation("/dashboard");
    }
  }, [authLoading, isAuthenticated, user, setLocation]);

  useEffect(() => savePrefs(prefs), [prefs]);

  useEffect(() => {
    if (!prefs.autoRefresh) return;
    const id = window.setInterval(() => setTick((v) => v + 1), 15000);
    return () => window.clearInterval(id);
  }, [prefs.autoRefresh]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const initial = data === null;
      if (initial) setIsLoading(true);
      else setIsRefreshing(true);
      setError(null);
      try {
        const next = await analyticsApi.getDashboard({ range: prefs.range, seed: tick });
        if (!active) return;
        setData(next);
      } catch (err: any) {
        if (!active) return;
        setError(err?.message || "Failed to load analytics");
      } finally {
        if (!active) return;
        setIsLoading(false);
        setIsRefreshing(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [prefs.range, tick]);

  const trend = data?.trend ?? [];
  const teams = data?.teams ?? [];
  const totals = data?.summary ?? { opened: 0, resolved: 0, sla: 0, backlog: 0, firstResponse: 0 };
  const reports = data?.reports ?? { operations: [], service: [], efficiency: [] };
  const isEmpty = !isLoading && !error && trend.length === 0 && teams.length === 0;

  const chartConfig = {
    opened: { label: "Opened", color: "#0f766e" },
    resolved: { label: "Resolved", color: "#2563eb" },
    sla: { label: "SLA %", color: "#ea580c" },
    closed: { label: "Closed", color: "#0284c7" },
    breached: { label: "Breached", color: "#ef4444" },
  } as const;

  if (!authLoading && isAuthenticated && !canAccessAnalytics(user)) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#F5F7FB] dark:bg-slate-950 flex text-slate-900 dark:text-slate-100">
      <SidebarRail />
      <div className="flex-1 p-6">
        <div className="mx-auto max-w-7xl grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <Card className="bg-white/90 text-slate-900 dark:bg-slate-900/90 dark:text-slate-100">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700 dark:border-teal-900/50 dark:bg-teal-900/20 dark:text-teal-300">
                      <BarChart3 className="h-3.5 w-3.5" />
                      Advanced Analytics & Reporting
                    </div>
                    <CardTitle className="text-2xl">Operations Intelligence Dashboard</CardTitle>
                    <CardDescription>
                      Real-time KPI monitoring, trend analysis, and performance reporting to identify bottlenecks early.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={prefs.range}
                      onChange={(e) => setPrefs((p) => ({ ...p, range: e.target.value as AnalyticsRange }))}
                      className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    >
                      <option value="24h">Last 24h</option>
                      <option value="7d">Last 7d</option>
                      <option value="30d">Last 30d</option>
                    </select>
                    <Button variant="outline" onClick={() => setTick((v) => v + 1)} disabled={isRefreshing}>
                      <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                      {isRefreshing ? "Refreshing..." : "Refresh"}
                    </Button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                  <span>Source: {data?.source || "..."}</span>
                  <span>
                    Updated: {data?.generatedAt ? new Date(data.generatedAt).toLocaleTimeString() : "--:--:--"}
                  </span>
                </div>
              </CardHeader>
            </Card>

            {isLoading && (
              <Card className="bg-white/90 text-slate-900 dark:bg-slate-900/90 dark:text-slate-100">
                <CardContent className="py-10">
                  <div className="flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Loading analytics dashboard...
                  </div>
                </CardContent>
              </Card>
            )}

            {error && !isLoading && (
              <Card className="bg-white/90 text-slate-900 dark:bg-slate-900/90 dark:text-slate-100 border-rose-200 dark:border-rose-900/50">
                <CardContent className="py-6">
                  <div className="text-sm font-medium text-rose-700 dark:text-rose-300">Failed to load analytics</div>
                  <div className="mt-1 text-xs text-rose-600/90 dark:text-rose-300/80">{error}</div>
                  <div className="mt-3">
                    <Button variant="outline" onClick={() => setTick((v) => v + 1)}>
                      Try Again
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {isEmpty && (
              <Card className="bg-white/90 text-slate-900 dark:bg-slate-900/90 dark:text-slate-100">
                <CardContent className="py-10 text-center">
                  <div className="text-sm font-medium">No analytics data available</div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    The server returned an empty analytics payload for this range.
                  </div>
                </CardContent>
              </Card>
            )}

            {!isLoading && !isEmpty && prefs.visible.kpis && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard title="Open Backlog" value={String(totals.backlog)} note="active queue" icon={Activity} delta={-3} />
                <MetricCard title="Resolved" value={String(totals.resolved)} note="selected range" icon={TrendingUp} delta={7} />
                <MetricCard title="SLA Compliance" value={`${totals.sla}%`} note="overall SLA" icon={Clock3} delta={2} />
                <MetricCard title="First Response" value={`${totals.firstResponse}m`} note="average" icon={RefreshCw} delta={-6} />
              </div>
            )}

            {!isLoading && !isEmpty && prefs.visible.trends && (
              <Card className="bg-white/90 text-slate-900 dark:bg-slate-900/90 dark:text-slate-100">
                <CardHeader className="pb-0">
                  <CardTitle>Trend Analysis</CardTitle>
                  <CardDescription>Opened vs resolved tickets with SLA trend overlay.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[320px] w-full">
                    <LineChart data={trend} margin={{ left: 6, right: 12, top: 10, bottom: 0 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} />
                      <YAxis yAxisId="a" tickLine={false} axisLine={false} width={34} />
                      <YAxis yAxisId="b" orientation="right" domain={[70, 100]} tickLine={false} axisLine={false} width={34} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Line yAxisId="a" dataKey="opened" type="monotone" stroke="var(--color-opened)" strokeWidth={2.5} dot={false} />
                      <Line yAxisId="a" dataKey="resolved" type="monotone" stroke="var(--color-resolved)" strokeWidth={2.5} dot={false} />
                      <Line yAxisId="b" dataKey="sla" type="monotone" stroke="var(--color-sla)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            )}

            {!isLoading && !isEmpty && prefs.visible.teams && (
              <Card className="bg-white/90 text-slate-900 dark:bg-slate-900/90 dark:text-slate-100">
                <CardHeader className="pb-0">
                  <CardTitle>Team Performance</CardTitle>
                  <CardDescription>Compare throughput and SLA breaches across teams.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[280px] w-full">
                    <BarChart data={teams} margin={{ left: 6, right: 10, top: 10, bottom: 0 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="team" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} width={34} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Bar dataKey="closed" fill="var(--color-closed)" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="breached" fill="var(--color-breached)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            )}

            {!isLoading && !isEmpty && prefs.visible.reports && (
              <Card className="bg-white/90 text-slate-900 dark:bg-slate-900/90 dark:text-slate-100">
                <CardHeader className="pb-0">
                  <CardTitle>Performance Reports</CardTitle>
                  <CardDescription>Action-oriented summaries for bottlenecks and efficiency.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="operations">
                    <TabsList>
                      <TabsTrigger value="operations">Operations</TabsTrigger>
                      <TabsTrigger value="service">Service</TabsTrigger>
                      <TabsTrigger value="efficiency">Efficiency</TabsTrigger>
                    </TabsList>
                    {(["operations", "service", "efficiency"] as const).map((tab) => (
                      <TabsContent key={tab} value={tab}>
                        <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                          <table className="min-w-full text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs uppercase text-slate-500 dark:text-slate-400">
                              <tr>
                                <th className="px-3 py-2 text-left">Metric</th>
                                <th className="px-3 py-2 text-left">Current</th>
                                <th className="px-3 py-2 text-left">Previous</th>
                                <th className="px-3 py-2 text-left">Delta</th>
                                <th className="px-3 py-2 text-left">Status</th>
                                <th className="px-3 py-2 text-left">Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {reports[tab].map((row) => (
                                <tr key={`${tab}-${row.metric}`} className="border-t border-slate-100 dark:border-slate-800 align-top">
                                  <td className="px-3 py-3 font-medium">{row.metric}</td>
                                  <td className="px-3 py-3">{row.current}</td>
                                  <td className="px-3 py-3 text-slate-500 dark:text-slate-400">{row.previous}</td>
                                  <td className="px-3 py-3">
                                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${deltaClass(row.delta)}`}>
                                      {row.delta >= 0 ? "+" : ""}
                                      {row.delta}%
                                    </span>
                                  </td>
                                  <td className="px-3 py-3">
                                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass(row.status)}`}>
                                      {row.status}
                                    </span>
                                  </td>
                                  <td className="px-3 py-3 text-xs text-slate-600 dark:text-slate-300">{row.action}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </TabsContent>
                    ))}
                  </Tabs>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card className="bg-white/90 text-slate-900 dark:bg-slate-900/90 dark:text-slate-100">
              <CardHeader className="pb-0">
                <CardTitle className="text-base">Customization</CardTitle>
                <CardDescription>Choose widgets and live refresh behavior.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                  <div>
                    <div className="text-sm font-medium">Auto refresh</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Simulated every 15s</div>
                  </div>
                  <Switch checked={prefs.autoRefresh} onCheckedChange={(v) => setPrefs((p) => ({ ...p, autoRefresh: !!v }))} />
                </div>
                {(Object.keys(prefs.visible) as WidgetKey[]).map((key) => (
                  <div key={key} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                    <span className="text-sm capitalize">{key}</span>
                    <Switch
                      checked={prefs.visible[key]}
                      onCheckedChange={(v) =>
                        setPrefs((p) => ({ ...p, visible: { ...p.visible, [key]: !!v } }))
                      }
                    />
                  </div>
                ))}
                <Button variant="outline" className="w-full" onClick={() => setPrefs(DEFAULT_PREFS)}>
                  Reset Preferences
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-white/90 text-slate-900 dark:bg-slate-900/90 dark:text-slate-100">
              <CardHeader className="pb-0">
                <CardTitle className="text-base">Next Frontend Steps</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                  Connect widgets to `/api/analytics/*` endpoints.
                </div>
                <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                  Add filters by team, board, customer, and channel.
                </div>
                <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                  Add CSV/PDF export and saved report presets.
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  note,
  icon: Icon,
  delta,
}: {
  title: string;
  value: string;
  note: string;
  icon: typeof Activity;
  delta: number;
}) {
  return (
    <Card className="gap-3 bg-white/90 text-slate-900 dark:bg-slate-900/90 dark:text-slate-100">
      <CardHeader className="px-4 pt-4 pb-0">
        <div className="flex items-center justify-between">
          <CardDescription className="text-xs">{title}</CardDescription>
          <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-200">
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="flex items-end justify-between gap-2">
          <div>
            <div className="text-2xl font-semibold">{value}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{note}</div>
          </div>
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${deltaClass(delta)}`}>
            {delta >= 0 ? "+" : ""}
            {delta}%
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
