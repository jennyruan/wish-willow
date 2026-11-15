import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, useScale } from "../theme";
import { Paper } from "./Paper";
import { Avatar, T } from "./ui";

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
