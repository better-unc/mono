import type { ServerWebSocket } from "bun";
import { getAuth } from "./auth";

type WebSocketData = {
  userId: string;
  sessionId: string;
};

const wsConnections = new Map<string, Set<ServerWebSocket<WebSocketData>>>();

export function registerConnection(userId: string, ws: ServerWebSocket<WebSocketData>) {
  if (!wsConnections.has(userId)) {
    wsConnections.set(userId, new Set());
  }
  wsConnections.get(userId)!.add(ws);
}

export function unregisterConnection(userId: string, ws: ServerWebSocket<WebSocketData>) {
  const connections = wsConnections.get(userId);
  if (connections) {
    connections.delete(ws);
    if (connections.size === 0) {
      wsConnections.delete(userId);
    }
  }
}

export function notifyUser(userId: string, message: object) {
  const connections = wsConnections.get(userId);
  if (connections) {
    const payload = JSON.stringify(message);
    for (const ws of connections) {
      try {
        ws.send(payload);
      } catch (err) {
        console.error("[WS] Failed to send message:", err);
      }
    }
  }
}

export function notifyUsers(userIds: string[], message: object) {
  for (const userId of userIds) {
    notifyUser(userId, message);
  }
}

export function getConnectedUserCount(): number {
  return wsConnections.size;
}

export function isUserConnected(userId: string): boolean {
  return wsConnections.has(userId) && wsConnections.get(userId)!.size > 0;
}

export async function handleWebSocketUpgrade(
  request: Request,
  server: any
): Promise<Response | undefined> {
  const url = new URL(request.url);

  if (url.pathname !== "/ws") {
    return undefined;
  }

  const token = url.searchParams.get("token");
  if (!token) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const auth = getAuth();
    const session = await auth.api.getSession({
      headers: new Headers({ Authorization: `Bearer ${token}` }),
    });

    if (!session?.user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const upgraded = server.upgrade(request, {
      data: {
        userId: session.user.id,
        sessionId: session.session.id,
      },
    });

    if (upgraded) {
      return undefined;
    }

    return new Response("WebSocket upgrade failed", { status: 500 });
  } catch (err) {
    console.error("[WS] Auth error:", err);
    return new Response("Unauthorized", { status: 401 });
  }
}

export const websocketHandlers = {
  open(ws: ServerWebSocket<WebSocketData>) {
    const { userId } = ws.data;
    registerConnection(userId, ws);

    ws.send(JSON.stringify({ type: "connected", userId }));
  },

  message(ws: ServerWebSocket<WebSocketData>, message: string | Buffer) {
    try {
      const data = JSON.parse(message.toString());

      if (data.type === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
      }
    } catch (err) {
      console.error("[WS] Invalid message:", err);
    }
  },

  close(ws: ServerWebSocket<WebSocketData>) {
    const { userId } = ws.data;
    unregisterConnection(userId, ws);
  },

  error(ws: ServerWebSocket<WebSocketData>, error: Error) {
    console.error("[WS] Error:", error);
  },
};
