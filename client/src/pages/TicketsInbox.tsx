import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import FreshdeskNewLauncher, { type BoardCatalogItem } from "@/components/FreshdeskNewLauncher";
import SidebarRail from "@/components/SidebarRail";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  boardApi,
  cardApi,
  listApi,
  Board,
  Card,
  List,
  TRAVEL_TICKET_STATUSES,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { isGlobalAdmin } from "@/lib/authz";
import {
  ArrowUpDown,
  CheckCircle2,
  CheckSquare,
  Download,
  ExternalLink,
  Filter,
  Forward,
  Loader2,
  Mail,
  MoreHorizontal,
  NotebookPen,
  Phone,
  Reply,
  Search,
  UserPlus,
} from "lucide-react";

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
type ComposerMode = "reply" | "note";

const PRIORITY_OPTIONS = ["Urgent", "High", "Medium", "Low"];
const CLOSED_STATUS_SET = new Set(["closed", "completed", "cancelled"]);

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

const compact = (value?: string) => {
  const text = String(value || "").trim();
  return text || "-";
};

const formatRequesterName = (value?: string) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "-";
  if (!trimmed.includes("@")) return trimmed;
  const local = (trimmed.split("@")[0] || "").trim();
  return local.replace(/[._-]+/g, " ") || trimmed;
};

