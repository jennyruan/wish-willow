import { useMutation } from "convex/react";
import * as ImagePicker from "expo-image-picker";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { uploadToConvex } from "./upload";

export type Attachment = { uri: string; kind: "photo" | "video"; mimeType: string };

/** Pick one photo or video (≤60s) from the library, or null if cancelled. */
export async function pickMedia(): Promise<Attachment | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images", "videos"], quality: 0.7, videoMaxDuration: 60 });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const kind = asset.type === "video" ? "video" : "photo";
  return { uri: asset.uri, kind, mimeType: asset.mimeType ?? (kind === "video" ? "video/mp4" : "image/jpeg") };
}

/** files:generateUploadUrl → POST bytes → storage id, for comments and DMs. */
export function useUploadMedia() {
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  return async (a: Attachment) => (await uploadToConvex(a.uri, await generateUploadUrl(), a.mimeType)) as Id<"_storage">;
}

export function timeAgo(at: number) {
  const sec = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (sec < 60) return "now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  return `${Math.floor(sec / 86400)}d`;
}
