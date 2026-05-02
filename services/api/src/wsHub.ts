import type { WebSocket } from "ws";
import type { WsOutboundMessage } from "./types.js";

const clients = new Set<WebSocket>();

export function addClient(ws: WebSocket): void {
  clients.add(ws);
  ws.on("close", () => clients.delete(ws));
}

export function broadcast(message: WsOutboundMessage): void {
  const payload = JSON.stringify(message);
  for (const client of clients) {
    if (client.readyState === 1 /* OPEN */) {
      client.send(payload);
    }
  }
}

export function clientCount(): number {
  return clients.size;
}
