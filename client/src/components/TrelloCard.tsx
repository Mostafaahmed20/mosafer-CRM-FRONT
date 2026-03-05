import { Card, getLabelColor, getDueDateStatus, formatDueDate, getChecklistProgress } from "@/lib/api";
import { Clock, MessageSquare, Paperclip, CheckSquare, AlignLeft } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface TrelloCardProps {
  card: Card;
  onClick: () => void;
  canDrag?: boolean;
  showBookingDetails?: boolean;
}

export function TrelloCard({
  card,
  onClick,
  canDrag = true,
  showBookingDetails = true,
}: TrelloCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card._id,
    disabled: !canDrag,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const checklistProgress = card.checklists?.length > 0 
    ? getChecklistProgress(card.checklists) 
    : null;

  const dueStatus = card.dueDate 
    ? getDueDateStatus(card.dueDate, card.dueComplete) 
    : null;

  const hasLabels = card.labels && card.labels.length > 0;
  const hasBadges = card.dueDate || card.description || 
    (card.comments && card.comments.length > 0) || 
    (card.attachments && card.attachments.length > 0) ||
    checklistProgress;

  const status = card.status || "Requested";
  const priority = card.priority || "Medium";
  const requester = card.requester || "Unknown requester";
  const bookingRef = card.bookingRef?.trim();
  const hotelName = card.hotelName?.trim();
  const supplierConf = card.supplierConfirmationNumber?.trim();
  const hotelConf = card.hotelConfirmationNumber?.trim();
  const arrivalDate = card.arrivalDate || card.checkInDate;
  const hasBookingMeta = Boolean(bookingRef || hotelName || supplierConf || hotelConf || arrivalDate);
  const serviceOrders = card.serviceOrders || [];
  const serviceTotal = serviceOrders.reduce((sum, order) => {
    const qty = Number(order.quantity || 0);
    const price = Number(order.price || 0);
    return sum + qty * price;
  }, 0);
  const serviceCurrency = serviceOrders[0]?.currency || "USD";
  const coveringStatus = card.coveringStatus || "Requested";
  const coveringStatusShort =
    coveringStatus === "Paid by VCC"
      ? "Paid"
      : coveringStatus === "Invoiced to agency"
      ? "Invoiced"
      : "Requested";
  const coveringStatusClass =
    coveringStatus === "Invoiced to agency"
      ? "is-invoiced"
      : coveringStatus === "Paid by VCC"
      ? "is-paid"
      : "is-requested";
  const priorityColor =
    priority === "Urgent"
      ? "bg-red-100 text-red-700"
      : priority === "High"
      ? "bg-amber-100 text-amber-700"
      : priority === "Low"
      ? "bg-emerald-100 text-emerald-700"
      : "bg-slate-100 text-slate-700";

  const slaStatus = card.slaStatus || "Open";
  const slaDueAt = card.slaDueAt ? new Date(card.slaDueAt) : null;
  const slaBadge = (() => {
    if (!slaDueAt) return null;
    const label = `SLA ${slaStatus}`;
    const base = "card-badge";
    if (slaStatus === "Breached") return { label, className: `${base} text-red-700 bg-red-50 border-red-200` };
    if (slaStatus === "Met") return { label, className: `${base} text-emerald-700 bg-emerald-50 border-emerald-200` };
    return { label, className: `${base} text-amber-700 bg-amber-50 border-amber-200` };
  })();
  const handoverReminderCount = Number(card.handoverReminderCount || 0);
  const isHandoverPending = card.handoverPendingState === "Yes";
  const showHandoverBadge = isHandoverPending || handoverReminderCount > 0;
  const handoverBadgeClass = isHandoverPending
    ? "card-badge text-amber-700 bg-amber-50 border-amber-200"
    : "card-badge text-slate-700 bg-slate-50 border-slate-200";
  const hasBadgesWithHandover = Boolean(hasBadges || slaBadge || showHandoverBadge);
  const safeMembers = (Array.isArray(card.members) ? card.members : []).filter(
    (member): member is NonNullable<Card["members"][number]> =>
      Boolean(member?._id && member?.username)
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="ticket-row animate-fade-in"
    >
      {/* Cover Image */}
      {card.cover && (
        <div 
          className="h-32 -mx-2 -mt-2 mb-2 rounded-t-lg bg-cover bg-center"
          style={{ backgroundImage: `url(${card.cover})` }}
        />
      )}

      {/* Labels */}
      {hasLabels && (
        <div className="flex flex-wrap gap-1 mb-2">
          {card.labels.map((label, index) => {
            const labelColor = getLabelColor(label.color);
            return (
              <div
                key={index}
                className="card-label min-w-[40px]"
                style={{ backgroundColor: labelColor.bg }}
                title={label.text || labelColor.name}
              />
            );
          })}
        </div>
      )}

      <div className="flex items-start gap-3">
        <div className="ticket-avatar">
          {requester.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="ticket-status">{status}</span>
            <span className={`ticket-priority ${priorityColor}`}>{priority}</span>
          </div>
          <p className="ticket-title">{card.title}</p>
          <p className="ticket-subtitle">{requester}</p>
          {showBookingDetails && hasBookingMeta && (
            <div className="ticket-booking-meta">
              {bookingRef && <span className="ticket-booking-chip">Ref {bookingRef}</span>}
              {hotelName && <span className="ticket-booking-chip">{hotelName}</span>}
              {arrivalDate && (
                <span className="ticket-booking-chip">
                  Arrival {new Date(arrivalDate).toLocaleDateString()}
                </span>
              )}
              <span className={`ticket-booking-chip ${supplierConf ? "is-ok" : "is-missing"}`}>
                S {supplierConf || "Missing"}
              </span>
              <span className={`ticket-booking-chip ${hotelConf ? "is-ok" : "is-missing"}`}>
                H {hotelConf || "Missing"}
              </span>
            </div>
          )}
          {showBookingDetails && (
            <div className="ticket-covering-meta">
              <span className={`ticket-covering-chip ${coveringStatusClass}`}>
                Covering: {coveringStatusShort}
              </span>
              <span className="ticket-covering-chip">
                Services: {serviceTotal.toFixed(2)} {serviceCurrency}
              </span>
            </div>
          )}
        </div>
        {card.dueDate && dueStatus && (
          <div className={`ticket-due due-${dueStatus}`}>
            <Clock className="w-3 h-3" />
            <span>{formatDueDate(card.dueDate)}</span>
          </div>
        )}
      </div>

      {/* Badges */}
      {hasBadgesWithHandover && (
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {/* Due Date */}
          {card.description && (
            <div className="card-badge" title="This card has a description">
              <AlignLeft className="card-badge-icon" />
            </div>
          )}

          {/* Comments */}
          {card.comments && card.comments.length > 0 && (
            <div className="card-badge">
              <MessageSquare className="card-badge-icon" />
              <span>{card.comments.length}</span>
            </div>
          )}

          {/* Attachments */}
          {card.attachments && card.attachments.length > 0 && (
            <div className="card-badge">
              <Paperclip className="card-badge-icon" />
              <span>{card.attachments.length}</span>
            </div>
          )}

          {/* Checklist Progress */}
          {checklistProgress && checklistProgress.total > 0 && (
            <div 
              className={`card-badge ${checklistProgress.percentage === 100 ? 'text-[#61BD4F]' : ''}`}
            >
              <CheckSquare className="card-badge-icon" />
              <span>{checklistProgress.completed}/{checklistProgress.total}</span>
            </div>
          )}

          {/* SLA */}
          {slaBadge && (
            <div className={slaBadge.className} title={slaDueAt ? `Due ${slaDueAt.toLocaleString()}` : ""}>
              {slaBadge.label}
            </div>
          )}

          {/* Handover reminders */}
          {showHandoverBadge && (
            <div
              className={handoverBadgeClass}
              title={
                card.handoverReminderSentAt
                  ? `Last reminder ${new Date(card.handoverReminderSentAt).toLocaleString()}`
                  : "No reminders sent yet"
              }
            >
              Handover {isHandoverPending ? "Pending" : "Done"} - {handoverReminderCount}
            </div>
          )}
        </div>
      )}

      {/* Members */}
      {safeMembers.length > 0 && (
        <div className="flex justify-end mt-2 -space-x-1">
          {safeMembers.slice(0, 3).map((member) => (
            <div
              key={member._id}
              className="member-avatar-sm member-avatar"
              title={member.username}
            >
              {member.username.charAt(0).toUpperCase()}
            </div>
          ))}
          {safeMembers.length > 3 && (
            <div className="member-avatar-sm member-avatar">
              +{safeMembers.length - 3}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Card overlay for drag preview
export function TrelloCardOverlay({ card }: { card: Card }) {
  const hasLabels = card.labels && card.labels.length > 0;

  return (
    <div className="trello-card p-2 w-64 shadow-lg rotate-3">
      {hasLabels && (
        <div className="flex flex-wrap gap-1 mb-2">
          {card.labels.map((label, index) => {
            const labelColor = getLabelColor(label.color);
            return (
              <div
                key={index}
                className="card-label min-w-[40px]"
                style={{ backgroundColor: labelColor.bg }}
              />
            );
          })}
        </div>
      )}
      <p className="trello-card-title">{card.title}</p>
    </div>
  );
}
