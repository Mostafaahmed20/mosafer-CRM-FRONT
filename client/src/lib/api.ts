const API_URL = import.meta.env.VITE_API_URL || "";
const IS_PROD = import.meta.env.PROD;

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

export type CustomerDecisionRole =
  | "Group Admin"
  | "CEO"
  | "Manager"
  | "Decision Maker"
  | "Owner"
  | "Operations";

export type CustomerTag = "VIP" | "Risky" | "Prepaid" | "Blacklist Watch";

export type AgencyContactRole =
  | "CEO"
  | "Manager"
  | "Operations"
  | "Accounting"
  | "Sales"
  | "Reservations"
  | "Owner"
  | "Other";

export type CustomerContact = {
  id: string;
  name: string;
  email: string;
  role: AgencyContactRole;
  phone?: string;
};

export type CustomerHistoryEvent = {
  id: string;
  action: string;
  at: string;
};

export type CustomerProfile = {
  _id: string;
  agencyName: string;
  location: string;
  email: string;
  decisionRole: CustomerDecisionRole;
  tags: CustomerTag[];
  contacts: CustomerContact[];
  notes?: string;
  history: CustomerHistoryEvent[];
  createdAt: string;
  updatedAt: string;
};

type CustomerCreateData = {
  agencyName: string;
  location: string;
  email: string;
  decisionRole: CustomerDecisionRole;
  tags?: CustomerTag[];
  contacts?: CustomerContact[];
  notes?: string;
};

type CustomerUpdateData = Partial<CustomerCreateData>;

const CUSTOMER_STORAGE_KEY = "crm_customers_v1";

function readLocalCustomers(): CustomerProfile[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CUSTOMER_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeLocalCustomerRecord);
  } catch {
    return [];
  }
}

function writeLocalCustomers(customers: CustomerProfile[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(customers));
}

