import type { Member, Notification } from "./api";

export type DutyChannel = "Mail" | "WhatsApp" | "Custom";
export type DailyTaskStatus = "todo" | "in_progress" | "pending" | "done" | "carried_forward";
export type TaskOrigin = "primary" | "additional" | "manual";

export type CoverageSlot = {
  _id: string;
  businessDate: string;
  memberId: string;
  channel: DutyChannel;
  taskWindow: string;
  additionalDuty?: string;
  scheduleWindow: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type DailyTaskComment = {
  _id: string;
  text: string;
  author: Member;
  parentCommentId?: string;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string;
};

export type DailyTaskAttachment = {
  _id: string;
  name: string;
  url: string;
  addedBy: Member;
  createdAt: string;
};

export type DailyTask = {
  _id: string;
  businessDate: string;
  coverageSlotId?: string;
  memberId: string;
  title: string;
  description?: string;
  channel?: DutyChannel;
  dutyLabel?: string;
  taskWindow: string;
  scheduleWindow: string;
  status: DailyTaskStatus;
  progressPercent: number;
  origin: TaskOrigin;
  pendingReason?: string;
  completionNote?: string;
  carryForwardShift?: string;
  carryForwardReason?: string;
  comments: DailyTaskComment[];
  attachments: DailyTaskAttachment[];
  createdAt: string;
  updatedAt: string;
};

export type DailyOpsDashboard = {
  businessDate: string;
  members: Member[];
  coverageSlots: CoverageSlot[];
  tasks: DailyTask[];
};

type DailyOpsStore = {
  members: Member[];
  coverageSlots: CoverageSlot[];
  tasks: DailyTask[];
};

type CoverageSlotInput = {
  businessDate: string;
  memberId: string;
  channel: DutyChannel;
  taskWindow: string;
  additionalDuty?: string;
  scheduleWindow: string;
  notes?: string;
};

type ManualTaskInput = {
  businessDate: string;
  memberId: string;
  title: string;
  description?: string;
  taskWindow: string;
  scheduleWindow: string;
};

type DailyTaskPatch = Partial<Pick<DailyTask, "memberId" | "title" | "description" | "status" | "progressPercent" | "pendingReason" | "completionNote" | "carryForwardShift" | "carryForwardReason">>;

const DAILY_OPS_STORAGE_KEY = "crm_daily_ops_v1";
const LOCAL_NOTIFICATION_STORAGE_KEY = "crm_notifications_v1";
const DAILY_OPS_CHANGED_EVENT = "crm:daily-ops-changed";
const NOTIFICATIONS_CHANGED_EVENT = "crm:notifications-changed";

function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";
}

function formatBusinessDate(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function getStoredUser(): Member | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("user");
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed?._id || !parsed?.username || !parsed?.email) return null;
    return {
      _id: String(parsed._id),
      username: String(parsed.username),
      email: String(parsed.email),
    };
  } catch {
    return null;
  }
}

function normalizeMember(input: Partial<Member> & { username: string; email: string }, fallbackId?: string): Member {
  return {
    _id: String(input._id || fallbackId || makeId("ops_member")),
    username: input.username.trim(),
    email: input.email.trim().toLowerCase(),
  };
}

function sortMembers(members: Member[]) {
  return [...members].sort((a, b) => a.username.localeCompare(b.username));
}

function normalizeIdentityValue(value?: string) {
  return String(value || "").trim().toLowerCase();
}

function hasMeaningfulIdentity(member?: Partial<Member> | null) {
  return Boolean(normalizeIdentityValue(member?.email) || normalizeIdentityValue(member?.username) || String(member?._id || "").trim());
}

function isPlaceholderMemberId(id?: string) {
  return String(id || "").startsWith("ops_member_");
}

function membersMatch(left: Partial<Member>, right: Partial<Member>) {
  const leftId = String(left._id || "").trim();
  const rightId = String(right._id || "").trim();
  if (leftId && rightId && leftId === rightId) return true;

  const leftEmail = normalizeIdentityValue(left.email);
  const rightEmail = normalizeIdentityValue(right.email);
  if (leftEmail && rightEmail) return leftEmail === rightEmail;

  const leftUsername = normalizeIdentityValue(left.username);
  const rightUsername = normalizeIdentityValue(right.username);
  if ((!leftEmail || !rightEmail) && leftUsername && rightUsername) return leftUsername === rightUsername;

  return false;
}

