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
  phone?: string;
  country?: string;
  language?: string;
  bookingValue?: string;
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

export type TravelerRecord = {
  _id: string;
  firstName: string;
  lastName: string;
  displayNameArabic?: string;
  email?: string;
  phone?: string;
  nationality?: string;
  dateOfBirth?: string;
  relationship?: string;
};

export type SupplierType = "DMC" | "Hotel" | "Flight supplier" | "Online portal" | "Tour operator" | "Transfer company" | "Local supplier" | "Other";
export type Supplier = {
  _id: string; name: string; type: SupplierType; status: "Active" | "Inactive" | "Preferred";
  country?: string; email?: string; phone?: string; whatsapp?: string; website?: string; currency?: string; paymentTerms?: string;
  contacts: { name: string; role?: string; email?: string; phone?: string }[]; notes?: string;
};
export type SupplierCreateData = Omit<Supplier, "_id">;

export const supplierApi = {
  list: async (search = "") => {
    const response = await fetch(`${API_URL}/api/suppliers${search ? `?q=${encodeURIComponent(search)}` : ""}`, { headers: getAuthHeaders() });
    return handleResponse<Supplier[]>(response);
  },
  create: async (data: SupplierCreateData) => {
    const response = await fetch(`${API_URL}/api/suppliers`, { method: "POST", headers: getAuthHeaders(), body: JSON.stringify(data) });
    return handleResponse<Supplier>(response);
  },
};

