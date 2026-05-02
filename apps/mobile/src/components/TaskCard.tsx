import React from "react";
import { Pressable, Text, View } from "react-native";
import { formatDistance, distanceMeters } from "../lib/geo";
import type { Task } from "../types/task";

type Props = {
  item: Task;
  /** Current user position for “away” line; omit to hide distance. */
  userLatLon?: { lat: number; lon: number } | null;
  reminderMutedTaskIds?: readonly string[];
  onResumeReminders?: (taskId: string) => void;
  onRemove?: (taskId: string) => void;
  /** When false, no remove / resume (e.g. read-only “at this area” preview). */
  showActions?: boolean;
};

export function TaskCard({
  item,
  userLatLon,
  reminderMutedTaskIds = [],
  onResumeReminders,
  onRemove,
  showActions = true,
}: Props) {
  const d =
    userLatLon &&
    item.latitude != null &&
    item.longitude != null
      ? distanceMeters(
          userLatLon.lat,
          userLatLon.lon,
          item.latitude,
          item.longitude
        )
      : null;

  return (
    <View className="mb-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <Text className="text-xs font-medium uppercase text-slate-400">
        {item.latitude != null &&
        item.longitude != null &&
        item.radiusMeters != null &&
        !item.locationId
          ? "Nickname"
          : "Reminder"}
      </Text>
      <Text className="text-base font-semibold text-slate-900">{item.title}</Text>
      {item.latitude != null &&
      item.longitude != null &&
      item.radiusMeters != null &&
      item.description != null &&
      item.description.trim() !== "" ? (
        <Text className="mt-2 text-sm leading-5 text-slate-600">
          {item.description}
        </Text>
      ) : null}
      <Text className="mt-2 text-xs text-slate-500">
        {item.latitude != null &&
        item.longitude != null &&
        item.radiusMeters != null ? (
          <>
            Radius {item.radiusMeters} m
            {d != null ? ` · ${formatDistance(d)} away` : ""}
            {item.remindAt != null && item.remindAt !== ""
              ? ` · Not before ${new Date(item.remindAt).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}`
              : ""}
          </>
        ) : (
          <>
            Time reminder (no map pin)
            {item.remindAt != null && item.remindAt !== ""
              ? ` · From ${new Date(item.remindAt).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}`
              : ""}
          </>
        )}
      </Text>
      {showActions && reminderMutedTaskIds.includes(item.id) && onResumeReminders ? (
        <View className="mt-2 flex-row flex-wrap items-center gap-2">
          <Text className="text-xs text-amber-900">
            Reminders muted after Dismiss — tap Resume to get nudges again.
          </Text>
          <Pressable
            onPress={() => onResumeReminders(item.id)}
            accessibilityRole="button"
            accessibilityLabel={`Resume reminders for ${item.title}`}
            className="rounded-lg bg-amber-200 px-3 py-1.5 active:bg-amber-300"
          >
            <Text className="text-xs font-semibold text-amber-950">Resume</Text>
          </Pressable>
        </View>
      ) : null}
      {showActions && onRemove ? (
        <Pressable
          onPress={() => void onRemove(item.id)}
          className="mt-3 self-start rounded-lg bg-red-50 px-3 py-2 active:bg-red-100"
        >
          <Text className="text-sm font-medium text-red-700">Remove</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
