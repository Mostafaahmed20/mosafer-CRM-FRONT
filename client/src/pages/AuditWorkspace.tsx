import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Download, RefreshCw, Search, StepBack, StepForward } from "lucide-react";
import { toast } from "sonner";
import SidebarRail from "@/components/SidebarRail";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { canManageGlobalUsers } from "@/lib/authz";
import { auditApi, AuditEvent, AuditFilterOptions } from "@/lib/api";

type AuditFiltersState = {
  q: string;
  action: string;
  boardId: string;
  actorId: string;
  channel: string;
  cardId: string;
  dateFrom: string;
  dateTo: string;
};

const DEFAULT_FILTERS: AuditFiltersState = {
  q: "",
  action: "",
  boardId: "",
  actorId: "",
  channel: "",
  cardId: "",
  dateFrom: "",
  dateTo: "",
};

const EMPTY_OPTIONS: AuditFilterOptions = {
  actions: [],
  channels: [],
  boards: [],
  users: [],
};

function fmtDate(value?: string) {
  if (!value) return "--";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "--";
  return d.toLocaleString();
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function downloadCsv(filename: string, rows: string[][]) {
  const content = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function AuditWorkspace() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [items, setItems] = useState<AuditEvent[]>([]);
  const [options, setOptions] = useState<AuditFilterOptions>(EMPTY_OPTIONS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(30);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [filters, setFilters] = useState<AuditFiltersState>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [refreshTick, setRefreshTick] = useState(0);
  const [playbackCardId, setPlaybackCardId] = useState("");
  const [playbackIndex, setPlaybackIndex] = useState(0);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/login");
  }, [authLoading, isAuthenticated, setLocation]);

  useEffect(() => {
    if (!authLoading && isAuthenticated && !canManageGlobalUsers(user)) {
      setLocation("/dashboard");
    }
  }, [authLoading, isAuthenticated, user, setLocation]);

  useEffect(() => {
    if (authLoading || !isAuthenticated || !canManageGlobalUsers(user)) return;
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [logs, filterOptions] = await Promise.all([
          auditApi.getLogs({
            page,
            limit,
            sort,
            ...filters,
          }),
          auditApi.getFilterOptions({
            dateFrom: filters.dateFrom || undefined,
            dateTo: filters.dateTo || undefined,
          }),
        ]);
        if (!active) return;
        setItems(logs.items);
        setTotal(logs.pagination.total);
        setTotalPages(logs.pagination.totalPages);
        setHasNext(logs.pagination.hasNext);
        setOptions(filterOptions);
      } catch (err: any) {
        if (!active) return;
        const message = err?.message || "Failed to load audit log";
        setError(message);
        toast.error(message);
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [authLoading, isAuthenticated, user, page, limit, sort, filters, refreshTick, setLocation]);

  useEffect(() => {
    if (!filters.cardId.trim()) return;
    setPlaybackCardId(filters.cardId.trim());
  }, [filters.cardId]);

  const playbackEvents = useMemo(() => {
    if (!playbackCardId) return [];
    return [...items]
      .filter((item) => item.card?._id === playbackCardId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [items, playbackCardId]);

  useEffect(() => {
    if (playbackEvents.length === 0) {
      setPlaybackIndex(0);
      return;
    }
    setPlaybackIndex(playbackEvents.length - 1);
  }, [playbackEvents]);

  const currentPlayback = playbackEvents[playbackIndex] || null;

  const applyField = (key: keyof AuditFiltersState, value: string) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setPage(1);
    setFilters(DEFAULT_FILTERS);
    setPlaybackCardId("");
  };

  const exportCsv = () => {
    const rows: string[][] = [
      ["Time", "Actor", "Action", "Message", "Board", "Card", "Channel", "Request ID"],
      ...items.map((item) => [
        fmtDate(item.createdAt),
        item.actor?.username || "--",
        item.action,
        item.message,
        item.board?.title || item.board?._id || "--",
        item.card?.title || item.card?._id || "--",
        item.channel || "--",
        item.requestId || "--",
      ]),
    ];
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(`audit-log-${date}.csv`, rows);
  };

  if (!authLoading && isAuthenticated && !canManageGlobalUsers(user)) return null;

  return (
    <div className="min-h-screen bg-[#F5F7FB] dark:bg-slate-950 flex text-slate-900 dark:text-slate-100">
      <SidebarRail />
      <div className="flex-1 p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <Card className="bg-white/90 text-slate-900 dark:bg-slate-900/90 dark:text-slate-100">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm text-amber-700 dark:text-amber-300">Global Admin</div>
                  <CardTitle className="mt-1 text-2xl">Audit Log & Playback</CardTitle>
                  <CardDescription>
                    Track who changed what and replay card-level events in sequence.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={limit}
                    onChange={(e) => {
                      setPage(1);
                      setLimit(Number(e.target.value) || 30);
                    }}
                    className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <option value={15}>15 / page</option>
                    <option value={30}>30 / page</option>
                    <option value={50}>50 / page</option>
                    <option value={100}>100 / page</option>
                  </select>
                  <select
                    value={sort}
                    onChange={(e) => {
                      setPage(1);
                      setSort(e.target.value === "oldest" ? "oldest" : "newest");
                    }}
                    className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                  </select>
                  <Button variant="outline" onClick={() => setRefreshTick((v) => v + 1)} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                    Refresh
                  </Button>
                  <Button variant="outline" onClick={exportCsv} disabled={!items.length}>
                    <Download className="h-4 w-4" />
                    Export CSV
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card className="bg-white/90 text-slate-900 dark:bg-slate-900/90 dark:text-slate-100">
            <CardHeader className="pb-0">
              <CardTitle className="text-base">Filters</CardTitle>
              <CardDescription>Filter by actor, board, action, channel, card, and date range.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={filters.q}
                    onChange={(e) => applyField("q", e.target.value)}
                    placeholder="Search message/action/user..."
                    className="pl-9"
                  />
                </div>
                <select
                  value={filters.action}
                  onChange={(e) => applyField("action", e.target.value)}
                  className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  <option value="">All actions</option>
                  {options.actions.map((action) => (
                    <option key={action} value={action}>
                      {action}
                    </option>
                  ))}
                </select>
                <select
                  value={filters.boardId}
                  onChange={(e) => applyField("boardId", e.target.value)}
                  className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  <option value="">All boards</option>
                  {options.boards.map((board) => (
                    <option key={board._id} value={board._id}>
                      {board.title || board._id}
                    </option>
                  ))}
                </select>
                <select
                  value={filters.actorId}
                  onChange={(e) => applyField("actorId", e.target.value)}
                  className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  <option value="">All actors</option>
                  {options.users.map((actor) => (
                    <option key={actor._id} value={actor._id}>
                      {actor.username}
                    </option>
                  ))}
                </select>
                <select
                  value={filters.channel}
                  onChange={(e) => applyField("channel", e.target.value)}
                  className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  <option value="">All channels</option>
                  {options.channels.map((channel) => (
                    <option key={channel} value={channel}>
                      {channel}
                    </option>
                  ))}
                </select>
                <Input
                  value={filters.cardId}
                  onChange={(e) => applyField("cardId", e.target.value)}
                  placeholder="Card ID"
                />
                <Input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => applyField("dateFrom", e.target.value)}
                />
                <Input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => applyField("dateTo", e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {total} total events
                </div>
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Reset filters
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <Card className="bg-white/90 text-slate-900 dark:bg-slate-900/90 dark:text-slate-100">
              <CardHeader className="pb-0">
                <CardTitle className="text-base">Event Timeline</CardTitle>
                <CardDescription>Latest events matching selected filters.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {loading && (
                  <div className="text-sm text-slate-500 dark:text-slate-400">Loading events...</div>
                )}

                {error && !loading && (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
                    {error}
                  </div>
                )}

                {!loading && !error && items.length === 0 && (
                  <div className="text-sm text-slate-500 dark:text-slate-400">No audit events found.</div>
                )}

                {!loading && items.length > 0 && (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs uppercase text-slate-500 dark:text-slate-400">
                        <tr>
                          <th className="px-3 py-2 text-left">Time</th>
                          <th className="px-3 py-2 text-left">Actor</th>
                          <th className="px-3 py-2 text-left">Action</th>
                          <th className="px-3 py-2 text-left">Message</th>
                          <th className="px-3 py-2 text-left">Board / Card</th>
                          <th className="px-3 py-2 text-left">Channel</th>
                          <th className="px-3 py-2 text-left">Playback</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item) => {
                          const cardId = item.card?._id;
                          return (
                            <tr key={item._id} className="border-t border-slate-100 dark:border-slate-800 align-top">
                              <td className="px-3 py-3 whitespace-nowrap">{fmtDate(item.createdAt)}</td>
                              <td className="px-3 py-3">{item.actor?.username || "--"}</td>
                              <td className="px-3 py-3 font-medium">{item.action}</td>
                              <td className="px-3 py-3 max-w-[280px]">{item.message}</td>
                              <td className="px-3 py-3">
                                <div>{item.board?.title || item.board?._id || "--"}</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                  {item.card?.title || item.card?._id || "--"}
                                </div>
                              </td>
                              <td className="px-3 py-3">{item.channel || "--"}</td>
                              <td className="px-3 py-3">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={!cardId}
                                  onClick={() => {
                                    if (!cardId) return;
                                    setPlaybackCardId(cardId);
                                    applyField("cardId", cardId);
                                  }}
                                >
                                  Open
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="flex items-center justify-between text-sm">
                  <div className="text-slate-500 dark:text-slate-400">
                    Page {page} / {Math.max(1, totalPages)}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1 || loading}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={!hasNext || loading}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/90 text-slate-900 dark:bg-slate-900/90 dark:text-slate-100">
              <CardHeader className="pb-0">
                <CardTitle className="text-base">Card Playback</CardTitle>
                <CardDescription>
                  Step through ordered events for card <span className="font-mono">{playbackCardId || "--"}</span>.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {!playbackCardId && (
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    Select an event with a card to open playback.
                  </div>
                )}

                {playbackCardId && playbackEvents.length === 0 && (
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    No events for this card in the current page/filter scope.
                  </div>
                )}

                {playbackEvents.length > 0 && currentPlayback && (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Step {playbackIndex + 1} / {playbackEvents.length}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPlaybackIndex((idx) => Math.max(0, idx - 1))}
                          disabled={playbackIndex <= 0}
                        >
                          <StepBack className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPlaybackIndex((idx) => Math.min(playbackEvents.length - 1, idx + 1))}
                          disabled={playbackIndex >= playbackEvents.length - 1}
                        >
                          <StepForward className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/40">
                      <div className="text-xs text-slate-500 dark:text-slate-400">{fmtDate(currentPlayback.createdAt)}</div>
                      <div className="mt-1 text-sm font-medium">{currentPlayback.action}</div>
                      <div className="mt-1 text-sm">{currentPlayback.message}</div>
                      <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        Actor: {currentPlayback.actor?.username || "--"} | Channel: {currentPlayback.channel || "--"}
                      </div>
                    </div>

                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {playbackEvents.map((event, index) => (
                        <button
                          key={event._id}
                          type="button"
                          onClick={() => setPlaybackIndex(index)}
                          className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition ${
                            index === playbackIndex
                              ? "border-slate-900 bg-slate-900 text-white dark:border-slate-200 dark:bg-slate-200 dark:text-slate-900"
                              : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                          }`}
                        >
                          <div>{fmtDate(event.createdAt)}</div>
                          <div className="mt-1 font-semibold">{event.action}</div>
                        </button>
                      ))}
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setPlaybackCardId("");
                        if (filters.cardId) applyField("cardId", "");
                      }}
                    >
                      Clear playback
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