type CustomerCreateData = {
  agencyName: string;
  phone?: string;
  country?: string;
  language?: string;
  bookingValue?: string;
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
    phone: data.phone?.trim() || "",
    country: data.country?.trim() || "",
    language: data.language?.trim() || "",
    bookingValue: data.bookingValue?.trim() || "",
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
    phone: String(input?.phone || "").trim(),
    country: String(input?.country || "").trim(),
    language: String(input?.language || "").trim(),
    bookingValue: String(input?.bookingValue || "").trim(),
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
  getAll: async (boardId?: string) => {
    return tryCustomerApi<CustomerProfile[]>(
      () =>
        fetch(`${API_URL}/api/customers${boardId ? `?boardId=${encodeURIComponent(boardId)}` : ""}`, {
          headers: getAuthHeaders(),
        }),
      () => readLocalCustomers()
    );
  },

  getTravelers: async (customerId: string) => {
    const response = await fetch(`${API_URL}/api/customers/${encodeURIComponent(customerId)}/travelers`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<TravelerRecord[]>(response);
  },

  addTraveler: async (customerId: string, data: Partial<TravelerRecord> & { firstName: string; lastName: string }) => {
    const response = await fetch(`${API_URL}/api/customers/${encodeURIComponent(customerId)}/travelers`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<TravelerRecord>(response);
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

export type AuditActor = {
  _id: string;
  username: string;
  email?: string;
};

export type AuditEntityRef = {
  _id: string;
  title?: string;
};

export type AuditTargetRef = {
  type?: string;
  _id?: string;
  title?: string;
};

export type AuditEvent = {
  _id: string;
  createdAt: string;
  action: string;
  category?: string;
  message: string;
  actor?: AuditActor;
  board?: AuditEntityRef;
  card?: AuditEntityRef;
  list?: AuditEntityRef;
  target?: AuditTargetRef;
  channel?: string;
  requestId?: string;
  ip?: string;
  meta?: Record<string, unknown>;
};

export type AuditLogQuery = {
  page?: number;
  limit?: number;
  q?: string;
  action?: string;
  boardId?: string;
  actorId?: string;
  channel?: string;
  cardId?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: "newest" | "oldest";
  seed?: number;
};

export type AuditLogResponse = {
  items: AuditEvent[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
  };
  source: "api" | "mock";
};

export type AuditFilterOptions = {
  actions: string[];
  channels: string[];
  boards: AuditEntityRef[];
  users: AuditActor[];
};

const MOCK_AUDIT_ACTIONS = [
  "card.created",
  "card.updated",
  "card.moved",
  "card.archived",
  "comment.added",
  "attachment.uploaded",
  "member.added",
  "member.removed",
  "handover.updated",
  "board.settings_updated",
];

const MOCK_AUDIT_CHANNELS = ["Email", "WhatsApp", "Portal", "Chat", "Phone", "API"];

const MOCK_AUDIT_BOARDS: AuditEntityRef[] = [
  { _id: "board_blue_sky", title: "Blue Sky" },
  { _id: "board_sahara_ops", title: "Sahara Ops" },
  { _id: "board_hotels_emea", title: "Hotels EMEA" },
  { _id: "board_vip_desk", title: "VIP Desk" },
];

const MOCK_AUDIT_USERS: AuditActor[] = [
  { _id: "u_mostafa", username: "Mostafa", email: "mostafa@crm.local" },
  { _id: "u_sara", username: "Sara", email: "sara@crm.local" },
  { _id: "u_kareem", username: "Kareem", email: "kareem@crm.local" },
  { _id: "u_aya", username: "Aya", email: "aya@crm.local" },
  { _id: "u_nour", username: "Nour", email: "nour@crm.local" },
];

const MOCK_AUDIT_CARDS: AuditEntityRef[] = [
  { _id: "card_req_001", title: "JUBA REQ" },
  { _id: "card_req_002", title: "VIP amendment - DXB" },
  { _id: "card_req_003", title: "Reconfirmation BCN booking" },
  { _id: "card_req_004", title: "Cancellation CAI - group" },
];

function makeAuditMessage(action: string, card?: AuditEntityRef, board?: AuditEntityRef) {
  const cardLabel = card?.title || card?._id || "card";
  const boardLabel = board?.title || board?._id || "board";
  switch (action) {
    case "card.created":
      return `Created ${cardLabel} in ${boardLabel}`;
    case "card.updated":
      return `Updated fields on ${cardLabel}`;
    case "card.moved":
      return `Moved ${cardLabel} between lists`;
    case "card.archived":
      return `Archived ${cardLabel}`;
    case "comment.added":
      return `Added comment on ${cardLabel}`;
    case "attachment.uploaded":
      return `Uploaded attachment to ${cardLabel}`;
    case "member.added":
      return `Added member to ${boardLabel}`;
    case "member.removed":
      return `Removed member from ${boardLabel}`;
    case "handover.updated":
      return `Updated shift handover details on ${cardLabel}`;
    case "board.settings_updated":
      return `Updated board settings for ${boardLabel}`;
    default:
      return `Performed ${action}`;
  }
}

function generateMockAuditEvents(seed = Date.now()): AuditEvent[] {
  const now = seed || Date.now();
  const events: AuditEvent[] = [];

  for (let i = 0; i < 140; i += 1) {
    const action = MOCK_AUDIT_ACTIONS[i % MOCK_AUDIT_ACTIONS.length];
    const actor = MOCK_AUDIT_USERS[i % MOCK_AUDIT_USERS.length];
    const board = MOCK_AUDIT_BOARDS[i % MOCK_AUDIT_BOARDS.length];
    const card = MOCK_AUDIT_CARDS[i % MOCK_AUDIT_CARDS.length];
    const channel = MOCK_AUDIT_CHANNELS[i % MOCK_AUDIT_CHANNELS.length];
    const createdAt = new Date(now - i * 25 * 60 * 1000).toISOString();
    const hasCard = action.startsWith("card.") || action === "comment.added" || action === "attachment.uploaded" || action === "handover.updated";

    events.push({
      _id: `mock_audit_${i + 1}`,
      createdAt,
      action,
      category: action.split(".")[0],
      message: makeAuditMessage(action, hasCard ? card : undefined, board),
      actor,
      board,
      card: hasCard ? card : undefined,
      list: hasCard ? { _id: `list_${(i % 3) + 1}`, title: ["Quoted", "In Progress", "Done"][i % 3] } : undefined,
      target: hasCard
        ? { type: "card", _id: card._id, title: card.title }
        : { type: "board", _id: board._id, title: board.title },
      channel,
      requestId: `req_${10000 + i}`,
      ip: `10.0.0.${(i % 40) + 10}`,
      meta: {
        source: "mock",
        boardId: board._id,
        cardId: hasCard ? card._id : undefined,
      },
    });
  }

  return events;
}

function normalizeAuditEntity(input: any): AuditEntityRef | undefined {
  if (!input) return undefined;
  if (typeof input === "string") return { _id: input, title: input };
  const id = String(input._id || input.id || "").trim();
  if (!id) return undefined;
  const title = String(input.title || input.name || input.label || "").trim();
  return {
    _id: id,
    title: title || undefined,
  };
}

function normalizeAuditActor(input: any): AuditActor | undefined {
  if (!input) return undefined;
  if (typeof input === "string") return { _id: input, username: input };
  const id = String(input._id || input.id || "").trim();
  const username = String(input.username || input.name || "").trim();
  if (!id && !username) return undefined;
  return {
    _id: id || username,
    username: username || id,
    email: typeof input.email === "string" ? input.email : undefined,
  };
}

function normalizeAuditEvent(input: any): AuditEvent {
  const createdAt = String(input?.createdAt || input?.at || input?.timestamp || new Date().toISOString());
  const action = String(input?.action || input?.type || "unknown");
  const board = normalizeAuditEntity(input?.board);
  const card = normalizeAuditEntity(input?.card);
  const list = normalizeAuditEntity(input?.list);
  const actor = normalizeAuditActor(input?.actor || input?.user);

  const targetInput = input?.target;
  const target: AuditTargetRef | undefined = targetInput
    ? {
        type: typeof targetInput?.type === "string" ? targetInput.type : undefined,
        _id: String(targetInput?._id || targetInput?.id || "").trim() || undefined,
        title: String(targetInput?.title || targetInput?.name || "").trim() || undefined,
      }
    : card
      ? { type: "card", _id: card._id, title: card.title }
      : board
        ? { type: "board", _id: board._id, title: board.title }
        : undefined;

  const message = String(input?.message || input?.summary || makeAuditMessage(action, card, board));

  return {
    _id: String(input?._id || input?.id || `${createdAt}_${action}_${Math.random().toString(36).slice(2, 8)}`),
    createdAt,
    action,
    category: typeof input?.category === "string" ? input.category : action.split(".")[0],
    message,
    actor,
    board,
    card,
    list,
    target,
    channel: typeof input?.channel === "string" ? input.channel : undefined,
    requestId: typeof input?.requestId === "string" ? input.requestId : undefined,
    ip: typeof input?.ip === "string" ? input.ip : undefined,
    meta: input?.meta && typeof input.meta === "object" ? input.meta : undefined,
  };
}

function applyAuditFilters(events: AuditEvent[], query: AuditLogQuery) {
  const q = String(query.q || "").trim().toLowerCase();
  return events.filter((event) => {
    const matchesQ =
      !q ||
      [
        event.message,
        event.action,
        event.category,
        event.actor?.username,
        event.actor?.email,
        event.board?.title,
        event.card?.title,
        event.card?._id,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    if (!matchesQ) return false;

    if (query.action && event.action !== query.action) return false;
    if (query.boardId && event.board?._id !== query.boardId) return false;
    if (query.actorId && event.actor?._id !== query.actorId) return false;
    if (query.channel && event.channel !== query.channel) return false;
    if (query.cardId && event.card?._id !== query.cardId) return false;

    if (query.dateFrom) {
      const from = new Date(query.dateFrom).getTime();
      const at = new Date(event.createdAt).getTime();
      if (!Number.isNaN(from) && at < from) return false;
    }
    if (query.dateTo) {
      const to = new Date(query.dateTo).getTime();
      const at = new Date(event.createdAt).getTime();
      if (!Number.isNaN(to) && at > to + 24 * 60 * 60 * 1000 - 1) return false;
    }
    return true;
  });
}

function buildMockAuditLogResponse(query: AuditLogQuery = {}): AuditLogResponse {
  const page = Math.max(1, Number(query.page || 1));
  const limit = Math.min(200, Math.max(1, Number(query.limit || 30)));
  const sort = query.sort === "oldest" ? "oldest" : "newest";
  const all = generateMockAuditEvents(query.seed || Date.now());
  const filtered = applyAuditFilters(all, query).sort((a, b) => {
    const left = new Date(a.createdAt).getTime();
    const right = new Date(b.createdAt).getTime();
    return sort === "oldest" ? left - right : right - left;
  });
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;
  const items = filtered.slice(start, start + limit);
  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
    },
    source: "mock",
  };
}

function buildMockAuditFilterOptions(query: AuditLogQuery = {}): AuditFilterOptions {
  const filtered = applyAuditFilters(generateMockAuditEvents(query.seed || Date.now()), {
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
  });

  const actions = Array.from(new Set(filtered.map((item) => item.action).filter(Boolean))).sort();
  const channels = Array.from(new Set(filtered.map((item) => item.channel).filter(Boolean) as string[])).sort();
  const boards = Array.from(
    new Map(filtered.filter((item) => item.board?._id).map((item) => [item.board!._id, item.board!])).values()
  ).sort((a, b) => String(a.title || a._id).localeCompare(String(b.title || b._id)));
  const users = Array.from(
    new Map(filtered.filter((item) => item.actor?._id).map((item) => [item.actor!._id, item.actor!])).values()
  ).sort((a, b) => a.username.localeCompare(b.username));

  return {
    actions,
    channels,
    boards,
    users,
  };
}

function normalizeAuditLogResponse(input: any, query: AuditLogQuery = {}): AuditLogResponse {
  const page = Math.max(1, Number(input?.pagination?.page || input?.page || query.page || 1));
  const limit = Math.min(200, Math.max(1, Number(input?.pagination?.limit || input?.limit || query.limit || 30)));
  const rawItems = Array.isArray(input)
    ? input
    : Array.isArray(input?.items)
      ? input.items
      : Array.isArray(input?.data)
        ? input.data
        : Array.isArray(input?.events)
          ? input.events
          : Array.isArray(input?.logs)
            ? input.logs
            : [];
  const items = rawItems.map(normalizeAuditEvent);
  const total = Math.max(items.length, Number(input?.pagination?.total || input?.total || items.length));
  const totalPages = Math.max(1, Number(input?.pagination?.totalPages || input?.totalPages || Math.ceil(total / limit)));
  const hasNext =
    typeof input?.pagination?.hasNext === "boolean"
      ? input.pagination.hasNext
      : typeof input?.hasNext === "boolean"
        ? input.hasNext
        : page < totalPages;

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext,
    },
    source: "api",
  };
}

function normalizeAuditFilterOptions(input: any, query: AuditLogQuery = {}): AuditFilterOptions {
  const fallback = buildMockAuditFilterOptions(query);
  const normalizeList = (values: any[]) =>
    Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean))).sort();

  const actions = Array.isArray(input?.actions) ? normalizeList(input.actions) : fallback.actions;
  const channels = Array.isArray(input?.channels) ? normalizeList(input.channels) : fallback.channels;
  const boards = Array.isArray(input?.boards)
    ? input.boards.map(normalizeAuditEntity).filter(Boolean) as AuditEntityRef[]
    : fallback.boards;
  const users = Array.isArray(input?.users)
    ? input.users.map(normalizeAuditActor).filter(Boolean) as AuditActor[]
    : fallback.users;

  return {
    actions,
    channels,
    boards,
    users,
  };
}