function localCreateCustomer(data: CustomerCreateData): CustomerProfile {
  const now = new Date().toISOString();
  return {
    _id: `local_${Math.random().toString(36).slice(2, 10)}`,
    agencyName: data.agencyName.trim(),
    location: data.location.trim(),
    email: data.email.trim().toLowerCase(),
    decisionRole: data.decisionRole,
    tags: [...(data.tags || [])],
    contacts: [...(data.contacts || [])],
    notes: data.notes?.trim() || "",
    history: [
      {
        id: `h_${Math.random().toString(36).slice(2, 10)}`,
        action: "Created profile",
        at: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeLocalCustomerRecord(input: any): CustomerProfile {
  const createdAt = input?.createdAt || new Date().toISOString();
  const updatedAt = input?.updatedAt || createdAt;
  return {
    _id: String(input?._id || `local_${Math.random().toString(36).slice(2, 10)}`),
    agencyName: String(input?.agencyName || "").trim(),
    location: String(input?.location || "").trim(),
    email: String(input?.email || "").trim().toLowerCase(),
    decisionRole: (input?.decisionRole || "Decision Maker") as CustomerDecisionRole,
    tags: Array.isArray(input?.tags) ? input.tags : [],
    contacts: Array.isArray(input?.contacts) ? input.contacts : [],
    notes: typeof input?.notes === "string" ? input.notes : "",
    history: Array.isArray(input?.history) ? input.history : [],
    createdAt,
    updatedAt,
  };
}

function normalizeCustomerKey(value: string) {
  return value.trim().toLowerCase();
}

function ensureNoCustomerDuplicate(
  customers: CustomerProfile[],
  data: { agencyName?: string; email?: string },
  ignoreId?: string
) {
  const agencyKey = data.agencyName ? normalizeCustomerKey(data.agencyName) : "";
  const emailKey = data.email ? normalizeCustomerKey(data.email) : "";

  const duplicateAgency = agencyKey
    ? customers.find((c) => c._id !== ignoreId && normalizeCustomerKey(c.agencyName) === agencyKey)
    : null;
  if (duplicateAgency) {
    throw new Error(`Agency already exists: ${duplicateAgency.agencyName}`);
  }

  const duplicateEmail = emailKey
    ? customers.find((c) => c._id !== ignoreId && normalizeCustomerKey(c.email) === emailKey)
    : null;
  if (duplicateEmail) {
    throw new Error(`Email already exists: ${duplicateEmail.email}`);
  }
}

async function tryCustomerApi<T>(request: () => Promise<Response>, fallback: () => T | Promise<T>): Promise<T> {
  try {
    const response = await request();
    if (response.status === 404 || response.status === 501) {
      return await fallback();
    }
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Request failed" }));
      throw new Error(error.message || "Request failed");
    }
    if (response.status === 204) return undefined as T;
    return response.json();
  } catch (error: any) {
    const message = String(error?.message || "");
    const isNetworkLike =
      message.includes("Failed to fetch") ||
      message.includes("NetworkError") ||
      message.includes("fetch");
    if (isNetworkLike || !API_URL) {
      return await fallback();
    }
    throw error;
  }
}

export const customerApi = {
  getAll: async () => {
    return tryCustomerApi<CustomerProfile[]>(
      () =>
        fetch(`${API_URL}/api/customers`, {
          headers: getAuthHeaders(),
        }),
      () => readLocalCustomers()
    );
  },

  create: async (data: CustomerCreateData) => {
    return tryCustomerApi<CustomerProfile>(
      () =>
        fetch(`${API_URL}/api/customers`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify(data),
        }),
      () => {
        const customers = readLocalCustomers();
        ensureNoCustomerDuplicate(customers, data);
        const next = localCreateCustomer(data);
        customers.unshift(next);
        writeLocalCustomers(customers);
        return next;
      }
    );
  },

  update: async (id: string, data: CustomerUpdateData) => {
    return tryCustomerApi<CustomerProfile>(
      () =>
        fetch(`${API_URL}/api/customers/${id}`, {
          method: "PATCH",
          headers: getAuthHeaders(),
          body: JSON.stringify(data),
        }),
      () => {
        const customers = readLocalCustomers();
        const current = customers.find((c) => c._id === id);
        if (!current) throw new Error("Customer profile not found");
        ensureNoCustomerDuplicate(customers, data, id);
        const updated: CustomerProfile = {
          ...current,
          agencyName: data.agencyName?.trim() ?? current.agencyName,
          location: data.location?.trim() ?? current.location,
          email: data.email?.trim().toLowerCase() ?? current.email,
          decisionRole: data.decisionRole ?? current.decisionRole,
          tags: data.tags ? [...data.tags] : current.tags,
          contacts: data.contacts ? [...data.contacts] : current.contacts,
          notes: data.notes !== undefined ? data.notes : current.notes,
          updatedAt: new Date().toISOString(),
        };
        updated.history = [
          ...(current.history || []),
          {
            id: `h_${Math.random().toString(36).slice(2, 10)}`,
            action: "Updated profile",
            at: updated.updatedAt,
          },
        ];
        writeLocalCustomers(customers.map((c) => (c._id === id ? updated : c)));
        return updated;
      }
    );
  },

  delete: async (id: string) => {
    return tryCustomerApi<{ success: true }>(
      () =>
        fetch(`${API_URL}/api/customers/${id}`, {
          method: "DELETE",
          headers: getAuthHeaders(),
        }),
      () => {
        const customers = readLocalCustomers().filter((c) => c._id !== id);
        writeLocalCustomers(customers);
        return { success: true as const };
      }
    );
  },
};

export type AnalyticsRange = "24h" | "7d" | "30d";

export type AnalyticsReportStatus = "good" | "watch" | "risk";

export type AnalyticsTrendPoint = {
  label: string;
  opened: number;
  resolved: number;
  sla: number;
};

export type AnalyticsTeamPoint = {
  team: string;
  closed: number;
  breached: number;
};

export type AnalyticsReportRow = {
  metric: string;
  current: string;
  previous: string;
  delta: number;
  status: AnalyticsReportStatus;
  action: string;
};

export type AnalyticsDashboardData = {
  range: AnalyticsRange;
  generatedAt: string;
  trend: AnalyticsTrendPoint[];
  teams: AnalyticsTeamPoint[];
  reports: {
    operations: AnalyticsReportRow[];
    service: AnalyticsReportRow[];
    efficiency: AnalyticsReportRow[];
  };
  summary: {
    opened: number;
    resolved: number;
    sla: number;
    backlog: number;
    firstResponse: number;
  };
  source: "api" | "mock";
};

export type AnalyticsFilters = {
  team?: string;
  board?: string;
  customer?: string;
  channel?: string;
};

export type AnalyticsFilterOptions = {
  teams: string[];
  boards: string[];
  customers: string[];
  channels: string[];
};

export type AnalyticsDashboardQuery = {
  range?: AnalyticsRange;
  seed?: number;
  filters?: AnalyticsFilters;
};

function generateAnalyticsTrend(range: AnalyticsRange, tick: number): AnalyticsTrendPoint[] {
  const count = range === "24h" ? 24 : range === "7d" ? 7 : 14;
  return Array.from({ length: count }, (_, i) => {
    const base = range === "24h" ? 26 : range === "7d" ? 88 : 74;
    const opened = Math.round(base + Math.sin((i + tick) / 2.2) * 14 + Math.cos((i + tick) / 3) * 7);
    const resolved = Math.round(opened - 5 + Math.cos((i + tick) / 1.8) * 8);
    const sla = Math.max(76, Math.min(99, Math.round(89 + Math.sin((i + tick) / 4) * 5)));
    const label =
      range === "24h"
        ? `${String(i).padStart(2, "0")}:00`
        : range === "7d"
          ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i]
          : `W${i + 1}`;
    return { label, opened: Math.max(8, opened), resolved: Math.max(6, resolved), sla };
  });
}

function generateAnalyticsTeams(tick: number): AnalyticsTeamPoint[] {
  return [
    { team: "Tier 1", closed: 132 + (tick % 8), breached: 6 + (tick % 3) },
    { team: "Tier 2", closed: 96 + ((tick + 2) % 7), breached: 4 + ((tick + 1) % 2) },
    { team: "Ops", closed: 78 + ((tick + 4) % 9), breached: 3 + (tick % 2) },
    { team: "Esc", closed: 64 + ((tick + 1) % 6), breached: 8 + ((tick + 3) % 4) },
  ];
}

function buildMockAnalyticsDashboard(range: AnalyticsRange, seed = Date.now()): AnalyticsDashboardData {
  const tick = Math.max(1, Math.floor(seed / 1000) % 1000);
  const trend = generateAnalyticsTrend(range, tick);
  const teams = generateAnalyticsTeams(tick);
  const opened = trend.reduce((s, p) => s + p.opened, 0);
  const resolved = trend.reduce((s, p) => s + p.resolved, 0);
  const sla = Math.round(trend.reduce((s, p) => s + p.sla, 0) / Math.max(1, trend.length));
  const summary = {
    opened,
    resolved,
    sla,
    backlog: 185 + (opened - resolved),
    firstResponse: Math.max(6, Math.round(34 - (sla - 84) * 0.8)),
  };

  const reports = {
    operations: [
      {
        metric: "Intake vs Resolution",
        current: `${summary.opened} / ${summary.resolved}`,
        previous: `${Math.max(0, summary.opened - 22)} / ${Math.max(0, summary.resolved - 14)}`,
        delta: Math.round(((summary.resolved - summary.opened) / Math.max(1, summary.opened)) * 100),
        status: summary.opened - summary.resolved > 25 ? "risk" : summary.opened - summary.resolved > 8 ? "watch" : "good",
        action: "Rebalance Tier 1 queue during peak windows.",
      },
      {
        metric: "Backlog Aging",
        current: `${Math.max(10, 18 + (summary.opened - summary.resolved) * 0.3).toFixed(0)}h`,
        previous: "21h",
        delta: -8,
        status: "watch",
        action: "Auto-escalate cards older than SLA target.",
      },
    ] satisfies AnalyticsReportRow[],
    service: [
      {
        metric: "SLA Compliance",
        current: `${summary.sla}%`,
        previous: `${Math.max(70, summary.sla - 2)}%`,
        delta: summary.sla - 90,
        status: summary.sla < 85 ? "risk" : summary.sla < 90 ? "watch" : "good",
        action: "Tune routing by channel and VIP priority.",
      },
      {
        metric: "Avg First Response",
        current: `${summary.firstResponse} min`,
        previous: `${summary.firstResponse + 4} min`,
        delta: 20 - summary.firstResponse,
        status: summary.firstResponse > 30 ? "risk" : summary.firstResponse > 20 ? "watch" : "good",
        action: "Introduce triage macros for email queue.",
      },
    ] satisfies AnalyticsReportRow[],
    efficiency: teams.map((t) => ({
      metric: `${t.team} Team`,
      current: `${t.closed} closed / ${t.breached} breached`,
      previous: `${Math.max(0, t.closed - 6)} / ${Math.max(0, t.breached - 1)}`,
      delta: Math.round(((t.closed - t.breached * 4) / 10) - 10),
      status: (t.breached > 7 ? "watch" : "good") as AnalyticsReportStatus,
      action: "Review staffing and handoff delays.",
    })),
  };

  return {
    range,
    generatedAt: new Date().toISOString(),
    trend,
    teams,
    reports,
    summary,
    source: "mock",
  };
}

function normalizeAnalyticsDashboard(input: any, range: AnalyticsRange): AnalyticsDashboardData {
  const fallback = buildMockAnalyticsDashboard(range);
  const trend = Array.isArray(input?.trend) ? input.trend : fallback.trend;
  const teams = Array.isArray(input?.teams) ? input.teams : fallback.teams;
  const reports = {
    operations: Array.isArray(input?.reports?.operations) ? input.reports.operations : fallback.reports.operations,
    service: Array.isArray(input?.reports?.service) ? input.reports.service : fallback.reports.service,
    efficiency: Array.isArray(input?.reports?.efficiency) ? input.reports.efficiency : fallback.reports.efficiency,
  };
  const summary =
    input?.summary &&
    typeof input.summary.opened === "number" &&
    typeof input.summary.resolved === "number" &&
    typeof input.summary.sla === "number" &&
    typeof input.summary.backlog === "number" &&
    typeof input.summary.firstResponse === "number"
      ? input.summary
      : fallback.summary;

  return {
    range: (input?.range || range) as AnalyticsRange,
    generatedAt: typeof input?.generatedAt === "string" ? input.generatedAt : fallback.generatedAt,
    trend,
    teams,
    reports,
    summary,
    source: "api",
  };
}

function normalizeAnalyticsSummary(
  input: any,
  fallback: AnalyticsDashboardData["summary"]
): AnalyticsDashboardData["summary"] {
  if (
    input &&
    typeof input.opened === "number" &&
    typeof input.resolved === "number" &&
    typeof input.sla === "number" &&
    typeof input.backlog === "number" &&
    typeof input.firstResponse === "number"
  ) {
    return input;
  }
  if (
    input?.summary &&
    typeof input.summary.opened === "number" &&
    typeof input.summary.resolved === "number" &&
    typeof input.summary.sla === "number" &&
    typeof input.summary.backlog === "number" &&
    typeof input.summary.firstResponse === "number"
  ) {
    return input.summary;
  }
  return fallback;
}

function normalizeAnalyticsTrend(
  input: any,
  fallback: AnalyticsTrendPoint[]
): AnalyticsTrendPoint[] {
  if (Array.isArray(input)) return input;
  if (Array.isArray(input?.trend)) return input.trend;
  return fallback;
}

function normalizeAnalyticsTeams(
  input: any,
  fallback: AnalyticsTeamPoint[]
): AnalyticsTeamPoint[] {
  if (Array.isArray(input)) return input;
  if (Array.isArray(input?.teams)) return input.teams;
  return fallback;
}

function normalizeAnalyticsReports(
  input: any,
  fallback: AnalyticsDashboardData["reports"]
): AnalyticsDashboardData["reports"] {
  const target = input?.reports ?? input;
  return {
    operations: Array.isArray(target?.operations) ? target.operations : fallback.operations,
    service: Array.isArray(target?.service) ? target.service : fallback.service,
    efficiency: Array.isArray(target?.efficiency) ? target.efficiency : fallback.efficiency,
  };
}

function normalizeAnalyticsFilterOptions(
  input: any,
  fallback: AnalyticsFilterOptions
): AnalyticsFilterOptions {
  const unique = (arr: unknown[]) =>
    Array.from(new Set(arr.map((item) => String(item || "").trim()).filter(Boolean)));
  return {
    teams: Array.isArray(input?.teams) ? unique(input.teams) : fallback.teams,
    boards: Array.isArray(input?.boards) ? unique(input.boards) : fallback.boards,
    customers: Array.isArray(input?.customers) ? unique(input.customers) : fallback.customers,
    channels: Array.isArray(input?.channels) ? unique(input.channels) : fallback.channels,
  };
}

function cleanAnalyticsFilters(filters?: AnalyticsFilters): AnalyticsFilters {
  const clean = (value?: string) => {
    const next = String(value || "").trim();
    if (!next || next.toLowerCase() === "all") return undefined;
    return next;
  };
  return {
    team: clean(filters?.team),
    board: clean(filters?.board),
    customer: clean(filters?.customer),
    channel: clean(filters?.channel),
  };
}

function buildAnalyticsQueryParams(range: AnalyticsRange, filters?: AnalyticsFilters) {
  const query = new URLSearchParams();
  query.set("range", range);
  const next = cleanAnalyticsFilters(filters);
  if (next.team) query.set("team", next.team);
  if (next.board) query.set("board", next.board);
  if (next.customer) query.set("customer", next.customer);
  if (next.channel) query.set("channel", next.channel);
  return query.toString();
}

async function requestAnalyticsJson(path: string, range: AnalyticsRange, filters?: AnalyticsFilters) {
  const query = buildAnalyticsQueryParams(range, filters);
  const response = await fetch(`${API_URL}/api/analytics/${path}${query ? `?${query}` : ""}`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ message: "Request failed" }));
    const error: any = new Error(errorBody?.message || "Request failed");
    error.status = response.status;
    error.code =
      response.status === 404 || response.status === 501
        ? "analytics_endpoint_missing"
        : "analytics_request_failed";
    throw error;
  }

  return response.json();
}

