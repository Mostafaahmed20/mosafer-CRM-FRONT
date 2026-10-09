import { useEffect, useState, type ReactElement } from "react";
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import SidebarRail from "@/components/SidebarRail";
import { NotificationBell } from "@/components/NotificationBell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { adminUserApi, type AdminUserRecord, type Member } from "@/lib/api";
import {
  dailyOpsApi,
  type CoverageSlot,
  type DailyOpsDashboard,
  type DailyTask,
  type DailyTaskComment,
  type DutyChannel,
} from "@/lib/dailyOps";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ArrowRightLeft,
  CheckCircle2,
  CircleDot,
  ClipboardCheck,
  Clock3,
  MessageSquare,
  Paperclip,
  Plus,
  Send,
  UserPlus,
} from "lucide-react";

type ViewMode = "my" | "team" | "pending" | "done";

const STATUS_STYLES: Record<DailyTask["status"], string> = {
  todo: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  in_progress: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-200",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200",
  done: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200",
  carried_forward: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200",
};

const CHANNEL_OPTIONS: DutyChannel[] = ["Mail", "WhatsApp", "Custom"];
const PANEL_CLASS =
  "border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900";
const PANEL_INSET_CLASS =
  "rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950";
const FIELD_CLASS =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:[color-scheme:dark] dark:focus:border-slate-500 dark:focus:ring-slate-800";
const DETAIL_BLOCK_CLASS =
  "space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950";
const PRIMARY_ACTION_CLASS =
  "rounded-lg border-transparent bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white";
const SECONDARY_ACTION_CLASS =
  "rounded-lg border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800";
const DAILY_OPS_STORAGE_KEY = "crm_daily_ops_v1";
const DAILY_OPS_CHANGED_EVENT = "crm:daily-ops-changed";

