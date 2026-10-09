import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { boardApi, Board, customerApi, CustomerProfile } from "@/lib/api";
import { NotificationBell } from "@/components/NotificationBell";
import { toast } from "sonner";
import {
  Layers,
  Plus,
  Search,
  LogOut,
  ChevronDown,
  Loader2,
  FileText,
  Filter,
  ArrowUpDown,
  SlidersHorizontal,
  ArrowRight,
  Plane,
  Hotel,
  PackageSearch,
  CreditCard,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import SidebarRail from "@/components/SidebarRail";

// Board background colors
const BOARD_COLORS = [
  { id: "blue", color: "#3B82F6", name: "Blue" },
  { id: "indigo", color: "#6366F1", name: "Indigo" },
  { id: "violet", color: "#8B5CF6", name: "Violet" },
  { id: "emerald", color: "#10B981", name: "Emerald" },
  { id: "orange", color: "#F97316", name: "Orange" },
  { id: "rose", color: "#F43F5E", name: "Rose" },
  { id: "cyan", color: "#06B6D4", name: "Cyan" },
  { id: "amber", color: "#F59E0B", name: "Amber" },
  { id: "slate", color: "#64748B", name: "Slate" },
];

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { user, logout, isAuthenticated, isLoading: authLoading } = useAuth();
  const [boards, setBoards] = useState<Board[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [globalQuery, setGlobalQuery] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newBoardTitle, setNewBoardTitle] = useState("");
  const [selectedColor, setSelectedColor] = useState(BOARD_COLORS[0]);
  const [isCreating, setIsCreating] = useState(false);
  const [agencyProfiles, setAgencyProfiles] = useState<CustomerProfile[]>([]);
  const [selectedAgencyId, setSelectedAgencyId] = useState("");
  const [isLoadingAgencyProfiles, setIsLoadingAgencyProfiles] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [authLoading, isAuthenticated, setLocation]);

  useEffect(() => {
    if (isAuthenticated) {
      loadBoards();
      loadAgencyProfiles();
    }
  }, [isAuthenticated]);

  const loadBoards = async () => {
    try {
      console.log("ðŸ”„ Loading boards...");
      const data = await boardApi.getAll() as Board[];
      console.log("âœ… Loaded boards:", data);
      setBoards(data);
    } catch (error: any) {
      console.error("âŒ Failed to load boards:", error);
      console.error("   Error message:", error.message);
      console.error("   Error response:", error.response?.data);
      toast.error(`Failed to load boards: ${error.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAgencyProfiles = async () => {
    try {
      setIsLoadingAgencyProfiles(true);
      const data = await customerApi.getAll();
      setAgencyProfiles(data);
    } catch {
      setAgencyProfiles([]);
    } finally {
      setIsLoadingAgencyProfiles(false);
    }
  };

  const handleCreateBoard = async () => {
    if (!newBoardTitle.trim()) return;

    setIsCreating(true);
    try {
      const selectedAgency = agencyProfiles.find((agency) => agency._id === selectedAgencyId);
      const newBoard = await boardApi.create({
        title: newBoardTitle.trim(),
        background: selectedColor.id,
        customerProfileId: selectedAgency?._id,
        description: selectedAgency
          ? [
              "Agency Profile",
              `Agency: ${selectedAgency.agencyName}`,
              `Location: ${selectedAgency.location}`,
              `Email: ${selectedAgency.email}`,
              `Decision Role: ${selectedAgency.decisionRole}`,
            ].join("\n")
          : undefined,
      }) as Board;
      setBoards([...boards, newBoard]);
      setNewBoardTitle("");
      setSelectedColor(BOARD_COLORS[0]);
      setSelectedAgencyId("");
      setIsCreateDialogOpen(false);
      toast.success("Board created!");
      setLocation(`/board/${newBoard._id}`);
    } catch (error) {
      toast.error("Failed to create board");
    } finally {
      setIsCreating(false);
    }
  };

  const handleLogout = () => {
    logout();
    setLocation("/");
  };

  const handleGlobalSearch = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && globalQuery.trim()) {
      setLocation(`/workspace/search?q=${encodeURIComponent(globalQuery.trim())}`);
    }
  };

  const filteredBoards = boards.filter((board) =>
    board.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getBackgroundColor = (board: Board) => {
    const bg = BOARD_COLORS.find((c) => c.id === board.background);
    return bg?.color || board.background || "#6366F1";
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#6366F1]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7FB] dark:bg-slate-950 flex text-slate-900 dark:text-slate-100">
      <SidebarRail />

      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur border-b border-slate-200 dark:border-slate-800">
          <div className="px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <div className="text-sm text-slate-500 dark:text-slate-400">All tickets</div>
                <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Boards <span className="text-slate-400 dark:text-slate-500">({boards.length})</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 bg-white dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100"
                  onClick={() => setIsCreateDialogOpen(true)}
                >
                  <Plus className="w-4 h-4" />
                  New
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLocation("/tools/hotel-quote")}
                  className="text-slate-600 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Hotel Quote Tool
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                <Input
                  placeholder="Find order, customer, PNR..."
                  value={globalQuery}
                  onChange={(e) => setGlobalQuery(e.target.value)}
                  onKeyDown={handleGlobalSearch}
                  className="pl-9 h-10 w-64 bg-slate-50 border-slate-200 rounded-xl dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>
              <NotificationBell />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="member-avatar-lg member-avatar">
                    {user?.username?.charAt(0).toUpperCase() || "U"}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 dark:bg-slate-900 dark:border-slate-800">
                  <div className="px-3 py-2.5 border-b border-[#E2E8F0] dark:border-slate-800">
                    <p className="font-semibold text-[#0F172A] dark:text-slate-100">{user?.username}</p>
                    <p className="text-sm text-[#475569] dark:text-slate-400">{user?.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                    <LogOut className="w-4 h-4 mr-2" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          {/* Ticket list */}
          <main className="flex-1 px-6 py-6 overflow-y-auto">
            <section className="mb-6 rounded-[28px] border border-[#D9E5F4] bg-[#102A43] p-6 text-white shadow-[0_20px_48px_rgba(15,42,67,0.14)]">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8FC9D3]">Operations hub</div>
                  <h1 className="mt-2 text-3xl font-semibold tracking-tight">Good to see you, {user?.username || "team"}</h1>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-[#B7C9DC]">
                    Keep customer requests, booking work, and team handovers moving from one desk.
                  </p>
                </div>
                <Button
                  onClick={() => setLocation("/workspace/search")}
                  className="h-11 rounded-xl bg-[#17B897] px-5 text-white hover:bg-[#119D84]"
                >
                  Open global search
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {[
                  { label: "Work queues", value: boards.length, tone: "text-[#8FC9D3]" },
                  { label: "Lists in view", value: boards.reduce((sum, board) => sum + (board.lists?.length || 0), 0), tone: "text-[#FFD38A]" },
                  { label: "Active tickets", value: boards.reduce((sum, board) => sum + (board.lists || []).reduce((listSum, list) => listSum + (list.cards || []).length, 0), 0), tone: "text-[#A8E6CF]" },
                ].map((metric) => (
                  <div key={metric.label} className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3">
                    <div className="text-xs text-[#B7C9DC]">{metric.label}</div>
                    <div className={`mt-1 text-2xl font-semibold ${metric.tone}`}>{metric.value}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Flight orders", icon: Plane, detail: "Find PNRs and booking references", path: "/orders?view=flight" },
                { label: "Hotel orders", icon: Hotel, detail: "Review supplier confirmations", path: "/orders?view=hotel" },
                { label: "Packages", icon: PackageSearch, detail: "Open travel service requests", path: "/orders?view=packages" },
                { label: "Payments", icon: CreditCard, detail: "Check payment-related orders", path: "/orders?view=payments" },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setLocation(item.path)}
                  className="group flex items-center gap-3 rounded-2xl border border-[#D9E5F4] bg-white px-4 py-4 text-left shadow-[0_12px_28px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-[#A8C6EA]"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF2FF] text-[#2063E9]">
                    <item.icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-[#102A43]">{item.label}</span>
                    <span className="mt-1 block truncate text-xs text-[#6B7C93]">{item.detail}</span>
                  </span>
                  <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-[#829AB1] transition group-hover:translate-x-1" />
                </button>
              ))}
            </section>

            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                <Button variant="ghost" size="sm" className="gap-2 text-slate-600 dark:text-slate-200">
                  <ArrowUpDown className="w-4 h-4" />
                  Sort by: Date created
                </Button>
                <Button variant="ghost" size="sm" className="gap-2 text-slate-600 dark:text-slate-200">
                  <SlidersHorizontal className="w-4 h-4" />
                  Layout: Card
                </Button>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <Filter className="w-4 h-4" />
                Filters (1)
              </div>
            </div>

            <div className="space-y-3">
              {filteredBoards.map((board) => (
                <button
                  key={board._id}
                  onClick={() => setLocation(`/board/${board._id}`)}
                  className="w-full text-left bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 transition shadow-sm dark:shadow-slate-950"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="h-10 w-10 rounded-xl flex items-center justify-center text-white font-semibold"
                        style={{ backgroundColor: getBackgroundColor(board) }}
                      >
                        {board.title.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm text-slate-500 dark:text-slate-400">Board</div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {board.title}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          {board.lists?.length || 0} lists · Updated{" "}
                          {new Date(board.updatedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-300">
                      <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold dark:bg-emerald-900/50 dark:text-emerald-200">
                        Open
                      </span>
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </div>
                </button>
              ))}

              {filteredBoards.length === 0 && !isLoading && (
                <div className="text-center py-16">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-900/40 flex items-center justify-center mx-auto mb-4">
                    <Layers className="w-8 h-8 text-[#6366F1]" />
                  </div>
                  <h3 className="text-lg font-bold text-[#0F172A] dark:text-slate-100 mb-2">
                    {searchQuery ? "No boards found" : "No boards yet"}
                  </h3>
                  <p className="text-[#475569] dark:text-slate-400 mb-6">
                    {searchQuery
                      ? "Try a different search term"
                      : "Create your first board to start managing your pipeline"}
                  </p>
                  {!searchQuery && (
                    <Button
                      onClick={() => setIsCreateDialogOpen(true)}
                      className="bg-[#6366F1] hover:bg-[#4F46E5] text-white shadow-md shadow-indigo-500/25 dark:shadow-indigo-900/50"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Create board
                    </Button>
                  )}
                </div>
              )}
            </div>
          </main>

          {/* Filters panel removed */}
        </div>
      </div>

      {/* Create Board Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-md dark:bg-slate-900 dark:text-slate-100 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-[#0F172A] dark:text-slate-100">Create board</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div
              className="h-28 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: selectedColor.color }}
            >
              <div className="w-32 h-20 bg-white/20 rounded-lg" />
            </div>

            <div>
              <label className="text-xs font-semibold text-[#475569] dark:text-slate-400 block mb-2">
                Background
              </label>
              <div className="flex gap-2 flex-wrap">
                {BOARD_COLORS.map((color) => (
                  <button
                    key={color.id}
                    onClick={() => setSelectedColor(color)}
                    className={`w-10 h-8 rounded-lg transition-all ${
                      selectedColor.id === color.id ? "ring-2 ring-[#6366F1] ring-offset-2 dark:ring-offset-slate-900" : ""
                    }`}
                    style={{ backgroundColor: color.color }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#475569] dark:text-slate-400 block mb-2">
                Board title <span className="text-red-500">*</span>
              </label>
              <Input
                value={newBoardTitle}
                onChange={(e) => setNewBoardTitle(e.target.value)}
                placeholder="Enter board title..."
                className="border-[#E2E8F0] rounded-lg dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                autoFocus
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-[#475569] dark:text-slate-400 block mb-2">
                Agency profile (optional)
              </label>
              <select
                value={selectedAgencyId}
                onChange={(e) => {
                  const agencyId = e.target.value;
                  setSelectedAgencyId(agencyId);
                  if (!newBoardTitle.trim()) {
                    const agency = agencyProfiles.find((item) => item._id === agencyId);
                    if (agency) setNewBoardTitle(`${agency.agencyName} - Board`);
                  }
                }}
                className="w-full h-10 rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="">
                  {isLoadingAgencyProfiles ? "Loading agencies..." : "Select an agency profile"}
                </option>
                {agencyProfiles.map((agency) => (
                  <option key={agency._id} value={agency._id}>
                    {agency.agencyName} - {agency.location} - {agency.decisionRole}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Agencies are managed in the Customers tab. Selected agency details are attached to the board description.
              </p>
            </div>

            <Button
              onClick={handleCreateBoard}
              disabled={!newBoardTitle.trim() || isCreating}
              className="w-full bg-[#6366F1] hover:bg-[#4F46E5] text-white rounded-lg shadow-sm dark:shadow-indigo-900/50"
            >
              {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
