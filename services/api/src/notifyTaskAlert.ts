import type { Task } from "./types.js";
import { sendSmsTaskAlert } from "./push/sendSms.js";
import { sendWebPushZoneEntry } from "./push/sendWebPush.js";

/** Same moments as WebSocket `task_alert`: web push + optional SMS. */
export async function notifyTaskAlertChannels(
  userId: string,
  task: Task,
  reason: string
): Promise<void> {
  await sendWebPushZoneEntry(userId, task);
  await sendSmsTaskAlert(userId, task, reason);
}
