import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import SidebarRail from "@/components/SidebarRail";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { boardApi, chatApi, Board, ChatMessage } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, MessageSquare, SendHorizontal, Users } from "lucide-react";
import { toast } from "sonner";

function formatMessageTime(value: string) {
  const date = new Date(value);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ChatWorkspace() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [boards, setBoards] = useState<Board[]>([]);
  const [isLoadingBoards, setIsLoadingBoards] = useState(true);
  const [selectedBoardId, setSelectedBoardId] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [authLoading, isAuthenticated, setLocation]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const loadBoards = async () => {
      try {
        setIsLoadingBoards(true);
        const data = await boardApi.getAll();
        const nextBoards = Array.isArray(data) ? data : [];
        setBoards(nextBoards);
        setSelectedBoardId((prev) => prev || nextBoards[0]?._id || "");
      } catch (error: any) {
        toast.error(error?.message || "Failed to load board chat workspace");
      } finally {
        setIsLoadingBoards(false);
      }
    };
    loadBoards();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!selectedBoardId) return;
    const loadMessages = async () => {
      try {
        setIsLoadingMessages(true);
        const data = await chatApi.getMessages(selectedBoardId, { limit: 100 });
        setMessages(Array.isArray(data) ? data : []);
      } catch (error: any) {
        toast.error(error?.message || "Failed to load board messages");
      } finally {
        setIsLoadingMessages(false);
      }
    };
    loadMessages();
  }, [selectedBoardId]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, selectedBoardId]);

  const selectedBoard = useMemo(
    () => boards.find((board) => board._id === selectedBoardId) || null,
    [boards, selectedBoardId]
  );

  const handleSend = async () => {
    const body = draft.trim();
    if (!body || !selectedBoardId) return;
    try {
      setIsSending(true);
      const created = (await chatApi.createMessage(selectedBoardId, body)) as ChatMessage;
      setMessages((prev) => [...prev, created]);
      setDraft("");
    } catch (error: any) {
      toast.error(error?.message || "Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FB] flex">
      <SidebarRail />
      <div className="flex-1 p-4 sm:p-6">
        <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="rounded-[28px] border border-[#D9E5F4] bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
            <div className="mb-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#829AB1]">Workspace</div>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#102A43]">Chat</h1>
              <p className="mt-2 text-sm text-[#6B7C93]">
                Monitor and reply to board-level team conversations without opening each board one by one.
              </p>
            </div>

            <div className="space-y-3">
              {isLoadingBoards ? (
                <div className="flex items-center gap-2 rounded-[22px] border border-[#D9E5F4] bg-[#FBFDFF] p-4 text-sm text-[#6B7C93]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading boards...
                </div>
              ) : boards.length === 0 ? (
                <div className="rounded-[22px] border border-dashed border-[#D9E5F4] bg-[#FBFDFF] p-4 text-sm text-[#6B7C93]">
                  No boards available.
                </div>
              ) : (
                boards.map((board) => (
                  <button
                    key={board._id}
                    onClick={() => setSelectedBoardId(board._id)}
                    className={`w-full rounded-[22px] border px-4 py-3 text-left transition ${
                      board._id === selectedBoardId
                        ? "border-[#BFD6FB] bg-[#F5F9FF]"
                        : "border-[#D9E5F4] bg-[#FBFDFF] hover:border-[#BDD4F7] hover:bg-white"
                    }`}
                  >
                    <div className="truncate text-sm font-semibold text-[#102A43]">{board.title}</div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-[#6B7C93]">
                      <Users className="h-3.5 w-3.5" />
                      {board.members?.length || 0} members
                    </div>
                  </button>
                ))
              )}
            </div>
          </aside>

          <section className="flex min-h-[70vh] flex-col rounded-[28px] border border-[#D9E5F4] bg-white shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
            <div className="border-b border-[#D9E5F4] px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EAF2FF] text-[#2063E9]">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-[#102A43]">{selectedBoard?.title || "Select a board"}</div>
                  <div className="text-xs text-[#6B7C93]">
                    {selectedBoard ? `${selectedBoard.members?.length || 0} board members` : "Board-level discussion stream"}
                  </div>
                </div>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5">
              {isLoadingMessages ? (
                <div className="flex items-center gap-2 text-sm text-[#6B7C93]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading messages...
                </div>
              ) : !selectedBoard ? (
                <div className="rounded-[22px] border border-dashed border-[#D9E5F4] bg-[#FBFDFF] p-5 text-sm text-[#6B7C93]">
                  Select a board from the left to open its conversation.
                </div>
              ) : messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center text-[#94A3B8]">
                  <MessageSquare className="mb-3 h-10 w-10" />
                  <div className="text-sm font-semibold text-[#64748B]">No messages yet</div>
                  <div className="mt-1 max-w-[240px] text-xs">
                    Use this workspace for quick team coordination across open requests.
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => {
                    const isMine = message.author?._id === user?._id;
                    return (
                      <div key={message._id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[78%] ${isMine ? "text-right" : "text-left"}`}>
                          {!isMine && (
                            <div className="mb-1 text-xs font-semibold text-[#486581]">
                              {message.author?.username || "Member"}
                            </div>
                          )}
                          <div
                            className={`rounded-[20px] px-4 py-3 text-sm leading-6 shadow-sm ${
                              isMine
                                ? "bg-gradient-to-r from-[#2063E9] to-[#17B897] text-white"
                                : "border border-[#D9E5F4] bg-[#FBFDFF] text-[#102A43]"
                            }`}
                          >
                            {message.body}
                          </div>
                          <div className="mt-1 text-[11px] text-[#94A3B8]">{formatMessageTime(message.createdAt)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border-t border-[#D9E5F4] px-5 py-4">
              <div className="flex items-end gap-3">
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={selectedBoard ? `Write to ${selectedBoard.title}...` : "Select a board first"}
                  disabled={!selectedBoard || isSending}
                  className="min-h-[52px] rounded-2xl border-[#D9E5F4] bg-[#FBFDFF] shadow-none"
                />
                <Button
                  onClick={handleSend}
                  disabled={!selectedBoard || !draft.trim() || isSending}
                  className="h-11 rounded-2xl bg-[#2063E9] px-4 text-white hover:bg-[#164FC0]"
                >
                  {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
                </Button>
              </div>
              <div className="mt-2 text-[11px] text-[#94A3B8]">Press Enter to send, Shift+Enter for a new line.</div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