const formatAge = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const diffMinutes = Math.max(1, Math.floor((Date.now() - date.getTime()) / 60000));
  if (diffMinutes < 60) return `${diffMinutes}m`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h`;
  return `${Math.floor(diffHours / 24)}d`;
};

const formatDate = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatDateTime = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const isClosedStatus = (status?: string) => CLOSED_STATUS_SET.has(String(status || "").trim().toLowerCase());

const getPriorityPill = (priority?: string) => {
  if (priority === "Urgent") return "border-red-200 bg-red-50 text-red-700";
  if (priority === "High") return "border-amber-200 bg-amber-50 text-amber-700";
  if (priority === "Low") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
};

export default function TicketsInbox() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [boardCatalog, setBoardCatalog] = useState<BoardCatalogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [boardFilter, setBoardFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [opsView, setOpsView] = useState<OpsView>("all");
  const [savedView, setSavedView] = useState<SavedView>("none");
  const [sortBy, setSortBy] = useState<"created-desc" | "created-asc" | "arrival-asc" | "due-asc">("created-desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [assignMemberUserId, setAssignMemberUserId] = useState("");
  const [assignAgentUserId, setAssignAgentUserId] = useState("");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [composerMode, setComposerMode] = useState<ComposerMode>("reply");
  const [composerText, setComposerText] = useState("");
  const [isSubmittingComposer, setIsSubmittingComposer] = useState(false);
  const [statusDraft, setStatusDraft] = useState("");
  const [priorityDraft, setPriorityDraft] = useState("");
  const [groupDraft, setGroupDraft] = useState("");
  const [typeDraft, setTypeDraft] = useState("");
  const [agentDraft, setAgentDraft] = useState("");
  const [isSavingProperties, setIsSavingProperties] = useState(false);
  const isGlobalAdminUser = isGlobalAdmin(user);

  const getUserBoardRole = (board: Board): "admin" | "member" | "guest" | "observer" | null => {
    const membership = board.members.find((member) => member.user?._id === user?._id);
    return (membership?.role as any) || null;
  };

  const canManageTicket = (ticket: TicketItem) => {
    if (isGlobalAdminUser) return true;
    const role = getUserBoardRole(ticket.board);
    return role === "admin" || role === "member";
  };

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/login");
  }, [authLoading, isAuthenticated, setLocation]);

  useEffect(() => {
    if (!isAuthenticated) return;
    void loadTickets();
  }, [isAuthenticated]);

  const loadTickets = async () => {
    try {
      setIsLoading(true);
      const boards = (await boardApi.getAll()) as Board[];
      const byBoard = await Promise.all(
        boards.map(async (board) => ({
          board,
          lists: (await listApi.getByBoard(board._id)) as List[],
        }))
      );

      const next: TicketItem[] = [];
      byBoard.forEach(({ board, lists }) => {
        lists.forEach((list) => {
          list.cards.forEach((card) => next.push({ board, list, card }));
        });
      });
      setBoardCatalog(byBoard);
      setTickets(next);
    } catch {
      toast.error("Failed to load tickets");
    } finally {
      setIsLoading(false);
    }
  };

  const boards = useMemo(() => boardCatalog.map((entry) => entry.board), [boardCatalog]);

  const statuses = useMemo(() => {
    const map = new Map<string, string>();
    tickets.forEach((ticket) => map.set(ticket.card.status || "Requested", ticket.card.status || "Requested"));
    return Array.from(map.values()).sort();
  }, [tickets]);

  const groupOptions = useMemo(() => {
    const map = new Map<string, string>();
    tickets.forEach((ticket) => {
      const group = String(ticket.card.group || "").trim();
      if (group) map.set(group, group);
    });
    return Array.from(map.values()).sort();
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    const filtered = tickets.filter((ticket) => {
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch = query
        ? [
            ticket.card.title,
            ticket.card.bookingRef,
            ticket.card.agencyName,
            ticket.card.hotelName,
            ticket.card.requester,
            ticket.board.title,
            ticket.list.title,
          ]
            .map((value) => String(value || "").toLowerCase())
            .some((value) => value.includes(query))
        : true;

      const matchesBoard = boardFilter === "all" || ticket.board._id === boardFilter;
      const matchesStatus = statusFilter === "all" || (ticket.card.status || "Requested") === statusFilter;
      const matchesAssignee =
        assigneeFilter === "all" ||
        ticket.card.agent?._id === user?._id ||
        ticket.card.members?.some((member) => member._id === user?._id);

      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const in3Days = new Date(todayStart);
      in3Days.setDate(todayStart.getDate() + 3);
      const arrival = toDateOnly(ticket.card.arrivalDate || ticket.card.checkInDate || ticket.card.dueDate);

      const matchesOpsView = (() => {
        if (opsView === "all") return true;
        if (opsView === "today-arrivals") return !!arrival && isSameDay(arrival, todayStart);
        if (opsView === "arrivals-next-3-days") return !!arrival && arrival >= todayStart && arrival <= in3Days;
        if (opsView === "pending-supplier-confirmation") {
          return (ticket.card.status === "Confirmed" || ticket.card.status === "Reconfirmed") &&
            !ticket.card.supplierConfirmationNumber;
        }
        if (opsView === "pending-hotel-confirmation") {
          return (ticket.card.status === "Confirmed" || ticket.card.status === "Reconfirmed") &&
            !ticket.card.hotelConfirmationNumber;
        }
        return ticket.card.status === "In-house";
      })();

      const matchesSavedView = (() => {
        if (savedView === "none") return true;
        if (savedView === "my-queue") {
          return ticket.card.agent?._id === user?._id || ticket.card.members?.some((member) => member._id === user?._id);
        }
        if (savedView === "today-arrivals") return !!arrival && isSameDay(arrival, todayStart);
        const eligible = ticket.card.status === "Confirmed" || ticket.card.status === "Reconfirmed";
        return eligible && (!ticket.card.supplierConfirmationNumber || !ticket.card.hotelConfirmationNumber);
      })();

      return matchesSearch && matchesBoard && matchesStatus && matchesAssignee && matchesOpsView && matchesSavedView;
    });

    const toMillis = (value?: string) => {
      if (!value) return 0;
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? 0 : date.getTime();
    };

    return filtered.sort((left, right) => {
      if (sortBy === "created-asc") return toMillis((left.card as any).createdAt) - toMillis((right.card as any).createdAt);
      if (sortBy === "arrival-asc") {
        return toMillis(left.card.arrivalDate || left.card.checkInDate || left.card.dueDate) -
          toMillis(right.card.arrivalDate || right.card.checkInDate || right.card.dueDate);
      }
      if (sortBy === "due-asc") return toMillis(left.card.dueDate) - toMillis(right.card.dueDate);
      return toMillis((right.card as any).createdAt) - toMillis((left.card as any).createdAt);
    });
  }, [tickets, searchQuery, boardFilter, statusFilter, assigneeFilter, opsView, savedView, sortBy, user?._id]);

  useEffect(() => {
    if (filteredTickets.length === 0) {
      setSelectedTicketId(null);
      return;
    }
    setSelectedTicketId((prev) => {
      if (prev && filteredTickets.some((ticket) => ticket.card._id === prev)) return prev;
      return filteredTickets[0].card._id;
    });
  }, [filteredTickets]);

  const selectedTicket = useMemo(
    () => filteredTickets.find((ticket) => ticket.card._id === selectedTicketId) ||
      tickets.find((ticket) => ticket.card._id === selectedTicketId) ||
      null,
    [filteredTickets, tickets, selectedTicketId]
  );

  useEffect(() => {
    if (!selectedTicket) return;
    setStatusDraft(selectedTicket.card.status || "Requested");
    setPriorityDraft(selectedTicket.card.priority || "Medium");
    setGroupDraft(selectedTicket.card.group || "Operations");
    setTypeDraft(selectedTicket.card.type || "Booking request");
    setAgentDraft(selectedTicket.card.agent?._id || "");
  }, [selectedTicket?.card._id]);

  const savedViewCounters = useMemo(() => {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return {
      "my-queue": tickets.filter((ticket) =>
        ticket.card.agent?._id === user?._id || ticket.card.members?.some((member) => member._id === user?._id)
      ).length,
      "today-arrivals": tickets.filter((ticket) => {
        const arrival = toDateOnly(ticket.card.arrivalDate || ticket.card.checkInDate || ticket.card.dueDate);
        return !!arrival && isSameDay(arrival, todayStart);
      }).length,
      "pending-confirmations": tickets.filter((ticket) => {
        const eligible = ticket.card.status === "Confirmed" || ticket.card.status === "Reconfirmed";
        return eligible && (!ticket.card.supplierConfirmationNumber || !ticket.card.hotelConfirmationNumber);
      }).length,
    };
  }, [tickets, user?._id]);

  const assignableUsers = useMemo(() => {
    const selected = filteredTickets.filter((ticket) => selectedIds.has(ticket.card._id)).filter(canManageTicket);
    const map = new Map<string, { _id: string; username: string; email: string }>();
    selected.forEach((ticket) => {
      ticket.board.members.forEach((member) => {
        if (member.user?._id) map.set(member.user._id, member.user);
      });
    });
    return Array.from(map.values()).sort((left, right) => left.username.localeCompare(right.username));
  }, [filteredTickets, selectedIds, user?._id, isGlobalAdminUser]);

  const relatedTickets = useMemo(() => {
    if (!selectedTicket) return [];
    return tickets
      .filter((ticket) => ticket.card._id !== selectedTicket.card._id)
      .filter((ticket) => {
        const sameRequester =
          String(ticket.card.requester || "").trim() &&
          String(ticket.card.requester || "").trim() === String(selectedTicket.card.requester || "").trim();
        const sameAgency =
          String(ticket.card.agencyName || "").trim() &&
          String(ticket.card.agencyName || "").trim() === String(selectedTicket.card.agencyName || "").trim();
        return sameRequester || sameAgency;
      })
      .slice(0, 5);
  }, [selectedTicket, tickets]);

  const propertyUsers = useMemo(() => {
    if (!selectedTicket) return [];
    return selectedTicket.board.members
      .map((member) => member.user)
      .filter((member): member is NonNullable<typeof member> => Boolean(member?._id))
      .sort((left, right) => left.username.localeCompare(right.username));
  }, [selectedTicket]);

  const selectedTickets = useMemo(
    () => filteredTickets.filter((ticket) => selectedIds.has(ticket.card._id)),
    [filteredTickets, selectedIds]
  );

  const selectedEligibleTickets = useMemo(
    () => selectedTickets.filter(canManageTicket),
    [selectedTickets, user?._id, isGlobalAdminUser]
  );

  const restrictedSelectedCount = selectedTickets.length - selectedEligibleTickets.length;

  const propertiesDirty = Boolean(selectedTicket) && (
    statusDraft !== (selectedTicket?.card.status || "Requested") ||
    priorityDraft !== (selectedTicket?.card.priority || "Medium") ||
    groupDraft !== (selectedTicket?.card.group || "Operations") ||
    typeDraft !== (selectedTicket?.card.type || "Booking request") ||
    agentDraft !== (selectedTicket?.card.agent?._id || "")
  );

  const updateLocalTicket = (cardId: string, updates: Partial<Card>) => {
    setTickets((prev) => prev.map((ticket) => (
      ticket.card._id === cardId ? { ...ticket, card: { ...ticket.card, ...updates } } : ticket
    )));
  };

  const replaceLocalCard = (cardId: string, card: Card) => {
    setTickets((prev) => prev.map((ticket) => (
      ticket.card._id === cardId ? { ...ticket, card } : ticket
    )));
  };

  const handleNewTicketCreated = ({ boardId, listId, card }: { boardId: string; listId: string; card: Card }) => {
    const boardEntry = boardCatalog.find((entry) => entry.board._id === boardId);
    const listEntry = boardEntry?.lists.find((list) => list._id === listId);
    if (!boardEntry || !listEntry) {
      void loadTickets();
      setSelectedTicketId(card._id);
      return;
    }

    setBoardCatalog((prev) =>
      prev.map((entry) =>
        entry.board._id !== boardId
          ? entry
          : {
              ...entry,
              lists: entry.lists.map((list) =>
                list._id === listId
                  ? {
                      ...list,
                      cards: [...list.cards.filter((existing) => existing._id !== card._id), card],
                    }
                  : list
              ),
            }
      )
    );

    setTickets((prev) => [
      { board: boardEntry.board, list: listEntry, card },
      ...prev.filter((ticket) => ticket.card._id !== card._id),
    ]);
    setSelectedTicketId(card._id);
  };

  const handleBoardUpdated = (board: Board) => {
    setBoardCatalog((prev) => prev.map((entry) => (entry.board._id === board._id ? { ...entry, board } : entry)));
    setTickets((prev) => prev.map((ticket) => (ticket.board._id === board._id ? { ...ticket, board } : ticket)));
  };

  const exportTickets = (selectedOnly: boolean) => {
    const rows = (selectedOnly
      ? filteredTickets.filter((ticket) => selectedIds.has(ticket.card._id))
      : filteredTickets
    ).map((ticket) => [
      ticket.card.title,
      ticket.board.title,
      ticket.list.title,
      ticket.card.status || "Requested",
      ticket.card.dueDate ? formatDate(ticket.card.dueDate) : "",
    ]);
    const csv = [["Title", "Board", "List", "Status", "Due"], ...rows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, "\"\"")}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "tickets.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setSavedView("none");
    setOpsView("all");
    setSearchQuery("");
    setBoardFilter("all");
    setStatusFilter("all");
    setAssigneeFilter("all");
  };

  const handleBulkAssignMember = async (targetUserId: string) => {
    if (!selectedEligibleTickets.length) return;
    const restricted = selectedTickets.length - selectedEligibleTickets.length;
    try {
      let updated = 0;
      await Promise.all(selectedEligibleTickets.map(async (ticket) => {
        const boardMember = ticket.board.members.find((member) => member.user._id === targetUserId)?.user;
        if (!boardMember) return;
        const memberIds = new Set((ticket.card.members || []).map((member) => member._id));
        memberIds.add(targetUserId);
        await cardApi.update(ticket.board._id, ticket.list._id, ticket.card._id, {
          members: Array.from(memberIds),
        });
        updateLocalTicket(ticket.card._id, {
          members: [...(ticket.card.members || []).filter((member) => member._id !== targetUserId), boardMember as any],
        });
        updated += 1;
      }));
      if (updated === 0) toast.error("No valid assignees for selected tickets");
      else toast.success(restricted > 0 ? `Members assigned (${restricted} skipped)` : "Members assigned");
    } catch {
      toast.error("Failed to assign member");
    }
  };

  const handleBulkAssignAgent = async (targetUserId: string) => {
    if (!selectedEligibleTickets.length) return;
    const restricted = selectedTickets.length - selectedEligibleTickets.length;
    try {
      let updated = 0;
      await Promise.all(selectedEligibleTickets.map(async (ticket) => {
        const boardMember = ticket.board.members.find((member) => member.user._id === targetUserId)?.user;
        if (!boardMember) return;
        await cardApi.update(ticket.board._id, ticket.list._id, ticket.card._id, { agent: targetUserId });
        updateLocalTicket(ticket.card._id, { agent: boardMember as any });
        updated += 1;
      }));
      if (updated === 0) toast.error("No valid agents for selected tickets");
      else toast.success(restricted > 0 ? `Agent assigned (${restricted} skipped)` : "Agent assigned");
    } catch {
      toast.error("Failed to assign agent");
    }
  };

  const handleBulkMarkDone = async () => {
    if (!selectedEligibleTickets.length) return;
    const restricted = selectedTickets.length - selectedEligibleTickets.length;
    try {
      await Promise.all(selectedEligibleTickets.map(async (ticket) => {
        await cardApi.update(ticket.board._id, ticket.list._id, ticket.card._id, { dueComplete: true });
        updateLocalTicket(ticket.card._id, { dueComplete: true });
      }));
      toast.success(restricted > 0 ? `Marked done (${restricted} skipped)` : "Marked done");
    } catch {
      toast.error("Failed to update tickets");
    }
  };

  const handleAssignAgentToMe = async (ticket: TicketItem) => {
    if (!user?._id) return;
    if (!canManageTicket(ticket)) {
      toast.error("You do not have permission on this board");
      return;
    }
    try {
      await cardApi.update(ticket.board._id, ticket.list._id, ticket.card._id, { agent: user._id });
      updateLocalTicket(ticket.card._id, {
        agent: { _id: user._id, username: user.username || "You", email: user.email || "" } as any,
      });
      toast.success("Agent assigned");
    } catch {
      toast.error("Failed to assign agent");
    }
  };

  const handleCloseTicket = async (ticket: TicketItem) => {
    if (!canManageTicket(ticket)) {
      toast.error("You do not have permission on this board");
      return;
    }
    try {
      const updated = await cardApi.update(ticket.board._id, ticket.list._id, ticket.card._id, {
        status: "Closed",
        dueComplete: true,
      }) as Card;
      replaceLocalCard(ticket.card._id, updated);
      toast.success("Ticket closed");
    } catch {
      toast.error("Failed to close ticket");
    }
  };

  const handleSaveProperties = async () => {
    if (!selectedTicket || !propertiesDirty) return;
    if (!canManageTicket(selectedTicket)) {
      toast.error("You do not have permission on this board");
      return;
    }
    try {
      setIsSavingProperties(true);
      const updated = await cardApi.update(
        selectedTicket.board._id,
        selectedTicket.list._id,
        selectedTicket.card._id,
        {
          status: statusDraft,
          priority: priorityDraft,
          group: groupDraft,
          type: typeDraft,
          agent: agentDraft || null,
        }
      ) as Card;
      replaceLocalCard(selectedTicket.card._id, updated);
      toast.success("Ticket updated");
    } catch {
      toast.error("Failed to update ticket");
    } finally {
      setIsSavingProperties(false);
    }
  };

  const handleSubmitComposer = async () => {
    if (!selectedTicket || !composerText.trim()) return;
    try {
      setIsSubmittingComposer(true);
      const nextText = composerMode === "note" ? `[Note] ${composerText.trim()}` : composerText.trim();
      const updated = await cardApi.addComment(
        selectedTicket.board._id,
        selectedTicket.list._id,
        selectedTicket.card._id,
        nextText
      ) as Card;
      replaceLocalCard(selectedTicket.card._id, updated);
      setComposerText("");
      toast.success(composerMode === "note" ? "Note added" : "Reply added");
    } catch {
      toast.error("Failed to update conversation");
    } finally {
      setIsSubmittingComposer(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex min-h-screen bg-[#F4F7FB]">
        <SidebarRail />
        <div className="flex flex-1 items-center justify-center">
          <div className="flex items-center gap-3 rounded-full border border-[#D9E5F4] bg-white px-5 py-3 text-sm font-medium text-[#486581] shadow-sm">
            <Loader2 className="h-5 w-5 animate-spin text-[#2063E9]" />
            Loading tickets workspace...
          </div>
        </div>
      </div>
    );
  }

  const selectedCreatedAt = (selectedTicket?.card as any)?.createdAt as string | undefined;
  const dueLabel = selectedTicket?.card.dueComplete
    ? "Complete"
    : selectedTicket?.card.dueDate
      ? `Due ${formatDate(selectedTicket.card.dueDate)}`
      : "No due date";

  return (
    <div className="flex min-h-screen bg-[#F4F7FB]">
      <SidebarRail />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="border-b border-[#D9E5F4] bg-white">
          <div className="flex h-16 items-center justify-between px-6">
            <div className="flex items-center gap-3">
              <div className="text-sm font-medium text-[#2063E9]">Tickets</div>
              <div className="text-sm text-[#829AB1]">{filteredTickets.length}</div>
            </div>
            <div className="flex items-center gap-2">
              <FreshdeskNewLauncher
                boardCatalog={boardCatalog}
                preferredBoardId={boardFilter !== "all" ? boardFilter : selectedTicket?.board._id}
                onTicketCreated={handleNewTicketCreated}
                onBoardUpdated={handleBoardUpdated}
              />
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#829AB1]" />
                <Input
                  placeholder="Search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-11 w-56 rounded-2xl border-[#D9E5F4] bg-[#F8FBFF] pl-9 shadow-none"
                />
              </div>
            </div>
          </div>
        </header>

        <div className="border-b border-[#D9E5F4] bg-white px-6 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
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
                  className={
                    savedView === view.key
                      ? "rounded-2xl bg-[#102A43] text-white hover:bg-[#183B5B]"
                      : "rounded-2xl border-[#D9E5F4] bg-white"
                  }
                >
                  {view.label} ({view.count})
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-2xl border border-[#D9E5F4] bg-[#F8FBFF] px-3 py-1">
                <ArrowUpDown className="h-4 w-4 text-[#829AB1]" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as "created-desc" | "created-asc" | "arrival-asc" | "due-asc")}
                  className="bg-transparent text-sm text-[#486581] outline-none"
                >
                  <option value="created-desc">Date created</option>
                  <option value="created-asc">Date created asc</option>
                  <option value="arrival-asc">Arrival date</option>
                  <option value="due-asc">Due date</option>
                </select>
              </div>
              <select value={boardFilter} onChange={(e) => setBoardFilter(e.target.value)} className="h-10 rounded-2xl border border-[#D9E5F4] bg-white px-3 text-sm text-[#486581]">
                <option value="all">All boards</option>
                {boards.map((board) => (
                  <option key={board._id} value={board._id}>{board.title}</option>
                ))}
              </select>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 rounded-2xl border border-[#D9E5F4] bg-white px-3 text-sm text-[#486581]">
                <option value="all">All status</option>
                {statuses.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
              <select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)} className="h-10 rounded-2xl border border-[#D9E5F4] bg-white px-3 text-sm text-[#486581]">
                <option value="all">All assignees</option>
                <option value="me">Assigned to me</option>
              </select>
              <select value={opsView} onChange={(e) => setOpsView(e.target.value as OpsView)} className="h-10 rounded-2xl border border-[#D9E5F4] bg-white px-3 text-sm text-[#486581]">
                <option value="all">All views</option>
                <option value="today-arrivals">Today arrivals</option>
                <option value="arrivals-next-3-days">Arrivals in 3 days</option>
                <option value="pending-supplier-confirmation">Pending supplier conf.</option>
                <option value="pending-hotel-confirmation">Pending hotel conf.</option>
                <option value="in-house">In-house</option>
              </select>
              <Button variant="ghost" size="sm" className="rounded-2xl text-[#486581]" onClick={clearFilters}>
                <Filter className="mr-1 h-4 w-4" />
                Clear
              </Button>
            </div>
          </div>
        </div>

        {selectedIds.size > 0 && (
          <div className="border-b border-[#D9E5F4] bg-[#EEF5FF] px-6 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-[#1E5ED8]">
                {selectedIds.size} selected
                {restrictedSelectedCount > 0 ? ` (${restrictedSelectedCount} restricted by role)` : ""}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" className="rounded-2xl border-[#C8DAF7] bg-white" onClick={() => user?._id && handleBulkAssignMember(user._id)} disabled={!selectedEligibleTickets.length}>
                  <UserPlus className="mr-1 h-4 w-4" />
                  Assign to me
                </Button>
                <select value={assignMemberUserId} onChange={(e) => setAssignMemberUserId(e.target.value)} className="h-10 rounded-2xl border border-[#C8DAF7] bg-white px-3 text-sm">
                  <option value="">Member...</option>
                  {assignableUsers.map((member) => (
                    <option key={member._id} value={member._id}>{member.username}</option>
                  ))}
                </select>
                <Button size="sm" variant="outline" className="rounded-2xl border-[#C8DAF7] bg-white" onClick={() => assignMemberUserId && handleBulkAssignMember(assignMemberUserId)} disabled={!assignMemberUserId || !selectedEligibleTickets.length}>
                  Assign member
                </Button>
                <select value={assignAgentUserId} onChange={(e) => setAssignAgentUserId(e.target.value)} className="h-10 rounded-2xl border border-[#C8DAF7] bg-white px-3 text-sm">
                  <option value="">Agent...</option>
                  {assignableUsers.map((member) => (
                    <option key={member._id} value={member._id}>{member.username}</option>
                  ))}
                </select>
                <Button size="sm" variant="outline" className="rounded-2xl border-[#C8DAF7] bg-white" onClick={() => assignAgentUserId && handleBulkAssignAgent(assignAgentUserId)} disabled={!assignAgentUserId || !selectedEligibleTickets.length}>
                  Assign agent
                </Button>
                <Button size="sm" variant="outline" className="rounded-2xl border-[#C8DAF7] bg-white" onClick={handleBulkMarkDone} disabled={!selectedEligibleTickets.length}>
                  <CheckSquare className="mr-1 h-4 w-4" />
                  Mark done
                </Button>
                <Button size="sm" variant="outline" className="rounded-2xl border-[#C8DAF7] bg-white" onClick={() => exportTickets(true)}>
                  <Download className="mr-1 h-4 w-4" />
                  Export
                </Button>
                <Button size="sm" variant="ghost" className="rounded-2xl" onClick={() => setSelectedIds(new Set())}>
                  Clear
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <aside className="w-[320px] shrink-0 border-r border-[#D9E5F4] bg-white">
            <div className="border-b border-[#D9E5F4] px-4 py-3">
              <label className="flex items-center justify-between text-sm text-[#486581]">
                <span className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.size > 0 && selectedIds.size === filteredTickets.length}
                    onChange={() =>
                      setSelectedIds(
                        selectedIds.size === filteredTickets.length
                          ? new Set()
                          : new Set(filteredTickets.map((ticket) => ticket.card._id))
                      )
                    }
                  />
                  <span className="font-medium">Date created</span>
                </span>
                <span>{filteredTickets.length}</span>
              </label>
            </div>

            <div className="h-full overflow-y-auto">
              {filteredTickets.map((ticket) => {
                const snippet =
                  String(ticket.card.description || "").trim() ||
                  String(ticket.card.comments?.[ticket.card.comments.length - 1]?.text || "").trim() ||
                  `${compact(ticket.card.hotelName)} ${compact(ticket.card.bookingRef)}`;
                const selected = ticket.card._id === selectedTicketId;
                return (
                  <div key={ticket.card._id} className={`border-b border-[#EEF4FB] px-3 py-4 transition ${selected ? "bg-[#EAF2FF]" : "bg-white hover:bg-[#F8FBFF]"}`}>
                    <div className="flex items-start gap-3">
                      <input type="checkbox" className="mt-1" checked={selectedIds.has(ticket.card._id)} onChange={() => setSelectedIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(ticket.card._id)) next.delete(ticket.card._id);
                        else next.add(ticket.card._id);
                        return next;
                      })} />
                      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setSelectedTicketId(ticket.card._id)}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm text-[#486581]">{formatRequesterName(ticket.card.requester)}</div>
                            <div className="mt-1 line-clamp-1 text-2xl font-semibold leading-none text-[#102A43]">{ticket.card.title}</div>
                          </div>
                          <div className="shrink-0 text-xs text-[#6B7C93]">{formatAge((ticket.card as any).createdAt)}</div>
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-xs text-[#6B7C93]">
                          <Phone className="h-3.5 w-3.5" />
                          <span className="line-clamp-1">{snippet}</span>
                        </div>
                      </button>
                    </div>
                  </div>
                );
              })}
              {filteredTickets.length === 0 && (
                <div className="px-6 py-10 text-center text-sm text-[#6B7C93]">No tickets found for the current filters.</div>
              )}
            </div>
          </aside>

          <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-white">
            {!selectedTicket ? (
              <div className="flex flex-1 items-center justify-center text-sm text-[#6B7C93]">Select a ticket to open the workspace.</div>
            ) : (
              <>
                <div className="border-b border-[#D9E5F4] px-5 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="outline" size="sm" className="rounded-2xl border-[#D9E5F4] bg-white"><Reply className="mr-1 h-4 w-4" />Reply</Button>
                      <Button variant="outline" size="sm" className="rounded-2xl border-[#D9E5F4] bg-white"><NotebookPen className="mr-1 h-4 w-4" />Note</Button>
                      <Button variant="outline" size="sm" className="rounded-2xl border-[#D9E5F4] bg-white"><Forward className="mr-1 h-4 w-4" />Forward</Button>
                      <Button variant="outline" size="sm" className="rounded-2xl border-[#D9E5F4] bg-white" onClick={() => handleCloseTicket(selectedTicket)}><CheckCircle2 className="mr-1 h-4 w-4" />Close</Button>
                      <Button variant="ghost" size="sm" className="rounded-2xl"><MoreHorizontal className="h-4 w-4" /></Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="rounded-2xl border-[#D9E5F4] bg-white" onClick={() => setLocation(`/board/${selectedTicket.board._id}?card=${selectedTicket.card._id}`)}><ExternalLink className="mr-1 h-4 w-4" />Open in board</Button>
                      <Button variant="outline" size="sm" className="rounded-2xl border-[#D9E5F4] bg-white" onClick={() => handleAssignAgentToMe(selectedTicket)}><UserPlus className="mr-1 h-4 w-4" />Assign to me</Button>
                    </div>
                  </div>
                </div>

                <div className="flex min-h-0 flex-1 overflow-hidden">
                  <section className="min-w-0 flex-1 overflow-y-auto px-6 py-6">
                    <div className="flex items-start justify-between gap-6">
                      <div className="min-w-0">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#5D748A] text-white"><Mail className="h-5 w-5" /></div>
                          <h1 className="text-[38px] font-semibold tracking-tight text-[#102A43]">{selectedTicket.card.title}</h1>
                        </div>
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-[#DDF7EA] px-3 py-1 text-xs font-semibold text-[#0F8A5F]">{selectedTicket.card.status || "Requested"}</span>
                          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getPriorityPill(selectedTicket.card.priority)}`}>{selectedTicket.card.priority || "Medium"}</span>
                        </div>
                      </div>
                      <div className="shrink-0 text-3xl font-medium text-[#102A43]">{isClosedStatus(selectedTicket.card.status) ? "Closed" : "Open"}</div>
                    </div>

                    <div className="mt-8 flex items-start gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FFECB0] text-sm font-semibold text-[#9A6700]">
                        {formatRequesterName(selectedTicket.card.requester).charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-sm text-[#486581]">
                          <span className="font-semibold text-[#1E5ED8]">{formatRequesterName(selectedTicket.card.requester)}</span>
                          <span>reported via {String(selectedTicket.card.source || "email").toLowerCase()}</span>
                          <span>-</span>
                          <span>{formatDateTime(selectedCreatedAt)}</span>
                        </div>
                        <div className="mt-4 whitespace-pre-wrap text-[17px] leading-8 text-[#102A43]">
                          {selectedTicket.card.description?.trim() || selectedTicket.card.title}
                        </div>
                      </div>
                    </div>

                    {(selectedTicket.card.comments || []).length > 0 && (
                      <div className="mt-8 space-y-6">
                        {[...(selectedTicket.card.comments || [])].reverse().map((comment) => (
                          <div key={comment._id} className="flex items-start gap-4">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EAF2FF] text-sm font-semibold text-[#1E5ED8]">
                              {comment.author?.username?.charAt(0).toUpperCase() || "U"}
                            </div>
                            <div className="min-w-0 flex-1 rounded-[24px] border border-[#D9E5F4] bg-[#F8FBFF] px-5 py-4">
                              <div className="text-sm font-semibold text-[#102A43]">{comment.author?.username || "Member"}</div>
                              <div className="mt-1 text-xs text-[#829AB1]">{formatDateTime(comment.createdAt)}</div>
                              <div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#486581]">{comment.text}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-8 flex gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FFECB0] text-sm font-semibold text-[#9A6700]">
                        {user?.username?.charAt(0).toUpperCase() || "M"}
                      </div>
                      <div className="min-w-0 flex-1 rounded-[24px] border border-[#D9E5F4] bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
                        <div className="mb-3 flex items-center gap-2">
                          <Button size="sm" variant={composerMode === "reply" ? "default" : "outline"} onClick={() => setComposerMode("reply")} className={composerMode === "reply" ? "rounded-2xl bg-[#2063E9] text-white hover:bg-[#164FC0]" : "rounded-2xl border-[#D9E5F4] bg-white"}><Reply className="mr-1 h-4 w-4" />Reply</Button>
                          <Button size="sm" variant={composerMode === "note" ? "default" : "outline"} onClick={() => setComposerMode("note")} className={composerMode === "note" ? "rounded-2xl bg-[#102A43] text-white hover:bg-[#183B5B]" : "rounded-2xl border-[#D9E5F4] bg-white"}><NotebookPen className="mr-1 h-4 w-4" />Note</Button>
                        </div>
                        <Textarea value={composerText} onChange={(e) => setComposerText(e.target.value)} placeholder={composerMode === "reply" ? "Type your response here..." : "Add an internal note..."} className="min-h-[120px] border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0" />
                        <div className="mt-3 flex justify-end">
                          <Button onClick={handleSubmitComposer} disabled={!composerText.trim() || isSubmittingComposer} className="rounded-2xl bg-[#2063E9] px-5 text-white hover:bg-[#164FC0]">
                            {isSubmittingComposer ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {composerMode === "reply" ? "Send reply" : "Add note"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </section>

                  <aside className="w-[340px] shrink-0 border-l border-[#D9E5F4] bg-[#F8FBFF]">
                    <div className="flex h-full min-h-0 flex-col">
                      <div className="flex-1 overflow-y-auto px-5 py-5">
                        <section className="mb-6">
                          <div className="mb-3 flex items-center justify-between">
                            <div className="text-sm font-semibold text-[#102A43]">Contact info</div>
                            <div className="text-sm text-[#1E5ED8]">Edit</div>
                          </div>
                          <div className="rounded-[24px] border border-[#D9E5F4] bg-white p-4">
                            <div className="flex items-start gap-3">
                              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FFECB0] text-sm font-semibold text-[#9A6700]">
                                {formatRequesterName(selectedTicket.card.requester).charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="text-xl font-semibold text-[#1E5ED8]">{formatRequesterName(selectedTicket.card.requester)}</div>
                                <div className="mt-1 text-sm text-[#486581]">{compact(selectedTicket.card.agencyName)}</div>
                              </div>
                            </div>
                            <div className="mt-5 space-y-4 text-sm">
                              <SidebarInfo label="Email" value={selectedTicket.card.requester?.includes("@") ? selectedTicket.card.requester : "-"} />
                              <SidebarInfo label="Hotel" value={selectedTicket.card.hotelName} />
                              <SidebarInfo label="Booking Ref" value={selectedTicket.card.bookingRef} />
                            </div>
                          </div>
                        </section>

                        <section className="mb-6">
                          <div className="mb-3 text-sm font-semibold text-[#102A43]">Properties</div>
                          <div className="space-y-4 rounded-[24px] border border-[#D9E5F4] bg-white p-4">
                            <PropertyField label="Type">
                              <Input value={typeDraft} onChange={(e) => setTypeDraft(e.target.value)} className="h-11 rounded-2xl border-[#D9E5F4] bg-white px-4 shadow-none" />
                            </PropertyField>
                            <PropertyField label="Status">
                              <select value={statusDraft} onChange={(e) => setStatusDraft(e.target.value)} className="h-11 w-full rounded-2xl border border-[#D9E5F4] bg-white px-4 text-sm text-[#102A43]">
                                {TRAVEL_TICKET_STATUSES.map((option) => <option key={option} value={option}>{option}</option>)}
                              </select>
                            </PropertyField>
                            <PropertyField label="Priority">
                              <select value={priorityDraft} onChange={(e) => setPriorityDraft(e.target.value)} className="h-11 w-full rounded-2xl border border-[#D9E5F4] bg-white px-4 text-sm text-[#102A43]">
                                {PRIORITY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                              </select>
                            </PropertyField>
                            <PropertyField label="Group">
                              <select value={groupDraft} onChange={(e) => setGroupDraft(e.target.value)} className="h-11 w-full rounded-2xl border border-[#D9E5F4] bg-white px-4 text-sm text-[#102A43]">
                                <option value="">No group</option>
                                {groupOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                              </select>
                            </PropertyField>
                            <PropertyField label="Agent">
                              <select value={agentDraft} onChange={(e) => setAgentDraft(e.target.value)} className="h-11 w-full rounded-2xl border border-[#D9E5F4] bg-white px-4 text-sm text-[#102A43]">
                                <option value="">Unassigned</option>
                                {propertyUsers.map((member) => <option key={member._id} value={member._id}>{member.username}</option>)}
                              </select>
                            </PropertyField>
                            <div className="grid gap-3 border-t border-[#EEF4FB] pt-3 text-sm">
                              <SidebarInfo label="Queue" value={selectedTicket.list.title} />
                              <SidebarInfo label="Board" value={selectedTicket.board.title} />
                              <SidebarInfo label="Due" value={dueLabel} />
                              <SidebarInfo label="Arrival" value={selectedTicket.card.arrivalDate || selectedTicket.card.checkInDate ? formatDate(selectedTicket.card.arrivalDate || selectedTicket.card.checkInDate) : "-"} />
                            </div>
                          </div>
                        </section>

                        <section>
                          <div className="mb-3 text-sm font-semibold text-[#102A43]">Recent tickets</div>
                          <div className="rounded-[24px] border border-[#D9E5F4] bg-white p-4">
                            {relatedTickets.length === 0 ? (
                              <div className="text-sm text-[#6B7C93]">No recent tickets found for this contact.</div>
                            ) : (
                              <div className="space-y-4">
                                {relatedTickets.map((ticket) => (
                                  <button key={ticket.card._id} type="button" onClick={() => setSelectedTicketId(ticket.card._id)} className="w-full text-left">
                                    <div className="text-sm font-semibold text-[#102A43]">{ticket.card.title}</div>
                                    <div className="mt-1 text-xs text-[#6B7C93]">{formatDateTime((ticket.card as any).createdAt)} - {ticket.card.status || "Requested"}</div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </section>
                      </div>

                      <div className="border-t border-[#D9E5F4] bg-white p-4">
                        <Button onClick={handleSaveProperties} disabled={!propertiesDirty || isSavingProperties} className="h-12 w-full rounded-2xl bg-[#2063E9] text-white hover:bg-[#164FC0]">
                          {isSavingProperties ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          Update
                        </Button>
                      </div>
                    </div>
                  </aside>
                </div>
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

function PropertyField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-sm text-[#486581]">{label}</div>
      {children}
    </div>
  );
}

function SidebarInfo({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="text-[#829AB1]">{label}</div>
      <div className="text-right font-medium text-[#102A43]">{compact(value)}</div>
    </div>
  );
}