function preferCanonicalMember(current: Member, candidate: Member) {
  const currentIsPlaceholder = isPlaceholderMemberId(current._id);
  const candidateIsPlaceholder = isPlaceholderMemberId(candidate._id);

  if (currentIsPlaceholder !== candidateIsPlaceholder) {
    const canonical = candidateIsPlaceholder ? current : candidate;
    const secondary = candidateIsPlaceholder ? candidate : current;
    return {
      _id: canonical._id,
      username: canonical.username || secondary.username,
      email: canonical.email || secondary.email,
    };
  }

  return {
    _id: current._id || candidate._id,
    username: current.username || candidate.username,
    email: current.email || candidate.email,
  };
}

function resolveCanonicalMember(member: Partial<Member>, directory: Member[]) {
  if (!hasMeaningfulIdentity(member)) return null;
  return (
    directory.find((candidate) => membersMatch(candidate, member)) ||
    directory.find((candidate) => String(candidate._id || "") === String(member._id || "")) ||
    null
  );
}

function reconcileMembers(existing: Member[], incoming: Member[]) {
  const nextMembers: Member[] = [];

  for (const member of [...existing, ...incoming].filter(hasMeaningfulIdentity)) {
    const normalized = normalizeMember(member as Member, member._id ? String(member._id) : undefined);
    const matchIndex = nextMembers.findIndex((candidate) => membersMatch(candidate, normalized));
    if (matchIndex === -1) {
      nextMembers.push(normalized);
      continue;
    }

    nextMembers[matchIndex] = preferCanonicalMember(nextMembers[matchIndex], normalized);
  }

  const aliases = new Map<string, string>();
  for (const member of [...existing, ...incoming].filter(hasMeaningfulIdentity)) {
    const canonical = resolveCanonicalMember(member, nextMembers);
    const originalId = String(member._id || "").trim();
    if (canonical && originalId && canonical._id !== originalId) {
      aliases.set(originalId, canonical._id);
    }
  }

  return {
    members: sortMembers(nextMembers),
    aliases,
  };
}

function remapMemberReference(member: Member, directory: Member[], aliases: Map<string, string>) {
  const aliasedId = aliases.get(member._id) || member._id;
  return resolveCanonicalMember({ ...member, _id: aliasedId }, directory) || { ...member, _id: aliasedId };
}

function remapMemberId(memberId: string, aliases: Map<string, string>) {
  return aliases.get(memberId) || memberId;
}

function getSeedMembers(currentUser?: Member | null): Member[] {
  const seeds: Member[] = [
    normalizeMember({ _id: "ops_member_hadeer", username: "Hadeer", email: "hadeer@taskflow.local" }),
    normalizeMember({ _id: "ops_member_eman", username: "Eman", email: "eman@taskflow.local" }),
    normalizeMember({ _id: "ops_member_yasmin", username: "Yasmin", email: "yasmin@taskflow.local" }),
    normalizeMember({ _id: "ops_member_fadwa", username: "Fadwa", email: "fadwa@taskflow.local" }),
    normalizeMember({ _id: "ops_member_mariam", username: "Mariam", email: "mariam@taskflow.local" }),
    normalizeMember({ _id: "ops_member_trainees", username: "Trainees", email: "trainees@taskflow.local" }),
  ];

  if (currentUser && !seeds.some((member) => member._id === currentUser._id || member.email === currentUser.email)) {
    seeds.push(normalizeMember(currentUser, currentUser._id));
  }

  return sortMembers(seeds);
}