function buildAuditQueryParams(query: AuditLogQuery = {}) {
  const q = new URLSearchParams();
  if (query.page) q.set("page", String(query.page));
  if (query.limit) q.set("limit", String(query.limit));
  if (query.q) q.set("q", query.q);
  if (query.action) q.set("action", query.action);
  if (query.boardId) q.set("boardId", query.boardId);
  if (query.actorId) q.set("actorId", query.actorId);
  if (query.channel) q.set("channel", query.channel);
  if (query.cardId) q.set("cardId", query.cardId);
  if (query.dateFrom) q.set("dateFrom", query.dateFrom);
  if (query.dateTo) q.set("dateTo", query.dateTo);
  if (query.sort) q.set("sort", query.sort);
  return q.toString();
}

function isAuditNetworkLikeError(error: any) {
  const message = String(error?.message || "");
  return (
    message.includes("Failed to fetch") ||
    message.includes("NetworkError") ||
    message.includes("fetch")
  );
}

async function tryAuditApi<T>(
  request: () => Promise<Response>,
  fallback: () => T | Promise<T>
): Promise<T> {
  try {
    const response = await request();
    if ((response.status === 404 || response.status === 501) && !IS_PROD) {
      return await fallback();
    }
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Request failed" }));
      throw new Error(error.message || "Request failed");
    }
    return (await response.json()) as T;
  } catch (error: any) {
    if (!IS_PROD && (isAuditNetworkLikeError(error) || !API_URL)) {
      return await fallback();
    }
    throw error;
  }
}

