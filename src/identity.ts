import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation } from "convex/react";
import { randomUUID } from "expo-crypto";
import { useCallback, useEffect, useState } from "react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

const TOKEN_KEY = "ww.deviceToken";
const HANDLE_KEY = "ww.handle";

export type Me = { _id: Id<"users">; handle: string };

export type Identity =
  | { status: "loading" }
  | { status: "needsHandle"; handle: string; error?: string }
  | { status: "ready"; user: Me };

async function deviceToken() {
  const existing = await AsyncStorage.getItem(TOKEN_KEY);
  if (existing) return existing;
  const token = randomUUID();
  await AsyncStorage.setItem(TOKEN_KEY, token);
  return token;
}

function joinError(e: unknown) {
  const message = e instanceof Error ? e.message : String(e);
  if (message.includes("already taken")) return "That handle’s taken — pick another.";
  return "Couldn’t join — check your connection and try again.";
}

/**
 * Join-by-handle identity: the device keeps a random token and the handle it
 * joined with; on launch it re-joins with both, and prompts once for a handle.
 */
export function useIdentity() {
  const joinByHandle = useMutation(api.users.joinByHandle);
  const [identity, setIdentity] = useState<Identity>({ status: "loading" });

  const join = useCallback(
    async (handle: string) => {
      try {
        const user = await joinByHandle({ handle, deviceToken: await deviceToken() });
        await AsyncStorage.setItem(HANDLE_KEY, user.handle);
        setIdentity({ status: "ready", user: { _id: user._id, handle: user.handle } });
      } catch (e) {
        setIdentity({ status: "needsHandle", handle, error: joinError(e) });
      }
    },
    [joinByHandle],
  );

  useEffect(() => {
    AsyncStorage.getItem(HANDLE_KEY).then((handle) => {
      if (handle) join(handle);
      else setIdentity({ status: "needsHandle", handle: "" });
    });
  }, [join]);

  return { identity, join };
}
