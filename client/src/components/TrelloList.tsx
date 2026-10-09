import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { List, Card, BoardRole, CardCreateData, CustomerProfile, customerApi, canEditList, canDeleteList, canCreateCard, canDragCards } from "@/lib/api";
import { TrelloCard } from "./TrelloCard";
import {
  Plus,
  MoreHorizontal,
  Trash2,
  Archive,
  Building2,
  ClipboardPenLine,
  CalendarDays,
  CircleDashed,
  Sparkles,
} from "lucide-react";
import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface TrelloListProps {
  boardId: string;
  list: List;
  onAddCard: (payload: CardCreateData) => Promise<void>;
  onDeleteList: () => Promise<void>;
  onCardClick: (card: Card) => void;
  onUpdateTitle: (title: string) => Promise<void>;
  onViewActivity?: (listId: string) => void;
  userRole?: BoardRole;
  isOverDropZone?: boolean;
  showBookingDetails?: boolean;
}

export function TrelloList({
  boardId,
  list,
  onAddCard,
  onDeleteList,
  onCardClick,
  onUpdateTitle,
  onViewActivity,
  userRole,
  isOverDropZone = false,
  showBookingDetails = true,
}: TrelloListProps) {
  const [isIntakeOpen, setIsIntakeOpen] = useState(false);
  const [requestTitle, setRequestTitle] = useState("");
  const [requestAgency, setRequestAgency] = useState("");
  const [requestCustomerId, setRequestCustomerId] = useState("");
  const [requestPhone, setRequestPhone] = useState("");
  const [customerProfiles, setCustomerProfiles] = useState<CustomerProfile[]>([]);
  const [requestDestination, setRequestDestination] = useState("");
  const [requestTravelers, setRequestTravelers] = useState("");
  const [requestServices, setRequestServices] = useState<("Flight" | "Hotel" | "Tour" | "Transfer" | "Package" | "Other")[]>([]);
  const [requestSource, setRequestSource] = useState("Email");
  const [requestType, setRequestType] = useState("Booking request");
  const [requestCheckIn, setRequestCheckIn] = useState("");
  const [requestCheckOut, setRequestCheckOut] = useState("");
  const [isCreatingRequest, setIsCreatingRequest] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(list.title);

  useEffect(() => {
    if (!isIntakeOpen) return;
    let active = true;
    customerApi.getAll(boardId)
      .then((profiles) => { if (active) setCustomerProfiles(profiles); })
      .catch(() => { if (active) setCustomerProfiles([]); });
    return () => { active = false; };
  }, [boardId, isIntakeOpen]);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: list._id, data: { type: "list" } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const resetIntake = () => {
    setRequestTitle("");
    setRequestAgency("");
    setRequestCustomerId("");
    setRequestPhone("");
    setRequestDestination("");
    setRequestTravelers("");
    setRequestServices([]);
    setRequestSource("Email");
    setRequestType("Booking request");
    setRequestCheckIn("");
    setRequestCheckOut("");
  };

  const handleCreateRequest = async () => {
    if (isCreatingRequest || !requestTitle.trim() || !requestAgency.trim() || !requestSource.trim()) return;

    setIsCreatingRequest(true);
    try {
      await onAddCard({
        title: requestTitle.trim(),
        agencyName: requestAgency.trim(),
        customerProfileId: requestCustomerId && !requestCustomerId.startsWith("local_") ? requestCustomerId : undefined,
        customerPhone: requestPhone.trim(),
        destination: requestDestination.trim(),
        travelerCount: requestTravelers ? Number(requestTravelers) : 0,
        travelServices: requestServices,
        source: requestSource,
        type: requestType,
        checkInDate: requestCheckIn || undefined,
        checkOutDate: requestCheckOut || undefined,
        arrivalDate: requestCheckIn || undefined,
        status: "Requested",
      });

      resetIntake();
      setIsIntakeOpen(false);
    } finally {
      setIsCreatingRequest(false);
    }
  };

  const handleSaveTitle = async () => {
    if (editedTitle.trim() && editedTitle !== list.title) {
      await onUpdateTitle(editedTitle.trim());
    }
    setIsEditingTitle(false);
  };

  const canSubmitRequest =
    Boolean(requestTitle.trim()) && Boolean(requestAgency.trim()) && Boolean(requestSource.trim());

  const formatPreviewDate = (value: string) => {
    if (!value) return "Not set";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const toggleService = (service: "Flight" | "Hotel" | "Tour" | "Transfer" | "Package" | "Other") => {
    setRequestServices((current) =>
      current.includes(service) ? current.filter((item) => item !== service) : [...current, service]
    );
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`ticket-list animate-fade-in ${isOverDropZone ? "drop-zone-active" : ""}`}
    >
      <div className="ticket-list-header" {...attributes} {...listeners}>
        <div className="min-w-0 flex-1">
          {isEditingTitle ? (
            <Input
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={(e) => e.key === "Enter" && handleSaveTitle()}
              className="h-9 rounded-xl border-[#D9E5F4] bg-white text-sm font-semibold shadow-none"
              autoFocus
            />
          ) : (
            <div className="flex items-center gap-2">
              <h3
                className={`ticket-list-title min-w-0 flex-1 truncate text-[#0B2239] ${canEditList(userRole) ? "cursor-pointer" : ""}`}
                onClick={() => canEditList(userRole) && setIsEditingTitle(true)}
              >
                {list.title}
              </h3>
              <span className="rounded-full bg-[#EAF2FF] px-2.5 py-1 text-[11px] font-semibold text-[#1E5ED8]">
                {list.cards.length}
              </span>
            </div>
          )}
        </div>

        {canEditList(userRole) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 rounded-xl p-0 text-[#486581] hover:bg-[#EAF2FF] hover:text-[#1E5ED8]"
              >
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {canCreateCard(userRole) && (
                <DropdownMenuItem onClick={() => setIsIntakeOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  New request
                </DropdownMenuItem>
              )}
              {onViewActivity && (
                <DropdownMenuItem onClick={() => onViewActivity(list._id)}>
                  View list activity
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-[#5E6C84]">
                <Archive className="w-4 h-4 mr-2" />
                Archive this list
              </DropdownMenuItem>
              {canDeleteList(userRole) && (
                <DropdownMenuItem
                  onClick={onDeleteList}
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete list
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <SortableContext
          items={list.cards.map((c) => c._id)}
          strategy={verticalListSortingStrategy}
        >
          {list.cards.map((card) => (
            <TrelloCard
              key={card._id}
              card={card}
              onClick={() => onCardClick(card)}
              canDrag={canDragCards(userRole)}
              showBookingDetails={showBookingDetails}
            />
          ))}
        </SortableContext>

        {list.cards.length === 0 && (
          <div className="mb-3 rounded-[20px] border border-dashed border-[#CAD8EB] bg-white/80 px-4 py-5 text-center">
            <div className="text-sm font-medium text-[#486581]">No requests in this stage</div>
            <div className="mt-1 text-xs text-[#829AB1]">
              New intake, follow-up items, and handovers will appear here.
            </div>
          </div>
        )}

        {canCreateCard(userRole) && (
          <button onClick={() => setIsIntakeOpen(true)} className="add-card-btn">
            <Plus className="w-4 h-4" />
            New request
          </button>
        )}
      </div>

      <Dialog
        open={isIntakeOpen}
        onOpenChange={(open) => {
          setIsIntakeOpen(open);
          if (!open && !isCreatingRequest) resetIntake();
        }}
      >
        <DialogContent className="w-[calc(100vw-2rem)] max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 shadow-[0_24px_70px_rgba(15,23,42,0.24)] sm:max-w-5xl">
          <DialogHeader className="border-b border-slate-200 bg-white px-5 py-5 sm:px-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <DialogTitle className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-[28px]">
                  Create request
                </DialogTitle>
                <p className="mt-1.5 max-w-2xl text-sm text-slate-500">
                  Add the essentials now. You can complete the details later.
                </p>
              </div>
              <div className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600">
                Queue <span className="mx-1 text-slate-400">/</span><span className="font-semibold text-slate-900">{list.title}</span>
              </div>
            </div>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_290px]">
            <div className="bg-white px-5 py-6 sm:px-7">
              <div className="mb-5 rounded-xl border border-slate-200 bg-white p-5">
                <div className="mb-4 flex items-center gap-2">
                  <ClipboardPenLine className="h-4 w-4 text-[#2063E9]" />
                  <div className="text-sm font-semibold text-[#102A43]">Ticket details</div>
                </div>

                <div className="grid grid-cols-1 gap-5">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.16em] text-[#829AB1]">
                      Agency / Company *
                    </label>
                    <Input
                      value={requestAgency}
                      list={`customer-profiles-${list._id}`}
                      onChange={(e) => {
                        const value = e.target.value;
                        const match = customerProfiles.find((profile) =>
                          String(profile.customerName || profile.agencyName).trim().toLowerCase() === value.trim().toLowerCase()
                        );
                        setRequestAgency(value);
                        setRequestCustomerId(match?._id || "");
                        setRequestPhone(match?.phone || "");
                      }}
                      placeholder="Choose or enter the requesting company"
                      className="mt-2 h-12 rounded-2xl border-[#D9E5F4] bg-white px-4 shadow-none"
                    />
                    <datalist id={`customer-profiles-${list._id}`}>
                      {customerProfiles.map((profile) => (
                        <option key={profile._id} value={profile.customerName || profile.agencyName}>
                          {profile.phone ? `Phone: ${profile.phone}` : "Saved customer profile"}
                        </option>
                      ))}
                    </datalist>
                    <Input
                      type="tel"
                      value={requestPhone}
                      onChange={(e) => setRequestPhone(e.target.value)}
                      placeholder="Customer phone number"
                      aria-label="Customer phone number"
                      className="mt-2 h-12 rounded-2xl border-[#D9E5F4] bg-white px-4 shadow-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.16em] text-[#829AB1]">
                      Request Title *
                    </label>
                    <Input
                      value={requestTitle}
                      onChange={(e) => setRequestTitle(e.target.value)}
                      placeholder="Hotel + dates + pax"
                      className="mt-2 h-12 rounded-2xl border-[#D9E5F4] bg-white px-4 text-base shadow-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.16em] text-[#829AB1]">
                        Destination
                      </label>
                      <Input
                        value={requestDestination}
                        onChange={(e) => setRequestDestination(e.target.value)}
                        placeholder="e.g. Istanbul, Turkey"
                        className="mt-2 h-12 rounded-2xl border-[#D9E5F4] bg-white px-4 shadow-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.16em] text-[#829AB1]">
                        Travelers
                      </label>
                      <Input
                        type="number"
                        min="1"
                        value={requestTravelers}
                        onChange={(e) => setRequestTravelers(e.target.value)}
                        placeholder="Number of travelers"
                        className="mt-2 h-12 rounded-2xl border-[#D9E5F4] bg-white px-4 shadow-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.16em] text-[#829AB1]">
                      Requested services
                    </label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(["Flight", "Hotel", "Tour", "Transfer", "Package", "Other"] as const).map((service) => {
                        const selected = requestServices.includes(service);
                        return (
                          <button
                            key={service}
                            type="button"
                            onClick={() => toggleService(service)}
                            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${selected ? "border-[#2063E9] bg-[#EAF2FF] text-[#1E5ED8]" : "border-[#D9E5F4] bg-white text-[#486581] hover:border-[#9DBCEB]"}`}
                          >
                            {service}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.16em] text-[#829AB1]">
                        Request Type *
                      </label>
                      <select
                        value={requestType}
                        onChange={(e) => setRequestType(e.target.value)}
                        className="mt-2 h-12 w-full rounded-2xl border border-[#D9E5F4] bg-white px-4 text-sm text-[#102A43] outline-none"
                      >
                        {["Booking request", "Amendment", "Cancellation", "Service request", "Rate request"].map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.16em] text-[#829AB1]">
                        Source *
                      </label>
                      <select
                        value={requestSource}
                        onChange={(e) => setRequestSource(e.target.value)}
                        className="mt-2 h-12 w-full rounded-2xl border border-[#D9E5F4] bg-white px-4 text-sm text-[#102A43] outline-none"
                      >
                        {["Email", "WhatsApp", "Portal", "Phone", "Agency"].map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="mb-4 flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-[#2063E9]" />
                  <div className="text-sm font-semibold text-[#102A43]">Stay dates</div>
                </div>

                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.16em] text-[#829AB1]">
                      Check-in
                    </label>
                    <Input
                      type="date"
                      value={requestCheckIn}
                      onChange={(e) => setRequestCheckIn(e.target.value)}
                      className="mt-2 h-12 rounded-2xl border-[#D9E5F4] bg-white px-4 shadow-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.16em] text-[#829AB1]">
                      Check-out
                    </label>
                    <Input
                      type="date"
                      value={requestCheckOut}
                      onChange={(e) => setRequestCheckOut(e.target.value)}
                      className="mt-2 h-12 rounded-2xl border-[#D9E5F4] bg-white px-4 shadow-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            <aside className="border-t border-slate-200 bg-slate-50 px-5 py-6 lg:border-l lg:border-t-0">
              <div className="mb-5 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#2063E9]" />
                <div className="text-sm font-semibold text-[#102A43]">Ticket preview</div>
              </div>

              <div className="space-y-4">
                <div className="rounded-[22px] border border-[#D9E5F4] bg-white p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#829AB1]">
                    Subject
                  </div>
                  <div className="mt-2 text-sm font-semibold text-[#102A43]">
                    {requestTitle.trim() || "Ticket subject will appear here"}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-[#EAF2FF] px-2.5 py-1 text-[11px] font-semibold text-[#1E5ED8]">
                      {requestType}
                    </span>
                    <span className="rounded-full bg-[#EEF8F6] px-2.5 py-1 text-[11px] font-semibold text-[#0F766E]">
                      {requestSource}
                    </span>
                    <span className="rounded-full bg-[#FFF4E5] px-2.5 py-1 text-[11px] font-semibold text-[#B45309]">
                      Requested
                    </span>
                    {requestServices.map((service) => (
                      <span key={service} className="rounded-full bg-[#F1F5F9] px-2.5 py-1 text-[11px] font-semibold text-[#475569]">
                        {service}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-[22px] border border-[#D9E5F4] bg-white p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-[#2063E9]" />
                    <div className="text-sm font-semibold text-[#102A43]">Requester</div>
                  </div>
                  <div className="text-sm font-medium text-[#102A43]">
                    {requestAgency.trim() || "No company selected yet"}
                  </div>
                  {requestPhone.trim() && <div className="mt-1 text-xs text-[#486581]">{requestPhone}</div>}
                  <div className="mt-2 text-xs text-[#6B7C93]">
                    Saved customer details fill the name and phone automatically.
                  </div>
                </div>

                <div className="rounded-[22px] border border-[#D9E5F4] bg-white p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <CircleDashed className="h-4 w-4 text-[#2063E9]" />
                    <div className="text-sm font-semibold text-[#102A43]">Routing context</div>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-[#829AB1]">Stage</span>
                      <span className="text-right font-medium text-[#102A43]">{list.title}</span>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-[#829AB1]">Destination</span>
                      <span className="text-right font-medium text-[#102A43]">{requestDestination || "Not set"}</span>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-[#829AB1]">Travelers</span>
                      <span className="text-right font-medium text-[#102A43]">{requestTravelers || "Not set"}</span>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-[#829AB1]">Check-in</span>
                      <span className="text-right font-medium text-[#102A43]">{formatPreviewDate(requestCheckIn)}</span>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-[#829AB1]">Check-out</span>
                      <span className="text-right font-medium text-[#102A43]">{formatPreviewDate(requestCheckOut)}</span>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-[#829AB1]">Status on create</span>
                      <span className="text-right font-medium text-[#102A43]">Requested</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-[22px] border border-dashed border-[#C7D8EE] bg-[#FDFEFF] p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#829AB1]">
                    Notes
                  </div>
                  <div className="mt-2 text-sm leading-6 text-[#6B7C93]">
                    Keep the title short and searchable. Put the hotel, dates, and passenger count in the subject so the ticket is easy to triage later.
                  </div>
                </div>
              </div>
            </aside>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
            <div className="text-sm text-[#6B7C93]">
              {canSubmitRequest
                ? "Ready to create this ticket."
                : "Complete the required fields to create the ticket."}
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                onClick={() => setIsIntakeOpen(false)}
                className="rounded-2xl px-4 text-[#486581] hover:bg-[#EFF4FB]"
              >
                Cancel
              </Button>
              <Button
                className="rounded-2xl bg-[#2063E9] px-5 text-white hover:bg-[#164FC0]"
                onClick={handleCreateRequest}
                disabled={!canSubmitRequest || isCreatingRequest}
              >
                {isCreatingRequest ? "Creating..." : "Create Request"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
