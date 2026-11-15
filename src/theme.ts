import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export const colors = {
  paper: "#EBE0C6",
  paper2: "#E2D4B4",
  cream: "#F4ECD8",
  red: "#B23A2C",
  redDeep: "#8E2C20",
  ink: "#241C16",
  ochre: "#C68A38",
  line: "#C9B98F",
  ochreInk: "#2b2008",
  muted: "#7a6b53",
  faint: "#9a8a68",
  meta: "#8a7a5c",
  body: "#6a5b45",
  note: "#4a3f33",
};

export const fonts = {
  anton: "Anton",
  yeseva: "YesevaOne",
  sans: "DMSans",
  sansMedium: "DMSans-Medium",
  sansBold: "DMSans-Bold",
};

/**
 * One scale factor for every screen: the mockup is drawn on a ~320×640 screen,
 * so sizes grow with the smaller of the width and safe-area height ratios,
 * clamped so the SE stays legible and tablets don't balloon.
 */
export function useScale() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const usable = height - insets.top - insets.bottom;
  const s = Math.min(Math.max(Math.min(width / 320, usable / 640), 0.85), 1.4);
  return { s, maxWidth: 360 * s };
}
