import { useAction, useMutation } from "convex/react";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import { useState } from "react";
import { Platform } from "react-native";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { uploadToConvex } from "./upload";

export type VoicePhase = "idle" | "recording" | "transcribing";

/** Browsers without getUserMedia + MediaRecorder (or on plain http) can't record, so web falls back to typing. */
export const voiceSupported =
  Platform.OS !== "web" ||
  (typeof window !== "undefined" &&
    window.isSecureContext &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined");

/** Tap to record, tap again to transcribe via Deepgram; the text goes to onText. */
export function useVoiceInput(onText: (text: string) => void) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const transcribe = useAction(api.voice.transcribe);
  const [phase, setPhase] = useState<VoicePhase>("idle");
  const [available, setAvailable] = useState(voiceSupported);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    if (phase === "transcribing" || !available) return;
    setError(null);
    if (phase === "idle") {
      try {
        const permission = await requestRecordingPermissionsAsync();
        if (!permission.granted) {
          setError(Platform.OS === "web" ? "Microphone is blocked — type instead." : "Microphone is off — type instead, or allow it in Settings.");
          return;
        }
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await recorder.prepareToRecordAsync();
        recorder.record();
        setPhase("recording");
      } catch {
        setAvailable(false);
        setError("Voice isn’t available here — type instead.");
      }
      return;
    }
    setPhase("transcribing");
    try {
      await recorder.stop();
      if (!recorder.uri) throw new Error("no recording");
      const storageId = await uploadToConvex(recorder.uri, await generateUploadUrl(), Platform.OS === "web" ? "audio/webm" : "audio/m4a");
      const text = await transcribe({ storageId: storageId as Id<"_storage"> });
      if (text) onText(text);
      else setError("Didn’t catch that — try again.");
    } catch {
      setError("Couldn’t transcribe that — try again or type it.");
    } finally {
      setPhase("idle");
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    }
  };

  return { phase, available, error, toggle };
}
