import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./AuthContext";

const API_URL = import.meta.env.VITE_API_URL || window.location.origin;

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
  joinBoard: (boardId: string) => void;
  leaveBoard: (boardId: string) => void;
  subscribeNotification: (handler: (payload: any) => void) => () => void;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  connected: false,
  joinBoard: () => {},
  leaveBoard: () => {},
  subscribeNotification: () => () => {},
});

export function useSocket() {
  return useContext(SocketContext);
}

interface SocketProviderProps {
  children: ReactNode;
}

export function SocketProvider({ children }: SocketProviderProps) {
  const { isAuthenticated } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const notificationHandlers = useRef<((payload: any) => void)[]>([]);

  // Connect/disconnect based on auth state
  useEffect(() => {
    if (!isAuthenticated) {
      // Disconnect if logged out
      if (socketRef.current) {
        console.log("🔌 Disconnecting Socket.IO (logged out)...");
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setConnected(false);
      }
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) return;

    // Already connected
    if (socketRef.current?.connected) return;

    console.log("🔌 Connecting to Socket.IO...");
    const newSocket = io(API_URL, {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    newSocket.on("connect", () => {
      console.log("✅ Socket.IO connected:", newSocket.id);
      setConnected(true);
    });

    newSocket.on("disconnect", () => {
      console.log("❌ Socket.IO disconnected");
      setConnected(false);
    });

    newSocket.on("connect_error", (error) => {
      console.error("Socket.IO connection error:", error.message);
      setConnected(false);
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    return () => {
      console.log("🔌 Cleaning up Socket.IO...");
      notificationHandlers.current = [];
      newSocket.disconnect();
      socketRef.current = null;
      setSocket(null);
      setConnected(false);
    };
  }, [isAuthenticated]);

  const joinBoard = useCallback((boardId: string) => {
    const s = socketRef.current;
    if (s) {
      console.log(`📋 Joining board room: ${boardId}`);
      s.emit("join-board", boardId);
    } else {
      console.log(`⚠️ Socket not ready, waiting to join board: ${boardId}`);
    }
  }, []);

  const leaveBoard = useCallback((boardId: string) => {
    const s = socketRef.current;
    if (s) {
      console.log(`📋 Leaving board room: ${boardId}`);
      s.emit("leave-board", boardId);
    }
  }, []);

  const subscribeNotification = useCallback((handler: (payload: any) => void) => {
    notificationHandlers.current.push(handler);
    const s = socketRef.current;
    if (s) {
      const listener = (payload: any) => handler(payload);
      s.on("notification:new", listener);
      return () => {
        s.off("notification:new", listener);
        notificationHandlers.current = notificationHandlers.current.filter((h) => h !== handler);
      };
    }
    return () => {};
  }, []);

  return (
    <SocketContext.Provider value={{ socket, connected, joinBoard, leaveBoard, subscribeNotification }}>
      {children}
    </SocketContext.Provider>
  );
}