function isAnalyticsNetworkLikeError(error: any) {
  const message = String(error?.message || "");
  return (
    message.includes("Failed to fetch") ||
    message.includes("NetworkError") ||
    message.includes("fetch")
  );
}

async function tryAnalyticsValue<T>(
  request: () => Promise<T>,
  fallback: () => T | Promise<T>,
  options?: { allowProdMissingEndpointFallback?: boolean }
) {
  try {
    return await request();
  } catch (error: any) {
    const missingEndpoint = error?.code === "analytics_endpoint_missing";
    const shouldFallback =
      (!IS_PROD && (isAnalyticsNetworkLikeError(error) || !API_URL || missingEndpoint)) ||
      (Boolean(options?.allowProdMissingEndpointFallback) && missingEndpoint);
    if (shouldFallback) return await fallback();
    throw error;
  }
}

export const analyticsApi = {
  getDashboard: async (params?: AnalyticsDashboardQuery) => {
    const range = params?.range || "7d";
    const seed = params?.seed ?? Date.now();
    return tryAnalyticsValue(
      async () => {
        const raw = await requestAnalyticsJson("dashboard", range, params?.filters);
        return normalizeAnalyticsDashboard(raw, range);
      },
      () => buildMockAnalyticsDashboard(range, seed),
      { allowProdMissingEndpointFallback: false }
    );
  },

  getFilterOptions: async (params?: AnalyticsDashboardQuery) => {
    const range = params?.range || "7d";
    const dashboard = await analyticsApi.getDashboard(params);
    const fallback: AnalyticsFilterOptions = {
      teams: Array.from(new Set(dashboard.teams.map((item) => item.team).filter(Boolean))),
      boards: [],
      customers: [],
      channels: ["Email", "WhatsApp", "Portal", "Chat", "Phone", "API"],
    };

    return tryAnalyticsValue(
      async () => {
        const raw = await requestAnalyticsJson("filters", range, params?.filters);
        return normalizeAnalyticsFilterOptions(raw, fallback);
      },
      () => fallback,
      { allowProdMissingEndpointFallback: true }
    );
  },

  getDashboardWidgets: async (params?: AnalyticsDashboardQuery) => {
    const range = params?.range || "7d";
    const dashboard = await analyticsApi.getDashboard(params);

    const [summary, trend, teams, reports] = await Promise.all([
      tryAnalyticsValue(
        async () => {
          const raw = await requestAnalyticsJson("summary", range, params?.filters);
          return normalizeAnalyticsSummary(raw, dashboard.summary);
        },
        () => dashboard.summary,
        { allowProdMissingEndpointFallback: true }
      ),
      tryAnalyticsValue(
        async () => {
          const raw = await requestAnalyticsJson("trend", range, params?.filters);
          return normalizeAnalyticsTrend(raw, dashboard.trend);
        },
        () => dashboard.trend,
        { allowProdMissingEndpointFallback: true }
      ),
      tryAnalyticsValue(
        async () => {
          const raw = await requestAnalyticsJson("teams", range, params?.filters);
          return normalizeAnalyticsTeams(raw, dashboard.teams);
        },
        () => dashboard.teams,
        { allowProdMissingEndpointFallback: true }
      ),
      tryAnalyticsValue(
        async () => {
          const raw = await requestAnalyticsJson("reports", range, params?.filters);
          return normalizeAnalyticsReports(raw, dashboard.reports);
        },
        () => dashboard.reports,
        { allowProdMissingEndpointFallback: true }
      ),
    ]);

    return {
      ...dashboard,
      summary,
      trend,
      teams,
      reports,
      source: dashboard.source,
    } satisfies AnalyticsDashboardData;
  },
};

