import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

const KEY = "ww.streak";

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

/**
 * Consecutive days this device has opened Willow to check on its wishes,
 * recounted on launch and whenever the app returns to the foreground. Once
 * the user is known, the check-in is mirrored to Convex so the daily nudge
 * skips users who already checked in and can quote their streak.
 */
export function useStreak(userId: Id<"users"> | undefined) {
  const [streak, setStreak] = useState<number | null>(null);
  const checkIn = useMutation(api.nudge.checkIn);

  useEffect(() => {
    const record = () => AsyncStorage.getItem(KEY).then(async (raw) => {
      const now = new Date();
      const today = dayKey(now);
      const yesterday = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
      const saved = raw ? (JSON.parse(raw) as { day: string; count: number }) : null;
      const count =
        saved?.day === today ? saved.count : saved?.day === yesterday ? saved.count + 1 : 1;
      await AsyncStorage.setItem(KEY, JSON.stringify({ day: today, count }));
      setStreak(count);
      if (userId) await checkIn({ userId, streak: count });
    });
    record();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") record();
    });
    return () => sub.remove();
  }, [userId, checkIn]);

  return streak;
}
