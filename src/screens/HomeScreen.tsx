import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, View } from "react-native";
import { LogoMark, Wordmark } from "../components/Logo";
import { Avatar, Question, T, VoiceField } from "../components/ui";
import { colors, fonts, useScale } from "../theme";
import { voiceSupported } from "../voice";
import { EXAMPLE_WISHES, WISH_EMOJI, type WishKind } from "../wishKinds";

/** The "I Wish" home: brand + handle row, four example wishes, custom wish pinned at the bottom. */
export function HomeScreen({
  handle,
  streak,
  onPick,
  onCustom,
  onAvatar,
}: {
  handle: string;
  streak: number | null;
  onPick: (kind: Exclude<WishKind, "other">) => void;
  onCustom: (text: string) => void;
  onAvatar: () => void;
}) {
  const { s } = useScale();
  const [wish, setWish] = useState("");
  const submit = () => {
    if (wish.trim()) onCustom(wish.trim());
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={{ flex: 1, paddingHorizontal: 22 * s, paddingTop: 12 * s, paddingBottom: 14 * s }}>
        <View style={{ marginTop: 6 * s, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 * s }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 * s, flex: 1 }}>
            <LogoMark size={46 * s} />
            <View style={{ flex: 1 }}>
              <Wordmark size={19 * s} />
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 * s }}>
            {streak !== null && (
              <View accessibilityLabel={`${streak}-day wish-check streak`} style={{ backgroundColor: colors.ochre, borderRadius: 14 * s, paddingVertical: 6 * s, paddingHorizontal: 10 * s }}>
                <T style={{ fontFamily: fonts.sansBold, fontSize: 12 * s, color: colors.ochreInk }}>🔥 {streak}</T>
              </View>
            )}
            <Avatar handle={handle} size={34 * s} onPress={onAvatar} />
          </View>
        </View>

        <Question size={34} style={{ marginTop: 10 * s }}>I Wish</Question>
        <T style={{ color: colors.red, opacity: 0.6, fontSize: 11 * s, letterSpacing: 11 * s * 0.5, marginTop: 7 * s, marginBottom: 2 * s }}>✦ ✦ ✦</T>

        {EXAMPLE_WISHES.map((w) => (
          <Pressable
            key={w.kind}
            onPress={() => onPick(w.kind)}
            accessibilityRole="button"
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 12 * s,
              marginTop: 8 * s,
              paddingVertical: 10 * s,
              paddingHorizontal: 14 * s,
              borderWidth: 2,
              borderColor: colors.red,
              borderRadius: 13 * s,
              backgroundColor: colors.cream,
              transform: [{ translateY: pressed ? -2 : 0 }],
            })}
          >
            <T style={{ fontSize: 21 * s }}>{WISH_EMOJI[w.kind]}</T>
            <T style={{ flex: 1, fontFamily: fonts.yeseva, fontSize: 15 * s, lineHeight: 15 * s * 1.14 }}>{w.text}</T>
          </Pressable>
        ))}

        <View style={{ flex: 1, minHeight: 4 * s }} />
        <T style={{ textAlign: "center", fontSize: 10 * s, letterSpacing: 10 * s * 0.18, textTransform: "uppercase", color: colors.faint, marginBottom: 6 * s }}>
          {voiceSupported ? "speak or type your own wish" : "type your own wish"}
        </T>
        <VoiceField value={wish} onChangeText={setWish} onSubmit={submit} placeholder="I wish…" returnKeyType="go" style={{ marginTop: 0 }} />
      </View>
    </KeyboardAvoidingView>
  );
}
