import { Router } from "express";
import { z } from "zod";
import { sendWebPushZoneEntry } from "../push/sendWebPush.js";
import * as store from "../store.js";
import { filterTasksByLocation } from "../taskLocationFilter.js";
import { broadcastToUser } from "../wsHub.js";

export const taskRouter = Router();

/** Optional: filter pin tasks by location (query string). */
const listTasksQuery = z
  .object({
    /** Return only tasks linked to this saved location. */
    locationId: z.string().min(1).optional(),
    /** With centerLon: return pin tasks whose center is within centerRadiusMeters of this point. */
    centerLat: z.coerce.number().min(-90).max(90).optional(),
    centerLon: z.coerce.number().min(-180).max(180).optional(),
    centerRadiusMeters: z.coerce.number().min(5).max(50_000).optional(),
    /** With containsLon: return pin tasks whose geofence contains this point. */
    containsLat: z.coerce.number().min(-90).max(90).optional(),
    containsLon: z.coerce.number().min(-180).max(180).optional(),
  })
  .superRefine((q, ctx) => {
    const hasCenterPair =
      q.centerLat != null &&
      q.centerLon != null &&
      !Number.isNaN(q.centerLat) &&
      !Number.isNaN(q.centerLon);
    const partialCenter =
      q.centerLat != null ||
      q.centerLon != null ||
      q.centerRadiusMeters != null;
    if (partialCenter && !hasCenterPair) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Use centerLat and centerLon together (optional centerRadiusMeters, default 100).",
      });
    }
    const hasContainsPair =
      q.containsLat != null &&
      q.containsLon != null &&
      !Number.isNaN(q.containsLat) &&
      !Number.isNaN(q.containsLon);
    const partialContains = q.containsLat != null || q.containsLon != null;
    if (partialContains && !hasContainsPair) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Use containsLat and containsLon together.",
      });
    }
  });

const createBody = z
  .object({
    title: z.string().min(1).max(200),
    description: z.string().max(2000).nullable().optional(),
    /** When set, task is tied to a saved location (omit lat/lon/radius). */
    locationId: z.string().min(1).optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    radiusMeters: z.number().min(10).max(50_000).nullable().optional(),
    /** Pin: optional “not before” when in zone. Time-only: required schedule (no map). */
    remindAt: z.union([z.string().datetime(), z.null()]).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.locationId != null && data.locationId !== "") {
      const extra =
        data.latitude != null ||
        data.longitude != null ||
        data.radiusMeters != null;
      if (extra) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "When using locationId, omit latitude, longitude, and radiusMeters.",
        });
      }
      return;
    }
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
        "Use locationId for a saved place, or send a full pin, or a time-only reminder with remindAt (ISO 8601).",
    });
  });

taskRouter.get("/", async (req, res) => {
  const userId = req.userId!;
  const parsed = listTasksQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  try {
    const q = parsed.data;
    let tasks = await store.listTasks(userId, {
      locationId: q.locationId,
    });
    const hasCenter =
      q.centerLat != null &&
      q.centerLon != null &&
      !Number.isNaN(q.centerLat) &&
      !Number.isNaN(q.centerLon);
    const hasContains =
      q.containsLat != null &&
      q.containsLon != null &&
      !Number.isNaN(q.containsLat) &&
      !Number.isNaN(q.containsLon);
    if (hasCenter || hasContains) {
      tasks = filterTasksByLocation(tasks, {
        center: hasCenter
          ? {
              lat: q.centerLat as number,
              lon: q.centerLon as number,
              radiusMeters: q.centerRadiusMeters ?? 100,
            }
          : undefined,
        containsPoint: hasContains
          ? {
              lat: q.containsLat as number,
              lon: q.containsLon as number,
            }
          : undefined,
      });
    }
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
    const {
      remindAt: rawRemind,
      title,
      description: rawDesc,
      locationId,
      latitude,
      longitude,
      radiusMeters,
    } = parsed.data;
    const remindAt =
      rawRemind === undefined
        ? null
        : rawRemind === null
          ? null
          : new Date(rawRemind);
    const description =
      rawDesc === undefined || rawDesc === null
        ? null
        : rawDesc.trim() === ""
          ? null
        : rawDesc.trim();
    let task;
    try {
      task = await store.createTask(userId, {
        title,
        description,
        remindAt,
        locationId: locationId ?? null,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        radiusMeters: radiusMeters ?? null,
      });
    } catch (e) {
      if (e instanceof Error && e.message === "location_not_found") {
        res.status(404).json({ error: "location_not_found" });
        return;
      }
      throw e;
    }
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
