import { useEffect, useRef, useState, type ReactNode } from "react";
import { Dimensions, Keyboard, Platform, Pressable, View, type KeyboardEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, useScale } from "../theme";
import { Paper } from "./Paper";
import { Avatar, T } from "./ui";

/**
 * Pads its bottom by exactly how much the on-screen keyboard overlaps it, so
 * inputs and their send buttons pinned at the bottom stay above the keyboard.
 * Measures itself in window coordinates, so tab bars, top bars, and safe-area
 * padding around it are accounted for (KeyboardAvoidingView measures relative
 * to its parent and under-pads inside Screen).
 */
export function KeyboardAvoider({ children }: { children: ReactNode }) {
  const ref = useRef<View>(null);
  const keyboardTop = useRef<number | null>(null);
  const [pad, setPad] = useState(0);

  const measure = () => {
    const top = keyboardTop.current;
    if (top === null) return setPad(0);
    ref.current?.measureInWindow((_x, y, _w, h) => setPad(Math.max(0, y + h - top)));
  };

  useEffect(() => {
    const ios = Platform.OS === "ios";
    const onFrame = (e: KeyboardEvent) => {
      keyboardTop.current = e.endCoordinates.screenY || Dimensions.get("window").height - e.endCoordinates.height;
      measure();
    };
    const subs = [
      Keyboard.addListener(ios ? "keyboardWillShow" : "keyboardDidShow", onFrame),
      Keyboard.addListener(ios ? "keyboardWillChangeFrame" : "keyboardDidChangeFrame", (e) => Keyboard.isVisible() && onFrame(e)),
      Keyboard.addListener(ios ? "keyboardWillHide" : "keyboardDidHide", () => {
        keyboardTop.current = null;
        setPad(0);
      }),
    ];
    return () => subs.forEach((sub) => sub.remove());
  }, []);

  return (
    <View ref={ref} style={{ flex: 1 }} onLayout={measure}>
      <View style={{ flex: 1, marginBottom: pad }}>{children}</View>
    </View>
  );
}

export type Tab = "notif" | "dms" | "wishes" | "community";

/** Paper page inside the safe area, content capped to a phone-width column on tablets. */
export function Screen({ children, tabBar }: { children: ReactNode; tabBar?: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { maxWidth } = useScale();
  return (
    <Paper style={{ paddingTop: insets.top, paddingBottom: tabBar ? 0 : insets.bottom }}>
      <View style={{ flex: 1, width: "100%", maxWidth, alignSelf: "center" }}>{children}</View>
      {tabBar}
    </Paper>
  );
}

/** Back chevron, a centred Anton mark (WISH·WILLOW by default), optional avatar. */
export function TopBar({ title, onBack, handle, onAvatar }: { title?: string; onBack?: () => void; handle?: string; onAvatar?: () => void }) {
  const { s } = useScale();
  const markStyle = { fontFamily: fonts.anton, fontSize: 11 * s, letterSpacing: 11 * s * 0.22, color: colors.redDeep, opacity: 0.75 };
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingTop: 8 * s, paddingHorizontal: 14 * s, minHeight: 38 * s }}>
      <View style={{ width: 44 * s }}>
        {onBack && (
          <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back" style={{ paddingLeft: 8 * s }}>
            <T style={{ fontSize: 22 * s, color: colors.ink, opacity: 0.5 }}>‹</T>
          </Pressable>
        )}
      </View>
      <View style={{ flex: 1, alignItems: "center" }}>
        {title ? (
          <T numberOfLines={1} style={markStyle}>{title}</T>
        ) : (
          <T style={markStyle}>
            WISH<T style={{ color: colors.ink }}>·</T>WILLOW
          </T>
        )}
      </View>
      <View style={{ width: 44 * s, alignItems: "flex-end" }}>
        {handle && <Avatar handle={handle} size={30 * s} onPress={onAvatar} />}
      </View>
    </View>
  );
}

const TABS: Array<{ tab: Tab; icon: string; label: string }> = [
  { tab: "notif", icon: "🔔", label: "Notifications" },
  { tab: "dms", icon: "✉️", label: "DMs" },
  { tab: "wishes", icon: "🌳", label: "Wishes" },
  { tab: "community", icon: "👥", label: "Community" },
];

export function TabBar({ active, onSelect }: { active: Tab | null; onSelect: (tab: Tab) => void }) {
  const { s } = useScale();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flexDirection: "row", borderTopWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, paddingBottom: insets.bottom }}>
      {TABS.map(({ tab, icon, label }) => (
        <Pressable
          key={tab}
          onPress={() => onSelect(tab)}
          accessibilityRole="tab"
          accessibilityState={{ selected: active === tab }}
          style={{ flex: 1, alignItems: "center", paddingTop: 8 * s, paddingBottom: 11 * s, paddingHorizontal: 2 }}
        >
          <T style={{ fontSize: 17 * s, marginBottom: 3 * s }}>{icon}</T>
          <T numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: fonts.sansBold, fontSize: 8 * s, letterSpacing: 8 * s * 0.03, textTransform: "uppercase", color: active === tab ? colors.red : colors.meta }}>
            {label}
          </T>
        </Pressable>
      ))}
    </View>
  );
}
