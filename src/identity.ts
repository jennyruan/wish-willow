import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation } from "convex/react";
import { randomUUID } from "expo-crypto";
import { useCallback, useEffect, useState } from "react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

const TOKEN_KEY = "ww.deviceToken";
const HANDLE_KEY = "ww.handle";
const USER_KEY = "ww.user";

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
 * Join-by-handle identity: the device keeps a random token and the user it
 * joined as. On launch a cached user is shown at once and re-joined in the
 * background; without one, it re-joins with the stored handle or prompts once.
 * Signing out drops the device token too, so the next new handle becomes a new
 * user instead of renaming the old one.
 */
export function useIdentity() {
  const joinByHandle = useMutation(api.users.joinByHandle);
  const [identity, setIdentity] = useState<Identity>({ status: "loading" });

  const signIn = useCallback(
    async (handle: string) => {
      const user = await joinByHandle({ handle, deviceToken: await deviceToken() });
      const me = { _id: user._id, handle: user.handle };
      await AsyncStorage.multiSet([[HANDLE_KEY, me.handle], [USER_KEY, JSON.stringify(me)]]);
      setIdentity({ status: "ready", user: me });
    },
    [joinByHandle],
  );

  const join = useCallback(
    (handle: string) => signIn(handle).catch((e) => setIdentity({ status: "needsHandle", handle, error: joinError(e) })),
    [signIn],
  );

  const signOut = useCallback(async () => {
    await AsyncStorage.multiRemove([USER_KEY, HANDLE_KEY, TOKEN_KEY]);
    setIdentity({ status: "needsHandle", handle: "" });
  }, []);

  useEffect(() => {
    AsyncStorage.multiGet([USER_KEY, HANDLE_KEY]).then(([[, cached], [, handle]]) => {
      if (cached) {
        const me = JSON.parse(cached) as Me;
        setIdentity({ status: "ready", user: me });
        signIn(me.handle).catch(() => {});
      } else if (handle) join(handle);
      else setIdentity({ status: "needsHandle", handle: "" });
    });
  }, [join, signIn]);

  return { identity, join, signOut };
}
