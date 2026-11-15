import { useState } from "react";
import { View } from "react-native";
import Svg, { Circle, Ellipse, G, Path } from "react-native-svg";
import { colors, fonts } from "../theme";
import { T } from "./ui";

const TWIG =
  "M9 39 C6 33 11 30 8 24 C5 19 12 16 8 11 C5 7 10 5 9 1 C12 5 8 8 11 13 C14 18 7 21 11 26 C14 31 8 34 9 39Z";

/** The willow-twig roundel. `detailed` adds the dotted inner ring and sparkles (splash). */
export function LogoMark({ size, detailed = false }: { size: number; detailed?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 70 70">
      <Circle cx="35" cy="35" r="32" fill={colors.cream} stroke={colors.red} strokeWidth={detailed ? 2.5 : 3} />
      {detailed && (
        <Circle cx="35" cy="35" r="27" fill="none" stroke={colors.red} strokeWidth={1} strokeDasharray="1.2 3.2" opacity={0.85} />
      )}
      <G transform="translate(26,14) scale(0.95)">
        <Path d={TWIG} fill={colors.ink} />
        <Ellipse cx="9" cy="10" rx="1.5" ry="3" fill={colors.cream} />
        <Ellipse cx="9" cy="20" rx="1.6" ry="3.3" fill={colors.cream} />
        <Ellipse cx="9" cy="29" rx="1.3" ry="2.5" fill={colors.cream} />
      </G>
      {detailed && (
        <G fill={colors.red}>
          <Path d="M14 20l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9z" />
          <Path d="M55 44l.8 2.3 2.3.8-2.3.8-.8 2.3-.8-2.3-2.3-.8 2.3-.8z" />
          <Circle cx="54" cy="20" r="1.5" />
          <Circle cx="15" cy="49" r="1.3" />
        </G>
      )}
    </Svg>
  );
}

export function Twig({ width, height }: { width: number; height: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 18 40">
      <Path d={TWIG} fill={colors.ink} />
    </Svg>
  );
}

/**
 * `WISH · WILLOW` + `★ wishes do come true ★` on one line each. Shrinks below `size`
 * when the width it's given can't hold the wordmark (the wordmark is ~7.3em wide).
 */
export function Wordmark({ size: maxSize, align = "flex-start" }: { size: number; align?: "flex-start" | "center" }) {
  const [width, setWidth] = useState<number | null>(null);
  const big = maxSize >= 26;
  const size = width ? Math.min(maxSize, width / (big ? 7.7 : 7.4)) : maxSize;
  return (
    <View style={{ alignItems: align, alignSelf: "stretch" }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <T
        numberOfLines={1}
        style={{ fontFamily: fonts.anton, fontSize: size, letterSpacing: size * (big ? 0.15 : 0.13), color: colors.redDeep, lineHeight: size * 1.15 }}
      >
        WISH <T style={{ color: colors.ink }}>·</T> WILLOW
      </T>
      <T
        numberOfLines={1}
        style={{
          fontFamily: fonts.sansBold,
          fontSize: big ? size * 0.3 : Math.max(size * 0.37, 7),
          letterSpacing: (big ? size * 0.3 : size * 0.37) * (big ? 0.3 : 0.18),
          color: colors.ochre,
          marginTop: big ? 10 : 3,
          textTransform: "uppercase",
        }}
      >
        ★ wishes do come true ★
      </T>
    </View>
  );
}
