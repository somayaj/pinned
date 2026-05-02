import { Router } from "express";
import { z } from "zod";
import * as store from "../store.js";
import { broadcast } from "../wsHub.js";

export const taskRouter = Router();

const createBody = z.object({
  title: z.string().min(1).max(200),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusMeters: z.number().min(10).max(50_000),
});

taskRouter.get("/", async (_req, res) => {
  try {
    const tasks = await store.listTasks();
    res.json({ tasks });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database_error" });
  }
});

taskRouter.post("/", async (req, res) => {
  const parsed = createBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  try {
    const task = await store.createTask(parsed.data);
    const tasks = await store.listTasks();
    broadcast({ type: "tasks_updated", tasks });
    broadcast({
      type: "task_alert",
      task,
      reason: "new_task",
    });
    res.status(201).json({ task });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database_error" });
  }
});

taskRouter.delete("/:id", async (req, res) => {
  try {
    const ok = await store.deleteTask(req.params.id);
    if (!ok) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const tasks = await store.listTasks();
    broadcast({ type: "tasks_updated", tasks });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database_error" });
  }
});

/** Called when the device enters the pin radius (optional sync with other clients). */
taskRouter.post("/:id/nudge", async (req, res) => {
  try {
    const task = await store.getTask(req.params.id);
    if (!task) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    broadcast({
      type: "task_alert",
      task,
      reason: "zone_entry",
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database_error" });
  }
});
