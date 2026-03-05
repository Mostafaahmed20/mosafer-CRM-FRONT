import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  Label,
  Attachment,
  Checklist,
  ChecklistItem,
  ServiceOrder,
  LABEL_COLORS,
  TRAVEL_TICKET_STATUSES,
  TRAVEL_PAYMENT_STATUSES,
  getLabelColor,
  getDueDateStatus,
  formatDueDate,
  getChecklistProgress,
  LabelColor,
  BoardRole,
  BoardMember,
  canEditCard,
  canDeleteCard,
  canComment,
  canManageCardMembers,
} from "@/lib/api";
import {
  X,
  CreditCard,
  AlignLeft,
  Tag,
  CheckSquare,
  Clock,
  Paperclip,
  Image,
  FileText,
  Archive,
  Copy,
  Trash2,
  Plus,
  User,
  Loader2,
  ExternalLink,
  MessageSquare,
  Pencil,
  ArrowRight,
  Pin,
} from "lucide-react";
import { toast } from "sonner";

const API_BASE_URL = import.meta.env.VITE_API_URL || "";

function resolveAttachmentUrl(url?: string) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  if (
    raw.startsWith("http://") ||
    raw.startsWith("https://") ||
    raw.startsWith("//") ||
    raw.startsWith("data:") ||
    raw.startsWith("blob:")
  ) {
    return raw;
  }

  if (!API_BASE_URL) return raw;

  const normalizedBase = API_BASE_URL.endsWith("/") ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
  const normalizedPath = raw.startsWith("/") ? raw : `/${raw}`;
  return `${normalizedBase}${normalizedPath}`;
}

interface ListOption {
  _id: string;
  title: string;
}

interface CardDetailModalProps {
  card: Card | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updates: Partial<Card>) => Promise<void>;
  onDelete: () => Promise<void>;
  onMove?: (targetListId: string) => Promise<void>;
  onAddAttachment?: (file: File) => Promise<void>;
  onDeleteAttachment?: (attachmentId: string) => Promise<void>;
  onAddComment?: (text: string) => Promise<void>;
  onEditComment?: (commentId: string, text: string) => Promise<void>;
  onDeleteComment?: (commentId: string) => Promise<void>;
  currentUser?: { _id: string; username: string; email: string } | null;
  userRole?: BoardRole;
  listTitle: string;
  currentListId?: string;
  lists?: ListOption[];
  members?: BoardMember[];
}

export function CardDetailModal({
  card,
  isOpen,
  onClose,
  onUpdate,
  onDelete,
  onMove,
  onAddAttachment,
  onDeleteAttachment,
  onAddComment,
  onEditComment,
  onDeleteComment,
  currentUser,
  userRole,
  listTitle,
  currentListId,
  lists = [],
  members = [],
}: CardDetailModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requester, setRequester] = useState("");
  const [bookingRef, setBookingRef] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [hotelName, setHotelName] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [supplierConfirmationNumber, setSupplierConfirmationNumber] = useState("");
  const [hotelConfirmationNumber, setHotelConfirmationNumber] = useState("");
  const [voucherNumber, setVoucherNumber] = useState("");
  const [checkInDate, setCheckInDate] = useState("");
  const [checkOutDate, setCheckOutDate] = useState("");
  const [arrivalDate, setArrivalDate] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("Not required");
  const [coveringStatus, setCoveringStatus] = useState<"Requested" | "Paid by VCC" | "Invoiced to agency">("Requested");
  const [netPaidToHotel, setNetPaidToHotel] = useState(0);
  const [sellToAgency, setSellToAgency] = useState(0);
  const [ticketType, setTicketType] = useState("Booking request");
  const [ticketStatus, setTicketStatus] = useState("Requested");
  const [ticketPriority, setTicketPriority] = useState("Medium");
  const [ticketGroup, setTicketGroup] = useState("Operations");
  const [ticketAgent, setTicketAgent] = useState<string>("");
  const [ticketSource, setTicketSource] = useState("Agency");
  const [handoverStatus, setHandoverStatus] = useState<"Not set" | "Resolved in shift" | "Pending for next shift">("Not set");
  const [handoverSummary, setHandoverSummary] = useState("");
  const [handoverDone, setHandoverDone] = useState("");
  const [handoverPending, setHandoverPending] = useState("");
  const [handoverPendingState, setHandoverPendingState] = useState<"Yes" | "No">("No");
  const [handoverBlocker, setHandoverBlocker] = useState("");
  const [handoverNextAction, setHandoverNextAction] = useState("");
  const [handoverNextOwner, setHandoverNextOwner] = useState("");
  const [isEditingHandover, setIsEditingHandover] = useState(false);
  const [isSavingHandover, setIsSavingHandover] = useState(false);
  const [isSavingTicketFields, setIsSavingTicketFields] = useState(false);
  const [labels, setLabels] = useState<Label[]>([]);
  const [dueDate, setDueDate] = useState("");
  const [dueComplete, setDueComplete] = useState(false);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);
  const [showServiceOrders, setShowServiceOrders] = useState(false);
  const [showCoveringBookingDetails, setShowCoveringBookingDetails] = useState(false);
  const [cover, setCover] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showChecklistAdd, setShowChecklistAdd] = useState(false);
