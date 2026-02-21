import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SidebarRail from "@/components/SidebarRail";
import { boardApi, listApi, cardApi, Board, List, Card } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { NotificationBell } from "@/components/NotificationBell";
import {
  ArrowUpDown,
  CheckSquare,
  Download,
  Filter,
  Loader2,
  Plus,
  Search,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

interface TicketItem {
  card: Card;
  board: Board;
  list: List;
}

type OpsView =
  | "all"
  | "today-arrivals"
  | "arrivals-next-3-days"
  | "pending-supplier-confirmation"
  | "pending-hotel-confirmation"
  | "in-house";
type SavedView = "none" | "my-queue" | "today-arrivals" | "pending-confirmations";

const toDateOnly = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const formatRequesterName = (value?: string) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "-";
  if (!trimmed.includes("@")) return trimmed;
  const local = (trimmed.split("@")[0] || "").trim();
  return local.replace(/[._-]+/g, " ") || trimmed;
};

export default function TicketsInbox() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [boardFilter, setBoardFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [opsView, setOpsView] = useState<OpsView>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<"created-desc" | "created-asc" | "arrival-asc" | "due-asc">("created-desc");
  const [assignMemberUserId, setAssignMemberUserId] = useState<string>("");
  const [assignAgentUserId, setAssignAgentUserId] = useState<string>("");
  const [savedView, setSavedView] = useState<SavedView>("none");

  const getUserBoardRole = (board: Board): "admin" | "member" | "guest" | "observer" | null => {
    const membership = board.members.find((m) => m.user?._id === user?._id);
    return (membership?.role as any) || null;
  };

  const canBulkManageTicket = (ticket: TicketItem): boolean => {
    const role = getUserBoardRole(ticket.board);
    return role === "admin" || role === "member";
  };

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [authLoading, isAuthenticated, setLocation]);

  useEffect(() => {
    if (isAuthenticated) {
      loadTickets();
    }
  }, [isAuthenticated]);

  const loadTickets = async () => {
    try {
      setIsLoading(true);
      const boards = (await boardApi.getAll()) as Board[];
      const listsByBoard = await Promise.all(
        boards.map(async (board) => {
          const lists = (await listApi.getByBoard(board._id)) as List[];
          return { board, lists };
        })
      );

      const flattened: TicketItem[] = [];
      listsByBoard.forEach(({ board, lists }) => {
        lists.forEach((list) => {
          list.cards.forEach((card) => {
            flattened.push({ card, board, list });
          });
        });
      });

      setTickets(flattened);
    } catch (error) {
      toast.error("Failed to load tickets");
    } finally {
      setIsLoading(false);
    }
  };

  const boards = useMemo(() => {
    const map = new Map<string, Board>();
    tickets.forEach((t) => map.set(t.board._id, t.board));
    return Array.from(map.values());
  }, [tickets]);

  const statuses = useMemo(() => {
    const map = new Map<string, string>();
    tickets.forEach((t) => {
      const status = t.card.status || "Requested";
      map.set(status, status);
    });
    return Array.from(map.values());
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    const filtered = tickets.filter((t) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch = q
        ? [
            t.card.title,
            t.card.bookingRef,
            t.card.agencyName,
            t.card.hotelName,
            t.card.supplierConfirmationNumber,
            t.card.hotelConfirmationNumber,
            t.card.voucherNumber,
            t.card.requester,
            t.board.title,
            t.list.title,
          ]
            .map((value) => String(value || "").toLowerCase())
            .some((value) => value.includes(q))
        : true;
      const matchesBoard = boardFilter === "all" ? true : t.board._id === boardFilter;
      const matchesStatus = statusFilter === "all" ? true : (t.card.status || "Requested") === statusFilter;
      const matchesAssignee = assigneeFilter === "all"
        ? true
        : assigneeFilter === "me"
        ? t.card.members?.some((m) => m._id === user?._id)
        : true;

      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const in3Days = new Date(todayStart);
      in3Days.setDate(todayStart.getDate() + 3);
      const arrival = toDateOnly(t.card.arrivalDate || t.card.checkInDate || t.card.dueDate);

      const matchesOpsView = (() => {
        if (opsView === "all") return true;
        if (opsView === "today-arrivals") return !!arrival && isSameDay(arrival, todayStart);
        if (opsView === "arrivals-next-3-days") {
          if (!arrival) return false;
          return arrival >= todayStart && arrival <= in3Days;
        }
        if (opsView === "pending-supplier-confirmation") {
          return (t.card.status === "Confirmed" || t.card.status === "Reconfirmed") && !t.card.supplierConfirmationNumber;
        }
        if (opsView === "pending-hotel-confirmation") {
          return (t.card.status === "Confirmed" || t.card.status === "Reconfirmed") && !t.card.hotelConfirmationNumber;
        }
        if (opsView === "in-house") return t.card.status === "In-house";
        return true;
      })();

      const matchesSavedView = (() => {
        if (savedView === "none") return true;
        if (savedView === "my-queue") {
          return t.card.agent?._id === user?._id || t.card.members?.some((m) => m._id === user?._id);
        }
        if (savedView === "today-arrivals") {
          return !!arrival && isSameDay(arrival, todayStart);
        }
        if (savedView === "pending-confirmations") {
          const status = t.card.status || "";
          const statusEligible = status === "Confirmed" || status === "Reconfirmed";
          return statusEligible && (!t.card.supplierConfirmationNumber || !t.card.hotelConfirmationNumber);
        }
        return true;
      })();

      return matchesSearch && matchesBoard && matchesStatus && matchesAssignee && matchesOpsView && matchesSavedView;
    });

    const toMillis = (value?: string) => {
      if (!value) return 0;
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? 0 : date.getTime();
    };

    return filtered.sort((a, b) => {
      if (sortBy === "created-asc") return toMillis((a.card as any).createdAt) - toMillis((b.card as any).createdAt);
      if (sortBy === "arrival-asc") {
        return toMillis(a.card.arrivalDate || a.card.checkInDate || a.card.dueDate) -
          toMillis(b.card.arrivalDate || b.card.checkInDate || b.card.dueDate);
      }
      if (sortBy === "due-asc") return toMillis(a.card.dueDate) - toMillis(b.card.dueDate);
      return toMillis((b.card as any).createdAt) - toMillis((a.card as any).createdAt);
    });
  }, [tickets, searchQuery, boardFilter, statusFilter, assigneeFilter, user?._id, opsView, savedView, sortBy]);

  const savedViewCounters = useMemo(() => {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return {
      "my-queue": tickets.filter((t) => t.card.agent?._id === user?._id || t.card.members?.some((m) => m._id === user?._id)).length,
      "today-arrivals": tickets.filter((t) => {
        const arrival = toDateOnly(t.card.arrivalDate || t.card.checkInDate || t.card.dueDate);
        return !!arrival && isSameDay(arrival, todayStart);
      }).length,
      "pending-confirmations": tickets.filter((t) => {
        const status = t.card.status || "";
        const statusEligible = status === "Confirmed" || status === "Reconfirmed";
        return statusEligible && (!t.card.supplierConfirmationNumber || !t.card.hotelConfirmationNumber);
      }).length,
    };
  }, [tickets, user?._id]);

  const assignableUsers = useMemo(() => {
    const selected = filteredTickets
      .filter((t) => selectedIds.has(t.card._id))
      .filter(canBulkManageTicket);
    const map = new Map<string, { _id: string; username: string; email: string }>();
    selected.forEach((ticket) => {
      ticket.board.members.forEach((member) => {
        if (member.user?._id) map.set(member.user._id, member.user);
      });
    });
    return Array.from(map.values()).sort((a, b) => a.username.localeCompare(b.username));
  }, [filteredTickets, selectedIds, user?._id]);

  const selectedTickets = useMemo(
    () => filteredTickets.filter((t) => selectedIds.has(t.card._id)),
    [filteredTickets, selectedIds]
  );
  const selectedEligibleTickets = useMemo(
    () => selectedTickets.filter(canBulkManageTicket),
    [selectedTickets, user?._id]
  );
  const restrictedSelectedCount = selectedTickets.length - selectedEligibleTickets.length;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredTickets.length) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(filteredTickets.map((t) => t.card._id)));
  };

  const updateTicket = (cardId: string, updates: Partial<Card>) => {
    setTickets((prev) =>
      prev.map((t) =>
        t.card._id === cardId
          ? { ...t, card: { ...t.card, ...updates } }
          : t
      )
    );
  };

  const handleBulkAssignMember = async (targetUserId: string) => {
    const selected = selectedEligibleTickets;
    if (selected.length === 0) return;
    const restricted = selectedTickets.length - selected.length;

    try {
      let updated = 0;
      await Promise.all(
        selected.map(async (t) => {
          const boardMember = t.board.members.find((m) => m.user._id === targetUserId)?.user;
          if (!boardMember) return;
          const memberIds = new Set((t.card.members || []).map((m) => m._id));
          memberIds.add(targetUserId);
          await cardApi.update(t.board._id, t.list._id, t.card._id, {
            members: Array.from(memberIds),
          });
          const nextMembers = [
            ...(t.card.members || []).filter((m) => m._id !== targetUserId),
            boardMember as any,
          ];
          updateTicket(t.card._id, { members: nextMembers });
          updated += 1;
        })
      );
      if (updated === 0) {
        toast.error("No valid assignees for selected tickets");
      } else {
        toast.success(restricted > 0 ? `Members assigned (${restricted} skipped)` : "Members assigned");
      }
    } catch (error) {
      toast.error("Failed to assign");
    }
  };

  const handleBulkAssignToMe = async () => {
    if (!user?._id) return;
    await handleBulkAssignMember(user._id);
  };

  const handleBulkAssignAgent = async (targetUserId: string) => {
    const selected = selectedEligibleTickets;
    if (selected.length === 0) return;
    const restricted = selectedTickets.length - selected.length;

    try {
      let updated = 0;
      await Promise.all(
        selected.map(async (t) => {
          const boardMember = t.board.members.find((m) => m.user._id === targetUserId)?.user;
          if (!boardMember) return;
          await cardApi.update(t.board._id, t.list._id, t.card._id, {
            agent: targetUserId,
          });
          updateTicket(t.card._id, { agent: boardMember as any });
          updated += 1;
        })
      );
      if (updated === 0) {
        toast.error("No valid agents for selected tickets");
      } else {
        toast.success(restricted > 0 ? `Agent assigned (${restricted} skipped)` : "Agent assigned");
      }
    } catch (error) {
      toast.error("Failed to assign agent");
    }
  };

  const handleBulkMarkDone = async () => {
    const selected = selectedEligibleTickets;
    if (selected.length === 0) return;
    const restricted = selectedTickets.length - selected.length;

    try {
      await Promise.all(
        selected.map(async (t) => {
          await cardApi.update(t.board._id, t.list._id, t.card._id, { status: "Completed", dueComplete: true });
          updateTicket(t.card._id, { status: "Completed", dueComplete: true });
        })
      );
      toast.success(restricted > 0 ? `Marked as done (${restricted} skipped)` : "Marked as done");
    } catch (error) {
      toast.error("Failed to update tickets");
    }
  };

  const handleAssignAgentToMeSingle = async (ticket: TicketItem) => {
    if (!user?._id) return;
    if (!canBulkManageTicket(ticket)) {
      toast.error("You do not have permission on this board");
      return;
    }
    try {
      await cardApi.update(ticket.board._id, ticket.list._id, ticket.card._id, { agent: user._id });
      updateTicket(ticket.card._id, { agent: { _id: user._id, username: user.username || "You", email: user.email || "" } as any });
      toast.success("Agent assigned");
    } catch (error) {
      toast.error("Failed to assign agent");
    }
  };

  const handleMarkDoneSingle = async (ticket: TicketItem) => {
    if (!canBulkManageTicket(ticket)) {
      toast.error("You do not have permission on this board");
      return;
    }
    try {
      await cardApi.update(ticket.board._id, ticket.list._id, ticket.card._id, {
        status: "Completed",
        dueComplete: true,
      });
      updateTicket(ticket.card._id, { status: "Completed", dueComplete: true });
      toast.success("Marked as done");
    } catch (error) {
      toast.error("Failed to mark done");
    }
  };

  const handleExport = (onlySelected: boolean) => {
    const rows = (onlySelected
      ? filteredTickets.filter((t) => selectedIds.has(t.card._id))
      : filteredTickets
    ).map((t) => [
      t.card.title,
      t.board.title,
      t.list.title,
      t.card.dueDate ? new Date(t.card.dueDate).toLocaleDateString() : "",
      t.card.dueComplete ? "Done" : "Open",
    ]);

    const header = ["Title", "Board", "Status", "Due", "State"];
    const csv = [header, ...rows]
      .map((row) => row.map((value) => `\"${String(value).replace(/\"/g, '\"\"')}\"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "tickets.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleClearFilters = () => {
    setSavedView("none");
    setOpsView("all");
    setSearchQuery("");
    setBoardFilter("all");
    setStatusFilter("all");
    setAssigneeFilter("all");
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-[#F5F7FB] flex">
        <SidebarRail />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7FB] flex">
      <SidebarRail />
      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b border-slate-200">
          <div className="px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <div className="text-sm text-slate-500">All tickets</div>
                <div className="text-lg font-semibold text-slate-900">Tickets Inbox</div>
              </div>
              <Button variant="outline" size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                New
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search tickets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 w-64 bg-slate-50 border-slate-200 rounded-full"
                />
              </div>
              <NotificationBell />
            </div>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          <main className="flex-1 px-6 py-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <Button variant="ghost" size="sm" className="gap-2" asChild>
                  <label>
                  <ArrowUpDown className="w-4 h-4" />
                  Sort by:
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as "created-desc" | "created-asc" | "arrival-asc" | "due-asc")}
                    className="bg-transparent text-slate-700 outline-none"
                  >
                    <option value="created-desc">Date created (newest)</option>
                    <option value="created-asc">Date created (oldest)</option>
                    <option value="arrival-asc">Arrival date</option>
                    <option value="due-asc">Due date</option>
                  </select>
                  </label>
                </Button>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Filter className="w-4 h-4" />
                Filters ({boardFilter === "all" && statusFilter === "all" ? 0 : 1})
                <Button variant="ghost" size="sm" onClick={handleClearFilters}>Clear</Button>
              </div>
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-2">
              {[
                { key: "all", label: "All" },
                { key: "today-arrivals", label: "Today arrivals" },
                { key: "arrivals-next-3-days", label: "Arrivals in 3 days" },
                { key: "pending-supplier-confirmation", label: "Pending supplier conf." },
                { key: "pending-hotel-confirmation", label: "Pending hotel conf." },
                { key: "in-house", label: "In-house" },
              ].map((view) => (
                <Button
                  key={view.key}
                  size="sm"
                  variant={opsView === view.key ? "default" : "outline"}
                  onClick={() => setOpsView(view.key as OpsView)}
                  className={opsView === view.key ? "bg-[#6366F1] hover:bg-[#4F46E5] text-white" : ""}
                >
                  {view.label}
                </Button>
              ))}
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-2">
              {[
                { key: "none" as SavedView, label: "All queue", count: tickets.length },
                { key: "my-queue" as SavedView, label: "My queue", count: savedViewCounters["my-queue"] },
                { key: "today-arrivals" as SavedView, label: "Today arrivals", count: savedViewCounters["today-arrivals"] },
                { key: "pending-confirmations" as SavedView, label: "Pending confirmations", count: savedViewCounters["pending-confirmations"] },
              ].map((view) => (
                <Button
                  key={view.key}
                  size="sm"
                  variant={savedView === view.key ? "default" : "outline"}
                  onClick={() => setSavedView(view.key)}
                  className={savedView === view.key ? "bg-[#0F172A] hover:bg-[#1E293B] text-white" : ""}
                >
                  {view.label} ({view.count})
                </Button>
              ))}
            </div>

            {selectedIds.size > 0 && (
              <div className="mb-4 flex items-center justify-between rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
                <div className="text-sm text-indigo-700">
                  {selectedIds.size} selected
                  {restrictedSelectedCount > 0 ? ` (${restrictedSelectedCount} restricted by role)` : ""}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    onClick={handleBulkAssignToMe}
                    disabled={selectedEligibleTickets.length === 0}
                  >
                    <UserPlus className="w-4 h-4" />
                    Assign to me
                  </Button>
                  <div className="flex items-center gap-2">
                    <select
                      value={assignMemberUserId}
                      onChange={(e) => setAssignMemberUserId(e.target.value)}
                      className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm"
                    >
                      <option value="">Member...</option>
                      {assignableUsers.map((member) => (
                        <option key={member._id} value={member._id}>
                          {member.username}
                        </option>
                      ))}
                    </select>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => assignMemberUserId && handleBulkAssignMember(assignMemberUserId)}
                      disabled={!assignMemberUserId || selectedEligibleTickets.length === 0}
                    >
                      Assign member
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={assignAgentUserId}
                      onChange={(e) => setAssignAgentUserId(e.target.value)}
                      className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm"
                    >
                      <option value="">Agent...</option>
                      {assignableUsers.map((member) => (
                        <option key={member._id} value={member._id}>
                          {member.username}
                        </option>
                      ))}
                    </select>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => assignAgentUserId && handleBulkAssignAgent(assignAgentUserId)}
                      disabled={!assignAgentUserId || selectedEligibleTickets.length === 0}
                    >
                      Assign agent
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    onClick={handleBulkMarkDone}
                    disabled={selectedEligibleTickets.length === 0}
                  >
                    <CheckSquare className="w-4 h-4" />
                    Mark done
                  </Button>
                  <Button size="sm" variant="outline" className="gap-2" onClick={() => handleExport(true)}>
                    <Download className="w-4 h-4" />
                    Export
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                    Clear
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <input
                  type="checkbox"
                  checked={selectedIds.size > 0 && selectedIds.size === filteredTickets.length}
                  onChange={toggleSelectAll}
                />
                <div className="flex-1">Ticket</div>
                <div className="w-32">Status</div>
                <div className="w-32">Agent</div>
                <div className="w-40">Hotel</div>
                <div className="w-40">Confirmations</div>
                <div className="w-32">Board</div>
                <div className="w-32">Due</div>
                <div className="w-56">Actions</div>
              </div>

              {filteredTickets.map((ticket) => (
                (() => {
                  const today = new Date();
                  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                  const arrival = toDateOnly(ticket.card.arrivalDate || ticket.card.checkInDate || ticket.card.dueDate);
                  const due = toDateOnly(ticket.card.dueDate);
                  const isOverdue = !!due && due < todayStart && !ticket.card.dueComplete;
                  const arrivalRisk = !!arrival && arrival >= todayStart &&
                    Math.floor((arrival.getTime() - todayStart.getTime()) / 86400000) <= 3;
                  const hasSlaRisk = isOverdue || arrivalRisk;

                  return (
                <div
                  key={ticket.card._id}
                  className={`bg-white rounded-2xl border p-4 hover:shadow-md transition flex items-center gap-3 ${
                    hasSlaRisk ? "border-amber-300 bg-amber-50/40" : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(ticket.card._id)}
                    onChange={() => toggleSelect(ticket.card._id)}
                  />
                  <button
                    onClick={() => setLocation(`/board/${ticket.board._id}?card=${ticket.card._id}`)}
                    className="flex-1 text-left"
                  >
                    <div className="text-sm font-semibold text-slate-900">
                      {ticket.card.title}
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-2">
                      <span>{formatRequesterName(ticket.card.requester)} - {ticket.board.title}</span>
                      {isOverdue && (
                        <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[10px] font-semibold">
                          Due overdue
                        </span>
                      )}
                      {arrivalRisk && (
                        <span className="rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[10px] font-semibold">
                          Arrival risk
                        </span>
                      )}
                    </div>
                  </button>
                  <div className="w-32 text-xs font-semibold text-slate-600">
                    {ticket.card.status || "Requested"}
                  </div>
                  <div className="w-32 text-xs text-slate-600 truncate">
                    {ticket.card.agent?.username || "-"}
                  </div>
                  <div className="w-40 text-xs text-slate-600 truncate">
                    {ticket.card.hotelName || "-"}
                  </div>
                  <div className="w-40 text-xs text-slate-500 truncate">
                    S: {ticket.card.supplierConfirmationNumber || "-"} / H: {ticket.card.hotelConfirmationNumber || "-"}
                  </div>
                  <div className="w-32 text-xs text-slate-500">
                    {ticket.board.title}
                  </div>
                  <div className="w-32 text-xs text-slate-500">
                    {ticket.card.dueDate
                      ? new Date(ticket.card.dueDate).toLocaleDateString()
                      : "-"}
                  </div>
                  <div className="w-56 flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-2"
                      disabled={!canBulkManageTicket(ticket)}
                      onClick={() => handleAssignAgentToMeSingle(ticket)}
                    >
                      Assign agent
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-2"
                      disabled={!canBulkManageTicket(ticket)}
                      onClick={() => handleMarkDoneSingle(ticket)}
                    >
                      Mark done
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2"
                      onClick={() => setLocation(`/board/${ticket.board._id}?card=${ticket.card._id}`)}
                    >
                      Open
                    </Button>
                  </div>
                </div>
                  );
                })()
              ))}
            </div>
          </main>

          {/* Filters panel removed */}
        </div>
      </div>
    </div>
  );
}
