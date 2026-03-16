import { useState, useEffect, useRef } from "react";
import { Bell, Check, X } from "lucide-react";
import { notificationApi, Notification } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { useSocket } from "@/contexts/SocketContext";

const LOCAL_NOTIFICATION_STORAGE_KEY = "crm_notifications_v1";
const NOTIFICATIONS_CHANGED_EVENT = "crm:notifications-changed";

export function NotificationBell() {
  const [, setLocation] = useLocation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { subscribeNotification, connected } = useSocket();
  const unsubRef = useRef<() => void>(() => {});

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      const data = await notificationApi.getAll() as Notification[];
      setNotifications(data);
      setUnreadCount(data.filter((n) => !n.read).length);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    }
  };

  // Fetch unread count (for polling)
  const fetchUnreadCount = async () => {
    try {
      const data = await notificationApi.getUnreadCount() as { count: number };
      setUnreadCount(data.count);
    } catch (error) {
      console.error("Failed to fetch unread count:", error);
    }
  };

  // Mark notification as read
  const markAsRead = async (id: string) => {
    try {
      await notificationApi.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      setIsLoading(true);
      await notificationApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Delete notification
  const deleteNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await notificationApi.delete(id);
      setNotifications((prev) => prev.filter((n) => n._id !== id));
      const notification = notifications.find((n) => n._id === id);
      if (notification && !notification.read) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error("Failed to delete notification:", error);
    }
  };

  // Handle notification click
  const handleNotificationClick = (notification: Notification) => {
    // Mark as read
    if (!notification.read) {
      markAsRead(notification._id);
    }

    if (notification.board?._id === "daily-ops") {
      const taskQuery = notification.card?._id ? `?task=${encodeURIComponent(notification.card._id)}` : "";
      setLocation(`/workspace/daily-ops${taskQuery}`);
      setIsOpen(false);
      return;
    }

    // Navigate to card or board
    if (notification.card && notification.board) {
      setLocation(`/board/${notification.board._id}?card=${notification.card._id}`);
      setIsOpen(false);
      return;
    }
    if (notification.board) {
      setLocation(`/board/${notification.board._id}`);
      setIsOpen(false);
    }
  };

  // Poll for new notifications every 30 seconds
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleNotificationChange = () => {
      void fetchUnreadCount();
      if (isOpen) {
        void fetchNotifications();
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key && event.key !== LOCAL_NOTIFICATION_STORAGE_KEY && event.key !== "user") return;
      handleNotificationChange();
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, handleNotificationChange);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, handleNotificationChange);
    };
  }, [isOpen]);

  // Realtime notifications
  useEffect(() => {
    if (!connected) return;
    const unsub = subscribeNotification((payload: any) => {
      // Merge new notification at top
      setNotifications((prev) => {
        const exists = prev.some((n) => n._id === payload._id);
        if (exists) return prev;
        const safePayload: Notification = {
          _id: payload._id || globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
          recipient: payload.recipient,
          sender: payload.sender || { _id: "", username: "System", email: "" },
          type: payload.type,
          card: payload.card,
          board: payload.board,
          message: payload.message || "New notification",
          commentText: payload.commentText,
          read: false,
          createdAt: payload.createdAt || new Date().toISOString(),
        };
        return [safePayload, ...prev].slice(0, 50);
      });
      setUnreadCount((prev) => prev + 1);
    });
    unsubRef.current = unsub;
    return () => unsubRef.current();
  }, [connected, subscribeNotification]);

  // Fetch full notifications when dropdown opens
  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-slate-300 hover:text-white hover:bg-white/10 relative"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 p-0">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              disabled={isLoading}
              className="text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
            >
              <Check className="w-3 h-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>

        {/* Notifications List */}
        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <Bell className="w-12 h-12 mx-auto mb-2 text-slate-300" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification._id}
                onClick={() => handleNotificationClick(notification)}
                className={`p-4 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors group ${
                  !notification.read ? "bg-indigo-50/50" : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="member-avatar-sm flex-shrink-0 mt-1">
                    {(notification.sender?.username || "?").charAt(0).toUpperCase()}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-900">
                      {notification.message}
                    </p>
                    {notification.commentText && (
                      <p className="text-xs text-slate-600 mt-1 bg-slate-100 p-2 rounded italic line-clamp-2">
                        "{notification.commentText}"
                      </p>
                    )}
                    <p className="text-xs text-slate-500 mt-1">
                      {formatDistanceToNow(new Date(notification.createdAt), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!notification.read && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead(notification._id);
                        }}
                        className="h-7 w-7 p-0 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                        title="Mark as read"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => deleteNotification(notification._id, e)}
                      className="h-7 w-7 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                      title="Delete"
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Unread indicator */}
                {!notification.read && (
                  <div className="absolute left-2 top-1/2 -translate-y-1/2 w-2 h-2 bg-indigo-600 rounded-full" />
                )}
              </div>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
