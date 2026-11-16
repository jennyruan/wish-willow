import { useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { colors, fonts, useScale } from "../theme";
import { useVoiceInput } from "../voice";

/** Base text: DM Sans ink, with OS font scaling capped so layouts still fit. */
export function T({ style, ...rest }: TextProps) {
  return <Text maxFontSizeMultiplier={1.25} style={[base.text, style]} {...rest} />;
}

/** A hard offset "stamp" shadow under a rounded shape (letterpress buttons and chips). */
function Stamp({ depth, radius, color, children, style }: { depth: number; radius: number; color: string | null; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ paddingBottom: depth }, style]}>
      {color && (
        <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, top: depth, borderRadius: radius, backgroundColor: color }} />
      )}
      {children}
    </View>
  );
}

export function CtaButton({ label, onPress, disabled, style }: { label: string; onPress: () => void; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  const { s } = useScale();
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" style={[{ marginTop: 18 * s, opacity: disabled ? 0.45 : 1 }, style]}>
      {({ pressed }) => (
        <Stamp depth={pressed ? 2 * s : 5 * s} radius={13 * s} color={colors.redDeep} style={{ marginTop: pressed ? 3 * s : 0 }}>
          <View style={{ backgroundColor: colors.red, borderRadius: 13 * s, paddingVertical: 15 * s, alignItems: "center" }}>
            <T style={{ fontFamily: fonts.anton, fontSize: 16 * s, letterSpacing: 16 * s * 0.07, color: colors.cream, textTransform: "uppercase" }}>{label}</T>
          </View>
        </Stamp>
      )}
    </Pressable>
  );
}

export function Chip({ label, on, onPress, swatch }: { label: string; on: boolean; onPress: () => void; swatch?: string }) {
  const { s } = useScale();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }}>
      <Stamp depth={3 * s} radius={22 * s} color={on ? colors.redDeep : null}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            borderWidth: 1.5,
            borderColor: colors.red,
            borderRadius: 22 * s,
            paddingVertical: 9 * s,
            paddingHorizontal: 15 * s,
            backgroundColor: on ? colors.red : "transparent",
          }}
        >
          {swatch && (
            <View style={{ width: 13 * s, height: 13 * s, borderRadius: 7 * s, backgroundColor: swatch, borderWidth: 1, borderColor: "rgba(0,0,0,.25)", marginRight: 6 * s }} />
          )}
          <T style={{ fontFamily: fonts.sansMedium, fontSize: 13 * s, color: on ? colors.cream : colors.red }}>{label}</T>
        </View>
      </Stamp>
    </Pressable>
  );
}

export function Chips({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { s } = useScale();
  return <View style={[{ flexDirection: "row", flexWrap: "wrap", gap: 9 * s, marginTop: 16 * s }, style]}>{children}</View>;
}

export function Kicker({ children, style }: { children: ReactNode; style?: TextProps["style"] }) {
  const { s } = useScale();
  return (
    <T style={[{ fontFamily: fonts.sansBold, fontSize: 10 * s, letterSpacing: 10 * s * 0.2, textTransform: "uppercase", color: colors.ochre, marginBottom: 7 * s }, style]}>
      {children}
    </T>
  );
}

export function Question({ children, size = 26, style }: { children: ReactNode; size?: number; style?: TextProps["style"] }) {
  const { s } = useScale();
  return <T style={[{ fontFamily: fonts.yeseva, fontSize: size * s, lineHeight: size * s * 1.14, color: colors.ink }, style]}>{children}</T>;
}

export function Sub({ children, style }: { children: ReactNode; style?: TextProps["style"] }) {
  const { s } = useScale();
  return <T style={[{ fontSize: 12.5 * s, lineHeight: 12.5 * s * 1.4, color: colors.muted, marginTop: 8 * s }, style]}>{children}</T>;
}

export function GroupLabel({ children }: { children: ReactNode }) {
  const { s } = useScale();
  return (
    <T style={{ fontFamily: fonts.sansBold, fontSize: 10 * s, letterSpacing: 10 * s * 0.16, textTransform: "uppercase", color: colors.faint, marginTop: 16 * s, marginBottom: 2 * s }}>
      {children}
    </T>
  );
}

export function Avatar({ handle, size, onPress }: { handle: string; size: number; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`@${handle} menu`}>
      <Stamp depth={2} radius={size / 2} color={colors.redDeep}>
        <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.red, alignItems: "center", justifyContent: "center" }}>
          <T style={{ fontFamily: fonts.sansBold, fontSize: size * 0.42, color: colors.cream }}>{handle.charAt(0).toUpperCase()}</T>
        </View>
      </Stamp>
    </Pressable>
  );
}

export function StatusLabel({ realized }: { realized: boolean }) {
  return <Pill tone={realized ? "true" : "prog"} text={realized ? "✓ true" : "in progress"} />;
}

export function Pill({ tone, text }: { tone: "true" | "prog"; text: string }) {
  const { s } = useScale();
  const on = tone === "true";
  return (
    <View style={{ borderRadius: 12 * s, paddingVertical: 4 * s, paddingHorizontal: 8 * s, backgroundColor: on ? colors.ochre : colors.paper2, borderWidth: on ? 0 : 1, borderColor: colors.line }}>
      <T style={{ fontFamily: fonts.sansBold, fontSize: 9 * s, letterSpacing: 9 * s * 0.1, textTransform: "uppercase", color: on ? colors.ochreInk : colors.redDeep }}>{text}</T>
    </View>
  );
}

