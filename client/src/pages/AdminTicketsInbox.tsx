import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import SidebarRail from "@/components/SidebarRail";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { canManageGlobalUsers } from "@/lib/authz";
import {
  adminTicketsApi,
  type AdminTicketDetailResponse,
  type AdminTicketListItem,
  type AdminTicketsFilters,
  type AdminTicketsSortBy,
  type SortDir,
} from "@/lib/api";
import { Loader2, RefreshCw, Search } from "lucide-react";

type TicketFiltersState = Omit<AdminTicketsFilters, "page" | "limit" | "sortBy" | "sortDir"> & {
  q: string;
  status: string;
  priority: string;
  group: string;
  boardId: string;
  listId: string;
  agentId: string;
  includeArchived: boolean;
  includeClosed: boolean;
};

const DEFAULT_FILTERS: TicketFiltersState = {
  q: "",
  status: "",
  priority: "",
  group: "",
  boardId: "",
  listId: "",
  agentId: "",
  includeArchived: false,
  includeClosed: false,
};

function fmtDate(value?: string) {
  if (!value) return "--";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "--";
  return d.toLocaleString();
}

function compact(value?: string) {
  const text = String(value || "").trim();
  return text || "--";
}

function errorStatus(error: unknown) {
  return typeof error === "object" && error && "status" in error ? Number((error as any).status) : undefined;
}

