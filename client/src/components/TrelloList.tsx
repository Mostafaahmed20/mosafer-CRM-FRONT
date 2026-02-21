import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { List, Card, BoardRole, CardCreateData, canEditList, canDeleteList, canCreateCard, canDragCards } from "@/lib/api";
import { TrelloCard } from "./TrelloCard";
import { Plus, MoreHorizontal, Trash2, Archive } from "lucide-react";
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
  const [requestSource, setRequestSource] = useState("Email");
  const [requestType, setRequestType] = useState("Booking request");
  const [requestCheckIn, setRequestCheckIn] = useState("");
  const [requestCheckOut, setRequestCheckOut] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(list.title);

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
    setRequestSource("Email");
    setRequestType("Booking request");
    setRequestCheckIn("");
    setRequestCheckOut("");
  };

  const handleCreateRequest = async () => {
    if (!requestTitle.trim() || !requestAgency.trim() || !requestSource.trim()) return;

    await onAddCard({
      title: requestTitle.trim(),
      agencyName: requestAgency.trim(),
      source: requestSource,
      type: requestType,
      checkInDate: requestCheckIn || undefined,
      checkOutDate: requestCheckOut || undefined,
      arrivalDate: requestCheckIn || undefined,
      status: "Requested",
    });

    resetIntake();
    setIsIntakeOpen(false);
  };

  const handleSaveTitle = async () => {
    if (editedTitle.trim() && editedTitle !== list.title) {
      await onUpdateTitle(editedTitle.trim());
    }
    setIsEditingTitle(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`ticket-list animate-fade-in ${isOverDropZone ? "drop-zone-active" : ""}`}
    >
      <div className="ticket-list-header" {...attributes} {...listeners}>
        {isEditingTitle ? (
          <Input
            value={editedTitle}
            onChange={(e) => setEditedTitle(e.target.value)}
            onBlur={handleSaveTitle}
            onKeyDown={(e) => e.key === "Enter" && handleSaveTitle()}
            className="h-7 text-sm font-semibold bg-white"
            autoFocus
          />
        ) : (
          <h3
            className={`ticket-list-title flex-1 ${canEditList(userRole) ? "cursor-pointer" : ""}`}
            onClick={() => canEditList(userRole) && setIsEditingTitle(true)}
          >
            {list.title}
          </h3>
        )}

        {canEditList(userRole) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-[#6B778C] hover:bg-[#DFE1E6]"
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

      <div className="flex-1 overflow-y-auto px-3 pb-3">
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
          if (!open) resetIntake();
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>New Request Intake</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-[#64748B]">Request Title *</label>
              <Input
                value={requestTitle}
                onChange={(e) => setRequestTitle(e.target.value)}
                placeholder="Hotel + dates + pax"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#64748B]">Agency / Company *</label>
              <Input
                value={requestAgency}
                onChange={(e) => setRequestAgency(e.target.value)}
                placeholder="Travel agency name"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#64748B]">Source *</label>
              <select
                value={requestSource}
                onChange={(e) => setRequestSource(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm"
              >
                {["Email", "WhatsApp", "Portal", "Phone", "Agency"].map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-[#64748B]">Request Type *</label>
              <select
                value={requestType}
                onChange={(e) => setRequestType(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm"
              >
                {["Booking request", "Amendment", "Cancellation", "Service request", "Rate request"].map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-[#64748B]">Check-in</label>
              <Input type="date" value={requestCheckIn} onChange={(e) => setRequestCheckIn(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#64748B]">Check-out</label>
              <Input type="date" value={requestCheckOut} onChange={(e) => setRequestCheckOut(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsIntakeOpen(false)}>
              Cancel
            </Button>
            <Button
              className="trello-btn-primary"
              onClick={handleCreateRequest}
              disabled={!requestTitle.trim() || !requestAgency.trim() || !requestSource.trim()}
            >
              Create Request
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