/** Mic button: tap to record, tap to stop and transcribe into the field. */
export function MicButton({ onText, submit }: { onText: (text: string) => void; submit?: () => void }) {
  const { s } = useScale();
  const voice = useVoiceInput(onText);
  const size = 36 * s;
  const icon = submit ? "➤" : "🎙";
  if (!submit && !voice.available) return <View style={{ alignItems: "flex-end" }}>{voice.error && <VoiceError text={voice.error} />}</View>;
  return (
    <View style={{ alignItems: "flex-end" }}>
      <Pressable
        onPress={submit && voice.phase === "idle" ? submit : voice.toggle}
        accessibilityRole="button"
        accessibilityLabel={submit ? "Make this wish" : voice.phase === "recording" ? "Stop recording" : "Speak"}
      >
        <Stamp depth={3 * s} radius={size / 2} color={colors.redDeep}>
          <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: voice.phase === "recording" ? colors.redDeep : colors.red, alignItems: "center", justifyContent: "center" }}>
            {voice.phase === "transcribing" ? (
              <ActivityIndicator color={colors.cream} size="small" />
            ) : (
              <T style={{ fontSize: (voice.phase === "recording" ? 13 : 16) * s, color: colors.cream }}>{voice.phase === "recording" ? "■" : icon}</T>
            )}
          </View>
        </Stamp>
      </Pressable>
      {voice.error && <VoiceError text={voice.error} />}
    </View>
  );
}

function VoiceError({ text }: { text: string }) {
  const { s } = useScale();
  return <T style={{ position: "absolute", top: 42 * s, right: 0, width: 220 * s, textAlign: "right", fontSize: 11 * s, color: colors.redDeep }}>{text}</T>;
}

/** Cream rounded field with a voice button; spoken text is appended to the value. */
export function VoiceField({
  value,
  onChangeText,
  multiline,
  prefix,
  suffix,
  onSubmit,
  canSubmit = value.trim().length > 0,
  style,
  ...input
}: Omit<TextInputProps, "style"> & { value: string; onChangeText: (t: string) => void; prefix?: ReactNode; suffix?: ReactNode; onSubmit?: () => void; canSubmit?: boolean; style?: StyleProp<ViewStyle> }) {
  const { s } = useScale();
  return (
    <View
      style={[
        {
          marginTop: 14 * s,
          flexDirection: "row",
          alignItems: multiline ? "flex-start" : "center",
          gap: 8 * s,
          backgroundColor: colors.cream,
          borderWidth: 1.5,
          borderColor: colors.line,
          borderRadius: 14 * s,
          paddingVertical: 6 * s,
          paddingLeft: 14 * s,
          paddingRight: 8 * s,
        },
        style,
      ]}
    >
      {prefix}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        placeholderTextColor={colors.faint}
        onSubmitEditing={onSubmit}
        maxFontSizeMultiplier={1.25}
        style={[
          { flex: 1, fontFamily: fonts.sans, fontSize: 13.5 * s, color: colors.ink, paddingVertical: 8 * s, outlineStyle: "none" } as object,
          multiline && { minHeight: 92 * s, textAlignVertical: "top", paddingTop: 6 * s },
        ]}
        {...input}
      />
      {suffix}
      <MicButton
        submit={onSubmit && canSubmit ? onSubmit : undefined}
        onText={(text) => onChangeText(value.trim() ? `${value.trim()} ${text}` : text)}
      />
    </View>
  );
}

/** Mockup's native <select>: a cream field with a red chevron that opens an option sheet. */
export function Select<V extends string | number>({ value, options, onChange, label }: { value: V; options: V[]; onChange: (v: V) => void; label: string }) {
  const { s } = useScale();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value}`}
        style={{ flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: colors.cream, borderWidth: 1.5, borderColor: colors.line, borderRadius: 12 * s, paddingVertical: 12 * s, paddingLeft: 14 * s, paddingRight: 13 * s }}
      >
        <T style={{ flex: 1, fontSize: 14 * s }}>{value}</T>
        <Svg width={12} height={8}>
          <Path d="M1 1l5 5 5-5" fill="none" stroke={colors.red} strokeWidth={2} />
        </Svg>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={base.scrim} onPress={() => setOpen(false)}>
          <View style={[base.sheet, { borderRadius: 14 * s, width: 240 * s }]}>
            <T style={{ fontFamily: fonts.sansBold, fontSize: 10 * s, letterSpacing: 1.6 * s, textTransform: "uppercase", color: colors.faint, padding: 12 * s }}>{label}</T>
            <ScrollView style={{ maxHeight: 320 * s }}>
              {options.map((o) => (
                <Pressable
                  key={String(o)}
                  onPress={() => {
                    onChange(o);
                    setOpen(false);
                  }}
                  style={{ paddingVertical: 11 * s, paddingHorizontal: 14 * s, borderTopWidth: 1, borderColor: colors.line, backgroundColor: o === value ? colors.paper2 : "transparent" }}
                >
                  <T style={{ fontSize: 14 * s, color: o === value ? colors.red : colors.ink, fontFamily: o === value ? fonts.sansBold : fonts.sans }}>{o}</T>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const base = StyleSheet.create({
  text: { fontFamily: fonts.sans, color: colors.ink },
  scrim: { flex: 1, backgroundColor: "rgba(36,28,22,.35)", alignItems: "center", justifyContent: "center" },
  sheet: { backgroundColor: colors.cream, borderWidth: 1.5, borderColor: colors.line, overflow: "hidden" },
});
