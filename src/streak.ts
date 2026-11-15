import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

const KEY = "ww.streak";

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

/** Consecutive days this device has opened Willow to check on its wishes. */
export function useStreak() {
  const [streak, setStreak] = useState<number | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then(async (raw) => {
      const now = new Date();
      const today = dayKey(now);
      const yesterday = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
      const saved = raw ? (JSON.parse(raw) as { day: string; count: number }) : null;
      const count =
        saved?.day === today ? saved.count : saved?.day === yesterday ? saved.count + 1 : 1;
      await AsyncStorage.setItem(KEY, JSON.stringify({ day: today, count }));
      setStreak(count);
    });
  }, []);

  return streak;
}