export default function AdminTicketsInbox() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [items, setItems] = useState<AdminTicketListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [filters, setFilters] = useState<TicketFiltersState>(DEFAULT_FILTERS);
  const [sortBy, setSortBy] = useState<AdminTicketsSortBy>("updatedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [refreshTick, setRefreshTick] = useState(0);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminTicketDetailResponse | null>(null);

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
        const res = await adminTicketsApi.getAll({
          page,
          limit,
          sortBy,
          sortDir,
          ...filters,
        });
        if (!active) return;
        setItems(res.items);
        setTotal(res.pagination.total);
        setTotalPages(res.pagination.totalPages);
        setHasNext(res.pagination.hasNext);
      } catch (err: any) {
        if (!active) return;
        const status = errorStatus(err);
        const message = err?.message || "Failed to load admin tickets";
        setError(message);
        if (status === 401) {
          toast.error("Session expired. Please log in again.");
          setLocation("/login");
        } else if (status === 403) {
          toast.error("Admin tickets are restricted to global admins.");
        } else if (status === 400) {
          toast.error(message);
        } else {
          toast.error("Failed to load admin tickets");
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [authLoading, isAuthenticated, user, page, limit, filters, sortBy, sortDir, refreshTick, setLocation]);

  useEffect(() => {
    if (!selectedTicketId) {
      setDetail(null);
      setDetailError(null);
      setDetailLoading(false);
      return;
    }
    let active = true;
    const loadDetail = async () => {
      setDetailLoading(true);
      setDetailError(null);
      try {
        const res = await adminTicketsApi.getById(selectedTicketId);
        if (!active) return;
        setDetail(res);
      } catch (err: any) {
        if (!active) return;
        const status = errorStatus(err);
        const message = err?.message || "Failed to load ticket details";
        setDetailError(message);
        if (status === 401) setLocation("/login");
      } finally {
        if (active) setDetailLoading(false);
      }
    };
    void loadDetail();
    return () => {
      active = false;
    };
  }, [selectedTicketId, setLocation]);

  const statusOptions = useMemo(
    () => Array.from(new Set(items.map((i) => i.card.status).filter(Boolean) as string[])).sort(),
    [items]
  );
  const priorityOptions = useMemo(
    () => Array.from(new Set(items.map((i) => i.card.priority).filter(Boolean) as string[])).sort(),
    [items]
  );
  const groupOptions = useMemo(
    () => Array.from(new Set(items.map((i) => i.card.group).filter(Boolean) as string[])).sort(),
    [items]
  );

  const applyField = (key: keyof TicketFiltersState, value: string | boolean) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, [key]: value } as TicketFiltersState));
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
                  <CardTitle className="mt-1 text-2xl">Admin Tickets Inbox</CardTitle>
                  <CardDescription>
                    Cross-board ticket inbox powered by `/api/admin/tickets` (global admin only).
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={limit}
                    onChange={(e) => {
                      setPage(1);
                      setLimit(Number(e.target.value) || 25);
                    }}
                    className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <option value={10}>10 / page</option>
                    <option value={25}>25 / page</option>
                    <option value={50}>50 / page</option>
                    <option value={100}>100 / page</option>
                  </select>
                  <Button
                    variant="outline"
                    onClick={() => setRefreshTick((v) => v + 1)}
                    disabled={loading}
                    className="gap-2"
                  >
                    <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                    Refresh
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-4">
              <Card className="bg-white/90 text-slate-900 dark:bg-slate-900/90 dark:text-slate-100">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Filters</CardTitle>
                  <CardDescription>Server-side query params for admin tickets.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <div className="relative xl:col-span-2">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        value={filters.q}
                        onChange={(e) => applyField("q", e.target.value)}
                        placeholder="Search title, subject, booking ref, requester..."
                        className="pl-9"
                      />
                    </div>
                    <select
                      value={filters.status}
                      onChange={(e) => applyField("status", e.target.value)}
                      className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                    >
                      <option value="">All status</option>
                      {statusOptions.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>

                    <select
                      value={filters.priority}
                      onChange={(e) => applyField("priority", e.target.value)}
                      className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                    >
                      <option value="">All priority</option>
                      {priorityOptions.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                    <select
                      value={filters.group}
                      onChange={(e) => applyField("group", e.target.value)}
                      className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                    >
                      <option value="">All group</option>
                      {groupOptions.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={sortBy}
                        onChange={(e) => {
                          setPage(1);
                          setSortBy(e.target.value as AdminTicketsSortBy);
                        }}
                        className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                      >
                        <option value="updatedAt">Sort: Updated</option>
                        <option value="createdAt">Sort: Created</option>
                        <option value="priority">Sort: Priority</option>
                        <option value="status">Sort: Status</option>
                        <option value="group">Sort: Group</option>
                        <option value="board">Sort: Board</option>
                        <option value="list">Sort: List</option>
                      </select>
                      <select
                        value={sortDir}
                        onChange={(e) => {
                          setPage(1);
                          setSortDir(e.target.value as SortDir);
                        }}
                        className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                      >
                        <option value="desc">Desc</option>
                        <option value="asc">Asc</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <Input
                      value={filters.boardId}
                      onChange={(e) => applyField("boardId", e.target.value)}
                      placeholder="boardId"
                    />
                    <Input
                      value={filters.listId}
                      onChange={(e) => applyField("listId", e.target.value)}
                      placeholder="listId"
                    />
                    <Input
                      value={filters.agentId}
                      onChange={(e) => applyField("agentId", e.target.value)}
                      placeholder="agentId"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={filters.includeArchived}
                        onChange={(e) => applyField("includeArchived", e.target.checked)}
                      />
                      Include archived
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={filters.includeClosed}
                        onChange={(e) => applyField("includeClosed", e.target.checked)}
                      />
                      Include closed
                    </label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setPage(1);
                        setSortBy("updatedAt");
                        setSortDir("desc");
                        setFilters(DEFAULT_FILTERS);
                      }}
                    >
                      Reset filters
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/90 text-slate-900 dark:bg-slate-900/90 dark:text-slate-100">
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">Tickets</CardTitle>
                      <CardDescription>
                        {total} total, page {page} of {Math.max(1, totalPages)}
                      </CardDescription>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Click a row to load `GET /api/admin/tickets/:cardId`
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="py-10 flex items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading admin tickets...
                    </div>
                  ) : error ? (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-300">
                      {error}
                    </div>
                  ) : (
                    <>
                      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                        <table className="min-w-full text-sm">
                          <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs uppercase text-slate-500 dark:text-slate-400">
                            <tr>
                              <th className="px-3 py-2 text-left">Ticket</th>
                              <th className="px-3 py-2 text-left">Status</th>
                              <th className="px-3 py-2 text-left">Priority</th>
                              <th className="px-3 py-2 text-left">Group</th>
                              <th className="px-3 py-2 text-left">Agent</th>
                              <th className="px-3 py-2 text-left">Board</th>
                              <th className="px-3 py-2 text-left">List</th>
                              <th className="px-3 py-2 text-left">Updated</th>
                              <th className="px-3 py-2 text-left">Booking / Requester</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((item) => {
                              const isSelected = item.card._id === selectedTicketId;
                              return (
                                <tr
                                  key={item.card._id}
                                  className={`border-t border-slate-100 dark:border-slate-800 cursor-pointer ${
                                    isSelected ? "bg-indigo-50 dark:bg-indigo-900/20" : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                                  }`}
                                  onClick={() => setSelectedTicketId(item.card._id)}
                                >
                                  <td className="px-3 py-3">
                                    <div className="font-medium">{compact(item.card.subject || item.card.title)}</div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400">{compact(item.card.title)}</div>
                                  </td>
                                  <td className="px-3 py-3">{compact(item.card.status)}</td>
                                  <td className="px-3 py-3">{compact(item.card.priority)}</td>
                                  <td className="px-3 py-3">{compact(item.card.group)}</td>
                                  <td className="px-3 py-3">{compact(item.card.agent?.username)}</td>
                                  <td className="px-3 py-3">{compact(item.board.title)}</td>
                                  <td className="px-3 py-3">{compact(item.listMeta.title)}</td>
                                  <td className="px-3 py-3 text-xs">{fmtDate(item.card.updatedAt)}</td>
                                  <td className="px-3 py-3 text-xs">
                                    <div>{compact(item.card.bookingRef)}</div>
                                    <div className="text-slate-500 dark:text-slate-400">{compact(item.card.requester)}</div>
                                  </td>
                                </tr>
                              );
                            })}
                            {!items.length && (
                              <tr>
                                <td colSpan={9} className="px-3 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                                  No tickets found for the current filters.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          total={total} totalPages={Math.max(1, totalPages)} hasNext={String(hasNext)}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                            Previous
                          </Button>
                          <div className="text-sm">Page {page}</div>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!hasNext && page >= totalPages}
                            onClick={() => setPage((p) => p + 1)}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card className="bg-white/90 text-slate-900 dark:bg-slate-900/90 dark:text-slate-100">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Ticket Detail</CardTitle>
                  <CardDescription>
                    {selectedTicketId ? `Selected: ${selectedTicketId}` : "Select a ticket row to load details"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!selectedTicketId && (
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      The detail panel calls `GET /api/admin/tickets/:cardId` and shows board/list context.
                    </div>
                  )}

                  {selectedTicketId && detailLoading && (
                    <div className="flex items-center text-sm text-slate-500 dark:text-slate-400">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading detail...
                    </div>
                  )}

                  {selectedTicketId && detailError && !detailLoading && (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-300">
                      {detailError}
                    </div>
                  )}

                  {detail && !detailLoading && !detailError && (
                    <>
                      <div className="space-y-2">
                        <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Card</div>
                        <div className="font-semibold">{compact(detail.card.subject || detail.card.title)}</div>
                        <div className="text-sm text-slate-600 dark:text-slate-300">{compact(detail.card.description)}</div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <Info label="Status" value={detail.card.status} />
                        <Info label="Priority" value={detail.card.priority} />
                        <Info label="Group" value={detail.card.group} />
                        <Info label="Agent" value={detail.card.agent?.username} />
                        <Info label="Booking Ref" value={detail.card.bookingRef} />
                        <Info label="Requester" value={detail.card.requester} />
                      </div>

                      <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                        <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Context</div>
                        <div className="mt-2 text-sm">Board: {compact(detail.board.title)}</div>
                        <div className="text-sm">List: {compact(detail.list.title)}</div>
                        <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                          Updated: {fmtDate(detail.card.updatedAt)} | Created: {fmtDate(detail.card.createdAt)}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setLocation(`/board/${detail.board._id}?card=${detail.card._id}`)}
                        >
                          Open in Board
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedTicketId(null)}>
                          Clear Selection
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-2 dark:border-slate-700">
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 font-medium">{compact(value)}</div>
    </div>
  );
}
