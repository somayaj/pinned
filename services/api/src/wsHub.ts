import type { WebSocket } from "ws";
import type { WsOutboundMessage } from "./types.js";

const clients = new Map<WebSocket, string>();

export function addClient(ws: WebSocket, userId: string): void {
  clients.set(ws, userId);
  ws.on("close", () => clients.delete(ws));
}

export function broadcastToUser(
  userId: string,
  message: WsOutboundMessage
): void {
  const payload = JSON.stringify(message);
  for (const [client, uid] of clients) {
    if (uid === userId && client.readyState === 1 /* OPEN */) {
      client.send(payload);
    }
  }
}

export function clientCount(): number {
  return clients.size;
}
