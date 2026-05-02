import DateTimePicker from "@react-native-community/datetimepicker";
import React, { useMemo, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";

function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultRemindDate(): Date {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

type Props = {
  value: Date | null;
  onChange: (d: Date | null) => void;
};

/**
 * Optional reminder time: native uses DateTimePicker; web uses datetime-local.
 */
export function ReminderTimeField({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value ?? defaultRemindDate());

  const label = useMemo(() => {
    if (!value) return "Any time (when you enter the zone)";
    return value.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }, [value]);

  if (Platform.OS === "web") {
    return (
      <View>
        <Text className="mt-1 text-xs text-slate-500">
          Only nudge after this time (your local time).
        </Text>
        {React.createElement("input", {
          type: "datetime-local",
          value: value ? toDatetimeLocalValue(value) : "",
          onChange: (e: { target: { value: string } }) => {
            const v = e.target.value;
            if (!v) {
              onChange(null);
              return;
            }
            const d = new Date(v);
            if (!Number.isNaN(d.getTime())) onChange(d);
          },
          style: {
            width: "100%",
            marginTop: 8,
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "#e2e8f0",
            backgroundColor: "#f8fafc",
            fontSize: 16,
          },
        })}
        <Pressable
          onPress={() => onChange(null)}
          className="mt-2 self-start rounded-lg bg-slate-100 px-3 py-2 active:bg-slate-200"
        >
          <Text className="text-sm font-medium text-slate-700">Clear time</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View>
      <Text className="mt-1 text-xs text-slate-500">
        Only nudge after this time (your local time).
      </Text>
      <Pressable
        onPress={() => {
          setDraft(value ?? defaultRemindDate());
          setOpen(true);
        }}
        className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 active:bg-slate-100"
      >
        <Text className="text-base text-slate-900">{label}</Text>
      </Pressable>
      <Pressable
        onPress={() => onChange(null)}
        className="mt-2 self-start rounded-lg bg-slate-100 px-3 py-2 active:bg-slate-200"
      >
        <Text className="text-sm font-medium text-slate-700">Any time in zone</Text>
      </Pressable>

      {open ? (
        Platform.OS === "ios" ? (
          <Modal transparent animationType="slide">
            <View className="flex-1 justify-end bg-black/40">
              <View className="rounded-t-2xl bg-white p-4 pb-8">
                <View className="mb-3 flex-row justify-between">
                  <Pressable onPress={() => setOpen(false)}>
                    <Text className="text-base text-pin-600">Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      onChange(draft);
                      setOpen(false);
                    }}
                  >
                    <Text className="text-base font-semibold text-pin-600">Done</Text>
                  </Pressable>
                </View>
                <DateTimePicker
                  value={draft}
                  mode="datetime"
                  display="spinner"
                  onChange={(_, d) => {
                    if (d) setDraft(d);
                  }}
                />
              </View>
            </View>
          </Modal>
        ) : (
          <DateTimePicker
            value={draft}
            mode="datetime"
            display="default"
            onChange={(event, d) => {
              setOpen(false);
              if (event.type === "dismissed" || !d) return;
              onChange(d);
            }}
          />
        )
      ) : null}
    </View>
  );
}
