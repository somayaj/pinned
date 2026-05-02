import { Router } from "express";
import { z } from "zod";
import { sendWebPushZoneEntry } from "../push/sendWebPush.js";
import * as store from "../store.js";
import { broadcastToUser } from "../wsHub.js";

export const taskRouter = Router();

const createBody = z
  .object({
    title: z.string().min(1).max(200),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    radiusMeters: z.number().min(10).max(50_000).nullable().optional(),
    /** Pin: optional “not before” when in zone. Time-only: required schedule (no map). */
    remindAt: z.union([z.string().datetime(), z.null()]).optional(),
  })
  .superRefine((data, ctx) => {
    const hasLat = data.latitude != null;
    const hasLon = data.longitude != null;
    const hasR = data.radiusMeters != null;
    const pin = hasLat && hasLon && hasR;
    const partial = hasLat || hasLon || hasR;
    if (partial && !pin) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "For a map pin, send latitude, longitude, and radiusMeters together.",
      });
      return;
    }
    if (pin) return;
    const timeOnly =
      !hasLat &&
      !hasLon &&
      !hasR &&
      data.remindAt != null &&
      data.remindAt !== undefined;
    if (timeOnly) return;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        "For a time-only reminder, omit latitude, longitude, and radiusMeters, and set remindAt (ISO 8601).",
    });
  });

taskRouter.get("/", async (req, res) => {
  const userId = req.userId!;
  try {
    const tasks = await store.listTasks(userId);
    res.json({ tasks });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database_error" });
  }
});

taskRouter.post("/", async (req, res) => {
  const userId = req.userId!;
  const parsed = createBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  try {
    const { remindAt: rawRemind, title, latitude, longitude, radiusMeters } =
      parsed.data;
    const remindAt =
      rawRemind === undefined
        ? null
        : rawRemind === null
          ? null
          : new Date(rawRemind);
    const task = await store.createTask(userId, {
      title,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      radiusMeters: radiusMeters ?? null,
      remindAt,
    });
    const tasks = await store.listTasks(userId);
    broadcastToUser(userId, { type: "tasks_updated", tasks });
    broadcastToUser(userId, {
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
  const userId = req.userId!;
  try {
    const ok = await store.deleteTask(userId, req.params.id);
    if (!ok) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const tasks = await store.listTasks(userId);
    broadcastToUser(userId, { type: "tasks_updated", tasks });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database_error" });
  }
});

taskRouter.post("/:id/nudge", async (req, res) => {
  const userId = req.userId!;
  try {
    const task = await store.getTask(userId, req.params.id);
    if (!task) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const reason =
      task.latitude == null &&
      task.longitude == null &&
      task.radiusMeters == null
        ? "time_reminder"
        : "zone_entry";
    broadcastToUser(userId, {
      type: "task_alert",
      task,
      reason,
    });
    void sendWebPushZoneEntry(userId, task);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database_error" });
  }
});
