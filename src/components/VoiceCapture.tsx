import { useAction, useMutation } from "convex/react";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { api } from "../../convex/_generated/api";

type Status = "idle" | "recording" | "transcribing" | "saving" | "typing";

type Props = {
  label: string;
  placeholder: string;
  onSubmit: (text: string) => Promise<void>;
};

export function VoiceCapture({ label, placeholder, onSubmit }: Props) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const generateUploadUrl = useMutation(api.voice.generateUploadUrl);
  const transcribe = useAction(api.voice.transcribe);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState("");

  const fallBackToTyping = (message: string, draft = "") => {
    setError(message);
    setTyped(draft);
    setStatus("typing");
  };

  const submit = async (text: string) => {
    setStatus("saving");
    try {
      await onSubmit(text);
      setStatus("idle");
      setTyped("");
      setError(null);
    } catch (submitError) {
      console.warn("Saving failed", submitError);
      fallBackToTyping("We couldn't save that. Check it and try again.", text);
    }
  };

  const startRecording = async () => {
    setError(null);
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        fallBackToTyping("Microphone access is off, so type it here instead.");
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setStatus("recording");
    } catch (recordError) {
      console.warn("Recording failed to start", recordError);
      fallBackToTyping("Recording isn't working right now, so type it here instead.");
    }
  };

  const stopAndTranscribe = async () => {
    setStatus("transcribing");
    let text = "";
    try {
      await recorder.stop();
      if (!recorder.uri) throw new Error("Recording produced no file");
      const audio = await (await fetch(recorder.uri)).blob();
      const uploadUrl = await generateUploadUrl();
      const upload = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": audio.type || "audio/mp4" },
        body: audio,
      });
      if (!upload.ok) throw new Error(`Upload failed with ${upload.status}`);
      const { storageId } = await upload.json();
      text = await transcribe({ storageId });
    } catch (transcribeError) {
      console.warn("Transcription failed", transcribeError);
      fallBackToTyping("We couldn't catch that. Type it here instead.");
      return;
    }
    if (!text) {
      fallBackToTyping("We didn't hear anything. Type it here, or try speaking again.");
      return;
    }
    await submit(text);
  };

  if (status === "typing") {
    return (
      <View style={styles.container}>
        {error && <Text style={styles.error}>{error}</Text>}
        <TextInput
          style={styles.input}
          value={typed}
          onChangeText={setTyped}
          placeholder={placeholder}
          placeholderTextColor="#8A9886"
          multiline
          autoFocus
        />
        <Pressable
          accessibilityRole="button"
          disabled={typed.trim().length === 0}
          onPress={() => submit(typed.trim())}
          style={({ pressed }) => [
            styles.button,
            typed.trim().length === 0 && styles.buttonDisabled,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.buttonText}>Continue</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={startRecording}>
          <Text style={styles.link}>Try speaking again</Text>
        </Pressable>
      </View>
    );
  }

  const busy = status === "transcribing" || status === "saving";
  const recording = status === "recording";
  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={recording ? "Stop recording" : label}
        disabled={busy}
        onPress={recording ? stopAndTranscribe : startRecording}
        style={({ pressed }) => [
          styles.button,
          recording && styles.buttonRecording,
          pressed && styles.buttonPressed,
        ]}
      >
        {busy ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>{recording ? "Tap when you're done" : label}</Text>
        )}
      </Pressable>
      <Text style={styles.hint}>
        {recording
          ? "Listening..."
          : status === "transcribing"
            ? "Listening back to you..."
            : status === "saving"
              ? "Saving..."
              : "Tap and speak"}
      </Text>
      {status === "idle" && (
        <Pressable accessibilityRole="button" onPress={() => fallBackToTyping("")}>
          <Text style={styles.link}>Type instead</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
    gap: 12,
  },
  button: {
    width: "100%",
    minHeight: 72,
    paddingVertical: 22,
    borderRadius: 999,
    backgroundColor: "#4E7D3A",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonRecording: {
    backgroundColor: "#B5543C",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "700",
  },
  hint: {
    color: "#5B6B57",
    fontSize: 15,
  },
  link: {
    color: "#4E7D3A",
    fontSize: 16,
    fontWeight: "600",
    textDecorationLine: "underline",
    paddingVertical: 4,
  },
  error: {
    color: "#9A3B26",
    fontSize: 15,
    textAlign: "center",
  },
  input: {
    width: "100%",
    minHeight: 96,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#C9D6C3",
    backgroundColor: "#FFFFFF",
    padding: 14,
    fontSize: 17,
    color: "#1F2D1C",
    textAlignVertical: "top",
  },
});
