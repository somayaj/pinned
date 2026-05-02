import "dotenv/config";
import cors from "cors";
import express from "express";
import { createServer } from "http";
import { nanoid } from "nanoid";
import { WebSocketServer } from "ws";
import { verifySessionToken } from "./auth/jwt.js";
import { migrate } from "./db/migrate.js";
import { requireAuth } from "./middleware/requireAuth.js";
import { authRouter } from "./routes/auth.js";
import { geocodeHandler } from "./routes/geocode.js";
import {
  deletePushSubscription,
  getVapidPublic,
  postPushSubscription,
  postPushTest,
} from "./routes/push.js";
import { locationRouter } from "./routes/locations.js";
import { stockRouter } from "./routes/stocks.js";
import { taskRouter } from "./routes/tasks.js";
import * as store from "./store.js";
import type { WsOutboundMessage } from "./types.js";
import { addClient, broadcastToUser, clientCount } from "./wsHub.js";

const PORT = Number(process.env.PORT ?? 3000);

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", async (_req, res) => {
  try {
    await store.pingDb();
    res.json({
      ok: true,
      service: "pinned-api",
      database: "connected",
      wsClients: clientCount(),
    });
  } catch (err) {
    console.error(err);
    res.status(503).json({
      ok: false,
      service: "pinned-api",
      database: "error",
      wsClients: clientCount(),
    });
  }
});

app.get("/geocode", geocodeHandler);

app.get("/push/vapid-public", getVapidPublic);
app.post("/push/subscribe", requireAuth, postPushSubscription);
app.post("/push/test", requireAuth, postPushTest);
app.delete("/push/subscribe", requireAuth, deletePushSubscription);

app.use("/auth", authRouter);
app.use("/locations", requireAuth, locationRouter);
app.use("/tasks", requireAuth, taskRouter);
app.use("/stocks", requireAuth, stockRouter);

const server = createServer(app);

const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws, req) => {
  let userId: string;
  try {
    const host = req.headers.host ?? "localhost";
    const url = new URL(req.url ?? "/", `http://${host}`);
    const token = url.searchParams.get("token");
    if (!token) {
      ws.close(4401, "Unauthorized");
      return;
    }
    const { sub } = verifySessionToken(token);
    userId = sub;
  } catch {
    ws.close(4401, "Unauthorized");
    return;
  }

  const clientId = nanoid();
  addClient(ws, userId);
  const hello: WsOutboundMessage = {
    type: "connected",
    clientId,
  };
  ws.send(JSON.stringify(hello));

  void (async () => {
    try {
      const tasks = await store.listTasks(userId);
      const snapshot: WsOutboundMessage = {
        type: "tasks_updated",
        tasks,
      };
      ws.send(JSON.stringify(snapshot));
    } catch (err) {
      console.error(err);
      ws.send(
        JSON.stringify({
          type: "error",
          message: "failed_to_load_tasks",
        })
      );
    }
  })();

  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(String(raw)) as { type?: string };
      if (msg.type === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
      }
    } catch {
      /* ignore */
    }
  });
});

async function start(): Promise<void> {
  await migrate();
  server.listen(PORT, () => {
    console.log(`pinned-api listening on http://localhost:${PORT}`);
    console.log(`WebSocket: ws://localhost:${PORT}/ws?token=JWT`);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
