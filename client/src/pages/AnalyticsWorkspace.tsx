import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Activity, BarChart3, Clock3, Download, FileText, RefreshCw, Save, Trash2, TrendingUp } from "lucide-react";
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
  AnalyticsFilterOptions,
  AnalyticsFilters,
  AnalyticsRange,
  AnalyticsReportStatus,
} from "@/lib/api";

type WidgetKey = "kpis" | "trends" | "teams" | "reports";

type Preferences = {
  range: AnalyticsRange;
  autoRefresh: boolean;
  visible: Record<WidgetKey, boolean>;
};

type AnalyticsFilterState = {
  team: string;
  board: string;
  customer: string;
  channel: string;
};

type AnalyticsPreset = {
  id: string;
  name: string;
  range: AnalyticsRange;
  autoRefresh: boolean;
  visible: Record<WidgetKey, boolean>;
  filters: AnalyticsFilterState;
  createdAt: string;
};

const PREFS_KEY = "crm_analytics_prefs_v1";
const PRESETS_KEY = "crm_analytics_report_presets_v1";
const FILTER_ALL = "all";

const DEFAULT_PREFS: Preferences = {
  range: "7d",
  autoRefresh: true,
  visible: { kpis: true, trends: true, teams: true, reports: true },
};

const DEFAULT_FILTERS: AnalyticsFilterState = {
  team: FILTER_ALL,
  board: FILTER_ALL,
  customer: FILTER_ALL,
  channel: FILTER_ALL,
};

const EMPTY_FILTER_OPTIONS: AnalyticsFilterOptions = {
  teams: [],
  boards: [],
  customers: [],
  channels: [],
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

function loadPresets(): AnalyticsPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item: any) => ({
        id: String(item?.id || ""),
        name: String(item?.name || ""),
        range: ["24h", "7d", "30d"].includes(item?.range) ? item.range : "7d",
        autoRefresh: typeof item?.autoRefresh === "boolean" ? item.autoRefresh : DEFAULT_PREFS.autoRefresh,
        visible: { ...DEFAULT_PREFS.visible, ...(item?.visible || {}) },
        filters: {
          team: item?.filters?.team || FILTER_ALL,
          board: item?.filters?.board || FILTER_ALL,
          customer: item?.filters?.customer || FILTER_ALL,
          channel: item?.filters?.channel || FILTER_ALL,
        },
        createdAt: typeof item?.createdAt === "string" ? item.createdAt : new Date().toISOString(),
      }))
      .filter((preset: AnalyticsPreset) => preset.id && preset.name);
  } catch {
    return [];
  }
}

