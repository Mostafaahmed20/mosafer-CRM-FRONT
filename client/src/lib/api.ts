const API_URL = import.meta.env.VITE_API_URL || "";

export type BoardRole = "admin" | "member" | "observer" | "guest";

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message || "Request failed");
  }
  return response.json();
}

// Board API
export const boardApi = {
  getAll: async () => {
    const response = await fetch(`${API_URL}/api/boards`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  getById: async (id: string) => {
    const response = await fetch(`${API_URL}/api/boards/${id}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  create: async (data: { title: string; description?: string; background?: string }) => {
    const response = await fetch(`${API_URL}/api/boards`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  update: async (id: string, data: { title?: string; description?: string; background?: string }) => {
    const response = await fetch(`${API_URL}/api/boards/${id}`, {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  delete: async (id: string) => {
    const response = await fetch(`${API_URL}/api/boards/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  addMember: async (boardId: string, email: string, role: BoardRole = "member") => {
    const response = await fetch(`${API_URL}/api/boards/${boardId}/members`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ email, role }),
    });
    return handleResponse(response);
  },

  updateMemberRole: async (boardId: string, userId: string, role: BoardRole) => {
    const response = await fetch(`${API_URL}/api/boards/${boardId}/members/${userId}`, {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify({ role }),
    });
    return handleResponse(response);
  },

  removeMember: async (boardId: string, userId: string) => {
    const response = await fetch(`${API_URL}/api/boards/${boardId}/members/${userId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  getArchivedCards: async (boardId: string) => {
    const response = await fetch(`${API_URL}/api/boards/${boardId}/archived-cards`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  restoreArchivedCard: async (boardId: string, cardId: string) => {
    const response = await fetch(`${API_URL}/api/boards/${boardId}/archived-cards/${cardId}/restore`, {
      method: "PATCH",
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  deleteArchivedCard: async (boardId: string, cardId: string) => {
    const response = await fetch(`${API_URL}/api/boards/${boardId}/archived-cards/${cardId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },
};

// List API
export const listApi = {
  getByBoard: async (boardId: string) => {
    const response = await fetch(`${API_URL}/api/boards/${boardId}/lists`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  create: async (boardId: string, data: { title: string; position?: number }) => {
    const response = await fetch(`${API_URL}/api/boards/${boardId}/lists`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  update: async (boardId: string, listId: string, data: { title?: string; position?: number }) => {
    const response = await fetch(`${API_URL}/api/boards/${boardId}/lists/${listId}`, {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  delete: async (boardId: string, listId: string) => {
    const response = await fetch(`${API_URL}/api/boards/${boardId}/lists/${listId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  reorder: async (boardId: string, lists: { _id: string; position: number }[]) => {
    const response = await fetch(`${API_URL}/api/boards/${boardId}/lists/reorder`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ lists }),
    });
    return handleResponse(response);
  },
};

// Card API
export type CardCreateData = {
  title: string;
  description?: string;
  bookingRef?: string;
  agencyName?: string;
  hotelName?: string;
  source?: string;
  type?: string;
  checkInDate?: string;
  checkOutDate?: string;
  arrivalDate?: string;
  status?: string;
};

export const cardApi = {
  create: async (boardId: string, listId: string, data: CardCreateData) => {
    const response = await fetch(`${API_URL}/api/boards/${boardId}/lists/${listId}/cards`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  getById: async (boardId: string, listId: string, cardId: string) => {
    const response = await fetch(`${API_URL}/api/boards/${boardId}/lists/${listId}/cards/${cardId}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  update: async (
    boardId: string,
    listId: string,
    cardId: string,
    data: Partial<CardUpdateData>
  ) => {
    const response = await fetch(`${API_URL}/api/boards/${boardId}/lists/${listId}/cards/${cardId}`, {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  delete: async (boardId: string, listId: string, cardId: string) => {
    const response = await fetch(`${API_URL}/api/boards/${boardId}/lists/${listId}/cards/${cardId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  reorder: async (
    boardId: string,
    listId: string,
    data: { cardId: string; newPosition: number; newListId?: string }
  ) => {
    const response = await fetch(`${API_URL}/api/boards/${boardId}/lists/${listId}/cards/reorder`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  addComment: async (boardId: string, listId: string, cardId: string, text: string) => {
    const response = await fetch(`${API_URL}/api/boards/${boardId}/lists/${listId}/cards/${cardId}/comments`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ text }),
    });
    return handleResponse(response);
  },

  editComment: async (boardId: string, listId: string, cardId: string, commentId: string, text: string) => {
    const response = await fetch(
      `${API_URL}/api/boards/${boardId}/lists/${listId}/cards/${cardId}/comments/${commentId}`,
      {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ text }),
      }
    );
    return handleResponse(response);
  },

  deleteComment: async (boardId: string, listId: string, cardId: string, commentId: string) => {
    const response = await fetch(
      `${API_URL}/api/boards/${boardId}/lists/${listId}/cards/${cardId}/comments/${commentId}`,
      {
        method: "DELETE",
        headers: getAuthHeaders(),
      }
    );
    return handleResponse(response);
  },

  addAttachment: async (boardId: string, listId: string, cardId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const token = localStorage.getItem("token");
    const response = await fetch(
      `${API_URL}/api/boards/${boardId}/lists/${listId}/cards/${cardId}/attachments`,
      {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      }
    );
    return handleResponse(response);
  },

  deleteAttachment: async (boardId: string, listId: string, cardId: string, attachmentId: string) => {
    const response = await fetch(
      `${API_URL}/api/boards/${boardId}/lists/${listId}/cards/${cardId}/attachments/${attachmentId}`,
      {
        method: "DELETE",
        headers: getAuthHeaders(),
      }
    );
    return handleResponse(response);
  },
};

// Activity API
export const activityApi = {
  getBoardActivity: async (
    boardId: string,
    params?: { listId?: string; cardId?: string; limit?: number }
  ) => {
    const query = new URLSearchParams();
    if (params?.listId) query.set("listId", params.listId);
    if (params?.cardId) query.set("cardId", params.cardId);
    if (params?.limit) query.set("limit", String(params.limit));
    const qs = query.toString();
    const response = await fetch(
      `${API_URL}/api/boards/${boardId}/activity${qs ? `?${qs}` : ""}`,
      {
        headers: getAuthHeaders(),
      }
    );
    return handleResponse(response);
  },
};

// Board Chat API
export const chatApi = {
  getMessages: async (boardId: string, params?: { limit?: number; before?: string }) => {
    const query = new URLSearchParams();
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.before) query.set("before", params.before);
    const qs = query.toString();
    const response = await fetch(
      `${API_URL}/api/boards/${boardId}/messages${qs ? `?${qs}` : ""}`,
      { headers: getAuthHeaders() }
    );
    return handleResponse(response);
  },

  createMessage: async (boardId: string, body: string) => {
    const response = await fetch(`${API_URL}/api/boards/${boardId}/messages`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ body }),
    });
    return handleResponse(response);
  },
};

// Types
export type Label = {
  _id?: string;
  color: LabelColor;
  text: string;
};

export type LabelColor = 
  | "green" 
  | "yellow" 
  | "orange" 
  | "red" 
  | "purple" 
  | "blue" 
  | "sky" 
  | "lime" 
  | "pink" 
  | "black";

export type ChecklistItem = {
  _id?: string;
  text: string;
  completed: boolean;
};

export type Checklist = {
  _id?: string;
  title: string;
  items: ChecklistItem[];
};

export type ServiceOrder = {
  _id?: string;
  service: string;
  quantity: number;
  price: number;
  currency: string;
  status: "Requested" | "In Progress" | "Completed" | "Cancelled";
  paymentStatus: "Unpaid" | "Partially paid" | "Paid";
  notes?: string;
};

export type Comment = {
  _id: string;
  text: string;
  author: { _id: string; username: string; email: string };
  createdAt: string;
};

export type Attachment = {
  _id?: string;
  name: string;
  url: string;
  type: string;
};

export type Member = {
  _id: string;
  username: string;
  email: string;
};

export type BoardMember = {
  user: Member;
  role: BoardRole;
};

export type Card = {
  _id: string;
  title: string;
  subject?: string;
  requester?: string;
  bookingRef?: string;
  agencyName?: string;
  hotelName?: string;
  supplierName?: string;
  supplierConfirmationNumber?: string;
  hotelConfirmationNumber?: string;
  voucherNumber?: string;
  checkInDate?: string;
  checkOutDate?: string;
  arrivalDate?: string;
  paymentStatus?: string;
  coveringStatus?: "Requested" | "Paid by VCC" | "Invoiced to agency";
  netPaidToHotel?: number;
  sellToAgency?: number;
  type?: string;
  status?: string;
  priority?: string;
  group?: string;
  agent?: Member;
  source?: string;
  handoverStatus?: "Not set" | "Resolved in shift" | "Pending for next shift";
  handoverSummary?: string;
  handoverDone?: string;
  handoverPending?: string;
  handoverPendingState?: "Yes" | "No";
  handoverBlocker?: string;
  handoverNextAction?: string;
  handoverNextOwner?: Member | string;
  handoverUpdatedAt?: string;
  handoverUpdatedBy?: Member;
  handoverReminderSentAt?: string;
  handoverReminderCount?: number;
  description?: string;
  list: string;
  creator: Member;
  position: number;
  dueDate?: string;
  dueComplete?: boolean;
  labels: Label[];
  members: Member[];
  comments: Comment[];
  attachments: Attachment[];
  checklists: Checklist[];
  serviceOrders?: ServiceOrder[];
  cover?: string;
  archived?: boolean;
  slaType?: string;
  slaDueAt?: string;
  slaStartedAt?: string;
  slaStatus?: "Open" | "Breached" | "Met" | "N/A";
  pinned?: boolean;
};

export type CardUpdateData = {
  title?: string;
  subject?: string;
  requester?: string;
  bookingRef?: string;
  agencyName?: string;
  hotelName?: string;
  supplierName?: string;
  supplierConfirmationNumber?: string;
  hotelConfirmationNumber?: string;
  voucherNumber?: string;
  checkInDate?: string | null;
  checkOutDate?: string | null;
  arrivalDate?: string | null;
  paymentStatus?: string;
  coveringStatus?: "Requested" | "Paid by VCC" | "Invoiced to agency";
  netPaidToHotel?: number;
  sellToAgency?: number;
  type?: string;
  status?: string;
  priority?: string;
  group?: string;
  agent?: string | null;
  source?: string;
  handoverStatus?: "Not set" | "Resolved in shift" | "Pending for next shift";
  handoverSummary?: string;
  handoverDone?: string;
  handoverPending?: string;
  handoverPendingState?: "Yes" | "No";
  handoverBlocker?: string;
  handoverNextAction?: string;
  handoverNextOwner?: string | null;
  description?: string;
  dueDate?: string | null;
  dueComplete?: boolean;
  labels?: Label[];
  checklists?: Checklist[];
  serviceOrders?: ServiceOrder[];
  cover?: string | null;
  archived?: boolean;
  members?: string[];
  slaType?: string;
  pinned?: boolean;
};

export type List = {
  _id: string;
  title: string;
  board: string;
  position: number;
  cards: Card[];
  archived?: boolean;
};

export type Board = {
  _id: string;
  title: string;
  description?: string;
  background: string;
  owner: Member;
  members: BoardMember[];
  lists: List[];
  labels: Label[];
  createdAt: string;
  updatedAt: string;
};

export type Activity = {
  _id: string;
  board: string;
  list?: string;
  card?: string;
  actor: Member;
  type: string;
  message: string;
  meta?: Record<string, unknown>;
  createdAt: string;
};

export type ChatMessage = {
  _id: string;
  board: string;
  author: Member;
  body: string;
  createdAt: string;
  updatedAt: string;
};

// Label color utilities
export const LABEL_COLORS: { color: LabelColor; name: string; bg: string; bgLight: string }[] = [
  { color: "green", name: "Green", bg: "#61BD4F", bgLight: "#61BD4F33" },
  { color: "yellow", name: "Yellow", bg: "#F2D600", bgLight: "#F2D60033" },
  { color: "orange", name: "Orange", bg: "#FF9F1A", bgLight: "#FF9F1A33" },
  { color: "red", name: "Red", bg: "#EB5A46", bgLight: "#EB5A4633" },
  { color: "purple", name: "Purple", bg: "#C377E0", bgLight: "#C377E033" },
  { color: "blue", name: "Blue", bg: "#0079BF", bgLight: "#0079BF33" },
  { color: "sky", name: "Sky", bg: "#00C2E0", bgLight: "#00C2E033" },
  { color: "lime", name: "Lime", bg: "#51E898", bgLight: "#51E89833" },
  { color: "pink", name: "Pink", bg: "#FF78CB", bgLight: "#FF78CB33" },
  { color: "black", name: "Black", bg: "#344563", bgLight: "#34456333" },
];

export const TRAVEL_TICKET_STATUSES = [
  "New",
  "In Progress",
  "Pending Supplier",
  "Pending Client",
  "Completed",
  "Closed",
  "Cancelled",
  // Legacy statuses for older cards
  "Requested",
  "Quoted",
  "Optioned",
  "Confirmed",
  "Reconfirmed",
  "In-house",
];

export const TRAVEL_PAYMENT_STATUSES = [
  "Not required",
  "Pending",
  "Partially paid",
  "Paid",
];

export function getLabelColor(color: LabelColor) {
  return LABEL_COLORS.find((l) => l.color === color) || LABEL_COLORS[0];
}

export function getDueDateStatus(dueDate: string, dueComplete?: boolean): "overdue" | "soon" | "complete" | "default" {
  if (dueComplete) return "complete";
  
  const due = new Date(dueDate);
  const now = new Date();
  const diffHours = (due.getTime() - now.getTime()) / (1000 * 60 * 60);
  
  if (diffHours < 0) return "overdue";
  if (diffHours < 24) return "soon";
  return "default";
}

export function formatDueDate(dueDate: string): string {
  const date = new Date(dueDate);
  const now = new Date();
  const isThisYear = date.getFullYear() === now.getFullYear();
  
  const options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    ...(isThisYear ? {} : { year: "numeric" }),
  };
  
  return date.toLocaleDateString("en-US", options);
}

export function getChecklistProgress(checklists: Checklist[]): { completed: number; total: number; percentage: number } {
  let completed = 0;
  let total = 0;

  checklists.forEach((checklist) => {
    checklist.items.forEach((item) => {
      total++;
      if (item.completed) completed++;
    });
  });

  return {
    completed,
    total,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}

// Permission utilities
const ROLE_HIERARCHY: Record<BoardRole, number> = {
  admin: 4,
  member: 3,
  guest: 2,
  observer: 1,
};

export function hasMinRole(userRole: BoardRole | undefined, minRole: BoardRole): boolean {
  if (!userRole) return false;
  return (ROLE_HIERARCHY[userRole] || 0) >= (ROLE_HIERARCHY[minRole] || 0);
}

export function canManageMembers(role?: BoardRole): boolean {
  return role === "admin";
}

export function canEditBoard(role?: BoardRole): boolean {
  return role === "admin";
}

export function canDeleteBoard(role?: BoardRole): boolean {
  return role === "admin";
}

export function canCreateList(role?: BoardRole): boolean {
  return hasMinRole(role, "member");
}

export function canEditList(role?: BoardRole): boolean {
  return hasMinRole(role, "member");
}

export function canDeleteList(role?: BoardRole): boolean {
  return hasMinRole(role, "member");
}

export function canCreateCard(role?: BoardRole): boolean {
  return hasMinRole(role, "guest");
}

export function canEditCard(role?: BoardRole): boolean {
  return hasMinRole(role, "guest");
}

export function canDeleteCard(role?: BoardRole, card?: Card, currentUserId?: string): boolean {
  void card;
  void currentUserId;
  return role === "admin";
}

export function canComment(role?: BoardRole): boolean {
  return hasMinRole(role, "guest");
}

export function canDragCards(role?: BoardRole): boolean {
  return hasMinRole(role, "member");
}

export function canManageCardMembers(role?: BoardRole): boolean {
  return hasMinRole(role, "member");
}

export function getRoleBadgeColor(role: BoardRole): string {
  switch (role) {
    case "admin": return "#6366F1";   // Indigo
    case "member": return "#10B981";  // Emerald
    case "guest": return "#F59E0B";   // Amber
    case "observer": return "#64748B"; // Slate
  }
}

export function getRoleLabel(role: BoardRole): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

// Notification Types
export type NotificationType =
  | "comment"
  | "mention"
  | "card_assigned"
  | "board_invite"
  | "card_moved"
  | "due_date"
  | "activity";

export type Notification = {
  _id: string;
  recipient: string;
  sender: Member;
  type: NotificationType;
  card?: { _id: string; title: string };
  board?: { _id: string; title: string };
  message: string;
  commentText?: string;
  read: boolean;
  createdAt: string;
};

// Notification API
export const notificationApi = {
  getAll: async () => {
    const response = await fetch(`${API_URL}/api/notifications`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  getUnreadCount: async () => {
    const response = await fetch(`${API_URL}/api/notifications/unread-count`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  markAsRead: async (id: string) => {
    const response = await fetch(`${API_URL}/api/notifications/${id}/read`, {
      method: "PATCH",
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  markAllAsRead: async () => {
    const response = await fetch(`${API_URL}/api/notifications/mark-all-read`, {
      method: "PATCH",
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  delete: async (id: string) => {
    const response = await fetch(`${API_URL}/api/notifications/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },
};