function getSeedCoverageSlots(businessDate: string, members: Member[]) {
  const memberByName = new Map(members.map((member) => [member.username.toLowerCase(), member]));
  const now = new Date().toISOString();
  const rows = [
    {
      memberName: "Hadeer",
      channel: "Mail" as DutyChannel,
      taskWindow: "2:00 AM - 1:00 PM",
      additionalDuty: "Creation",
      scheduleWindow: "8:00 AM - 5:00 PM",
    },
    {
      memberName: "Eman",
      channel: "WhatsApp" as DutyChannel,
      taskWindow: "8:00 AM - 3:00 PM",
      additionalDuty: "Arrivals",
      scheduleWindow: "9:00 AM - 6:00 PM",
    },
    {
      memberName: "Yasmin",
      channel: "WhatsApp" as DutyChannel,
      taskWindow: "9:00 AM - 4:00 PM",
      additionalDuty: "",
      scheduleWindow: "9:00 AM - 6:00 PM",
    },
    {
      memberName: "Fadwa",
      channel: "WhatsApp" as DutyChannel,
      taskWindow: "9:00 AM - 4:00 PM",
      additionalDuty: "3 days ahead",
      scheduleWindow: "9:00 AM - 6:00 PM",
    },
    {
      memberName: "Mariam",
      channel: "Mail" as DutyChannel,
      taskWindow: "1:00 PM - 4:00 PM",
      additionalDuty: "",
      scheduleWindow: "9:00 AM - 6:00 PM",
    },
    {
      memberName: "Trainees",
      channel: "WhatsApp" as DutyChannel,
      taskWindow: "9:00 AM - 4:00 PM",
      additionalDuty: "Failures - AR-CR",
      scheduleWindow: "",
    },
  ];

  return rows
    .map<CoverageSlot | null>((row) => {
      const member = memberByName.get(row.memberName.toLowerCase());
      if (!member) return null;
      const baseId = slugify(`${businessDate}-${member.username}-${row.channel}-${row.additionalDuty || "primary"}`);
      const slot: CoverageSlot = {
        _id: `coverage_${baseId}`,
        businessDate,
        memberId: member._id,
        channel: row.channel,
        taskWindow: row.taskWindow,
        additionalDuty: row.additionalDuty || undefined,
        scheduleWindow: row.scheduleWindow,
        notes: "",
        createdAt: now,
        updatedAt: now,
      };
      return slot;
    })
    .filter(isDefined);
}

function derivePrimaryTaskTitle(slot: CoverageSlot) {
  if (slot.channel === "Mail") return "Handle Mail queue";
  if (slot.channel === "WhatsApp") return "Handle WhatsApp queue";
  return "Handle assigned queue";
}

function deriveAdditionalTaskTitle(label: string) {
  return `${label} duty`;
}

function deriveStatusSeed(title: string): DailyTaskStatus {
  const normalized = title.toLowerCase();
  if (normalized.includes("arrivals")) return "in_progress";
  if (normalized.includes("failures")) return "pending";
  return "todo";
}

function deriveProgress(status: DailyTaskStatus) {
  switch (status) {
    case "done":
      return 100;
    case "carried_forward":
      return 100;
    case "pending":
      return 55;
    case "in_progress":
      return 40;
    default:
      return 0;
  }
}

function createTaskFromSlot(slot: CoverageSlot, origin: TaskOrigin): DailyTask {
  const now = new Date().toISOString();
  const title = origin === "primary" ? derivePrimaryTaskTitle(slot) : deriveAdditionalTaskTitle(slot.additionalDuty || "Additional duty");
  const status = deriveStatusSeed(title);
  return {
    _id: `task_${slugify(`${slot._id}-${origin}`)}`,
    businessDate: slot.businessDate,
    coverageSlotId: slot._id,
    memberId: slot.memberId,
    title,
    description:
      origin === "primary"
        ? `Auto-generated from the ${slot.channel} coverage plan for ${slot.taskWindow}.`
        : `Additional daily duty generated from coverage planning: ${slot.additionalDuty}.`,
    channel: slot.channel,
    dutyLabel: origin === "primary" ? slot.channel : slot.additionalDuty || undefined,
    taskWindow: slot.taskWindow,
    scheduleWindow: slot.scheduleWindow,
    status,
    progressPercent: deriveProgress(status),
    origin,
    pendingReason: status === "pending" ? "Waiting on queue context before next shift handover." : "",
    comments: [],
    attachments: [],
    createdAt: now,
    updatedAt: now,
  };
}

function createSystemMember(): Member {
  return {
    _id: "system_daily_ops",
    username: "Daily Ops",
    email: "system@taskflow.local",
  };
}

function readLocalNotifications(): Notification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_NOTIFICATION_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Notification[]) : [];
  } catch {
    return [];
  }
}

function writeLocalNotifications(notifications: Notification[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCAL_NOTIFICATION_STORAGE_KEY, JSON.stringify(notifications));
  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED_EVENT));
}