export type GlobalUserRole = "admin" | "user";

export type AdminUserRecord = {
  _id: string;
  username: string;
  email: string;
  role: GlobalUserRole;
  canViewAllAnalytics: boolean;
  emailVerified?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

function normalizeAdminUserRecord(input: any): AdminUserRecord {
  return {
    _id: String(input?._id || ""),
    username: String(input?.username || "Unknown"),
    email: String(input?.email || ""),
    role: String(input?.role || "user").toLowerCase() === "admin" ? "admin" : "user",
    canViewAllAnalytics: Boolean(input?.canViewAllAnalytics),
    emailVerified: typeof input?.emailVerified === "boolean" ? input.emailVerified : undefined,
    createdAt: typeof input?.createdAt === "string" ? input.createdAt : undefined,
    updatedAt: typeof input?.updatedAt === "string" ? input.updatedAt : undefined,
  };
}

export type AdminTicketsSortBy =
  | "updatedAt"
  | "createdAt"
  | "priority"
  | "status"
  | "group"
  | "board"
  | "list";

export type SortDir = "asc" | "desc";

export type AdminTicketListMeta = {
  _id: string;
  title: string;
  board?: string;
  archived?: boolean;
  position?: number;
};

export type AdminTicketBoardMeta = {
  _id: string;
  title: string;
};

export type AdminTicketCard = Card & {
  createdAt?: string;
  updatedAt?: string;
};

export type AdminTicketListItem = {
  card: AdminTicketCard;
  board: AdminTicketBoardMeta;
  listMeta: AdminTicketListMeta;
};

export type AdminTicketsFilters = {
  page?: number;
  limit?: number;
  q?: string;
  status?: string;
  priority?: string;
  group?: string;
  boardId?: string;
  listId?: string;
  agentId?: string;
  includeArchived?: boolean;
  includeClosed?: boolean;
  sortBy?: AdminTicketsSortBy;
  sortDir?: SortDir;
};

export type AdminTicketsResponse = {
  scope: string;
  items: AdminTicketListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
  };
  filters: Record<string, unknown>;
};