const [showMovePicker, setShowMovePicker] = useState(false);
const [isMoving, setIsMoving] = useState(false);
const [newChecklistTitle, setNewChecklistTitle] = useState("");
const [newItemTexts, setNewItemTexts] = useState<Record<string, string>>({});
const [isUploading, setIsUploading] = useState(false);
const [commentText, setCommentText] = useState("");
const [isSubmittingComment, setIsSubmittingComment] = useState(false);
const [copied, setCopied] = useState(false);
const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
const [editingCommentText, setEditingCommentText] = useState("");
const fileInputRef = useRef<HTMLInputElement>(null);
const activityFileInputRef = useRef<HTMLInputElement>(null);
const commentRef = useRef<HTMLTextAreaElement>(null);
  const [mentionQuery, setMentionQuery] = useState("");
  const [showMentionList, setShowMentionList] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [showMemberPicker, setShowMemberPicker] = useState(false);
  const [isEditingTicketFields, setIsEditingTicketFields] = useState(false);
  const safeMembers = members.filter(
    (member): member is BoardMember & { user: NonNullable<BoardMember["user"]> } =>
      Boolean(member?.user?._id && member.user?.username)
  );

  useEffect(() => {
    if (card) {
      setTitle(card.title);
      setDescription(card.description || "");
      setRequester(card.requester || "");
      setBookingRef(card.bookingRef || "");
      setAgencyName(card.agencyName || "");
      setHotelName(card.hotelName || "");
      setSupplierName(card.supplierName || "");
      setSupplierConfirmationNumber(card.supplierConfirmationNumber || "");
      setHotelConfirmationNumber(card.hotelConfirmationNumber || "");
      setVoucherNumber(card.voucherNumber || "");
      setCheckInDate(card.checkInDate ? new Date(card.checkInDate).toISOString().split("T")[0] : "");
      setCheckOutDate(card.checkOutDate ? new Date(card.checkOutDate).toISOString().split("T")[0] : "");
      setArrivalDate(card.arrivalDate ? new Date(card.arrivalDate).toISOString().split("T")[0] : "");
      setPaymentStatus(card.paymentStatus || "Not required");
      setCoveringStatus((card.coveringStatus as "Requested" | "Paid by VCC" | "Invoiced to agency") || "Requested");
      setNetPaidToHotel(Number(card.netPaidToHotel || 0));
      setSellToAgency(Number(card.sellToAgency || 0));
      setTicketType(card.type || "Booking request");
      setTicketStatus(card.status || "Requested");
      setTicketPriority(card.priority || "Medium");
      setTicketGroup(card.group || "Operations");
      setTicketAgent(card.agent?._id || "");
      setTicketSource(card.source || "Agency");
      setHandoverStatus((card.handoverStatus as any) || "Not set");
      setHandoverSummary(card.handoverSummary || "");
      setHandoverDone(card.handoverDone || "");
      setHandoverPending(card.handoverPending || "");
      setHandoverPendingState((card.handoverPendingState as any) || "No");
      setHandoverBlocker(card.handoverBlocker || "");
      setHandoverNextAction(card.handoverNextAction || "");
      setHandoverNextOwner(
        typeof card.handoverNextOwner === "string"
          ? card.handoverNextOwner
          : card.handoverNextOwner?._id || ""
      );
      setIsEditingHandover(false);
      setLabels(card.labels || []);
      setDueDate(card.dueDate ? new Date(card.dueDate).toISOString().split("T")[0] : "");
      setDueComplete(card.dueComplete || false);
      setChecklists(card.checklists || []);
      setServiceOrders(card.serviceOrders || []);
      setShowServiceOrders((card.serviceOrders || []).length > 0);
      setShowCoveringBookingDetails(false);
      setCover(card.cover || "");
      setSelectedMembers(
        (Array.isArray(card.members) ? card.members : [])
          .map((m) => m?._id)
          .filter((id): id is string => Boolean(id))
      );
      setIsEditingTicketFields(false);
    }
  }, [card]);

  // Paste image from clipboard (Ctrl+V)
  useEffect(() => {
    if (!isOpen || !onAddAttachment) return;

    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      // DataTransferItemList isn't always iterable; normalize to array first
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (!file) continue;

          // Give it a readable name with timestamp
          const ext = file.type.split("/")[1] || "png";
          const named = new File(
            [file],
            `pasted-image-${Date.now()}.${ext}`,
            { type: file.type }
          );

          setIsUploading(true);
          try {
            await onAddAttachment(named);
          } catch {
            // Error handled by parent
          } finally {
            setIsUploading(false);
          }
          break;
        }
      }
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [isOpen, onAddAttachment]);

  if (!card) return null;

  const cardDeepLink = (() => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("card", card._id);
      return url.toString();
    } catch {
      return "";
    }
  })();

  const handleSaveTitle = async () => {
    if (title.trim() && title !== card.title) {
      await onUpdate({ title: title.trim(), subject: title.trim() });
    }
    setIsEditingTitle(false);
  };

  const handleSaveDescription = async () => {
    if (description !== card.description) {
      await onUpdate({ description });
    }
    setIsEditingDescription(false);
  };

  const handleTicketFieldUpdate = async (field: Partial<Card>) => {
    await onUpdate(field);
  };

  const isTicketDirty = card ? (
    requester !== (card.requester || "") ||
    bookingRef !== (card.bookingRef || "") ||
    agencyName !== (card.agencyName || "") ||
    hotelName !== (card.hotelName || "") ||
    supplierName !== (card.supplierName || "") ||
    supplierConfirmationNumber !== (card.supplierConfirmationNumber || "") ||
    hotelConfirmationNumber !== (card.hotelConfirmationNumber || "") ||
    voucherNumber !== (card.voucherNumber || "") ||
    checkInDate !== (card.checkInDate ? new Date(card.checkInDate).toISOString().split("T")[0] : "") ||
    checkOutDate !== (card.checkOutDate ? new Date(card.checkOutDate).toISOString().split("T")[0] : "") ||
    arrivalDate !== (card.arrivalDate ? new Date(card.arrivalDate).toISOString().split("T")[0] : "") ||
    paymentStatus !== (card.paymentStatus || "Not required") ||
    coveringStatus !== ((card.coveringStatus as "Requested" | "Paid by VCC" | "Invoiced to agency") || "Requested") ||
    ticketSource !== (card.source || "Agency") ||
    ticketType !== (card.type || "Booking request") ||
    ticketStatus !== (card.status || "Requested") ||
    ticketPriority !== (card.priority || "Medium") ||
    ticketGroup !== (card.group || "Operations") ||
    ticketAgent !== (card.agent?._id || "")
  ) : false;

  const isHandoverDirty = card ? (
    handoverStatus !== ((card.handoverStatus as any) || "Not set") ||
    handoverSummary !== (card.handoverSummary || "") ||
    handoverDone !== (card.handoverDone || "") ||
    handoverPending !== (card.handoverPending || "") ||
    handoverPendingState !== ((card.handoverPendingState as any) || "No") ||
    handoverBlocker !== (card.handoverBlocker || "") ||
    handoverNextAction !== (card.handoverNextAction || "") ||
    handoverNextOwner !== (
      typeof card.handoverNextOwner === "string"
        ? card.handoverNextOwner
        : card.handoverNextOwner?._id || ""
    )
  ) : false;

  const resetHandoverFromCard = () => {
    if (!card) return;
    setHandoverStatus((card.handoverStatus as any) || "Not set");
    setHandoverSummary(card.handoverSummary || "");
    setHandoverDone(card.handoverDone || "");
    setHandoverPending(card.handoverPending || "");
    setHandoverPendingState((card.handoverPendingState as any) || "No");
    setHandoverBlocker(card.handoverBlocker || "");
    setHandoverNextAction(card.handoverNextAction || "");
    setHandoverNextOwner(
      typeof card.handoverNextOwner === "string"
        ? card.handoverNextOwner
        : card.handoverNextOwner?._id || ""
    );
  };

  const handleSaveHandover = async () => {
    if (!card || !isHandoverDirty) return;
    setIsSavingHandover(true);
    try {
      await onUpdate({
        handoverStatus,
        handoverSummary,
        handoverDone,
        handoverPending,
        handoverPendingState,
        handoverBlocker,
        handoverNextAction,
        handoverNextOwner: handoverNextOwner || null,
      } as any);
      toast.success("Handover saved");
      setIsEditingHandover(false);
    } finally {
      setIsSavingHandover(false);
    }
  };

  const handleSaveTicketFields = async () => {
    if (!card || !isTicketDirty) return;
    setIsSavingTicketFields(true);
    try {
      await handleTicketFieldUpdate({
        requester,
        bookingRef,
        agencyName,
        hotelName,
        supplierName,
        supplierConfirmationNumber,
        hotelConfirmationNumber,
        voucherNumber,
        checkInDate: checkInDate || null,
        checkOutDate: checkOutDate || null,
        arrivalDate: arrivalDate || null,
        paymentStatus,
        coveringStatus,
        source: ticketSource,
        type: ticketType,
        status: ticketStatus,
        priority: ticketPriority,
        group: ticketGroup,
        agent: ticketAgent || null,
      } as any);
      toast.success("Ticket properties saved");
      setIsEditingTicketFields(false);
    } finally {
      setIsSavingTicketFields(false);
    }
  };

  const hasBookingCoreDetails = [
    requester,
    bookingRef,
    agencyName,
    hotelName,
    supplierName,
    supplierConfirmationNumber,
    hotelConfirmationNumber,
    voucherNumber,
    checkInDate,
    checkOutDate,
    arrivalDate,
  ].some((value) => String(value || "").trim().length > 0);

  const hasBookingWorkflowOverrides =
    ticketSource !== "Agency" ||
    ticketType !== "Booking request" ||
    ticketStatus !== "Requested" ||
    ticketPriority !== "Medium" ||
    ticketGroup !== "Operations" ||
    ticketAgent.trim().length > 0;

  const hasBookingDetails = hasBookingCoreDetails || hasBookingWorkflowOverrides;
  const hasHandoverDetails = [
    handoverSummary,
    handoverDone,
    handoverPending,
    handoverBlocker,
    handoverNextAction,
    handoverNextOwner,
  ].some((value) => String(value || "").trim().length > 0) || handoverStatus !== "Not set" || handoverPendingState === "Yes";

  const formatRequesterDisplay = (value: string) => {
    const trimmed = String(value || "").trim();
    if (!trimmed) return "-";
    if (trimmed.includes("@")) {
      const local = trimmed.split("@")[0] || "";
      return local.replace(/[._-]+/g, " ").trim() || trimmed;
    }
    return trimmed;
  };

  const resetTicketFieldsFromCard = () => {
    if (!card) return;
    setRequester(card.requester || "");
    setBookingRef(card.bookingRef || "");
    setAgencyName(card.agencyName || "");
    setHotelName(card.hotelName || "");
    setSupplierName(card.supplierName || "");
    setSupplierConfirmationNumber(card.supplierConfirmationNumber || "");
    setHotelConfirmationNumber(card.hotelConfirmationNumber || "");
    setVoucherNumber(card.voucherNumber || "");
    setCheckInDate(card.checkInDate ? new Date(card.checkInDate).toISOString().split("T")[0] : "");
    setCheckOutDate(card.checkOutDate ? new Date(card.checkOutDate).toISOString().split("T")[0] : "");
    setArrivalDate(card.arrivalDate ? new Date(card.arrivalDate).toISOString().split("T")[0] : "");
    setPaymentStatus(card.paymentStatus || "Not required");
    setCoveringStatus((card.coveringStatus as "Requested" | "Paid by VCC" | "Invoiced to agency") || "Requested");
    setNetPaidToHotel(Number(card.netPaidToHotel || 0));
    setSellToAgency(Number(card.sellToAgency || 0));
    setTicketSource(card.source || "Agency");
    setTicketType(card.type || "Booking request");
    setTicketStatus(card.status || "Requested");
    setTicketPriority(card.priority || "Medium");
    setTicketGroup(card.group || "Operations");
    setTicketAgent(card.agent?._id || "");
  };

  const handleDeleteTicketDetails = async () => {
    if (userRole !== "admin") {
      toast.error("Only board admins can delete booking details");
      return;
    }

    await onUpdate({
      requester: "",
      bookingRef: "",
      agencyName: "",
      hotelName: "",
      supplierName: "",
      supplierConfirmationNumber: "",
      hotelConfirmationNumber: "",
      voucherNumber: "",
      checkInDate: null,
      checkOutDate: null,
      arrivalDate: null,
      paymentStatus: "Not required",
      source: "Agency",
      type: "Booking request",
      status: "Requested",
      priority: "Medium",
      group: "Operations",
      agent: null,
      netPaidToHotel: 0,
      sellToAgency: 0,
      coveringStatus: "Requested",
    } as any);
    resetTicketFieldsFromCard();
    setIsEditingTicketFields(false);
    toast.success("Booking details removed");
  };

  const handleArchiveCard = async () => {
    try {
      await onUpdate({ archived: true } as any);
      toast.success("Card archived");
      onClose();
    } catch (error: any) {
      toast.error(error?.message || "Failed to archive card");
    }
  };

  const normalizeServiceOrders = (orders: ServiceOrder[] = []): ServiceOrder[] =>
    orders.map((order) => ({
      _id: order._id,
      service: order.service || "",
      quantity: Number.isFinite(Number(order.quantity)) ? Number(order.quantity) : 1,
      price: Number.isFinite(Number(order.price)) ? Number(order.price) : 0,
      currency: (order.currency || "USD").toUpperCase(),
      status: (order.status || "Requested") as ServiceOrder["status"],
      paymentStatus: (order.paymentStatus || "Unpaid") as ServiceOrder["paymentStatus"],
      notes: order.notes || "",
    }));

  const isServiceOrdersDirty = card
    ? JSON.stringify(normalizeServiceOrders(serviceOrders)) !==
      JSON.stringify(normalizeServiceOrders(card.serviceOrders || []))
    : false;

  const isCoveringStatusDirty = card
    ? coveringStatus !== ((card.coveringStatus as "Requested" | "Paid by VCC" | "Invoiced to agency") || "Requested")
    : false;
  const isCoveringAmountsDirty = card
    ? Number(card.netPaidToHotel || 0) !== Number(netPaidToHotel || 0) ||
      Number(card.sellToAgency || 0) !== Number(sellToAgency || 0)
    : false;

  const handleSaveServiceOrders = async () => {
    if (!card || (!isServiceOrdersDirty && !isCoveringStatusDirty && !isCoveringAmountsDirty)) return;
    await onUpdate({
      serviceOrders: normalizeServiceOrders(serviceOrders),
      coveringStatus,
      netPaidToHotel: Number(netPaidToHotel || 0),
      sellToAgency: Number(sellToAgency || 0),
    });
    toast.success("Covering data saved");
  };

  const handleAddServiceOrder = () => {
    setServiceOrders((prev) => [
      ...prev,
      {
        service: "",
        quantity: 1,
        price: 0,
        currency: "USD",
        status: "Requested",
        paymentStatus: "Unpaid",
        notes: "",
      },
    ]);
  };

  const handleRemoveServiceOrder = (index: number) => {
    setServiceOrders((prev) => prev.filter((_, i) => i !== index));
  };

  const handleServiceOrderChange = <K extends keyof ServiceOrder>(
    index: number,
    field: K,
    value: ServiceOrder[K]
  ) => {
    setServiceOrders((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleSetCoveringStage = async (
    next: "Requested" | "Paid by VCC" | "Invoiced to agency"
  ) => {
    if (!card) return;
    let nextOrders = [...serviceOrders];
    if (next === "Requested") {
      nextOrders = nextOrders.map((order) =>
        order.status === "Cancelled"
          ? order
          : { ...order, status: "Requested", paymentStatus: "Unpaid" }
      );
    } else if (next === "Paid by VCC") {
      nextOrders = nextOrders.map((order) =>
        order.status === "Cancelled"
          ? order
          : { ...order, status: "Completed", paymentStatus: "Paid" }
      );
    }
    setCoveringStatus(next);
    setServiceOrders(nextOrders);
    await onUpdate({
      coveringStatus: next,
      serviceOrders: normalizeServiceOrders(nextOrders),
    });
    toast.success(`Covering stage updated: ${next}`);
  };

  const serviceTotals = serviceOrders.reduce(
    (acc, order) => {
      return {
        lines: acc.lines + 1,
      };
    },
    { lines: 0 }
  );
  const serviceTotalsByCurrency = serviceOrders.reduce<Record<string, number>>((acc, order) => {
    const qty = Number(order.quantity || 0);
    const price = Number(order.price || 0);
    const line = qty * price;
    const currency = (order.currency || "USD").toUpperCase();
    acc[currency] = (acc[currency] || 0) + line;
    return acc;
  }, {});
  const serviceTotalsLabel =
    Object.keys(serviceTotalsByCurrency).length === 0
      ? "0.00 USD"
      : Object.entries(serviceTotalsByCurrency)
          .map(([currency, amount]) => `${amount.toFixed(2)} ${currency}`)
          .join(" | ");
  const coveringMargin = Number(sellToAgency || 0) - Number(netPaidToHotel || 0);

  const handleToggleLabel = async (color: LabelColor) => {
    const existingIndex = labels.findIndex((l) => l.color === color);
    let newLabels: Label[];
    
    if (existingIndex >= 0) {
      newLabels = labels.filter((_, i) => i !== existingIndex);
    } else {
      newLabels = [...labels, { color, text: "" }];
    }
    
    setLabels(newLabels);
    await onUpdate({ labels: newLabels });
  };

  const toEndOfDayISO = (dateOnly: string) => {
    if (!dateOnly) return "";
    const [y, m, d] = dateOnly.split("-").map((v) => parseInt(v, 10));
    if (!y || !m || !d) return dateOnly;
    const local = new Date(y, m - 1, d, 23, 59, 59, 999);
    return local.toISOString();
  };

  const handleSaveDueDate = async () => {
    const dueValue = dueDate ? toEndOfDayISO(dueDate) : undefined;
    await onUpdate({ 
      dueDate: dueValue,
      dueComplete 
    });
    setShowDatePicker(false);
  };

  const handleToggleDueComplete = async () => {
    const newComplete = !dueComplete;
    setDueComplete(newComplete);
    await onUpdate({ dueComplete: newComplete });
  };

  const handleAddChecklist = async () => {
    if (!newChecklistTitle.trim()) return;
    
    const newChecklist: Checklist = {
      title: newChecklistTitle.trim(),
      items: [],
    };
    
    const newChecklists = [...checklists, newChecklist];
    setChecklists(newChecklists);
    await onUpdate({ checklists: newChecklists });
    setNewChecklistTitle("");
    setShowChecklistAdd(false);
  };

  const handleDeleteChecklist = async (index: number) => {
    const newChecklists = checklists.filter((_, i) => i !== index);
    setChecklists(newChecklists);
    await onUpdate({ checklists: newChecklists });
  };

  const handleAddChecklistItem = async (checklistIndex: number) => {
    const text = newItemTexts[checklistIndex];
    if (!text?.trim()) return;
    
    const newChecklists = [...checklists];
    newChecklists[checklistIndex].items.push({
      text: text.trim(),
      completed: false,
    });
    
    setChecklists(newChecklists);
    await onUpdate({ checklists: newChecklists });
    setNewItemTexts({ ...newItemTexts, [checklistIndex]: "" });
  };

  const handleToggleChecklistItem = async (checklistIndex: number, itemIndex: number) => {
    const newChecklists = [...checklists];
    newChecklists[checklistIndex].items[itemIndex].completed = 
      !newChecklists[checklistIndex].items[itemIndex].completed;
    
    setChecklists(newChecklists);
    await onUpdate({ checklists: newChecklists });
  };

  const handleDeleteChecklistItem = async (checklistIndex: number, itemIndex: number) => {
    const newChecklists = [...checklists];
    newChecklists[checklistIndex].items.splice(itemIndex, 1);
    
    setChecklists(newChecklists);
    await onUpdate({ checklists: newChecklists });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onAddAttachment) return;

    setIsUploading(true);
    try {
      await onAddAttachment(file);
    } catch {
      // Error handled by parent
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!onDeleteAttachment) return;
    await onDeleteAttachment(attachmentId);
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !onAddComment) return;
    setIsSubmittingComment(true);
    try {
      await onAddComment(commentText.trim());
      setCommentText("");
      setShowMentionList(false);
      setMentionQuery("");
    } catch {
      // Error handled by parent
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const toggleMember = async (userId: string) => {
    if (!canManageCardMembers(userRole)) return;
    const already = selectedMembers.includes(userId);
    const next = already
      ? selectedMembers.filter((id) => id !== userId)
      : [...selectedMembers, userId];
    setSelectedMembers(next);
    setShowMemberPicker(false);
    // onUpdate expects Partial<Card>; members in Card are BoardMember objects.
    // When updating we only send user ids; cast to satisfy type without widening the model.
    await onUpdate({ members: next } as any);
  };

  const updateMentionState = (value: string, caret: number) => {
    const beforeCaret = value.slice(0, caret);
    const match = beforeCaret.match(/@([A-Za-z0-9._-]{0,30})$/);
    if (match) {
      setMentionQuery(match[1]);
      setShowMentionList(true);
    } else {
      setShowMentionList(false);
      setMentionQuery("");
    }
  };

  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setCommentText(val);
    updateMentionState(val, e.target.selectionStart || val.length);
  };

  const insertMention = (username: string) => {
    if (!commentRef.current) return;
    const caret = commentRef.current.selectionStart || commentText.length;
    const before = commentText.slice(0, caret);
    const after = commentText.slice(caret);
    const match = before.match(/@([A-Za-z0-9._-]{0,30})$/);
    if (!match) return;
    const start = match.index ?? (before.length - match[0].length);
    const newText = before.slice(0, start) + `@${username} ` + after;
    setCommentText(newText);
    setShowMentionList(false);
    setMentionQuery("");
    // place caret after inserted mention
    const newCaret = start + username.length + 2;
    requestAnimationFrame(() => {
      if (commentRef.current) {
        commentRef.current.focus();
        commentRef.current.selectionStart = newCaret;
        commentRef.current.selectionEnd = newCaret;
      }
    });
  };

  const handleEditComment = async (commentId: string) => {
    if (!editingCommentText.trim() || !onEditComment) return;
    try {
      await onEditComment(commentId, editingCommentText.trim());
      setEditingCommentId(null);
      setEditingCommentText("");
    } catch {
      // Error handled by parent
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!onDeleteComment) return;
    await onDeleteComment(commentId);
  };

  const handleActivityFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onAddAttachment) return;

    setIsUploading(true);
    try {
      await onAddAttachment(file);
    } catch {
      // Error handled by parent
    } finally {
      setIsUploading(false);
      if (activityFileInputRef.current) activityFileInputRef.current.value = "";
    }
  };

  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    if (diffDays < 30) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const isImageType = (type: string) => type.startsWith("image/");

  const dueStatus = dueDate ? getDueDateStatus(dueDate, dueComplete) : null;
  const checklistProgress = checklists.length > 0 ? getChecklistProgress(checklists) : null;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="w-[95vw] max-w-5xl p-0 gap-0 bg-[#F8FAFC] max-h-[90vh] overflow-hidden">
        {/* Cover */}
        {cover && (
          <div 
            className="h-32 bg-cover bg-center"
            style={{ backgroundImage: `url(${cover})` }}
          />
        )}

        <div className="flex flex-col xl:flex-row">
          {/* Main Content */}
          <div className="flex-1 p-6 overflow-y-auto max-h-[calc(90vh-8rem)]">
            {/* Header */}
            <div className="flex items-start gap-3 mb-4">
              <CreditCard className="w-5 h-5 text-[#475569] mt-1 flex-shrink-0" />
              <div className="flex-1">
                {isEditingTitle ? (
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onBlur={handleSaveTitle}
                    onKeyDown={(e) => e.key === "Enter" && handleSaveTitle()}
                    className="text-xl font-semibold"
                    autoFocus
                  />
                ) : (
              <h2
                className={`text-xl font-semibold text-[#0F172A] px-2 py-1 -mx-2 rounded ${canEditCard(userRole) ? 'cursor-pointer hover:bg-slate-100' : ''}`}
                onClick={() => canEditCard(userRole) && setIsEditingTitle(true)}
              >
                {title}
              </h2>
            )}
            <p className="text-sm text-[#475569] mt-1">
              in list <span className="underline">{listTitle}</span>
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {cardDeepLink && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(cardDeepLink);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                    toast.success("Card link copied");
                  } catch {
                    toast.error("Failed to copy link");
                  }
                }}
              >
                <Copy className="w-4 h-4 mr-1" />
                {copied ? "Copied" : "Copy link"}
              </Button>
            )}
            {canEditCard(userRole) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onUpdate({ pinned: !card.pinned })}
                className="h-8 px-2"
              >
                <Pin className={`w-4 h-4 mr-1 ${card.pinned ? "text-indigo-600" : ""}`} />
                {card.pinned ? "Unpin" : "Pin"}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-[#475569] hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Members */}
        <div className="mb-4">
          <h3 className="text-xs font-semibold text-[#475569] mb-2">Members</h3>
          <div className="flex items-center flex-wrap gap-2">
            {selectedMembers.map((id) => {
              const member = safeMembers.find((m) => m.user._id === id);
              if (!member) return null;
              return (
                <button
                  key={id}
                  className="member-avatar member-avatar-sm border border-white/60"
                  title={
                    canManageCardMembers(userRole)
                      ? `${member.user.username} (Click to remove)`
                      : member.user.username
                  }
                  onClick={() => toggleMember(id)}
                  disabled={!canManageCardMembers(userRole)}
                >
                  {member.user.username.charAt(0).toUpperCase()}
                </button>
              );
            })}
            {canManageCardMembers(userRole) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => setShowMemberPicker((p) => !p)}
              >
                <Plus className="w-4 h-4 mr-1" />
                Add
              </Button>
            )}
          </div>
          {showMemberPicker && canManageCardMembers(userRole) && safeMembers.length > 0 && (
            <div className="mt-2 border border-slate-200 rounded-lg shadow-lg bg-white max-h-48 overflow-y-auto">
              {safeMembers.map((m) => {
                const checked = selectedMembers.includes(m.user._id);
                return (
                  <label
                    key={m.user._id}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleMember(m.user._id)}
                    />
                    <div className="member-avatar-sm member-avatar">{m.user.username.charAt(0).toUpperCase()}</div>
                    <div>
                      <div className="text-sm font-semibold text-[#0F172A]">{m.user.username}</div>
                      <div className="text-xs text-[#64748B]">{m.user.email}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Ticket Properties */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-[#475569]">Booking Details</h3>
            <div className="flex items-center gap-2">
              {!hasBookingDetails && !isEditingTicketFields && (
                <Button size="sm" variant="outline" onClick={() => setIsEditingTicketFields(true)}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add
                </Button>
              )}
              {hasBookingDetails && !isEditingTicketFields && (
                <>
                  <Button size="sm" variant="outline" onClick={() => setIsEditingTicketFields(true)}>
                    Edit
                  </Button>
                  {userRole === "admin" && (
                    <Button size="sm" variant="ghost" className="text-red-600" onClick={handleDeleteTicketDetails}>
                      Delete
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          {!isEditingTicketFields && hasBookingDetails && (
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 text-sm leading-relaxed">
                <div className="space-y-0.5"><span className="font-semibold text-slate-500">Requester:</span> {formatRequesterDisplay(requester)}</div>
                <div className="space-y-0.5"><span className="font-semibold text-slate-500">Booking Ref:</span> {bookingRef || "-"}</div>
                <div className="space-y-0.5"><span className="font-semibold text-slate-500">Agency:</span> {agencyName || "-"}</div>
                <div className="space-y-0.5"><span className="font-semibold text-slate-500">Hotel:</span> {hotelName || "-"}</div>
                <div className="space-y-0.5"><span className="font-semibold text-slate-500">Supplier:</span> {supplierName || "-"}</div>
                <div className="space-y-0.5"><span className="font-semibold text-slate-500">Source:</span> {ticketSource || "-"}</div>
                <div className="space-y-0.5"><span className="font-semibold text-slate-500">Type:</span> {ticketType || "-"}</div>
                <div className="space-y-0.5"><span className="font-semibold text-slate-500">Status:</span> {ticketStatus || "-"}</div>
                <div className="space-y-0.5"><span className="font-semibold text-slate-500">Priority:</span> {ticketPriority || "-"}</div>
                <div className="space-y-0.5"><span className="font-semibold text-slate-500">Group:</span> {ticketGroup || "-"}</div>
                <div className="space-y-0.5"><span className="font-semibold text-slate-500">Payment:</span> {paymentStatus || "-"}</div>
                <div className="space-y-0.5"><span className="font-semibold text-slate-500">Agent:</span> {safeMembers.find((m) => m.user._id === ticketAgent)?.user.username || "Unassigned"}</div>
                <div className="space-y-0.5"><span className="font-semibold text-slate-500">Check-in:</span> {checkInDate || "-"}</div>
                <div className="space-y-0.5"><span className="font-semibold text-slate-500">Check-out:</span> {checkOutDate || "-"}</div>
                <div className="space-y-0.5"><span className="font-semibold text-slate-500">Arrival:</span> {arrivalDate || "-"}</div>
                <div className="space-y-0.5"><span className="font-semibold text-slate-500">Supplier Conf:</span> {supplierConfirmationNumber || "-"}</div>
                <div className="space-y-0.5"><span className="font-semibold text-slate-500">Hotel Conf:</span> {hotelConfirmationNumber || "-"}</div>
                <div className="space-y-0.5"><span className="font-semibold text-slate-500">Voucher:</span> {voucherNumber || "-"}</div>
              </div>
            </div>
          )}

          {!hasBookingDetails && !isEditingTicketFields && (
            <div className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500 bg-white">
              No booking details yet.
            </div>
          )}

          {isEditingTicketFields && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-[#64748B]">Requester</label>
                <Input
                  value={requester}
                  onChange={(e) => setRequester(e.target.value)}
                  placeholder="Requester name or email"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#64748B]">Booking Ref</label>
                <Input
                  value={bookingRef}
                  onChange={(e) => setBookingRef(e.target.value)}
                  placeholder="System booking reference"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#64748B]">Agency</label>
                <Input value={agencyName} onChange={(e) => setAgencyName(e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#64748B]">Hotel</label>
                <Input value={hotelName} onChange={(e) => setHotelName(e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#64748B]">Supplier</label>
                <Input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#64748B]">Source</label>
                <select value={ticketSource} onChange={(e) => setTicketSource(e.target.value)} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm">
                  {["Agency", "Supplier", "Hotel", "Email", "WhatsApp", "Portal", "Chat", "Phone", "API"].map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-[#64748B]">Type</label>
                <select value={ticketType} onChange={(e) => setTicketType(e.target.value)} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm">
                  {["Booking request", "Rate request", "Reconfirmation", "Amendment", "Cancellation", "Service request"].map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-[#64748B]">Status</label>
                <select value={ticketStatus} onChange={(e) => setTicketStatus(e.target.value)} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm">
                  {TRAVEL_TICKET_STATUSES.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-[#64748B]">Priority</label>
                <select value={ticketPriority} onChange={(e) => setTicketPriority(e.target.value)} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm">
                  {["Urgent", "High", "Medium", "Low"].map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-[#64748B]">Group</label>
                <Input value={ticketGroup} onChange={(e) => setTicketGroup(e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#64748B]">Payment status</label>
                <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm">
                  {TRAVEL_PAYMENT_STATUSES.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-[#64748B]">Check-in</label>
                <Input type="date" value={checkInDate} onChange={(e) => setCheckInDate(e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#64748B]">Check-out</label>
                <Input type="date" value={checkOutDate} onChange={(e) => setCheckOutDate(e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#64748B]">Arrival date</label>
                <Input type="date" value={arrivalDate} onChange={(e) => setArrivalDate(e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#64748B]">Supplier confirmation no.</label>
                <Input value={supplierConfirmationNumber} onChange={(e) => setSupplierConfirmationNumber(e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#64748B]">Hotel confirmation no.</label>
                <Input value={hotelConfirmationNumber} onChange={(e) => setHotelConfirmationNumber(e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#64748B]">Voucher no.</label>
                <Input value={voucherNumber} onChange={(e) => setVoucherNumber(e.target.value)} className="mt-1" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-[#64748B]">Agent</label>
                <select value={ticketAgent} onChange={(e) => setTicketAgent(e.target.value)} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm">
                  <option value="">Unassigned</option>
                  {safeMembers.map((m) =>
                    m.user ? (
                      <option key={m.user._id} value={m.user._id}>
                        {m.user.username}
                      </option>
                    ) : null
                  )}
                </select>
              </div>
              <div className="md:col-span-2 flex items-center justify-end gap-2 pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    resetTicketFieldsFromCard();
                    setIsEditingTicketFields(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveTicketFields}
                  disabled={!isTicketDirty || isSavingTicketFields}
                  className="bg-[#6366F1] hover:bg-[#4F46E5] text-white"
                >
                  {isSavingTicketFields ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Shift Handover */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-[#475569]">Shift Handover</h3>
            <div className="flex items-center gap-2">
              {!isEditingHandover && (
                <Button size="sm" variant="outline" onClick={() => setIsEditingHandover(true)}>
                  {hasHandoverDetails ? "Edit" : "Add"}
                </Button>
              )}
            </div>
          </div>

          {!isEditingHandover && hasHandoverDetails && (
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div><span className="font-semibold text-slate-500">Status:</span> {handoverStatus}</div>
                <div>
                  <span className="font-semibold text-slate-500">Next owner:</span>{" "}
                  {safeMembers.find((m) => m.user._id === handoverNextOwner)?.user.username || "Unassigned"}
                </div>
                <div><span className="font-semibold text-slate-500">Pending:</span> {handoverPendingState}</div>
                <div className="sm:col-span-2"><span className="font-semibold text-slate-500">Summary:</span> {handoverSummary || "-"}</div>
                <div className="sm:col-span-2"><span className="font-semibold text-slate-500">Done in shift:</span> {handoverDone || "-"}</div>
                <div className="sm:col-span-2"><span className="font-semibold text-slate-500">Pending details:</span> {handoverPending || "-"}</div>
                <div className="sm:col-span-2"><span className="font-semibold text-slate-500">Blocker:</span> {handoverBlocker || "-"}</div>
                <div className="sm:col-span-2"><span className="font-semibold text-slate-500">Next action:</span> {handoverNextAction || "-"}</div>
                <div className="sm:col-span-2">
                  <span className="font-semibold text-slate-500">Reminders:</span>{" "}
                  {Number(card.handoverReminderCount || 0)} sent
                  {card.handoverReminderSentAt
                    ? ` - Last ${new Date(card.handoverReminderSentAt).toLocaleString()}`
                    : " - Not sent yet"}
                </div>
              </div>
            </div>
          )}

          {!hasHandoverDetails && !isEditingHandover && (
            <div className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500 bg-white">
              No handover details yet.
            </div>
          )}

          {isEditingHandover && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-white p-3">
              <div>
                <label className="text-xs font-semibold text-[#64748B]">Handover status</label>
                <select value={handoverStatus} onChange={(e) => setHandoverStatus(e.target.value as any)} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm">
                  {["Not set", "Resolved in shift", "Pending for next shift"].map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-[#64748B]">Next owner</label>
                <select value={handoverNextOwner} onChange={(e) => setHandoverNextOwner(e.target.value)} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm">
                  <option value="">Unassigned</option>
                  {safeMembers.map((m) =>
                    m.user ? (
                      <option key={m.user._id} value={m.user._id}>
                        {m.user.username}
                      </option>
                    ) : null
                  )}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-[#64748B]">Pending</label>
                <select value={handoverPendingState} onChange={(e) => setHandoverPendingState(e.target.value as "Yes" | "No")} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm">
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-[#64748B]">Summary</label>
                <Textarea value={handoverSummary} onChange={(e) => setHandoverSummary(e.target.value)} className="mt-1 min-h-[70px]" placeholder="Case summary for next shift" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-[#64748B]">Done in shift</label>
                <Textarea value={handoverDone} onChange={(e) => setHandoverDone(e.target.value)} className="mt-1 min-h-[70px]" placeholder="What was completed" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-[#64748B]">Pending details</label>
                <Textarea value={handoverPending} onChange={(e) => setHandoverPending(e.target.value)} className="mt-1 min-h-[70px]" placeholder="What is still pending" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-[#64748B]">Blocker</label>
                <Textarea value={handoverBlocker} onChange={(e) => setHandoverBlocker(e.target.value)} className="mt-1 min-h-[70px]" placeholder="Waiting reason/blocker" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-[#64748B]">Next action</label>
                <Textarea value={handoverNextAction} onChange={(e) => setHandoverNextAction(e.target.value)} className="mt-1 min-h-[70px]" placeholder="Exact next step" />
              </div>
              <div className="md:col-span-2 flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    resetHandoverFromCard();
                    setIsEditingHandover(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveHandover}
                  disabled={!isHandoverDirty || isSavingHandover}
                  className="bg-[#6366F1] hover:bg-[#4F46E5] text-white"
                >
                  {isSavingHandover ? "Saving..." : "Save Handover"}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Covering Services */}
        <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50/60">
          <div className="px-3 py-2.5 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-xs font-semibold text-[#334155]">Covering Services</h3>
              <div className="text-[11px] text-[#64748B]">
                {serviceTotals.lines} lines - Total {serviceTotalsLabel}
              </div>
              <div className="text-[11px] text-[#475569] mt-0.5">
                Stage: {coveringStatus} {bookingRef ? `- Ref: ${bookingRef}` : ""}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleAddServiceOrder}
                className="h-8"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setShowServiceOrders((prev) => !prev)}
                className="h-8"
              >
                {showServiceOrders ? "Hide" : "Show"}
              </Button>
            </div>
          </div>

          {showServiceOrders && (
            <div className="px-3 pb-3">
              <div className="mb-3 rounded-lg border border-slate-200 bg-white p-3">
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500">Net paid to hotel</label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={netPaidToHotel}
                      onChange={(e) => setNetPaidToHotel(Math.max(0, Number(e.target.value || 0)))}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500">Selling to travel agency</label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={sellToAgency}
                      onChange={(e) => setSellToAgency(Math.max(0, Number(e.target.value || 0)))}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500">Margin</label>
                    <div className={`h-10 rounded-md border px-3 flex items-center text-sm font-semibold ${coveringMargin >= 0 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>
                      {coveringMargin.toFixed(2)}
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="text-[11px] text-slate-500">Use these two values for final covering financials.</div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setShowCoveringBookingDetails((prev) => !prev)}
                  >
                    {showCoveringBookingDetails ? "Hide booking details" : "View booking details"}
                  </Button>
                </div>
                {showCoveringBookingDetails && (
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-[12px]">
                    <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5">
                      <span className="font-semibold text-slate-600">Booking Ref:</span> {bookingRef || "-"}
                    </div>
                    <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5">
                      <span className="font-semibold text-slate-600">Agency:</span> {agencyName || "-"}
                    </div>
                    <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5">
                      <span className="font-semibold text-slate-600">Hotel:</span> {hotelName || "-"}
                    </div>
                    <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5">
                      <span className="font-semibold text-slate-600">Supplier:</span> {supplierName || "-"}
                    </div>
                  </div>
                )}
              </div>

              <datalist id="covering-service-types">
                {[
                  "Laundry",
                  "Extra meal",
                  "City tax",
                  "Airport transfer",
                  "Late checkout",
                  "Early check-in",
                  "Mini bar",
                  "Spa",
                  "Other",
                ].map((serviceType) => (
                  <option key={serviceType} value={serviceType} />
                ))}
              </datalist>

              <div className="mb-2 flex flex-wrap items-center gap-2">
                {(["Requested", "Paid by VCC", "Invoiced to agency"] as const).map((stage) => (
                  <Button
                    key={stage}
                    type="button"
                    size="sm"
                    variant={coveringStatus === stage ? "default" : "outline"}
                    onClick={() => handleSetCoveringStage(stage)}
                    className={coveringStatus === stage ? "bg-[#6366F1] hover:bg-[#4F46E5] text-white" : ""}
                  >
                    {stage}
                  </Button>
                ))}
              </div>

              {serviceOrders.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500 bg-white">
                  No service orders yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {serviceOrders.map((order, index) => (
                    <div key={order._id || index} className="rounded-lg border border-slate-200 p-3 bg-white">
                      <div className="text-[11px] font-semibold text-slate-500 mb-2">Service line {index + 1}</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="sm:col-span-2">
                          <label className="text-[11px] font-semibold text-slate-500">Service type</label>
                          <Input
                            list="covering-service-types"
                            value={order.service}
                            onChange={(e) => handleServiceOrderChange(index, "service", e.target.value)}
                            placeholder="e.g. Laundry, City tax"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-slate-500">Qty</label>
                          <Input
                            type="number"
                            value={order.quantity}
                            onChange={(e) =>
                              handleServiceOrderChange(index, "quantity", Math.max(1, Number(e.target.value || 1)))
                            }
                            min={1}
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-slate-500">Unit price</label>
                          <Input
                            type="number"
                            value={order.price}
                            onChange={(e) => handleServiceOrderChange(index, "price", Math.max(0, Number(e.target.value || 0)))}
                            min={0}
                            step="0.01"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-slate-500">Currency</label>
                          <Input
                            value={order.currency}
                            onChange={(e) => handleServiceOrderChange(index, "currency", e.target.value.toUpperCase())}
                            placeholder="USD"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-slate-500">Line total</label>
                          <div className="h-10 rounded-md border border-slate-200 bg-slate-50 px-3 flex items-center text-sm font-semibold text-slate-700">
                            {(Number(order.quantity || 0) * Number(order.price || 0)).toFixed(2)}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                        <div>
                          <label className="text-[11px] font-semibold text-slate-500">Service status</label>
                          <select
                            value={order.status}
                            onChange={(e) => handleServiceOrderChange(index, "status", e.target.value as ServiceOrder["status"])}
                            className="w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm"
                          >
                            {["Requested", "In Progress", "Completed", "Cancelled"].map((option) => (
                              <option key={option} value={option}>{option}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-slate-500">Payment</label>
                          <select
                            value={order.paymentStatus}
                            onChange={(e) => handleServiceOrderChange(index, "paymentStatus", e.target.value as ServiceOrder["paymentStatus"])}
                            className="w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm"
                          >
                            {["Unpaid", "Partially paid", "Paid"].map((option) => (
                              <option key={option} value={option}>{option}</option>
                            ))}
                          </select>
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-[11px] font-semibold text-slate-500">Notes</label>
                          <Input
                            value={order.notes || ""}
                            onChange={(e) => handleServiceOrderChange(index, "notes", e.target.value)}
                            placeholder="Hotel quote note, invoice note, etc."
                          />
                        </div>
                        <div className="sm:col-span-2 flex justify-end">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRemoveServiceOrder(index)}
                            className="text-red-600 hover:text-red-700"
                            title="Delete service line"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setServiceOrders(card?.serviceOrders || []);
                    setCoveringStatus((card?.coveringStatus as "Requested" | "Paid by VCC" | "Invoiced to agency") || "Requested");
                    setNetPaidToHotel(Number(card?.netPaidToHotel || 0));
                    setSellToAgency(Number(card?.sellToAgency || 0));
                  }}
                  disabled={!isServiceOrdersDirty && !isCoveringStatusDirty && !isCoveringAmountsDirty}
                >
                  Reset
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveServiceOrders}
                  disabled={!isServiceOrdersDirty && !isCoveringStatusDirty && !isCoveringAmountsDirty}
                  className="bg-[#6366F1] hover:bg-[#4F46E5] text-white"
                >
                  Save services
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Labels */}
        {labels.length > 0 && (
          <div className="mb-4">
            <h3 className="text-xs font-semibold text-[#475569] mb-2">Labels</h3>
            <div className="flex flex-wrap gap-1">
                  {labels.map((label, index) => {
                    const labelColor = getLabelColor(label.color);
                    return (
                      <div
                        key={index}
                        className="card-label-expanded text-white"
                        style={{ backgroundColor: labelColor.bg }}
                      >
                        {label.text || labelColor.name}
                      </div>
                    );
                  })}
                  <button
                    onClick={() => setShowLabelPicker(true)}
                    className="h-5 px-2 rounded-full bg-slate-100 text-[#475569] text-xs hover:bg-slate-200"
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            {/* Due Date Display */}
            {dueDate && (
              <div className="mb-4">
                <h3 className="text-xs font-semibold text-[#475569] mb-2">Due date</h3>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={dueComplete}
                    onCheckedChange={handleToggleDueComplete}
                  />
                  <button
                    onClick={() => setShowDatePicker(true)}
                    className={`due-badge due-${dueStatus}`}
                  >
                    <Clock className="w-3 h-3" />
                    <span>{formatDueDate(dueDate)}</span>
                    {dueComplete && <span className="ml-1">âœ“ Complete</span>}
                  </button>
                </div>
              </div>
            )}

            {/* Description */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <AlignLeft className="w-5 h-5 text-[#475569]" />
                <h3 className="font-semibold text-[#0F172A]">Description</h3>
              </div>
              {isEditingDescription ? (
                <div className="ml-8">
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Add a more detailed description..."
                    className="min-h-[100px] mb-2"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleSaveDescription}
                      className="trello-btn-primary"
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setDescription(card.description || "");
                        setIsEditingDescription(false);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  className={`ml-8 p-3 bg-slate-100 rounded min-h-[60px] text-sm text-[#0F172A] ${canEditCard(userRole) ? 'cursor-pointer hover:bg-slate-200' : ''}`}
                  onClick={() => canEditCard(userRole) && setIsEditingDescription(true)}
                >
                  {description || (canEditCard(userRole) ? "Add a more detailed description..." : "No description")}
                </div>
              )}
            </div>

            {/* Checklists */}
            {checklists.map((checklist, checklistIndex) => {
              const progress = getChecklistProgress([checklist]);
              return (
                <div key={checklistIndex} className="mb-6">
                  <div className="flex items-center gap-3 mb-2">
                    <CheckSquare className="w-5 h-5 text-[#475569]" />
                    <h3 className="font-semibold text-[#0F172A] flex-1">{checklist.title}</h3>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteChecklist(checklistIndex)}
                      className="text-[#475569] hover:bg-slate-100"
                    >
                      Delete
                    </Button>
                  </div>

                  {/* Progress Bar */}
                  <div className="ml-8 mb-2">
                    <div className="flex items-center gap-2 text-xs text-[#475569] mb-1">
                      <span>{progress.percentage}%</span>
                    </div>
                    <div className="checklist-progress">
                      <div
                        className={`checklist-progress-bar ${progress.percentage === 100 ? 'checklist-progress-complete' : ''}`}
                        style={{ width: `${progress.percentage}%` }}
                      />
                    </div>
                  </div>

                  {/* Items */}
                  <div className="ml-8 space-y-1">
                    {checklist.items.map((item, itemIndex) => (
                      <div key={itemIndex} className="flex items-center gap-2 group">
                        <Checkbox
                          checked={item.completed}
                          onCheckedChange={() => handleToggleChecklistItem(checklistIndex, itemIndex)}
                        />
                        <span className={`flex-1 text-sm ${item.completed ? 'line-through text-[#475569]' : 'text-[#0F172A]'}`}>
                          {item.text}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteChecklistItem(checklistIndex, itemIndex)}
                          className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}

                    {/* Add Item */}
                    <div className="flex gap-2">
                      <Input
                        placeholder="Add an item..."
                        value={newItemTexts[checklistIndex] || ""}
                        onChange={(e) => setNewItemTexts({ ...newItemTexts, [checklistIndex]: e.target.value })}
                        onKeyDown={(e) => e.key === "Enter" && handleAddChecklistItem(checklistIndex)}
                        className="h-8 text-sm"
                      />
                      <Button
                        size="sm"
                        onClick={() => handleAddChecklistItem(checklistIndex)}
                        className="trello-btn-primary h-8"
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Attachments */}
            {card.attachments && card.attachments.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-3">
                  <Paperclip className="w-5 h-5 text-[#475569]" />
                  <h3 className="font-semibold text-[#0F172A]">Attachments</h3>
                </div>
                <div className="ml-8 space-y-2">
                  {card.attachments.map((attachment) => {
                    const attachmentUrl = resolveAttachmentUrl(attachment.url);
                    return (
                    <div
                      key={attachment._id}
                      className="group flex items-center gap-3 p-2 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      {/* Thumbnail / Icon */}
                      {isImageType(attachment.type) ? (
                        <a
                          href={attachmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-20 h-14 rounded overflow-hidden flex-shrink-0 bg-slate-100"
                        >
                          <img
                            src={attachmentUrl}
                            alt={attachment.name}
                            className="w-full h-full object-cover"
                          />
                        </a>
                      ) : (
                        <a
                          href={attachmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-20 h-14 rounded flex-shrink-0 bg-slate-100 flex items-center justify-center"
                        >
                          <FileText className="w-6 h-6 text-[#475569]" />
                        </a>
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <a
                          href={attachmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-[#0F172A] hover:underline truncate block"
                        >
                          {attachment.name}
                        </a>
                        <span className="text-xs text-[#475569]">
                          {attachment.type.split("/")[1]?.toUpperCase() || "FILE"}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <a
                          href={attachmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 rounded hover:bg-slate-200"
                          title="Open"
                        >
                          <ExternalLink className="w-4 h-4 text-[#475569]" />
                        </a>
                        <button
                          onClick={() => attachment._id && handleDeleteAttachment(attachment._id)}
                          className="p-1 rounded hover:bg-slate-200"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4 text-[#EF4444]" />
                        </button>
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Upload progress indicator */}
            {isUploading && (
              <div className="mb-6 ml-8 flex items-center gap-2 text-sm text-[#475569]">
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading attachment...
              </div>
            )}

            {/* Activity / Comments */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-3">
                <MessageSquare className="w-5 h-5 text-[#475569]" />
                <h3 className="font-semibold text-[#0F172A]">Activity</h3>
              </div>

              {/* Comment Input */}
              {onAddComment && canComment(userRole) && (
                <div className="ml-8 mb-4">
                  <div className="flex items-start gap-3">
                    <div className="comment-avatar flex-shrink-0">
                      {currentUser?.username?.charAt(0).toUpperCase() || "U"}
                    </div>
                    <div className="flex-1">
                    <Textarea
                      ref={commentRef}
                      placeholder="Write a comment..."
                      value={commentText}
                      onChange={handleCommentChange}
                      className="min-h-[60px] text-sm bg-white border-[#E2E8F0] focus:border-[#6366F1]"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleAddComment();
                        }
                      }}
                    />
                    {showMentionList && safeMembers.length > 0 && (
                      <div className="mt-1 max-h-40 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg text-sm">
                        {safeMembers
                          .filter((m) =>
                            mentionQuery
                              ? m.user.username.toLowerCase().includes(mentionQuery.toLowerCase())
                              : true
                          )
                          .slice(0, 8)
                          .map((m) => (
                            <button
                              key={m.user._id}
                              className="w-full text-left px-3 py-2 hover:bg-slate-100 flex items-center gap-2"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                insertMention(m.user.username);
                              }}
                            >
                              <div className="member-avatar-sm">{m.user.username.charAt(0).toUpperCase()}</div>
                              <div>
                                <div className="font-semibold text-[#0F172A]">{m.user.username}</div>
                                <div className="text-xs text-[#64748B]">{m.user.email}</div>
                              </div>
                            </button>
                          ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      {commentText.trim() && (
                        <Button
                          size="sm"
                          onClick={handleAddComment}
                            disabled={isSubmittingComment}
                            className="trello-btn-primary"
                          >
                            {isSubmittingComment ? (
                              <Loader2 className="w-4 h-4 animate-spin mr-1" />
                            ) : null}
                            Save
                          </Button>
                        )}
                        <button
                          onClick={() => activityFileInputRef.current?.click()}
                          disabled={isUploading}
                          className="p-1.5 rounded hover:bg-slate-200 text-[#475569] transition-colors"
                          title="Attach a file"
                        >
                          {isUploading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Paperclip className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Comments List */}
              {card.comments && card.comments.length > 0 && (
                <div className="ml-8 space-y-4">
                  {[...card.comments].reverse().map((comment) => (
                    <div key={comment._id} className="comment-item group">
                      <div className="comment-avatar flex-shrink-0">
                        {comment.author?.username?.charAt(0).toUpperCase() || "U"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-[#0F172A]">
                            {comment.author?.username || "Unknown"}
                          </span>
                          <span className="comment-timestamp">
                            {getRelativeTime(comment.createdAt)}
                          </span>
                        </div>
                        {editingCommentId === comment._id ? (
                          <div>
                            <Textarea
                              value={editingCommentText}
                              onChange={(e) => setEditingCommentText(e.target.value)}
                              className="min-h-[60px] text-sm bg-white border-[#E2E8F0] focus:border-[#6366F1]"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault();
                                  handleEditComment(comment._id);
                                }
                                if (e.key === "Escape") {
                                  setEditingCommentId(null);
                                  setEditingCommentText("");
                                }
                              }}
                            />
                            <div className="flex gap-2 mt-2">
                              <Button
                                size="sm"
                                onClick={() => handleEditComment(comment._id)}
                                className="trello-btn-primary"
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditingCommentId(null);
                                  setEditingCommentText("");
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="comment-bubble">
                              {comment.text}
                            </div>
                            {/* Edit / Delete actions */}
                            {(onEditComment || onDeleteComment) && (
                              <div className="flex items-center gap-3 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {onEditComment && (
                                  <button
                                    onClick={() => {
                                      setEditingCommentId(comment._id);
                                      setEditingCommentText(comment.text);
                                    }}
                                    className="text-xs text-[#475569] hover:text-[#6366F1] font-medium underline decoration-dotted"
                                  >
                                    Edit
                                  </button>
                                )}
                                {onDeleteComment && (
                                  <button
                                    onClick={() => handleDeleteComment(comment._id)}
                                    className="text-xs text-[#475569] hover:text-[#EF4444] font-medium underline decoration-dotted"
                                  >
                                    Delete
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Hidden file inputs */}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileSelect}
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar"
            />
            <input
              ref={activityFileInputRef}
              type="file"
              className="hidden"
              onChange={handleActivityFileSelect}
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar"
            />
          </div>

          {/* Sidebar */}
          <div className="w-full xl:w-48 p-4 bg-[#F1F5F9] border-t xl:border-t-0 xl:border-l border-[#E2E8F0]">
            {canEditCard(userRole) && (
              <>
                <h4 className="text-xs font-semibold text-[#475569] mb-2">Add to card</h4>
                <div className="space-y-1">
                  <button
                    onClick={() => setShowLabelPicker(!showLabelPicker)}
                    className="w-full trello-btn trello-btn-secondary text-left flex items-center gap-2"
                  >
                    <Tag className="w-4 h-4" />
                    Labels
                  </button>

                  <button
                    onClick={() => setShowChecklistAdd(!showChecklistAdd)}
                    className="w-full trello-btn trello-btn-secondary text-left flex items-center gap-2"
                  >
                    <CheckSquare className="w-4 h-4" />
                    Checklist
                  </button>

                  <button
                    onClick={() => setShowDatePicker(!showDatePicker)}
                    className="w-full trello-btn trello-btn-secondary text-left flex items-center gap-2"
                  >
                    <Clock className="w-4 h-4" />
                    Dates
                  </button>

                  <button className="w-full trello-btn trello-btn-secondary text-left flex items-center gap-2">
                    <Image className="w-4 h-4" />
                    Cover
                  </button>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="w-full trello-btn trello-btn-secondary text-left flex items-center gap-2"
                  >
                    {isUploading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Paperclip className="w-4 h-4" />
                    )}
                    Attachment
                  </button>
                </div>
              </>
            )}

            <h4 className={`text-xs font-semibold text-[#475569] mb-2 ${canEditCard(userRole) ? 'mt-4' : ''}`}>Actions</h4>
            <div className="space-y-1">
              {/* Move Button */}
              {onMove && canEditCard(userRole) && (
                <button
                  onClick={() => setShowMovePicker(!showMovePicker)}
                  className="w-full trello-btn trello-btn-secondary text-left flex items-center gap-2"
                >
                  <ArrowRight className="w-4 h-4" />
                  Move
                </button>
              )}

              {canEditCard(userRole) && (
                <button
                  onClick={handleArchiveCard}
                  className="w-full trello-btn trello-btn-secondary text-left flex items-center gap-2"
                >
                  <Archive className="w-4 h-4" />
                  Archive
                </button>
              )}
              {canDeleteCard(userRole, card, currentUser?._id) && (
                <button
                  onClick={onDelete}
                  className="w-full trello-btn text-left flex items-center gap-2 bg-[#EF4444] text-white hover:bg-[#DC2626]"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              )}
              {!canDeleteCard(userRole, card, currentUser?._id) && (
                <p className="text-xs text-[#64748B] p-2">
                  {userRole === "observer"
                    ? "Read-only access"
                    : userRole === "admin"
                    ? "Limited access"
                    : "Only board admins can delete cards"}
                </p>
              )}
            </div>

            {/* Label Picker Popup */}
            {showLabelPicker && (
              <div className="mt-2 p-2 bg-white rounded shadow-lg border">
                <h5 className="text-xs font-semibold text-[#475569] mb-2">Labels</h5>
                <div className="space-y-1">
                  {LABEL_COLORS.map((labelColor) => (
                    <button
                      key={labelColor.color}
                      onClick={() => handleToggleLabel(labelColor.color)}
                      className="w-full h-8 rounded flex items-center px-2"
                      style={{ backgroundColor: labelColor.bg }}
                    >
                      {labels.some((l) => l.color === labelColor.color) && (
                        <span className="text-white text-sm">âœ“</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Date Picker Popup */}
            {showDatePicker && (
              <div className="mt-2 p-2 bg-white rounded shadow-lg border">
                <h5 className="text-xs font-semibold text-[#475569] mb-2">Due date</h5>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="mb-2"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveDueDate} className="trello-btn-primary">
                    Save
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => {
                      setDueDate("");
                      handleSaveDueDate();
                    }}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            )}

            {/* Add Checklist Popup */}
            {showChecklistAdd && (
              <div className="mt-2 p-2 bg-white rounded shadow-lg border">
                <h5 className="text-xs font-semibold text-[#475569] mb-2">Add checklist</h5>
                <Input
                  placeholder="Checklist title..."
                  value={newChecklistTitle}
                  onChange={(e) => setNewChecklistTitle(e.target.value)}
                  className="mb-2"
                />
                <Button size="sm" onClick={handleAddChecklist} className="trello-btn-primary">
                  Add
                </Button>
              </div>
            )}

            {/* Move Card Picker */}
            {showMovePicker && onMove && (
              <div className="mt-2 p-3 bg-white rounded shadow-lg border">
                <h5 className="text-xs font-semibold text-[#475569] mb-2">Move to list</h5>
                <div className="space-y-1">
                  {lists.filter((l) => l._id !== currentListId).map((list) => (
                    <button
                      key={list._id}
                      disabled={isMoving}
                      onClick={async () => {
                        setIsMoving(true);
                        try {
                          await onMove(list._id);
                          setShowMovePicker(false);
                        } catch {
                          // Error handled by parent
                        } finally {
                          setIsMoving(false);
                        }
                      }}
                      className="w-full text-left px-3 py-2 text-sm rounded hover:bg-indigo-50 hover:text-indigo-700 transition-colors flex items-center gap-2"
                    >
                      <ArrowRight className="w-3 h-3" />
                      {list.title}
                    </button>
                  ))}
                  {lists.filter((l) => l._id !== currentListId).length === 0 && (
                    <p className="text-xs text-[#64748B] p-2">No other lists available</p>
                  )}
                </div>
                {isMoving && (
                  <div className="flex items-center gap-2 mt-2 text-xs text-[#475569]">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Moving...
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