export const auditApi = {
  getLogs: async (query: AuditLogQuery = {}) => {
    const qs = buildAuditQueryParams(query);
    const raw = await tryAuditApi<any>(
      () =>
        fetch(`${API_URL}/api/audit${qs ? `?${qs}` : ""}`, {
          headers: getAuthHeaders(),
        }),
      () => buildMockAuditLogResponse(query)
    );

    return Array.isArray(raw) || raw?.source !== "mock"
      ? normalizeAuditLogResponse(raw, query)
      : (raw as AuditLogResponse);
  },

  getFilterOptions: async (query: Pick<AuditLogQuery, "dateFrom" | "dateTo" | "seed"> = {}) => {
    const qs = buildAuditQueryParams(query);
    const raw = await tryAuditApi<any>(
      () =>
        fetch(`${API_URL}/api/audit/filters${qs ? `?${qs}` : ""}`, {
          headers: getAuthHeaders(),
        }),
      () => buildMockAuditFilterOptions(query)
    );
    return normalizeAuditFilterOptions(raw, query);
  },
};

export type GlobalUserRole = "admin" | "user";

export type AdminUserRecord = {
  _id: string;
  username: string;
  email: string;
  role: GlobalUserRole;
  workflowRoles: Array<"sales" | "operations" | "accounting">;
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
    workflowRoles: Array.isArray(input?.workflowRoles) ? input.workflowRoles.filter((role: string) => ["sales", "operations", "accounting"].includes(role)) : ["sales", "operations", "accounting"],
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

  setWorkflowRoles: async (userId: string, workflowRoles: Array<"sales" | "operations" | "accounting">) => {
    const response = await fetch(`${API_URL}/api/users/admin/${encodeURIComponent(userId)}/workflow-roles`, {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify({ workflowRoles }),
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
  destination?: string;
  travelerCount?: number;
  travelServices?: ("Flight" | "Hotel" | "Tour" | "Transfer" | "Other")[];
  hotelName?: string;
  source?: string;
  salesStage?: "New" | "Contacted" | "Qualified" | "Quoted" | "Follow-up" | "Won" | "Lost";
  qualificationStatus?: "Unqualified" | "Qualified" | "Not a fit";
  leadNeed?: string;
  leadBudget?: number;
  travelDates?: string;
  lossReason?: string;
  followUpAt?: string | null;
  followUpChannel?: "WhatsApp" | "Email" | "Phone" | "Other";
  followUpNote?: string;
  followUpCompleted?: boolean;
  accountingStatus?: "Not ready" | "Ready for accounting" | "Sent to accounting" | "Accounting received" | "Paid" | "Closed";
  accountingReference?: string;
  accountingNotes?: string;
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

export type QuotationLine = {
  _id?: string;
  serviceType: "Flight" | "Hotel" | "Tour" | "Transfer" | "Other";
  description: string;
  supplierName?: string;
  quantity: number;
  netRate: number;
  sellingRate: number;
};

export type Quotation = {
  _id: string;
  version: number;
  status: "Draft" | "Sent" | "Accepted" | "Rejected" | "Expired";
  currency: string;
  lines: QuotationLine[];
  notes?: string;
  createdAt: string;
};

export const quotationApi = {
  list: async (boardId: string, cardId: string) => {
    const response = await fetch(`${API_URL}/api/boards/${boardId}/requests/${cardId}/quotations`, { headers: getAuthHeaders() });
    return handleResponse<Quotation[]>(response);
  },
  create: async (boardId: string, cardId: string, data: Pick<Quotation, "currency" | "lines"> & { notes?: string }) => {
    const response = await fetch(`${API_URL}/api/boards/${boardId}/requests/${cardId}/quotations`, {
      method: "POST", headers: getAuthHeaders(), body: JSON.stringify(data),
    });
    return handleResponse<Quotation>(response);
  },
  update: async (boardId: string, cardId: string, quotationId: string, data: Partial<Pick<Quotation, "status" | "currency" | "lines" | "notes">>) => {
    const response = await fetch(`${API_URL}/api/boards/${boardId}/requests/${cardId}/quotations/${quotationId}`, {
      method: "PATCH", headers: getAuthHeaders(), body: JSON.stringify(data),
    });
    return handleResponse<Quotation>(response);
  },
};

export type TravelServiceType = "Flight" | "Hotel" | "Transfer" | "Tour" | "Activity" | "Transportation" | "Visa" | "Insurance" | "Guide" | "Cruise" | "Other";
export type TravelService = {
  _id: string;
  type: TravelServiceType;
  title: string;
  supplierName?: string;
  pricingSource?: string;
  supplierReference?: string;
  currency: string;
  netCost: number;
  sellingPrice: number;
  profit: number;
  marginPercent: number;
  status: "Requested" | "Quoted" | "Optioned" | "Confirmed" | "Cancelled";
  details: Record<string, unknown>;
  notes?: string;
};

export const travelServiceApi = {
  list: async (boardId: string, cardId: string) => {
    const response = await fetch(`${API_URL}/api/boards/${boardId}/requests/${cardId}/services`, { headers: getAuthHeaders() });
    return handleResponse<TravelService[]>(response);
  },
  create: async (boardId: string, cardId: string, data: Omit<TravelService, "_id" | "profit" | "marginPercent">) => {
    const response = await fetch(`${API_URL}/api/boards/${boardId}/requests/${cardId}/services`, { method: "POST", headers: getAuthHeaders(), body: JSON.stringify(data) });
    return handleResponse<TravelService>(response);
  },
  remove: async (boardId: string, cardId: string, serviceId: string) => {
    const response = await fetch(`${API_URL}/api/boards/${boardId}/requests/${cardId}/services/${serviceId}`, { method: "DELETE", headers: getAuthHeaders() });
    if (!response.ok) throw new Error((await response.json().catch(() => ({ message: "Could not remove service" }))).message);
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
  destination?: string;
  travelerCount?: number;
  travelServices?: ("Flight" | "Hotel" | "Tour" | "Transfer" | "Other")[];
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
  salesStage?: "New" | "Contacted" | "Qualified" | "Quoted" | "Follow-up" | "Won" | "Lost";
  qualificationStatus?: "Unqualified" | "Qualified" | "Not a fit";
  leadNeed?: string;
  leadBudget?: number;
  travelDates?: string;
  lossReason?: string;
  followUpAt?: string | null;
  followUpChannel?: "WhatsApp" | "Email" | "Phone" | "Other";
  followUpNote?: string;
  followUpCompleted?: boolean;
  accountingStatus?: "Not ready" | "Ready for accounting" | "Sent to accounting" | "Accounting received" | "Paid" | "Closed";
  accountingReference?: string;
  accountingNotes?: string;
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
  destination?: string;
  travelerCount?: number;
  travelServices?: ("Flight" | "Hotel" | "Tour" | "Transfer" | "Other")[];
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
  salesStage?: "New" | "Contacted" | "Qualified" | "Quoted" | "Follow-up" | "Won" | "Lost";
  qualificationStatus?: "Unqualified" | "Qualified" | "Not a fit";
  leadNeed?: string;
  leadBudget?: number;
  travelDates?: string;
  lossReason?: string;
  followUpAt?: string | null;
  followUpChannel?: "WhatsApp" | "Email" | "Phone" | "Other";
  followUpNote?: string;
  followUpCompleted?: boolean;
  accountingStatus?: "Not ready" | "Ready for accounting" | "Sent to accounting" | "Accounting received" | "Paid" | "Closed";
  accountingReference?: string;
  accountingNotes?: string;
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

const LOCAL_NOTIFICATION_STORAGE_KEY = "crm_notifications_v1";
const NOTIFICATIONS_CHANGED_EVENT = "crm:notifications-changed";

function readLocalNotifications(): Notification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_NOTIFICATION_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed as Notification[];
  } catch {
    return [];
  }
}

function writeLocalNotifications(notifications: Notification[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCAL_NOTIFICATION_STORAGE_KEY, JSON.stringify(notifications));
  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED_EVENT));
}

function getStoredUserId() {
  if (typeof window === "undefined") return "";
  try {
    const raw = localStorage.getItem("user");
    const parsed = raw ? JSON.parse(raw) : null;
    return String(parsed?._id || "");
  } catch {
    return "";
  }
}

async function tryNotificationApi<T>(request: () => Promise<Response>, fallback: () => T | Promise<T>): Promise<T> {
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

// Notification API
export const notificationApi = {
  getAll: async () => {
    return tryNotificationApi<Notification[]>(
      () =>
        fetch(`${API_URL}/api/notifications`, {
          headers: getAuthHeaders(),
        }),
      () => {
        const currentUserId = getStoredUserId();
        return readLocalNotifications()
          .filter((notification) => !currentUserId || notification.recipient === currentUserId)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }
    );
  },

  getUnreadCount: async () => {
    return tryNotificationApi<{ count: number }>(
      () =>
        fetch(`${API_URL}/api/notifications/unread-count`, {
          headers: getAuthHeaders(),
        }),
      () => {
        const currentUserId = getStoredUserId();
        const count = readLocalNotifications().filter(
          (notification) => (!currentUserId || notification.recipient === currentUserId) && !notification.read
        ).length;
        return { count };
      }
    );
  },

  markAsRead: async (id: string) => {
    return tryNotificationApi<Notification>(
      () =>
        fetch(`${API_URL}/api/notifications/${id}/read`, {
          method: "PATCH",
          headers: getAuthHeaders(),
        }),
      () => {
        const notifications = readLocalNotifications();
        let updated: Notification | undefined;
        const next = notifications.map((notification) => {
          if (notification._id !== id) return notification;
          updated = { ...notification, read: true };
          return updated;
        });
        writeLocalNotifications(next);
        if (!updated) throw new Error("Notification not found");
        return updated;
      }
    );
  },

  markAllAsRead: async () => {
    return tryNotificationApi<{ success: true }>(
      () =>
        fetch(`${API_URL}/api/notifications/mark-all-read`, {
          method: "PATCH",
          headers: getAuthHeaders(),
        }),
      () => {
        const currentUserId = getStoredUserId();
        const next = readLocalNotifications().map((notification) =>
          !currentUserId || notification.recipient === currentUserId
            ? { ...notification, read: true }
            : notification
        );
        writeLocalNotifications(next);
        return { success: true as const };
      }
    );
  },

  delete: async (id: string) => {
    return tryNotificationApi<{ success: true }>(
      () =>
        fetch(`${API_URL}/api/notifications/${id}`, {
          method: "DELETE",
          headers: getAuthHeaders(),
        }),
      () => {
        writeLocalNotifications(readLocalNotifications().filter((notification) => notification._id !== id));
        return { success: true as const };
      }
    );
  },
};
