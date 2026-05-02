import type { Task } from "../types.js";
import * as store from "../store.js";

function taskDetailSuffix(task: Task): string {
  const d = task.description?.trim();
  if (!d) return "";
  const s = d.length > 120 ? `${d.slice(0, 120)}…` : d;
  return ` — ${s}`;
}

/** SMS body aligned with web push / in-app copy (single segment when possible). */
export function buildTaskAlertSmsBody(task: Task, reason: string): string {
  const detail = taskDetailSuffix(task);
  const atPlace =
    task.latitude != null &&
    task.longitude != null &&
    task.radiusMeters != null;

  if (reason === "new_task") {
    return atPlace
      ? `Pin it: New pin — ${task.title}${detail}`
      : `Pin it: New reminder — ${task.title}${detail}`;
  }
  if (reason === "time_reminder") {
    return `Pin it: Reminder — ${task.title}${detail}`;
  }
  if (reason === "zone_entry") {
    return atPlace
      ? `Pin it: You're at — ${task.title}${detail}`
      : `Pin it: ${task.title}${detail}`;
  }
  return `Pin it: ${task.title}${detail}`;
}

/**
 * Sends SMS via Twilio when the user opted in and `TWILIO_*` env vars are set.
 * Fails soft (logs only) so API requests still succeed.
 */
export async function sendSmsTaskAlert(
  userId: string,
  task: Task,
  reason: string
): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_SMS_FROM?.trim();
  if (!accountSid || !authToken || !from) {
    return;
  }

  const { phoneE164, smsAlerts } = await store.getUserSmsSettings(userId);
  if (!smsAlerts || !phoneE164) return;

  const body = buildTaskAlertSmsBody(task, reason).slice(0, 1600);
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: phoneE164,
        From: from,
        Body: body,
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error("[sms] Twilio failed", res.status, t.slice(0, 400));
      return;
    }
    console.log(`[sms] sent task=${task.id} reason=${reason} to=${phoneE164.slice(0, 6)}…`);
  } catch (e) {
    console.error("[sms] Twilio request error", e);
  }
}
