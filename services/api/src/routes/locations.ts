import { Router } from "express";
import { z } from "zod";
import * as store from "../store.js";
import { broadcastToUser } from "../wsHub.js";

export const locationRouter = Router();

const createBody = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusMeters: z.number().min(10).max(50_000),
});

locationRouter.get("/", async (req, res) => {
  const userId = req.userId!;
  try {
    const locations = await store.listLocations(userId);
    res.json({ locations });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database_error" });
  }
});

locationRouter.post("/", async (req, res) => {
  const userId = req.userId!;
  const parsed = createBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  try {
    const loc = await store.createLocation(userId, {
      name: parsed.data.name,
      description:
        parsed.data.description == null || parsed.data.description === ""
          ? null
          : parsed.data.description.trim(),
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      radiusMeters: parsed.data.radiusMeters,
    });
    res.status(201).json({ location: loc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database_error" });
  }
});

locationRouter.delete("/:id", async (req, res) => {
  const userId = req.userId!;
  try {
    const ok = await store.deleteLocation(userId, req.params.id);
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