function savePresets(presets: AnalyticsPreset[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}

function toApiFilters(filters: AnalyticsFilterState): AnalyticsFilters {
  const clean = (value: string) => {
    const next = String(value || "").trim();
    if (!next || next.toLowerCase() === FILTER_ALL) return undefined;
    return next;
  };
  return {
    team: clean(filters.team),
    board: clean(filters.board),
    customer: clean(filters.customer),
    channel: clean(filters.channel),
  };
}

function getActiveFilterCount(filters: AnalyticsFilterState) {
  return [filters.team, filters.board, filters.customer, filters.channel].filter(
    (value) => value && value.toLowerCase() !== FILTER_ALL
  ).length;
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

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export default function AnalyticsWorkspace() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [prefs, setPrefs] = useState<Preferences>(() => loadPrefs());
  const [filters, setFilters] = useState<AnalyticsFilterState>(DEFAULT_FILTERS);
  const [presets, setPresets] = useState<AnalyticsPreset[]>(() => loadPresets());
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [filterOptions, setFilterOptions] = useState<AnalyticsFilterOptions>(EMPTY_FILTER_OPTIONS);
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

  const apiFilters = useMemo(
    () => toApiFilters(filters),
    [filters.team, filters.board, filters.customer, filters.channel]
  );

  useEffect(() => {
    let active = true;
    const load = async () => {
      const initial = data === null;
      if (initial) setIsLoading(true);
      else setIsRefreshing(true);
      setError(null);
      try {
        const [next, options] = await Promise.all([
          analyticsApi.getDashboardWidgets({ range: prefs.range, seed: tick, filters: apiFilters }),
          analyticsApi.getFilterOptions({ range: prefs.range }),
        ]);
        if (!active) return;
        setData(next);
        setFilterOptions(options);
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
  }, [prefs.range, tick, apiFilters]);

  const trend = data?.trend ?? [];
  const teams = data?.teams ?? [];
  const totals = data?.summary ?? { opened: 0, resolved: 0, sla: 0, backlog: 0, firstResponse: 0 };
  const reports = data?.reports ?? { operations: [], service: [], efficiency: [] };
  const salesFunnel = data?.salesFunnel ?? { stageCounts: [], averageNewToWonHours: null, conversionTimeSampleSize: 0, lossReasons: [] };
  const isEmpty = !isLoading && !error && trend.length === 0 && teams.length === 0;
  const activeFilterCount = getActiveFilterCount(filters);

  const chartConfig = {
    opened: { label: "Opened", color: "#0f766e" },
    resolved: { label: "Resolved", color: "#2563eb" },
    sla: { label: "SLA %", color: "#ea580c" },
    closed: { label: "Closed", color: "#0284c7" },
    breached: { label: "Breached", color: "#ef4444" },
  } as const;

  const handleFilterChange = (key: keyof AnalyticsFilterState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleClearFilters = () => {
    setFilters(DEFAULT_FILTERS);
  };

  const handleSavePreset = () => {
    const suggested = `Report ${new Date().toLocaleDateString()}`;
    const name = window.prompt("Preset name", suggested)?.trim();
    if (!name) return;

    const preset: AnalyticsPreset = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      range: prefs.range,
      autoRefresh: prefs.autoRefresh,
      visible: { ...prefs.visible },
      filters: { ...filters },
      createdAt: new Date().toISOString(),
    };

    setPresets((prev) => {
      const deduped = prev.filter((item) => item.name.toLowerCase() !== name.toLowerCase());
      const next = [preset, ...deduped];
      savePresets(next);
      return next;
    });
    setSelectedPresetId(preset.id);
  };

  const handleApplyPreset = () => {
    const preset = presets.find((item) => item.id === selectedPresetId);
    if (!preset) return;
    setPrefs({
      range: preset.range,
      autoRefresh: preset.autoRefresh,
      visible: { ...preset.visible },
    });
    setFilters({ ...preset.filters });
    setTick((v) => v + 1);
  };

  const handleDeletePreset = () => {
    if (!selectedPresetId) return;
    setPresets((prev) => {
      const next = prev.filter((item) => item.id !== selectedPresetId);
      savePresets(next);
      return next;
    });
    setSelectedPresetId("");
  };

  const handleExportCsv = () => {
    if (!data) return;

    const rows: string[][] = [];
    rows.push(["CRM Analytics Export"]);
    rows.push(["Generated At", new Date(data.generatedAt).toLocaleString()]);
    rows.push(["Range", data.range]);
    rows.push(["Team", filters.team]);
    rows.push(["Board", filters.board]);
    rows.push(["Customer", filters.customer]);
    rows.push(["Channel", filters.channel]);
    rows.push([]);

    rows.push(["Summary"]);
    rows.push(["Opened", "Resolved", "SLA", "Backlog", "First Response (min)"]);
    rows.push([
      String(totals.opened),
      String(totals.resolved),
      `${totals.sla}%`,
      String(totals.backlog),
      String(totals.firstResponse),
    ]);
    rows.push([]);

    rows.push(["Trend"]);
    rows.push(["Label", "Opened", "Resolved", "SLA"]);
    trend.forEach((point) => {
      rows.push([point.label, String(point.opened), String(point.resolved), `${point.sla}%`]);
    });
    rows.push([]);

    rows.push(["Teams"]);
    rows.push(["Team", "Closed", "Breached"]);
    teams.forEach((point) => {
      rows.push([point.team, String(point.closed), String(point.breached)]);
    });
    rows.push([]);

    (["operations", "service", "efficiency"] as const).forEach((tab) => {
      rows.push([`Report: ${tab}`]);
      rows.push(["Metric", "Current", "Previous", "Delta", "Status", "Action"]);
      reports[tab].forEach((row) => {
        rows.push([
          row.metric,
          row.current,
          row.previous,
          `${row.delta >= 0 ? "+" : ""}${row.delta}%`,
          row.status,
          row.action,
        ]);
      });
      rows.push([]);
    });

    const content = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
    const suffix = new Date().toISOString().slice(0, 10);
    downloadTextFile(`analytics-report-${suffix}.csv`, content, "text/csv;charset=utf-8;");
  };

  const handleExportPdf = () => {
    if (!data) return;

    const filterText = [
      `Team: ${filters.team}`,
      `Board: ${filters.board}`,
      `Customer: ${filters.customer}`,
      `Channel: ${filters.channel}`,
    ].join(" | ");

    const reportRows = (["operations", "service", "efficiency"] as const)
      .flatMap((tab) =>
        reports[tab].map(
          (row) =>
            `<tr>
              <td>${escapeHtml(tab)}</td>
              <td>${escapeHtml(row.metric)}</td>
              <td>${escapeHtml(row.current)}</td>
              <td>${escapeHtml(row.previous)}</td>
              <td>${escapeHtml(`${row.delta >= 0 ? "+" : ""}${row.delta}%`)}</td>
              <td>${escapeHtml(row.status)}</td>
            </tr>`
        )
      )
      .join("");

    const printWindow = window.open("", "_blank", "noopener,noreferrer,width=1200,height=900");
    if (!printWindow) return;

    printWindow.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Analytics Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
    h1 { margin: 0 0 8px; font-size: 24px; }
    .meta { color: #4b5563; font-size: 12px; margin-bottom: 12px; }
    .summary { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; margin: 16px 0; }
    .summary div { border: 1px solid #d1d5db; border-radius: 8px; padding: 10px; font-size: 12px; }
    .summary strong { display: block; font-size: 18px; color: #111827; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 14px; }
    th, td { border: 1px solid #e5e7eb; text-align: left; padding: 8px; font-size: 12px; }
    th { background: #f9fafb; }
  </style>
</head>
<body>
  <h1>Operations Analytics Report</h1>
  <div class="meta">Generated: ${escapeHtml(new Date(data.generatedAt).toLocaleString())}</div>
  <div class="meta">Range: ${escapeHtml(data.range)} | ${escapeHtml(filterText)}</div>
  <div class="summary">
    <div>Opened<strong>${escapeHtml(totals.opened)}</strong></div>
    <div>Resolved<strong>${escapeHtml(totals.resolved)}</strong></div>
    <div>SLA<strong>${escapeHtml(`${totals.sla}%`)}</strong></div>
    <div>Backlog<strong>${escapeHtml(totals.backlog)}</strong></div>
    <div>First Response<strong>${escapeHtml(`${totals.firstResponse} min`)}</strong></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Section</th>
        <th>Metric</th>
        <th>Current</th>
        <th>Previous</th>
        <th>Delta</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${reportRows}
    </tbody>
  </table>
</body>
</html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

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
                  <div className="flex flex-wrap items-center gap-2">
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
                    <Button variant="outline" onClick={handleExportCsv} disabled={!data}>
                      <Download className="h-4 w-4" />
                      CSV
                    </Button>
                    <Button variant="outline" onClick={handleExportPdf} disabled={!data}>
                      <FileText className="h-4 w-4" />
                      PDF
                    </Button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                  <span>Source: {data?.source || "..."}</span>
                  <span>
                    Updated: {data?.generatedAt ? new Date(data.generatedAt).toLocaleTimeString() : "--:--:--"}
                  </span>
                  <span>Active filters: {activeFilterCount}</span>
                </div>
              </CardHeader>
            </Card>

            <Card className="bg-white/90 text-slate-900 dark:bg-slate-900/90 dark:text-slate-100">
              <CardHeader className="pb-0">
                <CardTitle className="text-base">Filters</CardTitle>
                <CardDescription>Filter analytics by team, board, customer, and channel.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <select
                    value={filters.team}
                    onChange={(e) => handleFilterChange("team", e.target.value)}
                    className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                  >
                    <option value={FILTER_ALL}>All teams</option>
                    {filterOptions.teams.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                  <select
                    value={filters.board}
                    onChange={(e) => handleFilterChange("board", e.target.value)}
                    className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                  >
                    <option value={FILTER_ALL}>All boards</option>
                    {filterOptions.boards.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                  <select
                    value={filters.customer}
                    onChange={(e) => handleFilterChange("customer", e.target.value)}
                    className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                  >
                    <option value={FILTER_ALL}>All customers</option>
                    {filterOptions.customers.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                  <select
                    value={filters.channel}
                    onChange={(e) => handleFilterChange("channel", e.target.value)}
                    className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                  >
                    <option value={FILTER_ALL}>All channels</option>
                    {filterOptions.channels.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-xs text-slate-500 dark:text-slate-400">{activeFilterCount} filter(s) active</div>
                  <Button variant="ghost" size="sm" onClick={handleClearFilters}>Reset filters</Button>
                </div>
              </CardContent>
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
                    The server returned an empty analytics payload for this range and filter selection.
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

            {!isLoading && !isEmpty && (
              <Card className="bg-white/90 text-slate-900 dark:bg-slate-900/90 dark:text-slate-100">
                <CardHeader className="pb-2">
                  <CardTitle>Sales Funnel</CardTitle>
                  <CardDescription>Lead counts by current stage across boards you can access.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
                  <div className="space-y-3">
                    {salesFunnel.stageCounts.map((row) => {
                      const maxCount = Math.max(1, ...salesFunnel.stageCounts.map((stage) => stage.count));
                      return (
                        <div key={row.stage} className="grid grid-cols-[6rem_1fr_2rem] items-center gap-3 text-sm">
                          <span className="text-slate-600 dark:text-slate-300">{row.stage}</span>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                            <div className="h-full rounded-full bg-orange-600" style={{ width: `${(row.count / maxCount) * 100}%` }} />
                          </div>
                          <span className="text-right font-medium">{row.count}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="space-y-4 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
                    <div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Average New to Won</div>
                      <div className="mt-1 text-2xl font-semibold">
                        {salesFunnel.averageNewToWonHours == null ? "—" : `${salesFunnel.averageNewToWonHours}h`}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Based on {salesFunnel.conversionTimeSampleSize} leads with recorded stage history</div>
                    </div>
                    <div>
                      <div className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">Lost lead reasons</div>
                      {salesFunnel.lossReasons.length ? salesFunnel.lossReasons.slice(0, 5).map((row) => (
                        <div key={row.reason} className="flex justify-between gap-3 py-1 text-sm">
                          <span className="truncate">{row.reason}</span><span className="font-medium">{row.count}</span>
                        </div>
                      )) : <div className="text-sm text-slate-500 dark:text-slate-400">No lost leads recorded.</div>}
                    </div>
                  </div>
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
                    <div className="text-xs text-slate-500 dark:text-slate-400">Refresh every 15s</div>
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
                <CardTitle className="text-base">Saved Report Presets</CardTitle>
                <CardDescription>Save current range, filters, and visible widgets.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <select
                  value={selectedPresetId}
                  onChange={(e) => setSelectedPresetId(e.target.value)}
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  <option value="">Select preset</option>
                  {presets.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.name}
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Button variant="outline" onClick={handleSavePreset}>
                    <Save className="h-4 w-4" />
                    Save Current
                  </Button>
                  <Button variant="outline" onClick={handleApplyPreset} disabled={!selectedPresetId}>
                    Apply
                  </Button>
                  <Button variant="outline" onClick={handleDeletePreset} disabled={!selectedPresetId}>
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Presets saved: {presets.length}
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