function reconcileLocalNotifications(directory: Member[], aliases: Map<string, string>) {
  if (!aliases.size) return;

  const notifications = readLocalNotifications();
  const next = notifications.map((notification) => {
    const nextRecipient = aliases.get(notification.recipient) || notification.recipient;
    const nextSender = notification.sender ? remapMemberReference(notification.sender, directory, aliases) : notification.sender;
    return {
      ...notification,
      recipient: nextRecipient,
      sender: nextSender,
    };
  });

  writeLocalNotifications(next);
}

function pushNotifications(
  recipients: Member[],
  sender: Member,
  message: string,
  task: DailyTask,
  commentText?: string
) {
  if (!recipients.length) return;
  const notifications = readLocalNotifications();
  const now = new Date().toISOString();
  const uniqueRecipients = Array.from(new Map(recipients.map((recipient) => [recipient._id, recipient])).values());
  const next = uniqueRecipients.map((recipient) => ({
    _id: makeId("notif"),
    recipient: recipient._id,
    sender,
    type: "activity" as const,
    message,
    board: { _id: "daily-ops", title: "Daily Ops" },
    card: { _id: task._id, title: task.title },
    commentText,
    read: false,
    createdAt: now,
  }));
  writeLocalNotifications([...next, ...notifications]);
}

