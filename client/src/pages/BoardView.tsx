import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { boardApi, listApi, cardApi, activityApi, chatApi, Board, List, Card, Activity, BoardRole, ChatMessage, CardCreateData, canCreateList, canDragCards, getRoleBadgeColor, getRoleLabel, getDueDateStatus, formatDueDate } from "@/lib/api";
import { TrelloList } from "@/components/TrelloList";
import { CardDetailModal } from "@/components/CardDetailModal";
import { TrelloCardOverlay } from "@/components/TrelloCard";
import { ShareDialog } from "@/components/ShareDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useSocket } from "@/contexts/SocketContext";
import { toast } from "sonner";
import {
  ArrowLeft,
  Star,
  Users,
  MoreHorizontal,
  Plus,
  X,
  Filter,
  Search,
  Loader2,
  Trash2,
  Settings,
  Clock,
  Check,
  MessageSquare,
  SendHorizontal,
  Pin,
  Eye,
  EyeOff,
  Archive,
  RotateCcw,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import SidebarRail from "@/components/SidebarRail";

// Board background options
const BOARD_BACKGROUNDS = [
  { id: "blue", color: "#3B82F6" },
  { id: "indigo", color: "#6366F1" },
  { id: "violet", color: "#8B5CF6" },
  { id: "emerald", color: "#10B981" },
  { id: "orange", color: "#F97316" },
  { id: "rose", color: "#F43F5E" },
  { id: "cyan", color: "#06B6D4" },
  { id: "amber", color: "#F59E0B" },
  { id: "slate", color: "#64748B" },
];

type ArchivedCard = Card & {
  listTitle?: string;
};

export default function BoardView() {
  const { id: boardId } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { socket, connected, joinBoard, leaveBoard } = useSocket();
  const [board, setBoard] = useState<Board | null>(null);
  const [lists, setLists] = useState<List[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingList, setIsAddingList] = useState(false);
  const [newListTitle, setNewListTitle] = useState("");
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showArchivedDialog, setShowArchivedDialog] = useState(false);
  const [archivedCards, setArchivedCards] = useState<ArchivedCard[]>([]);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [archivedActionCardId, setArchivedActionCardId] = useState<string | null>(null);
  const [showBookingDetails, setShowBookingDetails] = useState<boolean>(() => {
    const key = `board:${boardId}:showBookingDetails`;
    const stored = localStorage.getItem(key);
    return stored === null ? true : stored === "true";
  });
  const [activityItems, setActivityItems] = useState<Activity[]>([]);
  const [activityFilterListId, setActivityFilterListId] = useState<string>("all");
  const [activityLoading, setActivityLoading] = useState(false);
  const [dueSoonOnly, setDueSoonOnly] = useState(false);
  const [settingsTitle, setSettingsTitle] = useState("");
  const [settingsDescription, setSettingsDescription] = useState("");
  const [settingsBackground, setSettingsBackground] = useState<string>("blue");
  const [deepLinkCardId, setDeepLinkCardId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("card");
  });
  const [showCalendarStrip, setShowCalendarStrip] = useState(true);
  const [dismissedCalendar, setDismissedCalendar] = useState(false);
  const [overListId, setOverListId] = useState<string | null>(null); // Track list being hovered over
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [newChatMessage, setNewChatMessage] = useState("");
  const [showMentionList, setShowMentionList] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  // Get current user's role on this board
  const getUserRole = (): BoardRole | undefined => {
    if (!board || !user) return undefined;
    const membership = board.members.find(m => m.user?._id === user._id);
    return membership?.role;
  };

  const userRole = getUserRole();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: canDragCards(userRole) ? 8 : Infinity,
      },
    }),
    useSensor(KeyboardSensor)
  );

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [authLoading, isAuthenticated, setLocation]);

  useEffect(() => {
    if (!boardId) return;
    const stored = localStorage.getItem(`board:${boardId}:showBookingDetails`);
    setShowBookingDetails(stored === null ? true : stored === "true");
  }, [boardId]);

  useEffect(() => {
    if (!boardId) return;
    localStorage.setItem(`board:${boardId}:showBookingDetails`, String(showBookingDetails));
  }, [boardId, showBookingDetails]);

  const fetchBoard = useCallback(async () => {
    if (!boardId) return;
    try {
      setLoading(true);
      const boardData = await boardApi.getById(boardId) as Board;
      setBoard(boardData);
      
      // Fetch lists with cards
      const listsData = await listApi.getByBoard(boardId) as List[];
      setLists(listsData.sort((a, b) => a.position - b.position));
    } catch (error) {
      toast.error("Failed to load board");
      setLocation("/dashboard");
    } finally {
      setLoading(false);
    }
  }, [boardId, setLocation]);

  const fetchActivity = useCallback(async () => {
    if (!boardId) return;
    setActivityLoading(true);
    try {
      const listId = activityFilterListId === "all" ? undefined : activityFilterListId;
      const activity = await activityApi.getBoardActivity(boardId, { listId, limit: 50 }) as Activity[];
      setActivityItems(activity);
    } catch (error) {
      console.error("Failed to load activity:", error);
      toast.error("Failed to load activity");
    } finally {
      setActivityLoading(false);
    }
  }, [boardId, activityFilterListId]);

  const loadArchivedCards = useCallback(async () => {
    if (!boardId) return;
    setArchivedLoading(true);
    try {
      const data = await boardApi.getArchivedCards(boardId) as ArchivedCard[];
      setArchivedCards(data);
    } catch (error) {
      toast.error("Failed to load archived cards");
    } finally {
      setArchivedLoading(false);
    }
  }, [boardId]);

  const loadChatMessages = useCallback(async () => {
    if (!boardId) return;
    setChatLoading(true);
    try {
      const data = await chatApi.getMessages(boardId, { limit: 100 }) as ChatMessage[];
      setChatMessages(data);
    } catch (error) {
      toast.error("Failed to load chat messages");
    } finally {
      setChatLoading(false);
    }
  }, [boardId]);

  const openListActivity = (listId: string) => {
    setActivityFilterListId(listId);
    setShowActivity(true);
  };

  const formatActivityTime = (dateString: string) => {
    const date = new Date(dateString);
    const diffMs = Date.now() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    if (diffMinutes < 1) return "just now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  useEffect(() => {
    if (isAuthenticated && boardId) {
      fetchBoard();
    }
  }, [isAuthenticated, boardId, fetchBoard]);

  // Open card from deep link ?card=ID once lists are loaded
  useEffect(() => {
    if (!deepLinkCardId || lists.length === 0 || selectedCard) return;
    const list = lists.find((l) => l.cards.some((c) => c._id === deepLinkCardId));
    const card = list?.cards.find((c) => c._id === deepLinkCardId);
    if (list && card) {
      setSelectedListId(list._id);
      setSelectedCard(card);
    }
  }, [deepLinkCardId, lists, selectedCard]);

  useEffect(() => {
    if (showActivity) {
      fetchActivity();
    }
  }, [showActivity, fetchActivity]);

  useEffect(() => {
    if (showChat) {
      loadChatMessages();
    }
  }, [showChat, loadChatMessages]);

  useEffect(() => {
    if (showArchivedDialog) {
      loadArchivedCards();
    }
  }, [showArchivedDialog, loadArchivedCards]);

  // Socket.IO: Join board room when connected
  useEffect(() => {
    if (!socket || !connected || !boardId) return;
    joinBoard(boardId);

    return () => {
      leaveBoard(boardId);
    };
  }, [socket, connected, boardId, joinBoard, leaveBoard]);

  // Socket.IO: Listen for real-time updates from OTHER users
  useEffect(() => {
    if (!socket || !boardId) return;

    const myUserId = user?._id;

    // Card events
    socket.on("card:created", ({ card, listId, userId }) => {
      if (userId === myUserId) return; // Skip own events
      console.log("🔔 Card created by another user:", card.title);
      setLists((prev) =>
        prev.map((list) =>
          list._id === listId ? { ...list, cards: [...list.cards, card] } : list
        )
      );
      toast.info(`New card: "${card.title}"`);
    });

    socket.on("card:updated", ({ card, userId }) => {
      if (userId === myUserId) return;
      console.log("🔔 Card updated by another user:", card.title);
      setLists((prev) =>
        prev.map((list) => ({
          ...list,
          cards: card.archived
            ? list.cards.filter((c) => c._id !== card._id)
            : list.cards.map((c) => (c._id === card._id ? card : c)),
        }))
      );
    });

    socket.on("card:deleted", ({ cardId, listId, userId }) => {
      if (userId === myUserId) return;
      console.log("🔔 Card deleted by another user");
      setLists((prev) =>
        prev.map((list) =>
          list._id === listId
            ? { ...list, cards: list.cards.filter((c) => c._id !== cardId) }
            : list
        )
      );
      toast.info("A card was deleted");
    });

    socket.on("card:moved", ({ cardId, oldListId, newListId, newPosition, userId }) => {
      if (userId === myUserId) return;
      console.log("🔔 Card moved by another user");
      // Simply refetch to get accurate state
      fetchBoard();
      toast.info("A card was moved");
    });

    // List events
    socket.on("list:created", ({ list, userId }) => {
      if (userId === myUserId) return;
      console.log("🔔 List created by another user:", list.title);
      setLists((prev) => [...prev, list]);
      toast.info(`New list: "${list.title}"`);
    });

    socket.on("list:updated", ({ list, userId }) => {
      if (userId === myUserId) return;
      console.log("🔔 List updated by another user");
      setLists((prev) =>
        prev.map((l) => (l._id === list._id ? { ...l, ...list } : l))
      );
    });

    socket.on("list:deleted", ({ listId, userId }) => {
      if (userId === myUserId) return;
      console.log("🔔 List deleted by another user");
      setLists((prev) => prev.filter((l) => l._id !== listId));
      toast.info("A list was deleted");
    });

    socket.on("lists:reordered", ({ lists: reorderedLists, userId }) => {
      if (userId === myUserId) return;
      console.log("🔔 Lists reordered by another user");
      setLists((prev) => {
        const updated = prev.map((list) => {
          const r = reorderedLists.find((l: { _id: string }) => l._id === list._id);
          return r ? { ...list, position: r.position } : list;
        });
        return updated.sort((a, b) => a.position - b.position);
      });
      fetchBoard();
    });

    socket.on("activity:created", ({ activity }) => {
      setActivityItems((prev) => {
        if (activityFilterListId !== "all" && activity.list !== activityFilterListId) {
          return prev;
        }
        const next = [activity, ...prev];
        return next.slice(0, 100);
      });
    });

    socket.on("board:message:new", ({ message, userId }) => {
      if (userId === myUserId) return;
      setChatMessages((prev) => {
        if (prev.some((m) => m._id === message._id)) {
          return prev;
        }
        return [...prev, message];
      });
    });

    return () => {
      socket.off("card:created");
      socket.off("card:updated");
      socket.off("card:deleted");
      socket.off("card:moved");
      socket.off("list:created");
      socket.off("list:updated");
      socket.off("list:deleted");
      socket.off("lists:reordered");
      socket.off("activity:created");
      socket.off("board:message:new");
    };
  }, [socket, boardId, user?._id, fetchBoard, activityFilterListId]);

  const handleAddList = async () => {
    if (!newListTitle.trim() || !boardId) return;
    try {
      const newList = await listApi.create(boardId, {
        title: newListTitle.trim(),
        position: lists.length,
      }) as List;
      setLists([...lists, { ...newList, cards: [] }]);
      setNewListTitle("");
      setIsAddingList(false);
      toast.success("List created");
    } catch (error) {
      toast.error("Failed to create list");
    }
  };

  const handleDeleteList = async (listId: string) => {
    if (!boardId) return;
    try {
      await listApi.delete(boardId, listId);
      setLists(lists.filter((l) => l._id !== listId));
      toast.success("List deleted");
    } catch (error) {
      toast.error("Failed to delete list");
    }
  };

  const handleUpdateListTitle = async (listId: string, title: string) => {
    if (!boardId) return;
    try {
      await listApi.update(boardId, listId, { title });
      setLists(lists.map((l) => (l._id === listId ? { ...l, title } : l)));
    } catch (error) {
      toast.error("Failed to update list");
    }
  };

  const handleAddCard = async (listId: string, payload: CardCreateData) => {
    if (!boardId) return;
    try {
      const newCard = await cardApi.create(boardId, listId, payload) as Card;
      setLists(
        lists.map((l) =>
          l._id === listId ? { ...l, cards: [...l.cards, newCard] } : l
        )
      );
      toast.success("Request created");
    } catch (error) {
      toast.error("Failed to create request");
    }
  };

  const handleCardClick = (card: Card, listId: string) => {
    setSelectedCard(card);
    setSelectedListId(listId);
    setDeepLinkCardId(card._id);
    const url = new URL(window.location.href);
    url.searchParams.set("card", card._id);
    window.history.replaceState({}, "", url.toString());
  };

  const handleUpdateCard = async (updates: Partial<Card>) => {
    if (!boardId || !selectedListId || !selectedCard) return;
    try {
      const payload: any = { ...updates };
      // Normalize agent to id for API payload
      if (payload.agent && typeof payload.agent === "object") {
        payload.agent = payload.agent._id;
      }
      const updatedCard = await cardApi.update(
        boardId,
        selectedListId,
        selectedCard._id,
        payload
      ) as Card;
      
      setLists((prev) =>
        prev.map((l) =>
          l._id === selectedListId
            ? {
                ...l,
                cards: updatedCard.archived
                  ? l.cards.filter((c) => c._id !== selectedCard._id)
                  : l.cards.map((c) =>
                      c._id === selectedCard._id ? { ...c, ...updatedCard } : c
                    ),
              }
            : l
        )
      );
      setSelectedCard({ ...selectedCard, ...updatedCard });
    } catch (error) {
      toast.error("Failed to update card");
    }
  };

  const handleRestoreArchivedCard = async (cardId: string) => {
    if (!boardId) return;
    try {
      setArchivedActionCardId(cardId);
      await boardApi.restoreArchivedCard(boardId, cardId);
      setArchivedCards((prev) => prev.filter((c) => c._id !== cardId));
      await fetchBoard();
      toast.success("Card restored");
    } catch (error) {
      toast.error("Failed to restore card");
    } finally {
      setArchivedActionCardId(null);
    }
  };

  const handleDeleteArchivedCard = async (cardId: string) => {
    if (!boardId || userRole !== "admin") return;
    if (!window.confirm("Delete this archived card permanently?")) return;
    try {
      setArchivedActionCardId(cardId);
      await boardApi.deleteArchivedCard(boardId, cardId);
      setArchivedCards((prev) => prev.filter((c) => c._id !== cardId));
      toast.success("Archived card deleted");
    } catch (error) {
      toast.error("Failed to delete archived card");
    } finally {
      setArchivedActionCardId(null);
    }
  };

  const handleAddAttachment = async (file: File) => {
    if (!boardId || !selectedListId || !selectedCard) return;
    try {
      const updatedCard = await cardApi.addAttachment(
        boardId,
        selectedListId,
        selectedCard._id,
        file
      ) as Card;

      setLists(
        lists.map((l) =>
          l._id === selectedListId
            ? {
                ...l,
                cards: l.cards.map((c) =>
                  c._id === selectedCard._id ? updatedCard : c
                ),
              }
            : l
        )
      );
      setSelectedCard(updatedCard);
      toast.success("Attachment added");
    } catch (error) {
      toast.error("Failed to upload attachment");
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!boardId || !selectedListId || !selectedCard) return;
    try {
      const updatedCard = await cardApi.deleteAttachment(
        boardId,
        selectedListId,
        selectedCard._id,
        attachmentId
      ) as Card;

      setLists(
        lists.map((l) =>
          l._id === selectedListId
            ? {
                ...l,
                cards: l.cards.map((c) =>
                  c._id === selectedCard._id ? updatedCard : c
                ),
              }
            : l
        )
      );
      setSelectedCard(updatedCard);
      toast.success("Attachment deleted");
    } catch (error) {
      toast.error("Failed to delete attachment");
    }
  };

  const handleAddComment = async (text: string) => {
    if (!boardId || !selectedListId || !selectedCard) return;
    try {
      const updatedCard = await cardApi.addComment(
        boardId,
        selectedListId,
        selectedCard._id,
        text
      ) as Card;

      setLists(
        lists.map((l) =>
          l._id === selectedListId
            ? {
                ...l,
                cards: l.cards.map((c) =>
                  c._id === selectedCard._id ? updatedCard : c
                ),
              }
            : l
        )
      );
      setSelectedCard(updatedCard);
    } catch (error) {
      toast.error("Failed to add comment");
    }
  };

  const handleEditComment = async (commentId: string, text: string) => {
    if (!boardId || !selectedListId || !selectedCard) return;
    try {
      const updatedCard = await cardApi.editComment(
        boardId,
        selectedListId,
        selectedCard._id,
        commentId,
        text
      ) as Card;

      setLists(
        lists.map((l) =>
          l._id === selectedListId
            ? {
                ...l,
                cards: l.cards.map((c) =>
                  c._id === selectedCard._id ? updatedCard : c
                ),
              }
            : l
        )
      );
      setSelectedCard(updatedCard);
    } catch (error) {
      toast.error("Failed to edit comment");
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!boardId || !selectedListId || !selectedCard) return;
    try {
      const updatedCard = await cardApi.deleteComment(
        boardId,
        selectedListId,
        selectedCard._id,
        commentId
      ) as Card;

      setLists(
        lists.map((l) =>
          l._id === selectedListId
            ? {
                ...l,
                cards: l.cards.map((c) =>
                  c._id === selectedCard._id ? updatedCard : c
                ),
              }
            : l
        )
      );
      setSelectedCard(updatedCard);
      toast.success("Comment deleted");
    } catch (error) {
      toast.error("Failed to delete comment");
    }
  };

  const handleDeleteCard = async () => {
    if (!boardId || !selectedListId || !selectedCard) return;
    try {
      await cardApi.delete(boardId, selectedListId, selectedCard._id);
      setLists(
        lists.map((l) =>
          l._id === selectedListId
            ? { ...l, cards: l.cards.filter((c) => c._id !== selectedCard._id) }
            : l
        )
      );
      setSelectedCard(null);
      setSelectedListId(null);
      toast.success("Card deleted");
    } catch (error) {
      toast.error("Failed to delete card");
    }
  };

  const handleMoveCard = async (targetListId: string) => {
    if (!boardId || !selectedListId || !selectedCard) return;
    try {
      const targetCards = lists.find((l) => l._id === targetListId)?.cards || [];
      console.log(`📤 Moving card "${selectedCard.title}" from ${selectedListId} to ${targetListId}`);

      await cardApi.reorder(boardId, selectedListId, {
        cardId: selectedCard._id,
        newPosition: targetCards.length,
        newListId: targetListId,
      });

      console.log(`✅ Move API call succeeded`);

      // Update local state: remove from old list, add to new list
      setLists(
        lists.map((l) => {
          if (l._id === selectedListId) {
            return { ...l, cards: l.cards.filter((c) => c._id !== selectedCard._id) };
          }
          if (l._id === targetListId) {
            return { ...l, cards: [...l.cards, { ...selectedCard, list: targetListId }] };
          }
          return l;
        })
      );

      const targetListTitle = lists.find((l) => l._id === targetListId)?.title;
      toast.success(`Moved to "${targetListTitle}"`);
      setSelectedCard(null);
      setSelectedListId(null);
    } catch (error) {
      console.error("❌ Move card error:", error);
      toast.error("Failed to move card");
    }
  };

  const updateCardInLists = (listId: string, cardId: string, updates: Partial<Card>) => {
    setLists((prev) =>
      prev.map((list) =>
        list._id === listId
          ? {
              ...list,
              cards: list.cards.map((card) =>
                card._id === cardId ? { ...card, ...updates } : card
              ),
            }
          : list
      )
    );
    if (selectedCard?._id === cardId) {
      setSelectedCard({ ...selectedCard, ...updates });
    }
  };

  const handleMarkDueDone = async (listId: string, cardId: string) => {
    if (!boardId) return;
    try {
      await cardApi.update(boardId, listId, cardId, { dueComplete: true });
      updateCardInLists(listId, cardId, { dueComplete: true });
      toast.success("Marked as done");
    } catch (error) {
      toast.error("Failed to mark done");
    }
  };

  const handleSnoozeDueDate = async (listId: string, card: Card) => {
    if (!boardId || !card.dueDate) return;
    const due = new Date(card.dueDate);
    due.setDate(due.getDate() + 1);
    try {
      await cardApi.update(boardId, listId, card._id, {
        dueDate: due.toISOString(),
        dueComplete: false,
      });
      updateCardInLists(listId, card._id, { dueDate: due.toISOString(), dueComplete: false });
      toast.success("Snoozed 1 day");
    } catch (error) {
      toast.error("Failed to snooze");
    }
  };

  const handleTogglePin = async (listId: string, card: Card, pinned: boolean) => {
    if (!boardId) return;
    try {
      await cardApi.update(boardId, listId, card._id, { pinned });
      updateCardInLists(listId, card._id, { pinned });
      toast.success(pinned ? "Pinned card" : "Unpinned card");
    } catch (error) {
      toast.error("Failed to update pin");
    }
  };

  const getMentionState = (value: string, cursor: number | null) => {
    const pos = cursor ?? value.length;
    const upto = value.slice(0, pos);
    const atIndex = upto.lastIndexOf("@");
    if (atIndex === -1) return null;
    const query = upto.slice(atIndex + 1);
    if (!/^[^\s@]{0,20}$/.test(query)) return null;
    return { start: atIndex, query };
  };

  const handleMentionPick = (username: string) => {
    const input = chatInputRef.current;
    if (!input) return;
    const value = input.value;
    const cursor = input.selectionStart ?? value.length;
    const mentionState = getMentionState(value, cursor);
    if (!mentionState) return;
    const before = value.slice(0, mentionState.start);
    const after = value.slice(cursor);
    const nextValue = `${before}@${username} ${after}`;
    setNewChatMessage(nextValue);
    requestAnimationFrame(() => {
      const nextCursor = (before + `@${username} `).length;
      input.focus();
      input.setSelectionRange(nextCursor, nextCursor);
    });
    setShowMentionList(false);
    setMentionQuery("");
  };

  const getMentionCandidates = () => {
    if (!board?.members) return [];
    return board.members
      .map((m) => m.user)
      .filter((u) => u?.username)
      .filter((u) =>
        mentionQuery
          ? u.username.toLowerCase().includes(mentionQuery.toLowerCase())
          : true
      );
  };

  const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const renderChatMessage = (text: string) => {
    if (!user?.username) return text;
    const mention = `@${user.username}`;
    const regex = new RegExp(`(${escapeRegExp(mention)})`, "ig");
    const parts = text.split(regex);
    return parts.map((part, index) => {
      if (part.toLowerCase() === mention.toLowerCase()) {
        return (
          <span
            key={`${part}-${index}`}
            className="px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-700 font-semibold"
          >
            {part}
          </span>
        );
      }
      return <span key={`${part}-${index}`}>{part}</span>;
    });
  };

  const handleDeleteBoard = async () => {
    if (!boardId) return;
    try {
      await boardApi.delete(boardId);
      toast.success("Board deleted successfully");
      setLocation("/dashboard");
    } catch (error) {
      toast.error("Failed to delete board");
    }
  };

  const handleSendChatMessage = async () => {
    if (!newChatMessage.trim() || !user || !boardId) return;
    const body = newChatMessage.trim();
    setNewChatMessage("");
    try {
      const created = await chatApi.createMessage(boardId, body) as ChatMessage;
      setChatMessages((prev) => {
        if (prev.some((m) => m._id === created._id)) {
          return prev;
        }
        return [...prev, created];
      });
    } catch (error) {
      toast.error("Failed to send message");
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;

    // Check if dragging a list
    const draggedList = lists.find((l) => l._id === active.id);
    if (draggedList) {
      return; // List drag is handled by dnd-kit's sortable context
    }

    // Check if dragging a card
    const activeList = lists.find((l) =>
      l.cards.some((c) => c._id === active.id)
    );
    if (activeList) {
      const card = activeList.cards.find((c) => c._id === active.id);
      setActiveCard(card || null);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Check if dragging a list
    const isListDrag = lists.some((l) => l._id === activeId);
    if (isListDrag) {
      setOverListId(overId);
      return;
    }

    // Check if dragging a card - track which list is being hovered
    const overList = lists.find(
      (l) => l._id === overId || l.cards.some((c) => c._id === overId)
    );
    if (overList) {
      setOverListId(overList._id);
    }

    const activeList = lists.find((l) =>
      l.cards.some((c) => c._id === activeId)
    );

    if (!activeList || !overList || activeList._id === overList._id) return;

    setLists((prev) => {
      const activeCards = [...activeList.cards];
      const overCards = [...overList.cards];

      const activeIndex = activeCards.findIndex((c) => c._id === activeId);
      const [movedCard] = activeCards.splice(activeIndex, 1);

      const overIndex = overCards.findIndex((c) => c._id === overId);
      if (overIndex >= 0) {
        overCards.splice(overIndex, 0, movedCard);
      } else {
        overCards.push(movedCard);
      }

      return prev.map((l) => {
        if (l._id === activeList._id) return { ...l, cards: activeCards };
        if (l._id === overList._id) return { ...l, cards: overCards };
        return l;
      });
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCard(null);
    setOverListId(null);

    if (!over || !boardId) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Check if dragging a list
    const activeListIndex = lists.findIndex((l) => l._id === activeId);
    const overListIndex = lists.findIndex((l) => l._id === overId);

    if (activeListIndex >= 0 && overListIndex >= 0) {
      // Reordering lists
      if (activeListIndex !== overListIndex) {
        const newLists = arrayMove(lists, activeListIndex, overListIndex);
        setLists(newLists);

        try {
          // Update positions on server
          await listApi.reorder(boardId, newLists.map((l, idx) => ({ _id: l._id, position: idx })));
        } catch (error) {
          toast.error("Failed to reorder lists");
          fetchBoard();
        }
      }
      return;
    }

    // Otherwise handle card movement
    const activeList = lists.find((l) =>
      l.cards.some((c) => c._id === activeId)
    );

    if (!activeList) return;

    const overList = lists.find(
      (l) => l._id === overId || l.cards.some((c) => c._id === overId)
    );

    if (!overList) return;

    if (activeList._id === overList._id) {
      // Reorder within same list
      const oldIndex = activeList.cards.findIndex((c) => c._id === activeId);
      const newIndex = activeList.cards.findIndex((c) => c._id === overId);

      if (oldIndex !== newIndex) {
        const newCards = arrayMove(activeList.cards, oldIndex, newIndex);
        setLists(
          lists.map((l) =>
            l._id === activeList._id ? { ...l, cards: newCards } : l
          )
        );

        try {
          await cardApi.reorder(boardId, activeList._id, {
            cardId: activeId,
            newPosition: newIndex,
          });
        } catch (error) {
          toast.error("Failed to reorder card");
          fetchBoard();
        }
      }
    } else {
      // Move to different list
      const newPosition = overList.cards.findIndex((c) => c._id === overId);

      try {
        await cardApi.reorder(boardId, activeList._id, {
          cardId: activeId,
          newPosition: newPosition >= 0 ? newPosition : overList.cards.length,
          newListId: overList._id,
        });
      } catch (error) {
        toast.error("Failed to move card");
        fetchBoard();
      }
    }
  };

  const getBackgroundColor = () => {
    if (!board?.background) return "#6366F1";
    const bg = BOARD_BACKGROUNDS.find((b) => b.id === board.background);
    return bg?.color || board.background;
  };

  // Upcoming due cards (next 7 days, incomplete)
  const upcomingCards = lists
    .flatMap((list) =>
      list.cards
        .filter((c) => c.dueDate && !c.dueComplete)
        .map((c) => ({
          card: c,
          listId: list._id,
          listTitle: list.title,
        }))
    )
    .filter(({ card }) => {
      const due = new Date(card.dueDate as string);
      const now = new Date();
      const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      return due >= now && due <= in7;
    })
    .sort(
      (a, b) => new Date(a.card.dueDate as string).getTime() - new Date(b.card.dueDate as string).getTime()
    )
    .slice(0, 20);

  const pinnedCards = lists
    .flatMap((list) =>
      list.cards
        .filter((c) => c.pinned)
        .map((c) => ({
          card: c,
          listId: list._id,
          listTitle: list.title,
        }))
    )
    .slice(0, 20);

  const getListTitle = () => {
    if (!selectedListId) return "";
    const list = lists.find((l) => l._id === selectedListId);
    return list?.title || "";
  };

  // Filter cards based on search and due soon
  const filteredLists = lists.map((list) => {
    const cards = list.cards.filter((card) => {
      const matchesSearch = searchQuery
        ? card.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          card.description?.toLowerCase().includes(searchQuery.toLowerCase())
        : true;

      const matchesDueSoon = dueSoonOnly
        ? (() => {
            if (!card.dueDate || card.dueComplete) return false;
            const now = new Date();
            const due = new Date(card.dueDate);
            const threshold = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            return due <= threshold;
          })()
        : true;

      return matchesSearch && matchesDueSoon;
    });

    return { ...list, cards };
  });

  const totalCards = lists.reduce((sum, list) => sum + list.cards.length, 0);
  const activeRequestCount = lists.reduce(
    (sum, list) =>
      sum +
      list.cards.filter((card) => !["Completed", "Closed", "Cancelled"].includes(card.status || "")).length,
    0
  );
  const handoverPendingCount = lists.reduce(
    (sum, list) => sum + list.cards.filter((card) => card.handoverPendingState === "Yes").length,
    0
  );
  const membersCount = board?.members?.length || 0;
  const boardAccent = getBackgroundColor();
  const boardDescription =
    board?.description?.trim() || "Track ticket intake, booking follow-up, and shift handovers in one workspace.";
  const toolbarButtonClass =
    "h-10 rounded-2xl border border-[#D9E5F4] bg-white px-3 text-[#486581] shadow-sm hover:bg-[#F6FAFF] hover:text-[#102A43]";
  const iconToolbarButtonClass =
    "h-10 w-10 rounded-2xl border border-[#D9E5F4] bg-white p-0 text-[#486581] shadow-sm hover:bg-[#F6FAFF] hover:text-[#102A43]";
  const sidebarCardClass =
    "rounded-[24px] border border-[#D9E5F4] bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.05)]";
  const summaryCardClass =
    "rounded-[24px] border border-[#D9E5F4] bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.05)]";

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen bg-[#F4F7FB]">
        <SidebarRail />
        <div className="flex flex-1 items-center justify-center">
          <div className="flex items-center gap-3 rounded-full border border-[#D9E5F4] bg-white px-5 py-3 text-sm font-medium text-[#486581] shadow-sm">
            <Loader2 className="h-5 w-5 animate-spin text-[#2063E9]" />
            Loading board workspace...
          </div>
        </div>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="flex min-h-screen bg-[#F4F7FB]">
        <SidebarRail />
        <div className="flex flex-1 items-center justify-center">
          <div className="rounded-[28px] border border-[#D9E5F4] bg-white px-8 py-10 text-center shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
            <div className="text-lg font-semibold text-[#102A43]">Board not found</div>
            <div className="mt-2 text-sm text-[#6B7C93]">The workspace could not be loaded.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F4F7FB]">
      <SidebarRail />
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="border-b border-[#D9E5F4] bg-white/90 backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-4 px-6 py-5">
            <div className="flex min-w-0 items-start gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation("/dashboard")}
                className="h-10 rounded-2xl border border-[#D9E5F4] bg-white px-3 text-[#486581] hover:bg-[#F6FAFF] hover:text-[#102A43]"
              >
                <ArrowLeft className="mr-1 h-4 w-4" />
                Boards
              </Button>

              <div
                className="hidden h-12 w-1 rounded-full md:block"
                style={{ backgroundColor: boardAccent }}
              />

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-[26px] font-semibold tracking-tight text-[#102A43]">
                    {board.title}
                  </h1>
                  <Button variant="ghost" size="sm" className={iconToolbarButtonClass}>
                    <Star className="h-4 w-4" />
                  </Button>
                  {userRole && (
                    <span className="rounded-full bg-[#EAF2FF] px-3 py-1 text-xs font-semibold text-[#1E5ED8]">
                      {getRoleLabel(userRole)}
                    </span>
                  )}
                </div>
                <p className="mt-1 max-w-3xl text-sm text-[#6B7C93]">{boardDescription}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              {showSearch ? (
                <div className="flex items-center gap-2 animate-fade-in">
                  <Input
                    placeholder="Search cards..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-10 w-56 rounded-2xl border-[#D9E5F4] bg-white px-4 text-[#102A43] shadow-none placeholder:text-[#829AB1]"
                    autoFocus
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowSearch(false);
                      setSearchQuery("");
                    }}
                    className={iconToolbarButtonClass}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSearch(true)}
                  className={toolbarButtonClass}
                >
                  <Search className="mr-1 h-4 w-4" />
                  Search
                </Button>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className={toolbarButtonClass}>
                    <Filter className="mr-1 h-4 w-4" />
                    {dueSoonOnly ? "Due soon" : "Filter"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-2xl border-[#D9E5F4]">
                  <DropdownMenuItem onClick={() => setDueSoonOnly((prev) => !prev)}>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-4 w-4 items-center justify-center rounded border border-slate-300">
                        {dueSoonOnly ? <Check className="h-3 w-3" /> : null}
                      </span>
                      Due soon (7 days)
                    </div>
                  </DropdownMenuItem>
                  {dueSoonOnly && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setDueSoonOnly(false)}>
                        Clear filters
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowBookingDetails((prev) => !prev)}
                className={toolbarButtonClass}
              >
                {showBookingDetails ? <Eye className="mr-1 h-4 w-4" /> : <EyeOff className="mr-1 h-4 w-4" />}
                Booking details
              </Button>

              <div className="hidden -space-x-1 md:flex">
                {board.members?.slice(0, 4).map((m) =>
                  m.user ? (
                    <div
                      key={m.user._id}
                      className="member-avatar relative border-2 border-white"
                      title={`${m.user.username} (${getRoleLabel(m.role)})`}
                    >
                      {m.user.username.charAt(0).toUpperCase()}
                      <span
                        className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-white"
                        style={{ backgroundColor: getRoleBadgeColor(m.role) }}
                      />
                    </div>
                  ) : null
                )}
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowShareDialog(true)}
                className={toolbarButtonClass}
              >
                <Users className="mr-1 h-4 w-4" />
                Share
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowActivity((prev) => !prev)}
                className={toolbarButtonClass}
              >
                <Clock className="mr-1 h-4 w-4" />
                Activity
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowChat((prev) => !prev)}
                className={toolbarButtonClass}
              >
                <MessageSquare className="mr-1 h-4 w-4" />
                Chat
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowArchivedDialog(true)}
                className={toolbarButtonClass}
              >
                <Archive className="mr-1 h-4 w-4" />
                Archived
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className={iconToolbarButtonClass}>
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-2xl border-[#D9E5F4]">
                  <DropdownMenuItem
                    onClick={() => {
                      if (board) {
                        setSettingsTitle(board.title || "");
                        setSettingsDescription(board.description || "");
                        setSettingsBackground(board.background || "blue");
                      }
                      setShowSettingsDialog(true);
                    }}
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    Board Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowBookingDetails((prev) => !prev)}>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-4 w-4 items-center justify-center rounded border border-slate-300">
                        {showBookingDetails ? <Check className="h-3 w-3" /> : null}
                      </span>
                      Booking details on cards
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {userRole === "admin" && (
                    <DropdownMenuItem
                      onClick={() => setShowDeleteDialog(true)}
                      className="text-red-600 focus:bg-red-50 focus:text-red-600"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Board
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="px-6 pt-5">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className={summaryCardClass}>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#829AB1]">
                  Total Requests
                </div>
                <div className="mt-3 text-3xl font-semibold text-[#102A43]">{totalCards}</div>
                <div className="mt-1 text-sm text-[#6B7C93]">{activeRequestCount} active in the queue</div>
              </div>
              <div className={summaryCardClass}>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#829AB1]">
                  Due Soon
                </div>
                <div className="mt-3 text-3xl font-semibold text-[#102A43]">{upcomingCards.length}</div>
                <div className="mt-1 text-sm text-[#6B7C93]">Requests due in the next 7 days</div>
              </div>
              <div className={summaryCardClass}>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#829AB1]">
                  Handover Watch
                </div>
                <div className="mt-3 text-3xl font-semibold text-[#102A43]">{handoverPendingCount}</div>
                <div className="mt-1 text-sm text-[#6B7C93]">Tickets waiting for the next shift</div>
              </div>
              <div
                className={summaryCardClass}
                style={{ background: `linear-gradient(135deg, ${boardAccent}16 0%, #ffffff 65%)` }}
              >
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#829AB1]">
                  Workspace Owner
                </div>
                <div className="mt-3 text-xl font-semibold text-[#102A43]">
                  {board.owner?.username || "Owner"}
                </div>
                <div className="mt-1 text-sm text-[#6B7C93]">{membersCount} members collaborating</div>
              </div>
            </div>
          </div>

          {showCalendarStrip && upcomingCards.length > 0 && (
            <div className="px-6 pt-5">
              <div className="rounded-[26px] border border-[#D9E5F4] bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-[#102A43]">Due in the next 7 days</div>
                    <div className="text-xs text-[#829AB1]">
                      Review upcoming requests and take action before they age out.
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={iconToolbarButtonClass}
                    onClick={() => {
                      setShowCalendarStrip(false);
                      setDismissedCalendar(true);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {upcomingCards.map(({ card, listId, listTitle }) => {
                    const dueDate = card.dueDate ? new Date(card.dueDate) : null;
                    const label = dueDate
                      ? dueDate.toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })
                      : "";
                    const dueStatus = card.dueDate
                      ? getDueDateStatus(card.dueDate, card.dueComplete)
                      : "default";
                    return (
                      <div
                        key={card._id}
                        onClick={() => handleCardClick(card, listId)}
                        className="min-w-[240px] cursor-pointer rounded-[22px] border border-[#D9E5F4] bg-[#F8FBFF] p-4 text-left transition hover:border-[#BCD3F8] hover:shadow-[0_18px_36px_rgba(15,23,42,0.08)]"
                      >
                        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#829AB1]">
                          {label}
                        </div>
                        <div className="mt-2 line-clamp-1 text-sm font-semibold text-[#102A43]">
                          {card.title}
                        </div>
                        <div className="mt-1 line-clamp-1 text-xs text-[#6B7C93]">List: {listTitle}</div>
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <div
                            className={`text-[11px] font-semibold ${
                              dueStatus === "overdue"
                                ? "text-red-600"
                                : dueStatus === "soon"
                                  ? "text-amber-600"
                                  : "text-emerald-600"
                            }`}
                          >
                            {formatDueDate(card.dueDate!)}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSnoozeDueDate(listId, card);
                              }}
                              className={iconToolbarButtonClass}
                            >
                              <Clock className="h-3 w-3" />
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMarkDueDone(listId, card._id);
                              }}
                              className={iconToolbarButtonClass}
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {pinnedCards.length > 0 && (
            <div className="px-6 pt-5">
              <div className="rounded-[26px] border border-[#D9E5F4] bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#102A43]">
                  <Pin className="h-4 w-4 text-[#2063E9]" />
                  Pinned requests
                </div>
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {pinnedCards.map(({ card, listId, listTitle }) => (
                    <div
                      key={card._id}
                      onClick={() => handleCardClick(card, listId)}
                      className="min-w-[240px] cursor-pointer rounded-[22px] border border-[#D9E5F4] bg-[#F8FBFF] p-4 text-left transition hover:border-[#BCD3F8] hover:shadow-[0_18px_36px_rgba(15,23,42,0.08)]"
                    >
                      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#829AB1]">
                        List: {listTitle}
                      </div>
                      <div className="mt-2 line-clamp-1 text-sm font-semibold text-[#102A43]">
                        {card.title}
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <div className="text-[11px] text-[#6B7C93]">
                          {card.dueDate ? formatDueDate(card.dueDate) : "No due date"}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTogglePin(listId, card, false);
                          }}
                          className={iconToolbarButtonClass}
                        >
                          <Pin className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!showCalendarStrip && upcomingCards.length > 0 && dismissedCalendar && (
            <div className="px-6 pt-5">
              <Button
                variant="ghost"
                size="sm"
                className={toolbarButtonClass}
                onClick={() => setShowCalendarStrip(true)}
              >
                Show due soon
              </Button>
            </div>
          )}

          <div className="flex-1 overflow-x-auto px-6 pb-6 pt-5">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex h-full items-start gap-4">
            <SortableContext
              items={filteredLists.map((l) => l._id)}
              strategy={horizontalListSortingStrategy}
            >
              {filteredLists.map((list) => (
                <TrelloList
                  key={list._id}
                  list={list}
                  onAddCard={(title) => handleAddCard(list._id, title)}
                  onDeleteList={() => handleDeleteList(list._id)}
                  onCardClick={(card) => handleCardClick(card, list._id)}
                  onUpdateTitle={(title) => handleUpdateListTitle(list._id, title)}
                  onViewActivity={openListActivity}
                  userRole={userRole}
                  isOverDropZone={overListId === list._id}
                  showBookingDetails={showBookingDetails}
                />
              ))}
            </SortableContext>

            {/* Add List - only if user can create lists */}
            {canCreateList(userRole) && (
              isAddingList ? (
                <div className="w-[336px] flex-shrink-0 animate-slide-up rounded-[24px] border border-[#D9E5F4] bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
                  <div className="mb-3 text-sm font-semibold text-[#102A43]">Create a new stage</div>
                  <Input
                    placeholder="Enter list title..."
                    value={newListTitle}
                    onChange={(e) => setNewListTitle(e.target.value)}
                    className="mb-3 h-11 rounded-2xl border-[#D9E5F4] bg-[#F8FBFF] px-4 shadow-none"
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && handleAddList()}
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={handleAddList}
                      className="rounded-2xl bg-[#2063E9] px-4 text-white hover:bg-[#164FC0]"
                    >
                      Add list
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setIsAddingList(false);
                        setNewListTitle("");
                      }}
                      className={iconToolbarButtonClass}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setIsAddingList(true)}
                  className="add-list-btn"
                >
                  <Plus className="w-4 h-4" />
                  Add another list
                </button>
              )
            )}
          </div>

          <DragOverlay>
            {activeCard && <TrelloCardOverlay card={activeCard} />}
          </DragOverlay>
        </DndContext>
          </div>

        </div>
        <aside className="hidden w-[320px] overflow-y-auto border-l border-[#D9E5F4] bg-[#F8FBFF] px-5 py-5 xl:block">
          <div className="mb-6">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#829AB1]">
              Board Summary
            </div>
            <div className={sidebarCardClass}>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-[#F6FAFF] p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#829AB1]">
                    Active
                  </div>
                  <div className="mt-1 text-xl font-semibold text-[#102A43]">{activeRequestCount}</div>
                </div>
                <div className="rounded-2xl bg-[#F6FAFF] p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#829AB1]">
                    Lists
                  </div>
                  <div className="mt-1 text-xl font-semibold text-[#102A43]">{lists.length}</div>
                </div>
                <div className="rounded-2xl bg-[#F6FAFF] p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#829AB1]">
                    Due Soon
                  </div>
                  <div className="mt-1 text-xl font-semibold text-[#102A43]">{upcomingCards.length}</div>
                </div>
                <div className="rounded-2xl bg-[#F6FAFF] p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#829AB1]">
                    Pinned
                  </div>
                  <div className="mt-1 text-xl font-semibold text-[#102A43]">{pinnedCards.length}</div>
                </div>
              </div>
              <div className="mt-4 rounded-2xl border border-[#D9E5F4] bg-white p-4">
                <div className="text-xs text-[#829AB1]">Owner</div>
                <div className="mt-1 text-sm font-semibold text-[#102A43]">
                  {board.owner?.username || "Owner"}
                </div>
                <div className="mt-3 text-xs text-[#829AB1]">Accent</div>
                <div className="mt-2 flex items-center gap-2">
                  <span
                    className="h-4 w-4 rounded-full border border-white shadow-sm"
                    style={{ backgroundColor: boardAccent }}
                  />
                  <span className="text-sm text-[#486581]">{board.background || "Default"}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#829AB1]">
              Quick Controls
            </div>
            <div className={`${sidebarCardClass} space-y-2`}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowBookingDetails((prev) => !prev)}
                className="h-11 w-full justify-start rounded-2xl border border-[#D9E5F4] bg-[#F6FAFF] px-4 text-[#486581] hover:bg-white"
              >
                {showBookingDetails ? <Eye className="mr-2 h-4 w-4" /> : <EyeOff className="mr-2 h-4 w-4" />}
                {showBookingDetails ? "Hide card details" : "Show card details"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCalendarStrip((prev) => !prev)}
                className="h-11 w-full justify-start rounded-2xl border border-[#D9E5F4] bg-[#F6FAFF] px-4 text-[#486581] hover:bg-white"
              >
                <Clock className="mr-2 h-4 w-4" />
                {showCalendarStrip ? "Hide due soon row" : "Show due soon row"}
              </Button>
            </div>
          </div>

          <div className="mb-6">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#829AB1]">
              Members
            </div>
            <div className={`${sidebarCardClass} space-y-3`}>
              {board.members?.map((m) => (
                m.user ? (
                  <div key={m.user._id} className="flex items-center gap-3">
                    <div className="member-avatar h-9 w-9 text-sm">
                      {m.user.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-[#102A43]">{m.user.username}</div>
                      <div className="text-xs text-[#6B7C93]">{getRoleLabel(m.role)}</div>
                    </div>
                  </div>
                ) : null
              ))}
            </div>
          </div>

          <div>
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#829AB1]">
              Pinned
            </div>
            <div className={`${sidebarCardClass} space-y-2`}>
              {pinnedCards.length === 0 ? (
                <div className="text-sm text-[#6B7C93]">No pinned cards yet.</div>
              ) : (
                pinnedCards.slice(0, 5).map(({ card, listId }) => (
                  <button
                    key={card._id}
                    onClick={() => handleCardClick(card, listId)}
                    className="w-full rounded-2xl border border-transparent bg-[#F6FAFF] px-3 py-3 text-left text-sm text-[#486581] transition hover:border-[#D9E5F4] hover:bg-white hover:text-[#102A43]"
                  >
                    {card.title}
                  </button>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Activity Panel */}
      {showActivity && (
        <div className="fixed bottom-5 right-5 top-24 z-40 flex w-80 flex-col rounded-[26px] border border-[#D9E5F4] bg-white/95 shadow-[0_28px_70px_rgba(15,23,42,0.18)] backdrop-blur">
          <div className="flex items-center justify-between border-b border-[#D9E5F4] px-5 py-4">
            <div className="font-semibold text-[#0F172A]">Activity</div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowActivity(false)}
              className="h-9 w-9 rounded-2xl p-0 text-[#486581] hover:bg-[#F6FAFF]"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="border-b border-[#D9E5F4] px-5 py-4">
            <label className="text-xs font-semibold text-[#64748B]">Filter</label>
            <select
              value={activityFilterListId}
              onChange={(e) => setActivityFilterListId(e.target.value)}
              className="mt-2 h-10 w-full rounded-2xl border border-[#D9E5F4] bg-white px-3 text-sm text-[#102A43]"
            >
              <option value="all">All activity</option>
              {lists.map((list) => (
                <option key={list._id} value={list._id}>
                  {list.title}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {activityLoading ? (
              <div className="text-sm text-[#64748B] flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading activity...
              </div>
            ) : activityItems.length === 0 ? (
              <div className="text-sm text-[#64748B]">No activity yet.</div>
            ) : (
              activityItems.map((item) => {
                const listTitle = item.list
                  ? lists.find((l) => l._id === item.list)?.title
                  : undefined;
                const actorInitial = (item.actor?.username?.charAt(0) || "U").toUpperCase();
                const actorName = item.actor?.username || "Unknown";
                return (
                  <div key={item._id} className="flex gap-3">
                    <div className="h-8 w-8 rounded-full bg-[#E2E8F0] flex items-center justify-center text-sm font-semibold text-[#475569]">
                      {actorInitial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-[#0F172A]">{item.message}</div>
                      {listTitle && (
                        <div className="text-xs text-[#64748B]">List: {listTitle}</div>
                      )}
                      <div className="text-xs text-[#94A3B8]">
                        {actorName} • {formatActivityTime(item.createdAt)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Chat Panel */}
      {showChat && (
        <div className="fixed bottom-5 right-5 top-24 z-40 flex w-[360px] flex-col rounded-[26px] border border-[#D9E5F4] bg-white/95 shadow-[0_28px_70px_rgba(15,23,42,0.18)] backdrop-blur">
          <div className="flex items-center justify-between border-b border-[#D9E5F4] px-5 py-4">
            <div>
              <div className="font-semibold text-[#0F172A]">Board chat</div>
              <div className="text-xs text-[#64748B]">
                {board?.members?.length || 0} members
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowChat(false)}
              className="h-9 w-9 rounded-2xl p-0 text-[#486581] hover:bg-[#F6FAFF]"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex items-center gap-1 border-b border-[#D9E5F4] bg-[#F8FBFF] px-5 py-3">
            <div className="flex -space-x-2">
              {board?.members?.slice(0, 5).map((m) => (
                m.user ? (
                  <div
                    key={m.user._id}
                    className="h-7 w-7 rounded-full border-2 border-white bg-[#E2E8F0] flex items-center justify-center text-xs font-semibold text-[#475569]"
                    title={m.user.username}
                  >
                    {m.user.username.charAt(0).toUpperCase()}
                  </div>
                ) : null
              ))}
            </div>
            {board?.members && board.members.length > 5 && (
              <div className="text-xs text-[#64748B] ml-2">
                +{board.members.length - 5} more
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {chatLoading ? (
              <div className="text-sm text-[#64748B] flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading messages...
              </div>
            ) : chatMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-[#94A3B8]">
                <MessageSquare className="w-10 h-10 mb-3" />
                <div className="text-sm font-semibold text-[#64748B]">Start the conversation</div>
                <div className="text-xs mt-1 max-w-[220px]">
                  Use board chat for quick questions and updates.
                </div>
              </div>
            ) : (
              chatMessages.map((message) => {
                const isMine = message.author?._id === user?._id;
                return (
                  <div
                    key={message._id}
                    className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`max-w-[75%] ${isMine ? "text-right" : "text-left"}`}>
                      {!isMine && (
                        <div className="text-xs font-semibold text-[#475569] mb-1">
                          {message.author?.username || "Member"}
                        </div>
                      )}
                      <div
                        className={`rounded-2xl px-4 py-2 text-sm leading-relaxed shadow-sm ${
                          isMine
                            ? "bg-gradient-to-r from-[#2063E9] to-[#17B897] text-white"
                            : "border border-[#D9E5F4] bg-white text-[#0F172A]"
                        }`}
                      >
                        {renderChatMessage(message.body)}
                      </div>
                      <div className="text-[11px] text-[#94A3B8] mt-1">
                        {formatActivityTime(message.createdAt)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t border-[#D9E5F4] bg-white px-5 py-4">
            <div className="flex items-end gap-2">
              <div className="relative flex-1">
                <Textarea
                  ref={chatInputRef}
                  value={newChatMessage}
                  onChange={(e) => {
                    const value = e.target.value;
                    setNewChatMessage(value);
                    const mentionState = getMentionState(value, e.target.selectionStart);
                    if (mentionState && board?.members?.length) {
                      setShowMentionList(true);
                      setMentionQuery(mentionState.query);
                      setActiveMentionIndex(0);
                    } else {
                      setShowMentionList(false);
                      setMentionQuery("");
                    }
                  }}
                  onKeyDown={(e) => {
                    if (showMentionList && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
                      e.preventDefault();
                      setActiveMentionIndex((prev) => {
                        const candidates = getMentionCandidates();
                        if (candidates.length === 0) return 0;
                        if (e.key === "ArrowDown") {
                          return (prev + 1) % candidates.length;
                        }
                        return (prev - 1 + candidates.length) % candidates.length;
                      });
                      return;
                    }

                    if (showMentionList && (e.key === "Enter" || e.key === "Tab")) {
                      const candidates = getMentionCandidates();
                      if (candidates.length > 0) {
                        e.preventDefault();
                        const selected = candidates[activeMentionIndex];
                        if (selected?.username) {
                          handleMentionPick(selected.username);
                        }
                        return;
                      }
                    }

                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendChatMessage();
                    }
                  }}
                  placeholder="Write a message..."
                  rows={2}
                  className="min-h-[44px] max-h-32 resize-none"
                />

                {showMentionList && board?.members && (
                  <div className="absolute bottom-[calc(100%+8px)] left-0 z-50 max-h-56 w-full overflow-y-auto rounded-[20px] border border-[#D9E5F4] bg-white shadow-[0_18px_40px_rgba(15,23,42,0.12)]">
                    {getMentionCandidates()
                      .slice(0, 6)
                      .map((member, index) => (
                        <button
                          key={member._id}
                          type="button"
                          onClick={() => handleMentionPick(member.username)}
                          className={`w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-slate-50 ${
                            index === activeMentionIndex ? "bg-slate-50" : ""
                          }`}
                        >
                          <div className="h-7 w-7 rounded-full bg-[#E2E8F0] flex items-center justify-center text-xs font-semibold text-[#475569]">
                            {member.username.charAt(0).toUpperCase()}
                          </div>
                          <div className="text-sm text-[#0F172A]">@{member.username}</div>
                        </button>
                      ))}
                    {getMentionCandidates().length === 0 && (
                      <div className="px-3 py-2 text-sm text-[#64748B]">No matches.</div>
                    )}
                  </div>
                )}
              </div>
              <Button
                onClick={handleSendChatMessage}
                disabled={!newChatMessage.trim()}
                className="h-10 rounded-2xl bg-[#2063E9] px-4 text-white hover:bg-[#164FC0]"
              >
                <SendHorizontal className="w-4 h-4" />
              </Button>
            </div>
            <div className="text-[11px] text-[#94A3B8] mt-2">
              Enter to send, Shift+Enter for new line.
            </div>
          </div>
        </div>
      )}

      {/* Card Detail Modal */}
      <CardDetailModal
        card={selectedCard}
        isOpen={!!selectedCard}
        onClose={() => {
          setSelectedCard(null);
          setSelectedListId(null);
          setDeepLinkCardId(null);
          const url = new URL(window.location.href);
          url.searchParams.delete("card");
          window.history.replaceState({}, "", url.toString());
        }}
        onUpdate={handleUpdateCard}
        onDelete={handleDeleteCard}
        onMove={handleMoveCard}
        onAddAttachment={handleAddAttachment}
        onDeleteAttachment={handleDeleteAttachment}
        onAddComment={handleAddComment}
        onEditComment={handleEditComment}
        onDeleteComment={handleDeleteComment}
        currentUser={user}
        userRole={userRole}
        listTitle={getListTitle()}
        currentListId={selectedListId || undefined}
        lists={lists.map((l) => ({ _id: l._id, title: l.title }))}
        members={board?.members || []}
      />

      <Dialog open={showArchivedDialog} onOpenChange={setShowArchivedDialog}>
        <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-[#0F172A]">Archived Cards</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-1">
            {archivedLoading ? (
              <div className="py-10 flex items-center justify-center text-[#64748B]">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Loading archived cards...
              </div>
            ) : archivedCards.length === 0 ? (
              <div className="py-10 text-center text-[#64748B]">No archived cards.</div>
            ) : (
              <div className="space-y-2">
                {archivedCards.map((card) => (
                  <div
                    key={card._id}
                    className="flex items-center justify-between gap-3 rounded-[20px] border border-[#D9E5F4] bg-[#F8FBFF] px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[#0F172A] truncate">{card.title}</div>
                      <div className="text-xs text-[#64748B] mt-0.5">
                        List: {card.listTitle || "Unknown"} {card.bookingRef ? `- Ref: ${card.bookingRef}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={archivedActionCardId === card._id}
                        onClick={() => handleRestoreArchivedCard(card._id)}
                      >
                        <RotateCcw className="w-4 h-4 mr-1" />
                        Restore
                      </Button>
                      {userRole === "admin" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:text-red-700"
                          disabled={archivedActionCardId === card._id}
                          onClick={() => handleDeleteArchivedCard(card._id)}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Delete permanently
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      {board && (
        <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
          <DialogContent className="sm:max-w-md rounded-[28px] border border-[#D9E5F4] bg-[#F8FBFF] shadow-[0_28px_70px_rgba(15,23,42,0.16)]">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-[#0F172A]">
                Board Settings
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-[#0F172A]">Title</label>
                <Input
                  value={settingsTitle}
                  onChange={(e) => setSettingsTitle(e.target.value)}
                  className="mt-1"
                  placeholder="Board title"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#0F172A]">Description</label>
                <Textarea
                  value={settingsDescription}
                  onChange={(e) => setSettingsDescription(e.target.value)}
                  className="mt-1"
                  placeholder="Board description"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#0F172A]">Background</label>
                <select
                  value={settingsBackground}
                  onChange={(e) => setSettingsBackground(e.target.value)}
                  className="mt-1 h-11 w-full rounded-2xl border border-[#D9E5F4] bg-white px-4 text-sm text-[#102A43]"
                >
                  {BOARD_BACKGROUNDS.map((bg) => (
                    <option key={bg.id} value={bg.id}>
                      {bg.id.charAt(0).toUpperCase() + bg.id.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setShowSettingsDialog(false)}>
                  Cancel
                </Button>
                <Button
                  className="rounded-2xl bg-[#2063E9] px-4 text-white hover:bg-[#164FC0]"
                  onClick={async () => {
                    if (!boardId) return;
                    try {
                      const updated = await boardApi.update(boardId, {
                        title: settingsTitle.trim() || board.title,
                        description: settingsDescription,
                        background: settingsBackground,
                      }) as Board;
                      setBoard((prev) => prev ? { ...prev, ...updated } : prev);
                      toast.success("Board updated");
                      setShowSettingsDialog(false);
                    } catch (error) {
                      toast.error("Failed to update board");
                    }
                  }}
                >
                  Save
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Share Dialog */}
      {board && (
        <ShareDialog
          board={board}
          isOpen={showShareDialog}
          onClose={() => setShowShareDialog(false)}
          currentUserRole={userRole}
          onMemberAdded={(updatedBoard) => setBoard(updatedBoard)}
          onMemberRemoved={(updatedBoard) => setBoard(updatedBoard)}
          onRoleChanged={(updatedBoard) => setBoard(updatedBoard)}
        />
      )}

      {/* Delete Board Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Board?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{board?.title}"? This action cannot be undone.
              All lists, cards, and their contents will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBoard}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              Delete Board
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </div>
  );
}
