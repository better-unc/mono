import { useEffect, useRef, useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authClient } from "./auth-client";
import { getApiUrl } from "./utils";

type WebSocketMessage = {
  type: string;
  [key: string]: any;
};

type WebSocketState = "connecting" | "connected" | "disconnected" | "error";

export function useWebSocket() {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [state, setState] = useState<WebSocketState>("disconnected");
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const baseReconnectDelay = 1000;

  const connect = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const session = await authClient.getSession();
      if (!session.data?.session?.token) {
        return;
      }

      const apiUrl = getApiUrl();
      const wsUrl = apiUrl.replace(/^http/, "ws");
      const url = `${wsUrl}/ws?token=${session.data.session.token}`;

      setState("connecting");
      const ws = new WebSocket(url);

      ws.onopen = () => {
        setState("connected");
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);

          if (message.type === "notification") {
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
          }
        } catch (err) {
          console.error("[WS] Failed to parse message:", err);
        }
      };

      ws.onclose = () => {
        setState("disconnected");
        wsRef.current = null;

        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = baseReconnectDelay * Math.pow(2, reconnectAttemptsRef.current);
          reconnectAttemptsRef.current++;

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };

      ws.onerror = () => {
        setState("error");
      };

      wsRef.current = ws;
    } catch (err) {
      console.error("[WS] Connection error:", err);
      setState("error");
    }
  }, [queryClient]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setState("disconnected");
  }, []);

  const send = useCallback((message: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return { state, connect, disconnect, send };
}