export type AdminTicketDetailResponse = {
  card: AdminTicketCard;
  list: AdminTicketListMeta;
  board: AdminTicketBoardMeta;
};

type ApiErrorWithStatus = Error & { status?: number };

function buildQueryParams(params: AdminTicketsFilters = {}) {
  const q = new URLSearchParams();
  const add = (key: string, value: unknown) => {
    if (value === undefined || value === null || value === "") return;
    q.set(key, String(value));
  };

  add("page", params.page);
  add("limit", params.limit);
  add("q", params.q);
  add("status", params.status);
  add("priority", params.priority);
  add("group", params.group);
  add("boardId", params.boardId);
  add("listId", params.listId);
  add("agentId", params.agentId);
  if (typeof params.includeArchived === "boolean") add("includeArchived", params.includeArchived);
  if (typeof params.includeClosed === "boolean") add("includeClosed", params.includeClosed);
  add("sortBy", params.sortBy);
  add("sortDir", params.sortDir);
  return q;
}

async function handleAdminTicketsResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ message: "Request failed" }));
    const message =
      response.status === 401
        ? payload.message || "Session expired. Please log in again."
        : response.status === 403
          ? payload.message || "You are not allowed to access admin tickets."
          : response.status === 400
            ? payload.message || "Invalid admin tickets filter."
            : payload.message || "Request failed";
    const error = new Error(message) as ApiErrorWithStatus;
    error.status = response.status;
    throw error;
  }
  return response.json();
}