function formatDisplayDate(date: string) {
  return new Date(`${date}T09:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function MetricCard({ label, value, valueClassName }: { label: string; value: number; valueClassName?: string }) {
  return (
    <div className={cn(PANEL_CLASS, "rounded-xl p-4")}>
      <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
      <div className={cn("mt-2 text-2xl font-semibold text-slate-950 dark:text-white", valueClassName)}>{value}</div>
      <div className="mt-3 h-px bg-slate-200 dark:bg-slate-800" />
    </div>
  );
}

function formatBusinessDate(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildActor(user: { _id: string; username: string; email: string } | null): Member | null {
  if (!user) return null;
  return {
    _id: user._id,
    username: user.username,
    email: user.email,
  };
}

function statusLabel(status: DailyTask["status"]) {
  return status.replace(/_/g, " ");
}

function renderCommentTree(
  comments: DailyTaskComment[],
  parentCommentId: string | undefined,
  renderNode: (comment: DailyTaskComment, depth: number) => ReactElement,
  depth = 0
): ReactElement[] {
  return comments
    .filter((comment) => comment.parentCommentId === parentCommentId)
    .flatMap((comment) => [renderNode(comment, depth), ...renderCommentTree(comments, comment._id, renderNode, depth + 1)]);
}

export default function DailyOpsWorkspace() {
  const [location, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const actor = buildActor(user);
  const [dashboard, setDashboard] = useState<DailyOpsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("my");
  const [slotDrafts, setSlotDrafts] = useState<Record<string, Partial<CoverageSlot>>>({});
  const [memberName, setMemberName] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [coverageForm, setCoverageForm] = useState({
    memberId: "",
    channel: "Mail" as DutyChannel,
    taskWindow: "",
    additionalDuty: "",
    scheduleWindow: "",
  });
  const [manualTaskForm, setManualTaskForm] = useState({
    memberId: "",
    title: "",
    description: "",
    taskWindow: "",
    scheduleWindow: "",
  });
  const [commentText, setCommentText] = useState("");
  const [replyTargetId, setReplyTargetId] = useState<string | undefined>(undefined);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [attachmentName, setAttachmentName] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [completionNote, setCompletionNote] = useState("");
  const [pendingReason, setPendingReason] = useState("");
  const [carryShift, setCarryShift] = useState("Night shift");
  const [carryReason, setCarryReason] = useState("");

  const isAdminUser = String(user?.role || "").toLowerCase() === "admin";
  const businessDate = dashboard?.businessDate || formatBusinessDate();
  const members = dashboard?.members || [];
  const tasks = dashboard?.tasks || [];
  const coverageSlots = dashboard?.coverageSlots || [];

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [authLoading, isAuthenticated, setLocation]);

  useEffect(() => {
    if (isAuthenticated) {
      void loadDashboard({ syncMembers: true });
    }
  }, [isAuthenticated, user?._id]);

  useEffect(() => {
    const nextDrafts = Object.fromEntries(
      coverageSlots.map((slot) => [
        slot._id,
        {
          memberId: slot.memberId,
          channel: slot.channel,
          taskWindow: slot.taskWindow,
          additionalDuty: slot.additionalDuty || "",
          scheduleWindow: slot.scheduleWindow,
        },
      ])
    );
    setSlotDrafts(nextDrafts);
    if (!selectedTaskId && tasks.length > 0) {
      setSelectedTaskId(tasks[0]._id);
    }
    if (!coverageForm.memberId && members.length > 0) {
      setCoverageForm((prev) => ({ ...prev, memberId: members[0]._id }));
      setManualTaskForm((prev) => ({ ...prev, memberId: members[0]._id }));
    }
  }, [coverageSlots, tasks, members, selectedTaskId, coverageForm.memberId]);

  async function syncKnownMembers() {
    if (!actor) return;

    const nextMembers: Member[] = [actor];
    if (isAdminUser) {
      try {
        const users = await adminUserApi.getAll();
        nextMembers.push(
          ...users.map((account: AdminUserRecord) => ({
            _id: account._id,
            username: account.username,
            email: account.email,
          }))
        );
      } catch (error) {
        console.error("Failed to sync daily ops users:", error);
      }
    }

    await dailyOpsApi.syncMembers(nextMembers, actor);
  }

  async function loadDashboard(options?: { syncMembers?: boolean }) {
    try {
      setLoading(true);
      if (options?.syncMembers) {
        await syncKnownMembers();
      }
      const data = await dailyOpsApi.getDashboard(formatBusinessDate(), actor);
      setDashboard(data);
      if (data.tasks.length > 0) {
        setSelectedTaskId((current) => current && data.tasks.some((task) => task._id === current) ? current : data.tasks[0]._id);
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to load daily ops");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isAuthenticated) return;

    const handleDailyOpsChange = () => {
      void loadDashboard();
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key && event.key !== DAILY_OPS_STORAGE_KEY && event.key !== "user") return;
      handleDailyOpsChange();
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(DAILY_OPS_CHANGED_EVENT, handleDailyOpsChange);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(DAILY_OPS_CHANGED_EVENT, handleDailyOpsChange);
    };
  }, [isAuthenticated, user?._id]);

  const myMemberIds = members
    .filter(
      (member) =>
        member._id === actor?._id ||
        member.email.toLowerCase() === String(actor?.email || "").toLowerCase() ||
        member.username.toLowerCase() === String(actor?.username || "").toLowerCase()
    )
    .map((member) => member._id);

  const filteredTasks = tasks.filter((task) => {
    if (view === "my") return myMemberIds.includes(task.memberId);
    if (view === "pending") return task.status === "pending" || task.status === "carried_forward";
    if (view === "done") return task.status === "done";
    return true;
  });

  useEffect(() => {
    const query = location.includes("?") ? location.slice(location.indexOf("?") + 1) : "";
    const taskId = new URLSearchParams(query).get("task");
    if (taskId && tasks.some((task) => task._id === taskId)) {
      setSelectedTaskId(taskId);
    }
  }, [location, tasks]);

  const selectedTask = tasks.find((task) => task._id === selectedTaskId) || filteredTasks[0] || tasks[0] || null;
  const selectedTaskOwner = members.find((member) => member._id === selectedTask?.memberId) || null;

  useEffect(() => {
    if (selectedTask) {
      setCompletionNote(selectedTask.completionNote || "");
      setPendingReason(selectedTask.pendingReason || "");
      setCarryReason(selectedTask.carryForwardReason || selectedTask.pendingReason || "");
      setCarryShift(selectedTask.carryForwardShift || "Night shift");
    }
  }, [selectedTask?._id]);

  const stats = {
    total: tasks.length,
    completed: tasks.filter((task) => task.status === "done").length,
    pending: tasks.filter((task) => task.status === "pending" || task.status === "carried_forward").length,
    mine: tasks.filter((task) => myMemberIds.includes(task.memberId)).length,
  };

  async function handleAddMember() {
    try {
      await dailyOpsApi.createMember({ username: memberName, email: memberEmail });
      setMemberName("");
      setMemberEmail("");
      toast.success("Member added");
      await loadDashboard();
    } catch (error: any) {
      toast.error(error?.message || "Failed to add member");
    }
  }

  async function handleAddCoverageSlot() {
    try {
      await dailyOpsApi.createCoverageSlot({
        businessDate,
        memberId: coverageForm.memberId,
        channel: coverageForm.channel,
        taskWindow: coverageForm.taskWindow,
        additionalDuty: coverageForm.additionalDuty,
        scheduleWindow: coverageForm.scheduleWindow,
      });
      setCoverageForm((prev) => ({
        ...prev,
        taskWindow: "",
        additionalDuty: "",
        scheduleWindow: "",
      }));
      toast.success("Coverage slot created");
      await loadDashboard();
    } catch (error: any) {
      toast.error(error?.message || "Failed to create coverage slot");
    }
  }

  async function handleSaveCoverageSlot(slotId: string) {
    try {
      const patch = slotDrafts[slotId];
      if (!patch) return;
      await dailyOpsApi.updateCoverageSlot(slotId, {
        memberId: patch.memberId,
        channel: patch.channel as DutyChannel,
        taskWindow: patch.taskWindow,
        additionalDuty: patch.additionalDuty,
        scheduleWindow: patch.scheduleWindow,
      });
      toast.success("Coverage updated");
      await loadDashboard();
    } catch (error: any) {
      toast.error(error?.message || "Failed to update coverage");
    }
  }

  async function handleCreateManualTask() {
    try {
      await dailyOpsApi.createManualTask(
        {
          businessDate,
          memberId: manualTaskForm.memberId,
          title: manualTaskForm.title,
          description: manualTaskForm.description,
          taskWindow: manualTaskForm.taskWindow,
          scheduleWindow: manualTaskForm.scheduleWindow,
        },
        actor
      );
      setManualTaskForm((prev) => ({
        ...prev,
        title: "",
        description: "",
        taskWindow: "",
        scheduleWindow: "",
      }));
      toast.success("Manual task created");
      await loadDashboard();
    } catch (error: any) {
      toast.error(error?.message || "Failed to create task");
    }
  }

  async function handleCompleteTask() {
    if (!selectedTask) return;
    try {
      await dailyOpsApi.completeTask(selectedTask._id, completionNote, actor);
      toast.success("Task completed at 100%");
      await loadDashboard();
    } catch (error: any) {
      toast.error(error?.message || "Failed to complete task");
    }
  }

  async function handlePendingTask() {
    if (!selectedTask) return;
    try {
      await dailyOpsApi.markPending(selectedTask._id, pendingReason, actor);
      toast.success("Task marked pending");
      await loadDashboard();
    } catch (error: any) {
      toast.error(error?.message || "Failed to mark pending");
    }
  }

  async function handleCarryTask() {
    if (!selectedTask) return;
    try {
      await dailyOpsApi.carryForwardTask(selectedTask._id, carryShift, carryReason, actor);
      toast.success("Task moved to the next shift");
      await loadDashboard();
    } catch (error: any) {
      toast.error(error?.message || "Failed to move task");
    }
  }

  async function handleAddComment() {
    if (!selectedTask) return;
    try {
      await dailyOpsApi.addComment(selectedTask._id, commentText, actor, replyTargetId);
      setCommentText("");
      setReplyTargetId(undefined);
      toast.success("Comment added");
      await loadDashboard();
    } catch (error: any) {
      toast.error(error?.message || "Failed to add comment");
    }
  }

  async function handleSaveEditedComment() {
    if (!selectedTask || !editingCommentId) return;
    try {
      await dailyOpsApi.editComment(selectedTask._id, editingCommentId, editingCommentText, actor);
      setEditingCommentId(null);
      setEditingCommentText("");
      toast.success("Comment updated");
      await loadDashboard();
    } catch (error: any) {
      toast.error(error?.message || "Failed to edit comment");
    }
  }

  async function handleDeleteComment(commentId: string) {
    if (!selectedTask) return;
    try {
      await dailyOpsApi.deleteComment(selectedTask._id, commentId, actor);
      toast.success("Comment deleted");
      await loadDashboard();
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete comment");
    }
  }

  async function handleAddAttachment() {
    if (!selectedTask) return;
    try {
      await dailyOpsApi.addAttachment(
        selectedTask._id,
        {
          name: attachmentName,
          url: attachmentUrl,
        },
        actor
      );
      setAttachmentName("");
      setAttachmentUrl("");
      toast.success("Evidence attached");
      await loadDashboard();
    } catch (error: any) {
      toast.error(error?.message || "Failed to attach evidence");
    }
  }

  async function handleDeleteAttachment(attachmentId: string) {
    if (!selectedTask) return;
    try {
      await dailyOpsApi.deleteAttachment(selectedTask._id, attachmentId, actor);
      toast.success("Attachment deleted");
      await loadDashboard();
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete attachment");
    }
  }

  function canManageOwnComment(comment: DailyTaskComment) {
    return comment.author._id === actor?._id;
  }

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <SidebarRail />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <div className="flex h-16 items-center justify-between gap-4 px-6">
            <div className="min-w-0">
              <div className="text-sm text-slate-500 dark:text-slate-400">Operations coverage and recurring tasks</div>
              <div className="truncate text-lg font-semibold text-slate-950 dark:text-white">Daily Ops Workspace</div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden rounded-md border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-600 sm:block dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                {businessDate}
              </div>
              <NotificationBell />
              <button className="member-avatar-lg member-avatar">
                {user?.username?.charAt(0).toUpperCase() || "U"}
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-6 py-6">
          <section className={cn(PANEL_CLASS, "hidden rounded-2xl px-6 py-5")}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-slate-950 dark:text-white">Daily Ops Workspace</h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Manage coverage, recurring work, and handoff notes in one place.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[480px]">
                <div className={cn(PANEL_INSET_CLASS, "p-3")}>
                  <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Date</div>
                  <div className="mt-1 text-sm font-medium text-slate-950 dark:text-white">{formatDisplayDate(businessDate)}</div>
                </div>
                <div className={cn(PANEL_INSET_CLASS, "p-3")}>
                  <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Team</div>
                  <div className="mt-1 text-sm font-medium text-slate-950 dark:text-white">{members.length} active members</div>
                </div>
                <div className={cn(PANEL_INSET_CLASS, "p-3")}>
                  <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Focus</div>
                  <div className="mt-1 truncate text-sm font-medium text-slate-950 dark:text-white">
                    {selectedTask?.title || "Select a task"}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="hidden mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Total tasks" value={stats.total} />
            <MetricCard label="Completed" value={stats.completed} valueClassName="text-emerald-600 dark:text-emerald-300" />
            <MetricCard label="Pending / carry" value={stats.pending} valueClassName="text-amber-600 dark:text-amber-300" />
            <MetricCard label="My tasks" value={stats.mine} valueClassName="text-sky-600 dark:text-sky-300" />
          </div>

          {isAdminUser && (
            <details className="mt-4 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white">
                Manage team and task setup
              </summary>
              <div className="grid gap-4 border-t border-slate-200 p-4 dark:border-slate-800 xl:grid-cols-3">
              <Card className={cn(PANEL_CLASS, "rounded-xl")}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <UserPlus className="h-4 w-4" />
                    Add Member
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input placeholder="Member name" value={memberName} onChange={(e) => setMemberName(e.target.value)} />
                  <Input placeholder="Email" value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} />
                  <Button className={cn("w-full", PRIMARY_ACTION_CLASS)} onClick={handleAddMember}>
                    Add member
                  </Button>
                </CardContent>
              </Card>

              <Card className={cn(PANEL_CLASS, "rounded-xl")}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Plus className="h-4 w-4" />
                    Add Coverage Slot
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <select
                    value={coverageForm.memberId}
                    onChange={(e) => setCoverageForm((prev) => ({ ...prev, memberId: e.target.value }))}
                    className={FIELD_CLASS}
                  >
                    {members.map((member) => (
                      <option key={member._id} value={member._id}>
                        {member.username}
                      </option>
                    ))}
                  </select>
                  <select
                    value={coverageForm.channel}
                    onChange={(e) => setCoverageForm((prev) => ({ ...prev, channel: e.target.value as DutyChannel }))}
                    className={FIELD_CLASS}
                  >
                    {CHANNEL_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <Input
                    placeholder="Task window"
                    value={coverageForm.taskWindow}
                    onChange={(e) => setCoverageForm((prev) => ({ ...prev, taskWindow: e.target.value }))}
                  />
                  <Input
                    placeholder="Additional duty"
                    value={coverageForm.additionalDuty}
                    onChange={(e) => setCoverageForm((prev) => ({ ...prev, additionalDuty: e.target.value }))}
                  />
                  <Input
                    placeholder="Schedule window"
                    value={coverageForm.scheduleWindow}
                    onChange={(e) => setCoverageForm((prev) => ({ ...prev, scheduleWindow: e.target.value }))}
                  />
                  <Button className={cn("w-full", PRIMARY_ACTION_CLASS)} onClick={handleAddCoverageSlot}>
                    Create coverage
                  </Button>
                </CardContent>
              </Card>

              <Card className={cn(PANEL_CLASS, "rounded-xl")}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ClipboardCheck className="h-4 w-4" />
                    Manual Task
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <select
                    value={manualTaskForm.memberId}
                    onChange={(e) => setManualTaskForm((prev) => ({ ...prev, memberId: e.target.value }))}
                    className={FIELD_CLASS}
                  >
                    {members.map((member) => (
                      <option key={member._id} value={member._id}>
                        {member.username}
                      </option>
                    ))}
                  </select>
                  <Input
                    placeholder="Task title"
                    value={manualTaskForm.title}
                    onChange={(e) => setManualTaskForm((prev) => ({ ...prev, title: e.target.value }))}
                  />
                  <Textarea
                    placeholder="Description"
                    value={manualTaskForm.description}
                    onChange={(e) => setManualTaskForm((prev) => ({ ...prev, description: e.target.value }))}
                    className="min-h-[84px]"
                  />
                  <Input
                    placeholder="Task window"
                    value={manualTaskForm.taskWindow}
                    onChange={(e) => setManualTaskForm((prev) => ({ ...prev, taskWindow: e.target.value }))}
                  />
                  <Input
                    placeholder="Schedule window"
                    value={manualTaskForm.scheduleWindow}
                    onChange={(e) => setManualTaskForm((prev) => ({ ...prev, scheduleWindow: e.target.value }))}
                  />
                  <Button className={cn("w-full", PRIMARY_ACTION_CLASS)} onClick={handleCreateManualTask}>
                    Assign task
                  </Button>
                </CardContent>
              </Card>
              </div>
            </details>
          )}

          <div className="mt-4 grid gap-4 xl:grid-cols-[1.15fr,0.85fr]">
            <div className="space-y-4">
              <details className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white">
                  Coverage planner
                </summary>
                <Card className={cn(PANEL_CLASS, "rounded-none border-x-0 border-b-0 shadow-none")}>
                  <CardHeader>
                    <CardDescription>Member coverage and duty windows.</CardDescription>
                  </CardHeader>
                  <CardContent>
                  <div className={cn(PANEL_INSET_CLASS, "p-2 sm:p-3")}>
                    <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Team Member</TableHead>
                        <TableHead>Task Type</TableHead>
                        <TableHead>Handling Window</TableHead>
                        <TableHead>Additional Tasks</TableHead>
                        <TableHead>Schedule</TableHead>
                        {isAdminUser && <TableHead className="text-right">Action</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {coverageSlots.map((slot) => (
                        <TableRow key={slot._id}>
                          <TableCell>
                            {isAdminUser ? (
                              <select
                                value={String(slotDrafts[slot._id]?.memberId || slot.memberId)}
                                onChange={(e) =>
                                  setSlotDrafts((prev) => ({
                                    ...prev,
                                    [slot._id]: { ...prev[slot._id], memberId: e.target.value },
                                  }))
                                }
                                className={FIELD_CLASS}
                              >
                                {members.map((member) => (
                                  <option key={member._id} value={member._id}>
                                    {member.username}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span>{members.find((member) => member._id === slot.memberId)?.username || "-"}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {isAdminUser ? (
                              <select
                                value={String(slotDrafts[slot._id]?.channel || slot.channel)}
                                onChange={(e) =>
                                  setSlotDrafts((prev) => ({
                                    ...prev,
                                    [slot._id]: { ...prev[slot._id], channel: e.target.value as DutyChannel },
                                  }))
                                }
                                className={FIELD_CLASS}
                              >
                                {CHANNEL_OPTIONS.map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span>{slot.channel}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {isAdminUser ? (
                              <Input
                                value={String(slotDrafts[slot._id]?.taskWindow || slot.taskWindow)}
                                onChange={(e) =>
                                  setSlotDrafts((prev) => ({
                                    ...prev,
                                    [slot._id]: { ...prev[slot._id], taskWindow: e.target.value },
                                  }))
                                }
                              />
                            ) : (
                              <span>{slot.taskWindow}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {isAdminUser ? (
                              <Input
                                value={String(slotDrafts[slot._id]?.additionalDuty || slot.additionalDuty || "")}
                                onChange={(e) =>
                                  setSlotDrafts((prev) => ({
                                    ...prev,
                                    [slot._id]: { ...prev[slot._id], additionalDuty: e.target.value },
                                  }))
                                }
                              />
                            ) : (
                              <span>{slot.additionalDuty || "-"}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {isAdminUser ? (
                              <Input
                                value={String(slotDrafts[slot._id]?.scheduleWindow || slot.scheduleWindow)}
                                onChange={(e) =>
                                  setSlotDrafts((prev) => ({
                                    ...prev,
                                    [slot._id]: { ...prev[slot._id], scheduleWindow: e.target.value },
                                  }))
                                }
                              />
                            ) : (
                              <span>{slot.scheduleWindow || "-"}</span>
                            )}
                          </TableCell>
                          {isAdminUser && (
                            <TableCell className="text-right">
                              <Button size="sm" variant="outline" className={SECONDARY_ACTION_CLASS} onClick={() => handleSaveCoverageSlot(slot._id)}>
                                Save
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                    </Table>
                  </div>
                  </CardContent>
                </Card>
              </details>

              <Card className={cn(PANEL_CLASS, "rounded-xl")}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">Today&apos;s Tasks</CardTitle>
                      <CardDescription>Primary queue ownership, extra duties, and manual assignments.</CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-950">
                      {([
                        ["my", "My tasks"],
                        ["team", "Team"],
                        ["pending", "Pending"],
                        ["done", "Done"],
                      ] as const).map(([id, label]) => (
                        <Button
                          key={id}
                          size="sm"
                          variant={view === id ? "default" : "outline"}
                          className={cn(
                            "rounded-md",
                            view === id
                              ? PRIMARY_ACTION_CLASS
                              : "border-transparent bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                          )}
                          onClick={() => setView(id)}
                        >
                          {label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 md:grid-cols-2">
                    {(filteredTasks.length ? filteredTasks : tasks).map((task) => {
                      const owner = members.find((member) => member._id === task.memberId);
                      const isSelected = selectedTask?._id === task._id;
                      return (
                        <button
                          key={task._id}
                          type="button"
                          onClick={() => setSelectedTaskId(task._id)}
                          className={cn(
                            "rounded-xl border p-4 text-left transition-colors",
                            isSelected
                              ? "border-sky-500 bg-sky-50 text-slate-950 dark:border-sky-400 dark:bg-sky-950/30 dark:text-white"
                              : "border-slate-200 bg-white text-slate-900 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:hover:border-slate-700"
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-xs uppercase tracking-[0.18em] opacity-70">{task.origin}</div>
                              <div className="mt-2 font-semibold">{task.title}</div>
                              <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                                {owner?.username || "Unassigned"} - {task.taskWindow}
                              </div>
                            </div>
                            <span
                              className={cn(
                                "rounded-full px-2.5 py-1 text-xs font-semibold capitalize",
                                isSelected ? "bg-white/15 text-white" : STATUS_STYLES[task.status]
                              )}
                            >
                              {statusLabel(task.status)}
                            </span>
                          </div>
                          <div className="mt-3">
                            <div className={cn("h-2 rounded-full", isSelected ? "bg-sky-100 dark:bg-sky-900/40" : "bg-slate-100 dark:bg-slate-800")}>
                              <div
                                className={cn("h-2 rounded-full", isSelected ? "bg-sky-600 dark:bg-sky-300" : "bg-slate-900 dark:bg-slate-200")}
                                style={{ width: `${task.progressPercent}%` }}
                              />
                            </div>
                            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">{task.progressPercent}% complete</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {!loading && tasks.length === 0 && (
                    <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                      No daily tasks created yet.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className={cn(PANEL_CLASS, "h-fit rounded-xl xl:sticky xl:top-24")}>
              <CardHeader>
                <CardTitle className="text-base">Task Detail</CardTitle>
                <CardDescription>Update completion, explain pending work, attach evidence, and discuss the task.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {!selectedTask && !loading && (
                  <div className="text-sm text-slate-500 dark:text-slate-400">Select a task to manage it.</div>
                )}

                {selectedTask && (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <h2 className="text-lg font-semibold">{selectedTask.title}</h2>
                        <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold capitalize", STATUS_STYLES[selectedTask.status])}>
                          {statusLabel(selectedTask.status)}
                        </span>
                      </div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        {selectedTaskOwner?.username || "Unassigned"} - {selectedTask.taskWindow}
                        {selectedTask.scheduleWindow ? ` - ${selectedTask.scheduleWindow}` : ""}
                      </div>
                      {selectedTask.description && (
                        <p className="text-sm text-slate-600 dark:text-slate-300">{selectedTask.description}</p>
                      )}
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      <div className={DETAIL_BLOCK_CLASS}>
                        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                          <CircleDot className="h-4 w-4" />
                          Progress
                        </div>
                        <div className="mt-2 text-2xl font-semibold">{selectedTask.progressPercent}%</div>
                      </div>
                      <div className={DETAIL_BLOCK_CLASS}>
                        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                          <Clock3 className="h-4 w-4" />
                          Updated
                        </div>
                        <div className="mt-2 text-sm font-medium">
                          {formatDistanceToNow(new Date(selectedTask.updatedAt), { addSuffix: true })}
                        </div>
                      </div>
                      <div className={DETAIL_BLOCK_CLASS}>
                        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                          <ClipboardCheck className="h-4 w-4" />
                          Evidence
                        </div>
                        <div className="mt-2 text-2xl font-semibold">{selectedTask.attachments.length}</div>
                      </div>
                    </div>

                    <div className={DETAIL_BLOCK_CLASS}>
                      <div className="flex items-center gap-2 font-semibold">
                        <CheckCircle2 className="h-4 w-4" />
                        Completion
                      </div>
                      <Textarea
                        value={completionNote}
                        onChange={(e) => setCompletionNote(e.target.value)}
                        placeholder="Add what was completed"
                        className="min-h-[88px]"
                      />
                      <Button className={cn("w-full", PRIMARY_ACTION_CLASS)} onClick={handleCompleteTask}>
                        Mark complete 100%
                      </Button>
                    </div>

                    <div className={DETAIL_BLOCK_CLASS}>
                      <div className="flex items-center gap-2 font-semibold">
                        <Clock3 className="h-4 w-4" />
                        Pending
                      </div>
                      <Textarea
                        value={pendingReason}
                        onChange={(e) => setPendingReason(e.target.value)}
                        placeholder="Why is this task pending?"
                        className="min-h-[88px]"
                      />
                      <Button variant="outline" className={cn("w-full", SECONDARY_ACTION_CLASS)} onClick={handlePendingTask}>
                        Save pending reason
                      </Button>
                    </div>

                    <div className={DETAIL_BLOCK_CLASS}>
                      <div className="flex items-center gap-2 font-semibold">
                        <ArrowRightLeft className="h-4 w-4" />
                        Move To Another Shift
                      </div>
                      <Input value={carryShift} onChange={(e) => setCarryShift(e.target.value)} placeholder="Next shift" />
                      <Textarea
                        value={carryReason}
                        onChange={(e) => setCarryReason(e.target.value)}
                        placeholder="What should the next shift know?"
                        className="min-h-[84px]"
                      />
                      <Button variant="outline" className={cn("w-full", SECONDARY_ACTION_CLASS)} onClick={handleCarryTask}>
                        Carry forward
                      </Button>
                    </div>

                    <div className={DETAIL_BLOCK_CLASS}>
                      <div className="flex items-center gap-2 font-semibold">
                        <Paperclip className="h-4 w-4" />
                        Attach Evidence
                      </div>
                      <Input value={attachmentName} onChange={(e) => setAttachmentName(e.target.value)} placeholder="Attachment label" />
                      <Input value={attachmentUrl} onChange={(e) => setAttachmentUrl(e.target.value)} placeholder="Optional URL" />
                      <Button variant="outline" className={cn("w-full", SECONDARY_ACTION_CLASS)} onClick={handleAddAttachment}>
                        Add attachment
                      </Button>
                      <div className="space-y-2">
                        {selectedTask.attachments.map((attachment) => (
                          <div key={attachment._id} className="rounded-xl border border-slate-200/70 bg-white/60 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="font-medium">{attachment.name}</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                  Added by {attachment.addedBy.username}
                                </div>
                                {attachment.url && (
                                  <a
                                    href={attachment.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs text-sky-600 dark:text-sky-300 break-all"
                                  >
                                    {attachment.url}
                                  </a>
                                )}
                              </div>
                              {attachment.addedBy._id === actor?._id && (
                                <Button size="sm" variant="ghost" onClick={() => handleDeleteAttachment(attachment._id)}>
                                  Delete
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className={DETAIL_BLOCK_CLASS}>
                      <div className="flex items-center gap-2 font-semibold">
                        <MessageSquare className="h-4 w-4" />
                        Comments & Replies
                      </div>
                      {replyTargetId && (
                        <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-100 px-3 py-2 text-xs dark:bg-white/[0.08]">
                          <span>Replying to a comment</span>
                          <button type="button" onClick={() => setReplyTargetId(undefined)}>
                            Clear
                          </button>
                        </div>
                      )}
                      <Textarea
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Add an update, reply, or blocker"
                        className="min-h-[90px]"
                      />
                      <Button className={cn("w-full", PRIMARY_ACTION_CLASS)} onClick={handleAddComment}>
                        <Send className="mr-2 h-4 w-4" />
                        Post comment
                      </Button>
                      <div className="space-y-3">
                        {renderCommentTree(selectedTask.comments, undefined, (comment, depth) => (
                          <div
                            key={comment._id}
                            className="rounded-xl border border-slate-200/70 bg-white/60 p-3 dark:border-white/10 dark:bg-white/[0.03]"
                            style={{ marginLeft: `${depth * 18}px` }}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold">{comment.author.username}</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                  {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                                  {comment.updatedAt ? " - edited" : ""}
                                </div>
                              </div>
                              <div className="flex gap-1">
                                <Button size="sm" variant="ghost" onClick={() => setReplyTargetId(comment._id)}>
                                  Reply
                                </Button>
                                {canManageOwnComment(comment) && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        setEditingCommentId(comment._id);
                                        setEditingCommentText(comment.text);
                                      }}
                                    >
                                      Edit
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => handleDeleteComment(comment._id)}>
                                      Delete
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                            {editingCommentId === comment._id ? (
                              <div className="mt-3 space-y-2">
                                <Textarea
                                  value={editingCommentText}
                                  onChange={(e) => setEditingCommentText(e.target.value)}
                                  className="min-h-[80px]"
                                />
                                <div className="flex gap-2">
                                  <Button size="sm" onClick={handleSaveEditedComment}>
                                    Save
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => setEditingCommentId(null)}>
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <p className="mt-3 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{comment.text}</p>
                            )}
                          </div>
                        ))}

                        {selectedTask.comments.length === 0 && (
                          <div className="text-sm text-slate-500 dark:text-slate-400">No comments yet.</div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
