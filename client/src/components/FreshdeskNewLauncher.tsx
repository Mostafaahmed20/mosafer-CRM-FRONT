import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AgencyContactRole,
  Board,
  BoardRole,
  Card,
  CustomerDecisionRole,
  CustomerProfile,
  List,
  TRAVEL_TICKET_STATUSES,
  boardApi,
  cardApi,
  customerApi,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  BadgePlus,
  Building2,
  ChevronDown,
  Loader2,
  Mail,
  MessageSquare,
  Ticket,
  UserPlus,
  UserRoundPlus,
} from "lucide-react";

export type BoardCatalogItem = {
  board: Board;
  lists: List[];
};

type NewAction = "ticket" | "email" | "message" | "contact" | "company" | "agent";

type TicketDraft = {
  boardId: string;
  listId: string;
  requester: string;
  companyName: string;
  subject: string;
  description: string;
  type: string;
  source: string;
  status: string;
  priority: string;
  group: string;
  agentId: string;
};

type EmailDraft = {
  boardId: string;
  listId: string;
  to: string;
  companyName: string;
  subject: string;
  body: string;
  status: string;
  priority: string;
  group: string;
  agentId: string;
};

type MessageDraft = {
  boardId: string;
  listId: string;
  source: string;
  contact: string;
  companyName: string;
  subject: string;
  body: string;
  status: string;
  priority: string;
  group: string;
  agentId: string;
};

type ContactDraft = {
  customerId: string;
  companyName: string;
  name: string;
  email: string;
  mobilePhone: string;
  workPhone: string;
  role: AgencyContactRole;
};

type CompanyDraft = {
  companyName: string;
  location: string;
  email: string;
  decisionRole: CustomerDecisionRole;
  notes: string;
};

type AgentDraft = {
  boardId: string;
  email: string;
  role: BoardRole;
};

const PRIORITY_OPTIONS = ["Urgent", "High", "Medium", "Low"];
const CONTACT_ROLE_OPTIONS: AgencyContactRole[] = ["CEO", "Manager", "Operations", "Accounting", "Sales", "Reservations", "Owner", "Other"];
const DECISION_ROLE_OPTIONS: CustomerDecisionRole[] = ["Group Admin", "CEO", "Manager", "Decision Maker", "Owner", "Operations"];
const MESSAGE_SOURCE_OPTIONS = ["WhatsApp", "SMS", "Instagram", "Facebook", "Live chat"];
const BOARD_ROLE_OPTIONS: BoardRole[] = ["admin", "member", "observer", "guest"];

const inputClassName = "h-12 rounded-[18px] border-[#D9E5F4] bg-white px-4 text-[#102A43] shadow-none";
const selectClassName = "h-12 w-full rounded-[18px] border border-[#D9E5F4] bg-white px-4 text-sm text-[#102A43] outline-none";

function findBoard(boardCatalog: BoardCatalogItem[], boardId: string) {
  return boardCatalog.find((entry) => entry.board._id === boardId) || null;
}

function getDefaultBoardId(boardCatalog: BoardCatalogItem[], preferredBoardId?: string) {
  if (preferredBoardId && boardCatalog.some((entry) => entry.board._id === preferredBoardId)) return preferredBoardId;
  return boardCatalog[0]?.board._id || "";
}

function getDefaultListId(boardCatalog: BoardCatalogItem[], boardId: string) {
  const lists = findBoard(boardCatalog, boardId)?.lists || [];
  const preferred = lists.find((list) => /new|open|intake|request/i.test(String(list.title || ""))) || lists[0];
  return preferred?._id || "";
}

function buildTicketDefaults(boardCatalog: BoardCatalogItem[], preferredBoardId?: string): TicketDraft {
  const boardId = getDefaultBoardId(boardCatalog, preferredBoardId);
  return {
    boardId,
    listId: getDefaultListId(boardCatalog, boardId),
    requester: "",
    companyName: "",
    subject: "",
    description: "",
    type: "Booking request",
    source: "Phone",
    status: "New",
    priority: "Low",
    group: "Operations",
    agentId: "",
  };
}

function buildEmailDefaults(boardCatalog: BoardCatalogItem[], preferredBoardId?: string): EmailDraft {
  const boardId = getDefaultBoardId(boardCatalog, preferredBoardId);
  return {
    boardId,
    listId: getDefaultListId(boardCatalog, boardId),
    to: "",
    companyName: "",
    subject: "",
    body: "",
    status: "New",
    priority: "Medium",
    group: "Support",
    agentId: "",
  };
}

function buildMessageDefaults(boardCatalog: BoardCatalogItem[], preferredBoardId?: string): MessageDraft {
  const boardId = getDefaultBoardId(boardCatalog, preferredBoardId);
  return {
    boardId,
    listId: getDefaultListId(boardCatalog, boardId),
    source: "WhatsApp",
    contact: "",
    companyName: "",
    subject: "",
    body: "",
    status: "New",
    priority: "Medium",
    group: "Support",
    agentId: "",
  };
}