function normalizeAdminTicketBoardMeta(input: any): AdminTicketBoardMeta {
  return {
    _id: String(input?._id || input?.id || ""),
    title: String(input?.title || "Unknown board"),
  };
}

function normalizeAdminTicketListMeta(input: any): AdminTicketListMeta {
  return {
    _id: String(input?._id || input?.id || ""),
    title: String(input?.title || "Unknown list"),
    board: typeof input?.board === "string" ? input.board : input?.board?._id ? String(input.board._id) : undefined,
    archived: typeof input?.archived === "boolean" ? input.archived : undefined,
    position: typeof input?.position === "number" ? input.position : undefined,
  };
}

function normalizeAdminTicketCard(input: any): AdminTicketCard {
  return {
    ...(input || {}),
    _id: String(input?._id || input?.id || ""),
    title: String(input?.title || "Untitled ticket"),
    createdAt: typeof input?.createdAt === "string" ? input.createdAt : undefined,
    updatedAt: typeof input?.updatedAt === "string" ? input.updatedAt : undefined,
  } as AdminTicketCard;
}

function normalizeAdminTicketListItem(input: any): AdminTicketListItem {
  const card = normalizeAdminTicketCard(input?.card || input);
  const board = normalizeAdminTicketBoardMeta(input?.board || input?.boardMeta || {});
  const listMeta = normalizeAdminTicketListMeta(input?.listMeta || input?.list || {});
  return { card, board, listMeta };
}