function readStore(currentUser?: Member | null): DailyOpsStore {
  if (typeof window === "undefined") {
    return { members: [], coverageSlots: [], tasks: [] };
  }

  try {
    const raw = localStorage.getItem(DAILY_OPS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const store: DailyOpsStore = {
      members: Array.isArray(parsed?.members) ? parsed.members : [],
      coverageSlots: Array.isArray(parsed?.coverageSlots) ? parsed.coverageSlots : [],
      tasks: Array.isArray(parsed?.tasks) ? parsed.tasks : [],
    };
    const nextStore = ensureSeed(store, currentUser || getStoredUser());
    if (JSON.stringify(nextStore) !== JSON.stringify(store)) {
      writeStore(nextStore);
    }
    return nextStore;
  } catch {
    const nextStore = ensureSeed({ members: [], coverageSlots: [], tasks: [] }, currentUser || getStoredUser());
    writeStore(nextStore);
    return nextStore;
  }
}

function writeStore(store: DailyOpsStore) {
  if (typeof window === "undefined") return;
  localStorage.setItem(DAILY_OPS_STORAGE_KEY, JSON.stringify(store));
  window.dispatchEvent(new CustomEvent(DAILY_OPS_CHANGED_EVENT));
}

function mergeMembers(existing: Member[], incoming: Member[]) {
  return reconcileMembers(existing, incoming).members;
}

function remapTask(task: DailyTask, directory: Member[], aliases: Map<string, string>): DailyTask {
  return {
    ...task,
    memberId: remapMemberId(task.memberId, aliases),
    comments: task.comments.map((comment) => ({
      ...comment,
      author: remapMemberReference(comment.author, directory, aliases),
    })),
    attachments: task.attachments.map((attachment) => ({
      ...attachment,
      addedBy: remapMemberReference(attachment.addedBy, directory, aliases),
    })),
  };
}

function remapStoreMembers(store: DailyOpsStore, directory: Member[], aliases: Map<string, string>) {
  if (!aliases.size) {
    return {
      ...store,
      members: sortMembers(directory),
    };
  }

  return {
    members: sortMembers(directory),
    coverageSlots: store.coverageSlots.map((slot) => ({
      ...slot,
      memberId: remapMemberId(slot.memberId, aliases),
    })),
    tasks: store.tasks.map((task) => remapTask(task, directory, aliases)),
  };
}

function ensureSeed(store: DailyOpsStore, currentUser?: Member | null) {
  const businessDate = formatBusinessDate();
  const reconciled = reconcileMembers(store.members, getSeedMembers(currentUser));
  let nextStore = remapStoreMembers(
    {
      members: [...store.members],
      coverageSlots: [...store.coverageSlots],
      tasks: [...store.tasks],
    },
    reconciled.members,
    reconciled.aliases
  );

  if (reconciled.aliases.size) {
    reconcileLocalNotifications(reconciled.members, reconciled.aliases);
  }

  const hasSlotsForToday = nextStore.coverageSlots.some((slot) => slot.businessDate === businessDate);
  if (!hasSlotsForToday) {
    const todaySlots = getSeedCoverageSlots(businessDate, nextStore.members);
    const todayTasks = todaySlots.flatMap((slot) => {
      const tasks = [createTaskFromSlot(slot, "primary")];
      if (slot.additionalDuty) tasks.push(createTaskFromSlot(slot, "additional"));
      return tasks;
    });
    nextStore = {
      ...nextStore,
      coverageSlots: [...nextStore.coverageSlots, ...todaySlots],
      tasks: [...nextStore.tasks, ...todayTasks],
    };
    const systemSender = createSystemMember();
    for (const task of todayTasks) {
      const recipient = nextStore.members.find((member) => member._id === task.memberId);
      if (recipient) {
        pushNotifications(
          [recipient],
          systemSender,
          `Today's task is ready: ${task.title}`,
          task
        );
      }
    }
    return nextStore;
  }

  return nextStore;
}

function getRecipientsForTask(store: DailyOpsStore, task: DailyTask, actorId?: string) {
  return store.members.filter((member) => member._id !== actorId && member._id === task.memberId);
}

function getCollaboratorRecipients(store: DailyOpsStore, actorId?: string) {
  return store.members.filter((member) => member._id !== actorId);
}

function syncTasksForCoverageSlot(tasks: DailyTask[], slot: CoverageSlot) {
  return tasks.map((task) => {
    if (task.coverageSlotId !== slot._id) return task;
    if (task.origin === "manual") return task;
    const title = task.origin === "primary" ? derivePrimaryTaskTitle(slot) : deriveAdditionalTaskTitle(slot.additionalDuty || "Additional duty");
    return {
      ...task,
      memberId: slot.memberId,
      title,
      channel: slot.channel,
      dutyLabel: task.origin === "primary" ? slot.channel : slot.additionalDuty || undefined,
      taskWindow: slot.taskWindow,
      scheduleWindow: slot.scheduleWindow,
      updatedAt: new Date().toISOString(),
    };
  });
}

function sortTasks(tasks: DailyTask[]) {
  return [...tasks].sort((a, b) => {
    const statusOrder: Record<DailyTaskStatus, number> = {
      todo: 0,
      in_progress: 1,
      pending: 2,
      carried_forward: 3,
      done: 4,
    };
    const byStatus = statusOrder[a.status] - statusOrder[b.status];
    if (byStatus !== 0) return byStatus;
    return a.title.localeCompare(b.title);
  });
}

export const dailyOpsApi = {
  getDashboard: async (businessDate = formatBusinessDate(), currentUser?: Member | null): Promise<DailyOpsDashboard> => {
    const store = readStore(currentUser);
    return {
      businessDate,
      members: sortMembers(store.members),
      coverageSlots: store.coverageSlots.filter((slot) => slot.businessDate === businessDate),
      tasks: sortTasks(store.tasks.filter((task) => task.businessDate === businessDate)),
    };
  },

  createMember: async (input: { username: string; email: string }) => {
    const store = readStore();
    const email = input.email.trim().toLowerCase();
    const username = input.username.trim();
    if (!username || !email) throw new Error("Name and email are required");
    if (store.members.some((member) => member.email === email)) {
      throw new Error("Member already exists");
    }
    const member = normalizeMember({ username, email });
    const nextStore = {
      ...store,
      members: mergeMembers(store.members, [member]),
    };
    writeStore(nextStore);
    return member;
  },

  syncMembers: async (members: Member[], actor?: Member | null) => {
    const store = readStore(actor);
    const normalizedIncoming = members
      .filter(hasMeaningfulIdentity)
      .map((member) => normalizeMember(member, member._id));
    const reconciled = reconcileMembers(store.members, normalizedIncoming);
    const nextStore = remapStoreMembers(store, reconciled.members, reconciled.aliases);
    if (reconciled.aliases.size) {
      reconcileLocalNotifications(reconciled.members, reconciled.aliases);
    }
    if (JSON.stringify(nextStore) !== JSON.stringify(store)) {
      writeStore(nextStore);
    }
    return nextStore.members;
  },

  createCoverageSlot: async (input: CoverageSlotInput) => {
    const store = readStore();
    const now = new Date().toISOString();
    const slot: CoverageSlot = {
      _id: makeId("coverage"),
      businessDate: input.businessDate,
      memberId: input.memberId,
      channel: input.channel,
      taskWindow: input.taskWindow.trim(),
      additionalDuty: input.additionalDuty?.trim() || undefined,
      scheduleWindow: input.scheduleWindow.trim(),
      notes: input.notes?.trim() || "",
      createdAt: now,
      updatedAt: now,
    };
    const nextTasks = [...store.tasks, createTaskFromSlot(slot, "primary")];
    if (slot.additionalDuty) nextTasks.push(createTaskFromSlot(slot, "additional"));
    const nextStore = {
      ...store,
      coverageSlots: [...store.coverageSlots, slot],
      tasks: nextTasks,
    };
    writeStore(nextStore);
    const recipient = nextStore.members.find((member) => member._id === slot.memberId);
    if (recipient) {
      const assignedTasks = nextTasks.filter((task) => task.coverageSlotId === slot._id);
      for (const assignedTask of assignedTasks) {
        pushNotifications([recipient], createSystemMember(), `New coverage assigned: ${assignedTask.title}`, assignedTask);
      }
    }
    return slot;
  },

  updateCoverageSlot: async (slotId: string, patch: Partial<CoverageSlot>) => {
    const store = readStore();
    let updated: CoverageSlot | undefined;
    let previous: CoverageSlot | undefined;
    const nextSlots = store.coverageSlots.map((slot) => {
      if (slot._id !== slotId) return slot;
      previous = slot;
      updated = {
        ...slot,
        ...patch,
        additionalDuty: patch.additionalDuty !== undefined ? patch.additionalDuty : slot.additionalDuty,
        updatedAt: new Date().toISOString(),
      };
      return updated;
    });
    if (!updated) throw new Error("Coverage slot not found");

    let nextTasks = syncTasksForCoverageSlot(store.tasks, updated);
    const hasAdditionalTask = nextTasks.some((task) => task.coverageSlotId === updated?._id && task.origin === "additional");
    if (updated.additionalDuty && !hasAdditionalTask) {
      nextTasks.push(createTaskFromSlot(updated, "additional"));
    }
    if (!updated.additionalDuty) {
      nextTasks = nextTasks.filter((task) => !(task.coverageSlotId === updated?._id && task.origin === "additional"));
    }
    const nextStore = {
      ...store,
      coverageSlots: nextSlots,
      tasks: nextTasks,
    };
    writeStore(nextStore);
    const memberId = updated?.memberId;
    const updatedId = updated?._id;
    const recipient = memberId ? nextStore.members.find((member) => member._id === memberId) : undefined;
    if (recipient && updatedId) {
      const affectedTasks = nextTasks.filter((task) => task.coverageSlotId === updatedId);
      const messagePrefix = previous?.memberId && previous.memberId !== memberId ? "You were assigned a daily task" : "Daily task updated";
      for (const task of affectedTasks) {
        pushNotifications([recipient], createSystemMember(), `${messagePrefix}: ${task.title}`, task);
      }
    }
    return updated;
  },

  createManualTask: async (input: ManualTaskInput, actor?: Member | null) => {
    const store = readStore(actor);
    const now = new Date().toISOString();
    const task: DailyTask = {
      _id: makeId("task"),
      businessDate: input.businessDate,
      memberId: input.memberId,
      title: input.title.trim(),
      description: input.description?.trim() || "",
      taskWindow: input.taskWindow.trim(),
      scheduleWindow: input.scheduleWindow.trim(),
      status: "todo",
      progressPercent: 0,
      origin: "manual",
      comments: [],
      attachments: [],
      createdAt: now,
      updatedAt: now,
    };
    const nextStore = {
      ...store,
      tasks: [...store.tasks, task],
    };
    writeStore(nextStore);
    const sender = actor || getStoredUser() || createSystemMember();
    const recipient = nextStore.members.find((member) => member._id === input.memberId);
    if (recipient) {
      pushNotifications([recipient], sender, `You were assigned a daily task: ${task.title}`, task);
    }
    return task;
  },

  updateTask: async (taskId: string, patch: DailyTaskPatch, actor?: Member | null) => {
    const store = readStore(actor);
    let updated: DailyTask | undefined;
    let previousStatus: DailyTaskStatus | undefined;
    let previousMemberId: string | undefined;
    const nextTasks = store.tasks.map((task) => {
      if (task._id !== taskId) return task;
      previousStatus = task.status;
      previousMemberId = task.memberId;
      const nextStatus = patch.status || task.status;
      const nextProgress = patch.progressPercent !== undefined ? patch.progressPercent : nextStatus === "done" ? 100 : task.progressPercent;
      updated = {
        ...task,
        ...patch,
        status: nextStatus,
        progressPercent: nextProgress,
        updatedAt: new Date().toISOString(),
      };
      return updated;
    });
    if (!updated) throw new Error("Task not found");
    writeStore({ ...store, tasks: nextTasks });

    const sender = actor || getStoredUser() || createSystemMember();
    if (patch.memberId && patch.memberId !== previousMemberId) {
      const nextRecipient = store.members.find((member) => member._id === patch.memberId);
      if (nextRecipient) {
        pushNotifications([nextRecipient], sender, `You were assigned a daily task: ${updated.title}`, updated);
      }
    }
    if (patch.status && previousStatus && patch.status !== previousStatus) {
      pushNotifications(
        getCollaboratorRecipients(store, sender._id),
        sender,
        `${updated.title} is now ${patch.status.replace("_", " ")}`,
        updated
      );
    }
    return updated;
  },

  completeTask: async (taskId: string, completionNote: string, actor?: Member | null) => {
    const store = readStore(actor);
    let updated: DailyTask | undefined;
    const nextTasks = store.tasks.map((task) => {
      if (task._id !== taskId) return task;
      updated = {
        ...task,
        status: "done",
        progressPercent: 100,
        completionNote: completionNote.trim(),
        pendingReason: "",
        updatedAt: new Date().toISOString(),
      };
      return updated;
    });
    if (!updated) throw new Error("Task not found");
    writeStore({ ...store, tasks: nextTasks });
    const sender = actor || getStoredUser() || createSystemMember();
    pushNotifications(
      getCollaboratorRecipients(store, sender._id),
      sender,
      `${updated.title} was completed at 100%`,
      updated
    );
    return updated;
  },

  markPending: async (taskId: string, reason: string, actor?: Member | null) => {
    const store = readStore(actor);
    const trimmedReason = reason.trim();
    if (!trimmedReason) throw new Error("Pending reason is required");
    let updated: DailyTask | undefined;
    const nextTasks = store.tasks.map((task) => {
      if (task._id !== taskId) return task;
      updated = {
        ...task,
        status: "pending",
        progressPercent: Math.max(task.progressPercent, 55),
        pendingReason: trimmedReason,
        updatedAt: new Date().toISOString(),
      };
      return updated;
    });
    if (!updated) throw new Error("Task not found");
    writeStore({ ...store, tasks: nextTasks });
    const sender = actor || getStoredUser() || createSystemMember();
    pushNotifications(
      getCollaboratorRecipients(store, sender._id),
      sender,
      `${updated.title} is pending: ${trimmedReason}`,
      updated
    );
    return updated;
  },

  carryForwardTask: async (taskId: string, nextShift: string, reason: string, actor?: Member | null) => {
    const store = readStore(actor);
    const shiftLabel = nextShift.trim();
    const carryReason = reason.trim();
    if (!shiftLabel || !carryReason) throw new Error("Next shift and reason are required");
    let updated: DailyTask | undefined;
    const nextTasks = store.tasks.map((task) => {
      if (task._id !== taskId) return task;
      updated = {
        ...task,
        status: "carried_forward",
        progressPercent: 100,
        carryForwardShift: shiftLabel,
        carryForwardReason: carryReason,
        pendingReason: carryReason,
        updatedAt: new Date().toISOString(),
      };
      return updated;
    });
    if (!updated) throw new Error("Task not found");
    writeStore({ ...store, tasks: nextTasks });
    const sender = actor || getStoredUser() || createSystemMember();
    pushNotifications(
      getCollaboratorRecipients(store, sender._id),
      sender,
      `${updated.title} moved to ${shiftLabel}`,
      updated
    );
    return updated;
  },

  addComment: async (taskId: string, text: string, actor?: Member | null, parentCommentId?: string) => {
    const store = readStore(actor);
    const sender = actor || getStoredUser();
    if (!sender) throw new Error("User not found");
    const trimmedText = text.trim();
    if (!trimmedText) throw new Error("Comment text is required");
    let updated: DailyTask | undefined;
    const nextTasks = store.tasks.map((task) => {
      if (task._id !== taskId) return task;
      const comment: DailyTaskComment = {
        _id: makeId("comment"),
        text: trimmedText,
        author: sender,
        parentCommentId,
        createdAt: new Date().toISOString(),
      };
      updated = {
        ...task,
        comments: [...task.comments, comment],
        updatedAt: new Date().toISOString(),
      };
      return updated;
    });
    if (!updated) throw new Error("Task not found");
    writeStore({ ...store, tasks: nextTasks });
    pushNotifications(
      getCollaboratorRecipients(store, sender._id),
      sender,
      parentCommentId
        ? `${sender.username} replied on ${updated.title}`
        : `${sender.username} commented on ${updated.title}`,
      updated,
      trimmedText
    );
    return updated;
  },

  editComment: async (taskId: string, commentId: string, text: string, actor?: Member | null) => {
    const store = readStore(actor);
    const sender = actor || getStoredUser();
    if (!sender) throw new Error("User not found");
    const trimmedText = text.trim();
    if (!trimmedText) throw new Error("Comment text is required");
    let updated: DailyTask | undefined;
    const nextTasks = store.tasks.map((task) => {
      if (task._id !== taskId) return task;
      const nextComments = task.comments.map((comment) => {
        if (comment._id !== commentId) return comment;
        if (comment.author._id !== sender._id) throw new Error("You can only edit your own comments");
        return {
          ...comment,
          text: trimmedText,
          updatedAt: new Date().toISOString(),
        };
      });
      updated = {
        ...task,
        comments: nextComments,
        updatedAt: new Date().toISOString(),
      };
      return updated;
    });
    if (!updated) throw new Error("Task not found");
    writeStore({ ...store, tasks: nextTasks });
    return updated;
  },

  deleteComment: async (taskId: string, commentId: string, actor?: Member | null) => {
    const store = readStore(actor);
    const sender = actor || getStoredUser();
    if (!sender) throw new Error("User not found");
    let updated: DailyTask | undefined;
    const nextTasks = store.tasks.map((task) => {
      if (task._id !== taskId) return task;
      const comment = task.comments.find((item) => item._id === commentId);
      if (!comment) return task;
      if (comment.author._id !== sender._id) throw new Error("You can only delete your own comments");
      updated = {
        ...task,
        comments: task.comments.filter((item) => item._id !== commentId),
        updatedAt: new Date().toISOString(),
      };
      return updated;
    });
    if (!updated) throw new Error("Task not found");
    writeStore({ ...store, tasks: nextTasks });
    return updated;
  },

  addAttachment: async (taskId: string, input: { name: string; url?: string }, actor?: Member | null) => {
    const store = readStore(actor);
    const sender = actor || getStoredUser();
    if (!sender) throw new Error("User not found");
    const name = input.name.trim();
    if (!name) throw new Error("Attachment name is required");
    let updated: DailyTask | undefined;
    const nextTasks = store.tasks.map((task) => {
      if (task._id !== taskId) return task;
      const attachment: DailyTaskAttachment = {
        _id: makeId("attachment"),
        name,
        url: input.url?.trim() || "",
        addedBy: sender,
        createdAt: new Date().toISOString(),
      };
      updated = {
        ...task,
        attachments: [...task.attachments, attachment],
        updatedAt: new Date().toISOString(),
      };
      return updated;
    });
    if (!updated) throw new Error("Task not found");
    writeStore({ ...store, tasks: nextTasks });
    pushNotifications(
      getCollaboratorRecipients(store, sender._id),
      sender,
      `${sender.username} attached evidence to ${updated.title}`,
      updated
    );
    return updated;
  },

  deleteAttachment: async (taskId: string, attachmentId: string, actor?: Member | null) => {
    const store = readStore(actor);
    const sender = actor || getStoredUser();
    if (!sender) throw new Error("User not found");
    let updated: DailyTask | undefined;
    const nextTasks = store.tasks.map((task) => {
      if (task._id !== taskId) return task;
      const attachment = task.attachments.find((item) => item._id === attachmentId);
      if (!attachment) return task;
      if (attachment.addedBy._id !== sender._id) throw new Error("You can only delete your own attachments");
      updated = {
        ...task,
        attachments: task.attachments.filter((item) => item._id !== attachmentId),
        updatedAt: new Date().toISOString(),
      };
      return updated;
    });
    if (!updated) throw new Error("Task not found");
    writeStore({ ...store, tasks: nextTasks });
    return updated;
  },
};
