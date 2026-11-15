import { useState } from "react";
import { KeyboardAvoidingView, Platform, TextInput, View } from "react-native";
import { Screen } from "../components/Chrome";
import { LogoMark, Wordmark } from "../components/Logo";
import { CtaButton, Question, Sub, T } from "../components/ui";
import { colors, fonts, useScale } from "../theme";

const HANDLE = /^[a-z0-9_]{2,20}$/;

/** One-time handle prompt; the handle is unique and becomes this device's identity. */
export function JoinScreen({ initialHandle, error, onJoin }: { initialHandle: string; error?: string; onJoin: (handle: string) => Promise<void> }) {
  const { s } = useScale();
  const [handle, setHandle] = useState(initialHandle);
  const [busy, setBusy] = useState(false);
  const valid = HANDLE.test(handle);

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    await onJoin(handle);
    setBusy(false);
  };

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={{ flex: 1, paddingHorizontal: 22 * s, paddingBottom: 14 * s, justifyContent: "center" }}>
          <View style={{ alignItems: "center", marginBottom: 28 * s }}>
            <LogoMark size={72 * s} detailed />
            <View style={{ marginTop: 12 * s, alignSelf: "stretch" }}>
              <Wordmark size={22 * s} align="center" />
            </View>
          </View>
          <Question>What should Willow call you?</Question>
          <Sub>Pick a handle — it’s how the grove finds you. You only do this once on this device.</Sub>
          <View style={{ marginTop: 18 * s, flexDirection: "row", alignItems: "center", gap: 6 * s, backgroundColor: colors.cream, borderWidth: 1.5, borderColor: colors.line, borderRadius: 14 * s, paddingHorizontal: 14 * s }}>
            <T style={{ fontFamily: fonts.anton, fontSize: 20 * s, color: colors.red }}>@</T>
            <TextInput
              value={handle}
              onChangeText={(t) => setHandle(t.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
              placeholder="yourname"
              placeholderTextColor={colors.faint}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              maxLength={20}
              returnKeyType="go"
              onSubmitEditing={submit}
              style={{ flex: 1, fontFamily: fonts.sans, fontSize: 16 * s, color: colors.ink, paddingVertical: 14 * s, outlineStyle: "none" } as object}
            />
          </View>
          <T style={{ fontSize: 11.5 * s, color: error ? colors.redDeep : colors.faint, marginTop: 8 * s }}>
            {error ?? "2–20 letters, numbers, or underscores."}
          </T>
          <CtaButton label={busy ? "Joining…" : "Join the grove"} onPress={submit} disabled={!valid || busy} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