function normalizeAdminTicketsResponse(input: any, params?: AdminTicketsFilters): AdminTicketsResponse {
  const itemsRaw = Array.isArray(input?.items) ? input.items : Array.isArray(input) ? input : [];
  const paginationRaw = input?.pagination || {};
  const page = Number(paginationRaw.page ?? params?.page ?? 1) || 1;
  const limit = Number(paginationRaw.limit ?? params?.limit ?? 25) || 25;
  const total = Number(paginationRaw.total ?? itemsRaw.length) || 0;
  const totalPages = Number(paginationRaw.totalPages ?? Math.max(1, Math.ceil(total / Math.max(1, limit)))) || 1;
  const hasNext = typeof paginationRaw.hasNext === "boolean" ? paginationRaw.hasNext : page < totalPages;
  return {
    scope: String(input?.scope || "global-admin"),
    items: itemsRaw.map(normalizeAdminTicketListItem),
    pagination: { page, limit, total, totalPages, hasNext },
    filters: input?.filters && typeof input.filters === "object" ? input.filters : {},
  };
}

function normalizeAdminTicketDetailResponse(input: any): AdminTicketDetailResponse {
  return {
    card: normalizeAdminTicketCard(input?.card || {}),
    list: normalizeAdminTicketListMeta(input?.list || input?.listMeta || {}),
    board: normalizeAdminTicketBoardMeta(input?.board || {}),
  };
}

export const adminUserApi = {
  getAll: async () => {
    const response = await fetch(`${API_URL}/api/users/admin/users`, {
      headers: getAuthHeaders(),
    });
    const raw = await handleResponse<any>(response);
    const items = Array.isArray(raw) ? raw : Array.isArray(raw?.users) ? raw.users : [];
    return items.map(normalizeAdminUserRecord);
  },

  setRole: async (userId: string, role: GlobalUserRole) => {
    const response = await fetch(`${API_URL}/api/users/admin/${encodeURIComponent(userId)}/role`, {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify({ role }),
    });
    const raw = await handleResponse<any>(response);
    return raw?.user ? normalizeAdminUserRecord(raw.user) : normalizeAdminUserRecord(raw);
  },

  setAnalyticsAccess: async (userId: string, canViewAllAnalytics: boolean) => {
    const response = await fetch(`${API_URL}/api/users/admin/${encodeURIComponent(userId)}/analytics-access`, {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify({ canViewAllAnalytics }),
    });
    const raw = await handleResponse<any>(response);
    return raw?.user ? normalizeAdminUserRecord(raw.user) : normalizeAdminUserRecord(raw);
  },
};

export const adminTicketsApi = {
  getAll: async (params: AdminTicketsFilters = {}) => {
    const search = buildQueryParams(params).toString();
    const response = await fetch(`${API_URL}/api/admin/tickets${search ? `?${search}` : ""}`, {
      headers: getAuthHeaders(),
    });
    const raw = await handleAdminTicketsResponse<any>(response);
    return normalizeAdminTicketsResponse(raw, params);
  },

  getById: async (cardId: string) => {
    const response = await fetch(`${API_URL}/api/admin/tickets/${encodeURIComponent(cardId)}`, {
      headers: getAuthHeaders(),
    });
    const raw = await handleAdminTicketsResponse<any>(response);
    return normalizeAdminTicketDetailResponse(raw);
  },
};

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

  create: async (data: { title: string; description?: string; background?: string; customerProfileId?: string }) => {
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