function buildContactDefaults(): ContactDraft {
  return { customerId: "", companyName: "", name: "", email: "", mobilePhone: "", workPhone: "", role: "Operations" };
}

function buildCompanyDefaults(): CompanyDraft {
  return { companyName: "", location: "", email: "", decisionRole: "Operations", notes: "" };
}

function buildAgentDefaults(boardCatalog: BoardCatalogItem[], preferredBoardId?: string): AgentDraft {
  return { boardId: getDefaultBoardId(boardCatalog, preferredBoardId), email: "", role: "member" };
}

type FreshdeskNewLauncherProps = {
  boardCatalog: BoardCatalogItem[];
  preferredBoardId?: string;
  onTicketCreated: (payload: { boardId: string; listId: string; card: Card }) => void;
  onBoardUpdated: (board: Board) => void;
};

export default function FreshdeskNewLauncher({
  boardCatalog,
  preferredBoardId,
  onTicketCreated,
  onBoardUpdated,
}: FreshdeskNewLauncherProps) {
  const [activeAction, setActiveAction] = useState<NewAction | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [ticketDraft, setTicketDraft] = useState(() => buildTicketDefaults(boardCatalog, preferredBoardId));
  const [emailDraft, setEmailDraft] = useState(() => buildEmailDefaults(boardCatalog, preferredBoardId));
  const [messageDraft, setMessageDraft] = useState(() => buildMessageDefaults(boardCatalog, preferredBoardId));
  const [contactDraft, setContactDraft] = useState(() => buildContactDefaults());
  const [companyDraft, setCompanyDraft] = useState(() => buildCompanyDefaults());
  const [agentDraft, setAgentDraft] = useState(() => buildAgentDefaults(boardCatalog, preferredBoardId));

  useEffect(() => {
    let cancelled = false;
    const loadCustomers = async () => {
      try {
        setIsLoadingCustomers(true);
        const data = await customerApi.getAll();
        if (!cancelled) setCustomers(data);
      } catch (error: any) {
        if (!cancelled) toast.error(error?.message || "Failed to load companies");
      } finally {
        if (!cancelled) setIsLoadingCustomers(false);
      }
    };

    void loadCustomers();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const defaultBoardId = getDefaultBoardId(boardCatalog, preferredBoardId);

    setTicketDraft((prev) => {
      const nextBoardId = findBoard(boardCatalog, prev.boardId) ? prev.boardId : defaultBoardId;
      const nextListId = findBoard(boardCatalog, nextBoardId)?.lists.some((list) => list._id === prev.listId)
        ? prev.listId
        : getDefaultListId(boardCatalog, nextBoardId);
      return { ...prev, boardId: nextBoardId, listId: nextListId };
    });

    setEmailDraft((prev) => {
      const nextBoardId = findBoard(boardCatalog, prev.boardId) ? prev.boardId : defaultBoardId;
      const nextListId = findBoard(boardCatalog, nextBoardId)?.lists.some((list) => list._id === prev.listId)
        ? prev.listId
        : getDefaultListId(boardCatalog, nextBoardId);
      return { ...prev, boardId: nextBoardId, listId: nextListId };
    });

    setMessageDraft((prev) => {
      const nextBoardId = findBoard(boardCatalog, prev.boardId) ? prev.boardId : defaultBoardId;
      const nextListId = findBoard(boardCatalog, nextBoardId)?.lists.some((list) => list._id === prev.listId)
        ? prev.listId
        : getDefaultListId(boardCatalog, nextBoardId);
      return { ...prev, boardId: nextBoardId, listId: nextListId };
    });

    setAgentDraft((prev) => ({
      ...prev,
      boardId: findBoard(boardCatalog, prev.boardId) ? prev.boardId : defaultBoardId,
    }));
  }, [boardCatalog, preferredBoardId]);

  const companyOptions = useMemo(
    () => [...customers].sort((left, right) => left.agencyName.localeCompare(right.agencyName)),
    [customers]
  );

  const ticketBoardLists = useMemo(() => findBoard(boardCatalog, ticketDraft.boardId)?.lists || [], [boardCatalog, ticketDraft.boardId]);
  const emailBoardLists = useMemo(() => findBoard(boardCatalog, emailDraft.boardId)?.lists || [], [boardCatalog, emailDraft.boardId]);
  const messageBoardLists = useMemo(() => findBoard(boardCatalog, messageDraft.boardId)?.lists || [], [boardCatalog, messageDraft.boardId]);

  const ticketAgents = useMemo(
    () =>
      (findBoard(boardCatalog, ticketDraft.boardId)?.board.members || [])
        .map((member) => member.user)
        .filter((member): member is NonNullable<typeof member> => Boolean(member?._id))
        .sort((left, right) => left.username.localeCompare(right.username)),
    [boardCatalog, ticketDraft.boardId]
  );

  const emailAgents = useMemo(
    () =>
      (findBoard(boardCatalog, emailDraft.boardId)?.board.members || [])
        .map((member) => member.user)
        .filter((member): member is NonNullable<typeof member> => Boolean(member?._id))
        .sort((left, right) => left.username.localeCompare(right.username)),
    [boardCatalog, emailDraft.boardId]
  );

  const messageAgents = useMemo(
    () =>
      (findBoard(boardCatalog, messageDraft.boardId)?.board.members || [])
        .map((member) => member.user)
        .filter((member): member is NonNullable<typeof member> => Boolean(member?._id))
        .sort((left, right) => left.username.localeCompare(right.username)),
    [boardCatalog, messageDraft.boardId]
  );

  const openAction = (action: NewAction) => {
    setActiveAction(action);
    if (action === "ticket") setTicketDraft(buildTicketDefaults(boardCatalog, preferredBoardId));
    if (action === "email") setEmailDraft(buildEmailDefaults(boardCatalog, preferredBoardId));
    if (action === "message") setMessageDraft(buildMessageDefaults(boardCatalog, preferredBoardId));
    if (action === "contact") setContactDraft(buildContactDefaults());
    if (action === "company") setCompanyDraft(buildCompanyDefaults());
    if (action === "agent") setAgentDraft(buildAgentDefaults(boardCatalog, preferredBoardId));
  };

  const closeSheet = () => {
    if (!isSaving) setActiveAction(null);
  };

  const handleCreateTicketRecord = async (input: {
    boardId: string;
    listId: string;
    title: string;
    description: string;
    requester?: string;
    companyName?: string;
    type?: string;
    source?: string;
    status?: string;
    priority?: string;
    group?: string;
    agentId?: string;
  }) => {
    const created = await cardApi.create(input.boardId, input.listId, {
      title: input.title.trim(),
      description: input.description.trim(),
      agencyName: input.companyName?.trim(),
      source: input.source?.trim(),
      type: input.type?.trim(),
      status: input.status?.trim(),
    }) as Card;

    const updates: Record<string, unknown> = {};
    if (input.requester?.trim()) updates.requester = input.requester.trim();
    if (input.priority?.trim()) updates.priority = input.priority.trim();
    if (input.group?.trim()) updates.group = input.group.trim();
    if (input.agentId?.trim()) updates.agent = input.agentId.trim();

    const finalCard = Object.keys(updates).length
      ? await cardApi.update(input.boardId, input.listId, created._id, updates) as Card
      : created;

    onTicketCreated({ boardId: input.boardId, listId: input.listId, card: finalCard });
    return finalCard;
  };

  const handleSubmitTicket = async (event: FormEvent) => {
    event.preventDefault();
    if (!ticketDraft.boardId || !ticketDraft.listId) {
      toast.error("Choose a board and queue first");
      return;
    }
    if (!ticketDraft.subject.trim()) {
      toast.error("Subject is required");
      return;
    }
    try {
      setIsSaving(true);
      await handleCreateTicketRecord({
        boardId: ticketDraft.boardId,
        listId: ticketDraft.listId,
        title: ticketDraft.subject,
        description: ticketDraft.description,
        requester: ticketDraft.requester,
        companyName: ticketDraft.companyName,
        type: ticketDraft.type,
        source: ticketDraft.source,
        status: ticketDraft.status,
        priority: ticketDraft.priority,
        group: ticketDraft.group,
        agentId: ticketDraft.agentId,
      });
      toast.success("Ticket created");
      closeSheet();
    } catch (error: any) {
      toast.error(error?.message || "Failed to create ticket");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitEmail = async (event: FormEvent) => {
    event.preventDefault();
    if (!emailDraft.boardId || !emailDraft.listId) {
      toast.error("Choose a board and queue first");
      return;
    }
    if (!emailDraft.to.trim() || !emailDraft.subject.trim() || !emailDraft.body.trim()) {
      toast.error("To, subject, and description are required");
      return;
    }
    try {
      setIsSaving(true);
      await handleCreateTicketRecord({
        boardId: emailDraft.boardId,
        listId: emailDraft.listId,
        title: emailDraft.subject,
        description: emailDraft.body,
        requester: emailDraft.to,
        companyName: emailDraft.companyName,
        type: "Email",
        source: "Email",
        status: emailDraft.status,
        priority: emailDraft.priority,
        group: emailDraft.group,
        agentId: emailDraft.agentId,
      });
      toast.success("Email ticket created");
      closeSheet();
    } catch (error: any) {
      toast.error(error?.message || "Failed to create email ticket");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitMessage = async (event: FormEvent) => {
    event.preventDefault();
    if (!messageDraft.boardId || !messageDraft.listId) {
      toast.error("Choose a board and queue first");
      return;
    }
    if (!messageDraft.contact.trim() || !messageDraft.body.trim()) {
      toast.error("Contact and message are required");
      return;
    }
    try {
      setIsSaving(true);
      await handleCreateTicketRecord({
        boardId: messageDraft.boardId,
        listId: messageDraft.listId,
        title: messageDraft.subject.trim() || `${messageDraft.source} message`,
        description: messageDraft.body,
        requester: messageDraft.contact,
        companyName: messageDraft.companyName,
        type: "Message",
        source: messageDraft.source,
        status: messageDraft.status,
        priority: messageDraft.priority,
        group: messageDraft.group,
        agentId: messageDraft.agentId,
      });
      toast.success("Message ticket created");
      closeSheet();
    } catch (error: any) {
      toast.error(error?.message || "Failed to create message ticket");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitContact = async (event: FormEvent) => {
    event.preventDefault();
    if (!contactDraft.name.trim() || !contactDraft.email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    if (!contactDraft.customerId && !contactDraft.companyName.trim()) {
      toast.error("Choose an existing company or enter a new one");
      return;
    }

    const nextContact = {
      id: `ct_${Math.random().toString(36).slice(2, 10)}`,
      name: contactDraft.name.trim(),
      email: contactDraft.email.trim().toLowerCase(),
      role: contactDraft.role,
      phone: [contactDraft.mobilePhone.trim(), contactDraft.workPhone.trim()].filter(Boolean).join(" / ") || undefined,
    };

    try {
      setIsSaving(true);
      if (contactDraft.customerId) {
        const existing = customers.find((customer) => customer._id === contactDraft.customerId);
        if (!existing) throw new Error("Selected company was not found");
        const duplicate = (existing.contacts || []).some((contact) => contact.email.trim().toLowerCase() === nextContact.email);
        if (duplicate) throw new Error("That contact email already exists in this company");
        const updated = await customerApi.update(existing._id, {
          contacts: [...(existing.contacts || []), nextContact],
        });
        setCustomers((prev) => prev.map((customer) => (customer._id === updated._id ? updated : customer)));
      } else {
        const created = await customerApi.create({
          agencyName: contactDraft.companyName.trim(),
          location: "",
          email: nextContact.email,
          decisionRole: "Operations",
          contacts: [nextContact],
          notes: "",
        });
        setCustomers((prev) => [created, ...prev.filter((customer) => customer._id !== created._id)]);
      }
      toast.success("Contact added");
      closeSheet();
    } catch (error: any) {
      toast.error(error?.message || "Failed to add contact");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitCompany = async (event: FormEvent) => {
    event.preventDefault();
    if (!companyDraft.companyName.trim()) {
      toast.error("Company name is required");
      return;
    }
    try {
      setIsSaving(true);
      const created = await customerApi.create({
        agencyName: companyDraft.companyName.trim(),
        location: companyDraft.location.trim(),
        email: companyDraft.email.trim(),
        decisionRole: companyDraft.decisionRole,
        notes: companyDraft.notes.trim(),
        contacts: [],
      });
      setCustomers((prev) => [created, ...prev.filter((customer) => customer._id !== created._id)]);
      toast.success("Company created");
      closeSheet();
    } catch (error: any) {
      toast.error(error?.message || "Failed to create company");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitAgent = async (event: FormEvent) => {
    event.preventDefault();
    if (!agentDraft.boardId || !agentDraft.email.trim()) {
      toast.error("Board and email are required");
      return;
    }
    try {
      setIsSaving(true);
      const updatedBoard = await boardApi.addMember(agentDraft.boardId, agentDraft.email.trim(), agentDraft.role) as Board;
      onBoardUpdated(updatedBoard);
      toast.success("Agent invited to board");
      closeSheet();
    } catch (error: any) {
      toast.error(error?.message || "Failed to invite agent");
    } finally {
      setIsSaving(false);
    }
  };

  const launcherItems: Array<{
    action: NewAction;
    label: string;
    description: string;
    icon: typeof Ticket;
    disabled?: boolean;
  }> = [
    { action: "ticket", label: "Ticket", description: "Create a support ticket in a board queue.", icon: Ticket, disabled: boardCatalog.length === 0 },
    { action: "email", label: "Email", description: "Log an outbound email as a ticket record.", icon: Mail, disabled: boardCatalog.length === 0 },
    { action: "message", label: "Message", description: "Capture a chat conversation as a ticket.", icon: MessageSquare, disabled: boardCatalog.length === 0 },
    { action: "contact", label: "Contact", description: "Add a contact to an existing or new company profile.", icon: UserRoundPlus },
    { action: "company", label: "Company", description: "Create a company profile in the CRM.", icon: Building2 },
    { action: "agent", label: "Agent", description: "Invite a teammate to a board with a board role.", icon: UserPlus, disabled: boardCatalog.length === 0 },
  ];

  const actionMeta = {
    ticket: {
      title: "New ticket",
      description: "Create a Freshdesk-style ticket and attach it to a board queue in this CRM.",
      onSubmit: handleSubmitTicket,
    },
    email: {
      title: "Send an email",
      description: "This logs the outbound email as a ticket record so the conversation stays inside the inbox.",
      onSubmit: handleSubmitEmail,
    },
    message: {
      title: "Message",
      description: "Capture a messaging conversation and route it into the right board queue.",
      onSubmit: handleSubmitMessage,
    },
    contact: {
      title: "Add contact",
      description: "Save the contact under an existing company, or create a company profile on the fly.",
      onSubmit: handleSubmitContact,
    },
    company: {
      title: "Add company",
      description: "Create a company profile your team can reuse during intake and board setup.",
      onSubmit: handleSubmitCompany,
    },
    agent: {
      title: "Invite agent",
      description: "Invite a teammate to a board. This project currently supports board roles rather than global Freshdesk agent roles.",
      onSubmit: handleSubmitAgent,
    },
  } satisfies Record<NewAction, { title: string; description: string; onSubmit: (event: FormEvent) => void | Promise<void> }>;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="rounded-2xl border-[#D9E5F4] bg-white px-4">
            <BadgePlus className="mr-1 h-4 w-4" />
            New
            <ChevronDown className="ml-1 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[320px] rounded-[20px] border-[#D9E5F4] p-2">
          {launcherItems.map((item, index) => (
            <div key={item.action}>
              {index === 3 ? <DropdownMenuSeparator className="bg-[#EEF4FB]" /> : null}
              <DropdownMenuItem
                disabled={item.disabled}
                onClick={() => !item.disabled && openAction(item.action)}
                className="rounded-2xl px-3 py-3 text-[#102A43] focus:bg-[#F4F8FF] focus:text-[#102A43]"
              >
                <item.icon className="h-4 w-4 text-[#2063E9]" />
                <div className="min-w-0">
                  <div className="font-medium">{item.label}</div>
                  <div className="text-xs text-[#6B7C93]">{item.description}</div>
                </div>
              </DropdownMenuItem>
            </div>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Sheet open={Boolean(activeAction)} onOpenChange={(nextOpen) => !nextOpen && closeSheet()}>
        <SheetContent side="right" className="w-full border-l border-[#D9E5F4] bg-[#F8FBFF] p-0 sm:max-w-[760px]">
          {activeAction ? (
            <form onSubmit={actionMeta[activeAction].onSubmit} className="flex h-full min-h-0 flex-col">
              <SheetHeader className="border-b border-[#D9E5F4] bg-white px-6 py-5">
                <SheetTitle className="text-[32px] font-semibold tracking-tight text-[#102A43]">{actionMeta[activeAction].title}</SheetTitle>
                <SheetDescription className="text-sm text-[#52667A]">{actionMeta[activeAction].description}</SheetDescription>
              </SheetHeader>

              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
                {activeAction === "ticket" ? (
                  <div className="space-y-6">
                    <FieldGrid>
                      <Field label="Board" required>
                        <select
                          value={ticketDraft.boardId}
                          onChange={(e) => setTicketDraft((prev) => ({ ...prev, boardId: e.target.value, listId: getDefaultListId(boardCatalog, e.target.value), agentId: "" }))}
                          className={selectClassName}
                        >
                          <option value="">Choose a board</option>
                          {boardCatalog.map((entry) => <option key={entry.board._id} value={entry.board._id}>{entry.board.title}</option>)}
                        </select>
                      </Field>
                      <Field label="Queue" required>
                        <select value={ticketDraft.listId} onChange={(e) => setTicketDraft((prev) => ({ ...prev, listId: e.target.value }))} className={selectClassName}>
                          <option value="">Choose a queue</option>
                          {ticketBoardLists.map((list) => <option key={list._id} value={list._id}>{list.title}</option>)}
                        </select>
                      </Field>
                    </FieldGrid>

                    <Field label="Contact">
                      <Input value={ticketDraft.requester} onChange={(e) => setTicketDraft((prev) => ({ ...prev, requester: e.target.value }))} placeholder="name@company.com" className={inputClassName} />
                    </Field>

                    <Field label="Company">
                      <Input list="freshdesk-company-options" value={ticketDraft.companyName} onChange={(e) => setTicketDraft((prev) => ({ ...prev, companyName: e.target.value }))} placeholder="Select or type a company" className={inputClassName} />
                    </Field>

                    <Field label="Subject" required>
                      <Input value={ticketDraft.subject} onChange={(e) => setTicketDraft((prev) => ({ ...prev, subject: e.target.value }))} placeholder="Reservation follow-up for Hilton booking" className={inputClassName} />
                    </Field>

                    <FieldGrid>
                      <Field label="Type">
                        <Input value={ticketDraft.type} onChange={(e) => setTicketDraft((prev) => ({ ...prev, type: e.target.value }))} className={inputClassName} />
                      </Field>
                      <Field label="Source">
                        <Input value={ticketDraft.source} onChange={(e) => setTicketDraft((prev) => ({ ...prev, source: e.target.value }))} className={inputClassName} />
                      </Field>
                    </FieldGrid>

                    <FieldGrid>
                      <Field label="Status">
                        <select value={ticketDraft.status} onChange={(e) => setTicketDraft((prev) => ({ ...prev, status: e.target.value }))} className={selectClassName}>
                          {TRAVEL_TICKET_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                        </select>
                      </Field>
                      <Field label="Priority">
                        <select value={ticketDraft.priority} onChange={(e) => setTicketDraft((prev) => ({ ...prev, priority: e.target.value }))} className={selectClassName}>
                          {PRIORITY_OPTIONS.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                        </select>
                      </Field>
                    </FieldGrid>

                    <FieldGrid>
                      <Field label="Group">
                        <Input value={ticketDraft.group} onChange={(e) => setTicketDraft((prev) => ({ ...prev, group: e.target.value }))} className={inputClassName} />
                      </Field>
                      <Field label="Agent">
                        <select value={ticketDraft.agentId} onChange={(e) => setTicketDraft((prev) => ({ ...prev, agentId: e.target.value }))} className={selectClassName}>
                          <option value="">Unassigned</option>
                          {ticketAgents.map((member) => <option key={member._id} value={member._id}>{member.username}</option>)}
                        </select>
                      </Field>
                    </FieldGrid>

                    <Field label="Description">
                      <Textarea value={ticketDraft.description} onChange={(e) => setTicketDraft((prev) => ({ ...prev, description: e.target.value }))} placeholder="Add the main issue, booking details, and the next action for the team." className="min-h-[180px] rounded-[20px] border-[#D9E5F4] bg-white px-4 py-3 shadow-none" />
                    </Field>
                  </div>
                ) : null}

                {activeAction === "email" ? (
                  <div className="space-y-6">
                    <FieldGrid>
                      <Field label="Board" required>
                        <select
                          value={emailDraft.boardId}
                          onChange={(e) => setEmailDraft((prev) => ({ ...prev, boardId: e.target.value, listId: getDefaultListId(boardCatalog, e.target.value), agentId: "" }))}
                          className={selectClassName}
                        >
                          <option value="">Choose a board</option>
                          {boardCatalog.map((entry) => <option key={entry.board._id} value={entry.board._id}>{entry.board.title}</option>)}
                        </select>
                      </Field>
                      <Field label="Queue" required>
                        <select value={emailDraft.listId} onChange={(e) => setEmailDraft((prev) => ({ ...prev, listId: e.target.value }))} className={selectClassName}>
                          <option value="">Choose a queue</option>
                          {emailBoardLists.map((list) => <option key={list._id} value={list._id}>{list.title}</option>)}
                        </select>
                      </Field>
                    </FieldGrid>

                    <Field label="To" required>
                      <Input value={emailDraft.to} onChange={(e) => setEmailDraft((prev) => ({ ...prev, to: e.target.value }))} placeholder="client@agency.com" className={inputClassName} />
                    </Field>

                    <Field label="Company">
                      <Input list="freshdesk-company-options" value={emailDraft.companyName} onChange={(e) => setEmailDraft((prev) => ({ ...prev, companyName: e.target.value }))} placeholder="Attach a company if known" className={inputClassName} />
                    </Field>

                    <Field label="Subject" required>
                      <Input value={emailDraft.subject} onChange={(e) => setEmailDraft((prev) => ({ ...prev, subject: e.target.value }))} className={inputClassName} />
                    </Field>

                    <FieldGrid>
                      <Field label="Status">
                        <select value={emailDraft.status} onChange={(e) => setEmailDraft((prev) => ({ ...prev, status: e.target.value }))} className={selectClassName}>
                          {TRAVEL_TICKET_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                        </select>
                      </Field>
                      <Field label="Priority">
                        <select value={emailDraft.priority} onChange={(e) => setEmailDraft((prev) => ({ ...prev, priority: e.target.value }))} className={selectClassName}>
                          {PRIORITY_OPTIONS.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                        </select>
                      </Field>
                    </FieldGrid>

                    <FieldGrid>
                      <Field label="Group">
                        <Input value={emailDraft.group} onChange={(e) => setEmailDraft((prev) => ({ ...prev, group: e.target.value }))} className={inputClassName} />
                      </Field>
                      <Field label="Agent">
                        <select value={emailDraft.agentId} onChange={(e) => setEmailDraft((prev) => ({ ...prev, agentId: e.target.value }))} className={selectClassName}>
                          <option value="">Unassigned</option>
                          {emailAgents.map((member) => <option key={member._id} value={member._id}>{member.username}</option>)}
                        </select>
                      </Field>
                    </FieldGrid>

                    <Field label="Description" required>
                      <Textarea value={emailDraft.body} onChange={(e) => setEmailDraft((prev) => ({ ...prev, body: e.target.value }))} placeholder="Write the outbound email body here..." className="min-h-[220px] rounded-[20px] border-[#D9E5F4] bg-white px-4 py-3 shadow-none" />
                    </Field>
                  </div>
                ) : null}

                {activeAction === "message" ? (
                  <div className="space-y-6">
                    <FieldGrid>
                      <Field label="Board" required>
                        <select
                          value={messageDraft.boardId}
                          onChange={(e) => setMessageDraft((prev) => ({ ...prev, boardId: e.target.value, listId: getDefaultListId(boardCatalog, e.target.value), agentId: "" }))}
                          className={selectClassName}
                        >
                          <option value="">Choose a board</option>
                          {boardCatalog.map((entry) => <option key={entry.board._id} value={entry.board._id}>{entry.board.title}</option>)}
                        </select>
                      </Field>
                      <Field label="Queue" required>
                        <select value={messageDraft.listId} onChange={(e) => setMessageDraft((prev) => ({ ...prev, listId: e.target.value }))} className={selectClassName}>
                          <option value="">Choose a queue</option>
                          {messageBoardLists.map((list) => <option key={list._id} value={list._id}>{list.title}</option>)}
                        </select>
                      </Field>
                    </FieldGrid>

                    <Field label="Source">
                      <select value={messageDraft.source} onChange={(e) => setMessageDraft((prev) => ({ ...prev, source: e.target.value }))} className={selectClassName}>
                        {MESSAGE_SOURCE_OPTIONS.map((source) => <option key={source} value={source}>{source}</option>)}
                      </select>
                    </Field>

                    <Field label="Contact" required>
                      <Input value={messageDraft.contact} onChange={(e) => setMessageDraft((prev) => ({ ...prev, contact: e.target.value }))} placeholder="Phone, email, or contact name" className={inputClassName} />
                    </Field>

                    <Field label="Company">
                      <Input list="freshdesk-company-options" value={messageDraft.companyName} onChange={(e) => setMessageDraft((prev) => ({ ...prev, companyName: e.target.value }))} placeholder="Attach a company if known" className={inputClassName} />
                    </Field>

                    <Field label="Subject">
                      <Input value={messageDraft.subject} onChange={(e) => setMessageDraft((prev) => ({ ...prev, subject: e.target.value }))} placeholder="Optional short summary" className={inputClassName} />
                    </Field>

                    <FieldGrid>
                      <Field label="Status">
                        <select value={messageDraft.status} onChange={(e) => setMessageDraft((prev) => ({ ...prev, status: e.target.value }))} className={selectClassName}>
                          {TRAVEL_TICKET_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                        </select>
                      </Field>
                      <Field label="Priority">
                        <select value={messageDraft.priority} onChange={(e) => setMessageDraft((prev) => ({ ...prev, priority: e.target.value }))} className={selectClassName}>
                          {PRIORITY_OPTIONS.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                        </select>
                      </Field>
                    </FieldGrid>

                    <FieldGrid>
                      <Field label="Group">
                        <Input value={messageDraft.group} onChange={(e) => setMessageDraft((prev) => ({ ...prev, group: e.target.value }))} className={inputClassName} />
                      </Field>
                      <Field label="Agent">
                        <select value={messageDraft.agentId} onChange={(e) => setMessageDraft((prev) => ({ ...prev, agentId: e.target.value }))} className={selectClassName}>
                          <option value="">Unassigned</option>
                          {messageAgents.map((member) => <option key={member._id} value={member._id}>{member.username}</option>)}
                        </select>
                      </Field>
                    </FieldGrid>

                    <Field label="Description" required>
                      <Textarea value={messageDraft.body} onChange={(e) => setMessageDraft((prev) => ({ ...prev, body: e.target.value }))} placeholder="Paste or write the message body here..." className="min-h-[220px] rounded-[20px] border-[#D9E5F4] bg-white px-4 py-3 shadow-none" />
                    </Field>
                  </div>
                ) : null}
                
                {activeAction === "contact" ? (
                  <div className="space-y-6">
                    <Field label="Company">
                      <select value={contactDraft.customerId} onChange={(e) => setContactDraft((prev) => ({ ...prev, customerId: e.target.value, companyName: e.target.value ? "" : prev.companyName }))} className={selectClassName} disabled={isLoadingCustomers}>
                        <option value="">Create under a new company</option>
                        {companyOptions.map((customer) => <option key={customer._id} value={customer._id}>{customer.agencyName}</option>)}
                      </select>
                    </Field>

                    {!contactDraft.customerId ? (
                      <Field label="New company name" required>
                        <Input value={contactDraft.companyName} onChange={(e) => setContactDraft((prev) => ({ ...prev, companyName: e.target.value }))} placeholder="Mostafa Travel Group" className={inputClassName} />
                      </Field>
                    ) : null}

                    <FieldGrid>
                      <Field label="Full name" required>
                        <Input value={contactDraft.name} onChange={(e) => setContactDraft((prev) => ({ ...prev, name: e.target.value }))} placeholder="Ahmed Mostafa" className={inputClassName} />
                      </Field>
                      <Field label="Role">
                        <select value={contactDraft.role} onChange={(e) => setContactDraft((prev) => ({ ...prev, role: e.target.value as AgencyContactRole }))} className={selectClassName}>
                          {CONTACT_ROLE_OPTIONS.map((role) => <option key={role} value={role}>{role}</option>)}
                        </select>
                      </Field>
                    </FieldGrid>

                    <Field label="Email" required>
                      <Input value={contactDraft.email} onChange={(e) => setContactDraft((prev) => ({ ...prev, email: e.target.value }))} placeholder="contact@company.com" className={inputClassName} />
                    </Field>

                    <FieldGrid>
                      <Field label="Mobile phone">
                        <Input value={contactDraft.mobilePhone} onChange={(e) => setContactDraft((prev) => ({ ...prev, mobilePhone: e.target.value }))} placeholder="+20 100 000 0000" className={inputClassName} />
                      </Field>
                      <Field label="Work phone">
                        <Input value={contactDraft.workPhone} onChange={(e) => setContactDraft((prev) => ({ ...prev, workPhone: e.target.value }))} placeholder="+20 2 0000 0000" className={inputClassName} />
                      </Field>
                    </FieldGrid>
                  </div>
                ) : null}

                {activeAction === "company" ? (
                  <div className="space-y-6">
                    <Field label="Company name" required>
                      <Input value={companyDraft.companyName} onChange={(e) => setCompanyDraft((prev) => ({ ...prev, companyName: e.target.value }))} placeholder="ma5131" className={inputClassName} />
                    </Field>

                    <FieldGrid>
                      <Field label="Primary email">
                        <Input value={companyDraft.email} onChange={(e) => setCompanyDraft((prev) => ({ ...prev, email: e.target.value }))} placeholder="ops@company.com" className={inputClassName} />
                      </Field>
                      <Field label="Location">
                        <Input value={companyDraft.location} onChange={(e) => setCompanyDraft((prev) => ({ ...prev, location: e.target.value }))} placeholder="Cairo" className={inputClassName} />
                      </Field>
                    </FieldGrid>

                    <Field label="Decision role">
                      <select value={companyDraft.decisionRole} onChange={(e) => setCompanyDraft((prev) => ({ ...prev, decisionRole: e.target.value as CustomerDecisionRole }))} className={selectClassName}>
                        {DECISION_ROLE_OPTIONS.map((role) => <option key={role} value={role}>{role}</option>)}
                      </select>
                    </Field>

                    <Field label="Notes">
                      <Textarea value={companyDraft.notes} onChange={(e) => setCompanyDraft((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Add operating notes, account context, or escalation guidance." className="min-h-[200px] rounded-[20px] border-[#D9E5F4] bg-white px-4 py-3 shadow-none" />
                    </Field>
                  </div>
                ) : null}

                {activeAction === "agent" ? (
                  <div className="space-y-6">
                    <Field label="Board" required>
                      <select value={agentDraft.boardId} onChange={(e) => setAgentDraft((prev) => ({ ...prev, boardId: e.target.value }))} className={selectClassName}>
                        <option value="">Choose a board</option>
                        {boardCatalog.map((entry) => <option key={entry.board._id} value={entry.board._id}>{entry.board.title}</option>)}
                      </select>
                    </Field>

                    <Field label="Email" required>
                      <Input value={agentDraft.email} onChange={(e) => setAgentDraft((prev) => ({ ...prev, email: e.target.value }))} placeholder="agent@company.com" className={inputClassName} />
                    </Field>

                    <Field label="Board role">
                      <select value={agentDraft.role} onChange={(e) => setAgentDraft((prev) => ({ ...prev, role: e.target.value as BoardRole }))} className={selectClassName}>
                        {BOARD_ROLE_OPTIONS.map((role) => <option key={role} value={role}>{role}</option>)}
                      </select>
                    </Field>

                    <div className="rounded-[24px] border border-[#D9E5F4] bg-white p-4 text-sm text-[#52667A]">
                      This uses the existing board invite flow in the CRM. If you want Freshdesk-style global agent roles,
                      we can add the backend model for that next.
                    </div>
                  </div>
                ) : null}
              </div>

              <SheetFooter className="border-t border-[#D9E5F4] bg-white px-6 py-4 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={closeSheet} className="rounded-2xl border-[#D9E5F4] bg-white px-5">
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving} className="rounded-2xl bg-[#2063E9] px-5 text-white hover:bg-[#164FC0]">
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {activeAction === "company" ? "Create company" : activeAction === "contact" ? "Add contact" : activeAction === "agent" ? "Invite agent" : "Create"}
                </Button>
              </SheetFooter>
            </form>
          ) : null}
        </SheetContent>
      </Sheet>

      <datalist id="freshdesk-company-options">
        {companyOptions.map((customer) => <option key={customer._id} value={customer.agencyName} />)}
      </datalist>
    </>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-medium text-[#102A43]">
        {label}
        {required ? <span className="text-[#D64545]"> *</span> : null}
      </div>
      {children}
    </label>
  );
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2">{children}</div>;
}
