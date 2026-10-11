import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import SidebarRail from "@/components/SidebarRail";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { boardApi, Board, Card, List, ReservationLookupResult, reservationApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Search, FolderKanban, Ticket, ArrowRight, Hash } from "lucide-react";
import { toast } from "sonner";

type SearchResult = {
  card: Card;
  board: Board;
  list: List;
};

function normalizeText(value?: string) {
  return String(value || "").trim().toLowerCase();
}

export default function SearchWorkspace() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [boards, setBoards] = useState<Board[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState(() => new URLSearchParams(window.location.search).get("q") || "");
  const [scope, setScope] = useState<"all" | "tickets" | "boards">("all");
  const [reservationResult, setReservationResult] = useState<ReservationLookupResult | null>(null);
  const [reservationLoading, setReservationLoading] = useState(false);

  const findReservation = async () => {
    const reference = query.trim();
    if (!/^\d{4,12}$/.test(reference)) {
      toast.error("Enter the numeric reservation reference");
      return;
    }
    setReservationLoading(true);
    setReservationResult(null);
    try {
      setReservationResult(await reservationApi.lookup(reference));
    } catch (error: any) {
      toast.error(error?.message || "Reservation not found");
    } finally {
      setReservationLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [authLoading, isAuthenticated, setLocation]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const loadBoards = async () => {
      try {
        setIsLoading(true);
        const data = await boardApi.getAll();
        setBoards(Array.isArray(data) ? data : []);
      } catch (error: any) {
        toast.error(error?.message || "Failed to load search workspace");
      } finally {
        setIsLoading(false);
      }
    };
    loadBoards();
  }, [isAuthenticated]);

  const boardMatches = useMemo(() => {
    const q = normalizeText(query);
    if (!q) return boards;
    return boards.filter((board) => {
      const values = [board.title, board.description, board.owner?.username];
      return values.some((value) => normalizeText(value).includes(q));
    });
  }, [boards, query]);

  const ticketMatches = useMemo(() => {
    const q = normalizeText(query);
    const flattened: SearchResult[] = boards.flatMap((board) =>
      (board.lists || []).flatMap((list) =>
        (list.cards || []).map((card) => ({
          board,
          list,
          card,
        }))
      )
    );

    if (!q) return flattened;

    return flattened.filter(({ card, board, list }) => {
      const values = [
        card.title,
        card.description,
        card.requester,
        card.bookingRef,
        card.agencyName,
        card.hotelName,
        card.status,
        card.priority,
        card.group,
        board.title,
        list.title,
      ];
      return values.some((value) => normalizeText(value).includes(q));
    });
  }, [boards, query]);

  const visibleBoards = scope === "tickets" ? [] : boardMatches;
  const visibleTickets = scope === "boards" ? [] : ticketMatches;

  return (
    <div className="min-h-screen bg-[#F5F7FB] flex">
      <SidebarRail />
      <div className="flex-1 p-4 sm:p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="rounded-[28px] border border-[#D9E5F4] bg-white p-5 shadow-[0_20px_48px_rgba(15,23,42,0.06)] sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#829AB1]">Workspace</div>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#102A43]">Search</h1>
                <p className="mt-2 max-w-3xl text-sm text-[#6B7C93]">
                  Search boards, queues, and tickets from one place. Use this to jump directly into the right workspace.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] lg:w-[680px] lg:grid-cols-[minmax(0,1fr)_auto_160px]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#829AB1]" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(event) => { if (event.key === "Enter" && /^\d{4,12}$/.test(query.trim())) void findReservation(); }}
                    placeholder="Search tickets, booking refs, requester, board..."
                    className="h-12 rounded-2xl border-[#D9E5F4] bg-[#FBFDFF] pl-11 text-[#102A43] shadow-none"
                  />
                </div>
                <Button variant="outline" onClick={() => void findReservation()} disabled={reservationLoading} className="h-12 rounded-2xl border-[#D9E5F4]">
                  {reservationLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Hash className="mr-2 h-4 w-4" />}
                  Find reservation
                </Button>
                <select
                  value={scope}
                  onChange={(e) => setScope(e.target.value as "all" | "tickets" | "boards")}
                  className="h-12 rounded-2xl border border-[#D9E5F4] bg-[#FBFDFF] px-4 text-sm text-[#102A43]"
                >
                  <option value="all">Boards + tickets</option>
                  <option value="tickets">Tickets only</option>
                  <option value="boards">Boards only</option>
                </select>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[22px] border border-[#D9E5F4] bg-[#F8FBFF] p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#829AB1]">Boards</div>
                <div className="mt-2 text-2xl font-semibold text-[#102A43]">{boards.length}</div>
              </div>
              <div className="rounded-[22px] border border-[#D9E5F4] bg-[#F8FBFF] p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#829AB1]">Ticket Results</div>
                <div className="mt-2 text-2xl font-semibold text-[#102A43]">{ticketMatches.length}</div>
              </div>
              <div className="rounded-[22px] border border-[#D9E5F4] bg-[#F8FBFF] p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#829AB1]">Board Results</div>
                <div className="mt-2 text-2xl font-semibold text-[#102A43]">{boardMatches.length}</div>
              </div>
            </div>
          </div>

          {reservationResult && (
            <section className="rounded-[28px] border border-[#D9E5F4] bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.05)] sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E8EEF6] pb-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#829AB1]">Reservation Details</div>
                  <h2 className="mt-1 text-2xl font-bold text-[#102A43]">{reservationResult.reservationRef}</h2>
                </div>
                <div className="text-sm text-[#6B7C93]">{reservationResult.workspace ? `${reservationResult.workspace.boardTitle} · ${reservationResult.workspace.listTitle}` : "Reservation record"}</div>
              </div>
              {reservationResult.lead ? (
                <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <div><div className="text-xs text-[#829AB1]">Client / inquiry</div><div className="mt-1 font-semibold text-[#102A43]">{reservationResult.lead.customerName || reservationResult.lead.title}</div><div className="mt-1 text-sm text-[#6B7C93]">{reservationResult.lead.customerPhone || "No phone"}</div><div className="text-sm text-[#6B7C93]">{reservationResult.lead.customerEmail || "No email"}</div></div>
                  <div><div className="text-xs text-[#829AB1]">Trip</div><div className="mt-1 font-semibold text-[#102A43]">{reservationResult.lead.destination || "Destination not set"}</div><div className="mt-1 text-sm text-[#6B7C93]">{reservationResult.lead.travelDates || "Dates not set"}</div><div className="text-sm text-[#6B7C93]">{reservationResult.lead.adultCount} adults · {reservationResult.lead.childCount} children</div></div>
                  <div><div className="text-xs text-[#829AB1]">Services and stage</div><div className="mt-1 font-semibold text-[#102A43]">{reservationResult.lead.travelServices.join(", ") || "Services not set"}</div><div className="mt-1 text-sm text-[#6B7C93]">{reservationResult.lead.salesStage} · {reservationResult.lead.status}</div><div className="text-sm text-[#6B7C93]">Agent: {reservationResult.lead.agent?.username || "Unassigned"}</div></div>
                  {reservationResult.order && <div><div className="text-xs text-[#829AB1]">Sale · {reservationResult.order.currency}</div><div className="mt-1 text-sm text-[#102A43]">Selling: {reservationResult.order.customerTotal.toFixed(2)}</div><div className="text-sm text-[#102A43]">Cost: {reservationResult.order.supplierCost.toFixed(2)}</div><div className="text-sm font-semibold text-emerald-700">Profit: {reservationResult.order.grossMargin.toFixed(2)}</div><div className="text-sm text-[#6B7C93]">{reservationResult.order.accountingStatus}</div></div>}
                </div>
              ) : <p className="mt-4 text-sm text-[#6B7C93]">No lead details are attached to this reservation yet.</p>}
            </section>
          )}

          {isLoading ? (
            <div className="rounded-[28px] border border-[#D9E5F4] bg-white p-8 text-sm text-[#6B7C93] shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading search workspace...
              </div>
            </div>
          ) : (
            <div className="grid gap-6 xl:grid-cols-[1.1fr_1.7fr]">
              <section className="rounded-[28px] border border-[#D9E5F4] bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EAF2FF] text-[#2063E9]">
                    <FolderKanban className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#829AB1]">Boards</div>
                    <div className="text-sm text-[#6B7C93]">Jump into the right queue.</div>
                  </div>
                </div>

                <div className="space-y-3">
                  {visibleBoards.length === 0 ? (
                    <div className="rounded-[22px] border border-dashed border-[#D9E5F4] bg-[#FBFDFF] p-4 text-sm text-[#6B7C93]">
                      No matching boards.
                    </div>
                  ) : (
                    visibleBoards.map((board) => (
                      <button
                        key={board._id}
                        onClick={() => setLocation(`/board/${board._id}`)}
                        className="flex w-full items-center justify-between gap-4 rounded-[22px] border border-[#D9E5F4] bg-[#FBFDFF] px-4 py-3 text-left transition hover:border-[#BDD4F7] hover:bg-white"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-[#102A43]">{board.title}</div>
                          <div className="mt-1 text-xs text-[#6B7C93]">
                            {(board.lists || []).length} lists • {(board.lists || []).reduce((sum, list) => sum + (list.cards || []).length, 0)} tickets
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 shrink-0 text-[#829AB1]" />
                      </button>
                    ))
                  )}
                </div>
              </section>

              <section className="rounded-[28px] border border-[#D9E5F4] bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EEF8F6] text-[#0F766E]">
                    <Ticket className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#829AB1]">Tickets</div>
                    <div className="text-sm text-[#6B7C93]">Open the exact request you need.</div>
                  </div>
                </div>

                <div className="space-y-3">
                  {visibleTickets.length === 0 ? (
                    <div className="rounded-[22px] border border-dashed border-[#D9E5F4] bg-[#FBFDFF] p-4 text-sm text-[#6B7C93]">
                      No matching tickets.
                    </div>
                  ) : (
                    visibleTickets.slice(0, 60).map(({ card, board, list }) => (
                      <div
                        key={card._id}
                        className="rounded-[22px] border border-[#D9E5F4] bg-[#FBFDFF] px-4 py-3"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-[#102A43]">{card.title}</div>
                            <div className="mt-1 text-xs text-[#6B7C93]">
                              {board.title} • {list.title}
                              {card.bookingRef ? ` • Ref ${card.bookingRef}` : ""}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {card.status && (
                                <span className="rounded-full bg-[#EAF2FF] px-2.5 py-1 text-[11px] font-semibold text-[#1E5ED8]">
                                  {card.status}
                                </span>
                              )}
                              {card.priority && (
                                <span className="rounded-full bg-[#FFF4E5] px-2.5 py-1 text-[11px] font-semibold text-[#B45309]">
                                  {card.priority}
                                </span>
                              )}
                              {(card.requester || card.agencyName) && (
                                <span className="rounded-full bg-[#F4F8FF] px-2.5 py-1 text-[11px] font-semibold text-[#486581]">
                                  {card.agencyName || card.requester}
                                </span>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-2xl"
                            onClick={() => setLocation(`/board/${board._id}?card=${card._id}`)}
                          >
                            Open
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
