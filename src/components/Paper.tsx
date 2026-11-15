import { StyleSheet, View, type ViewProps } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Pattern, RadialGradient, Rect, Stop } from "react-native-svg";
import { colors } from "../theme";

/** Kraft-paper background: two offset grain layers, a light wash, and a soft vignette. */
export function Paper({ style, children, ...rest }: ViewProps) {
  return (
    <View style={[styles.paper, style]} {...rest}>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <Pattern id="grainA" width="7" height="7" patternUnits="userSpaceOnUse">
            <Circle cx="1.4" cy="2.1" r="0.8" fill="#000" fillOpacity={0.05} />
          </Pattern>
          <Pattern id="grainB" width="9" height="9" patternUnits="userSpaceOnUse">
            <Circle cx="6.3" cy="5.4" r="0.8" fill="#000" fillOpacity={0.04} />
          </Pattern>
          <LinearGradient id="wash" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#fff" stopOpacity={0.18} />
            <Stop offset="1" stopColor="#000" stopOpacity={0.05} />
          </LinearGradient>
          <RadialGradient id="vignette" cx="50%" cy="50%" r="75%">
            <Stop offset="0.65" stopColor="#3c2814" stopOpacity={0} />
            <Stop offset="1" stopColor="#3c2814" stopOpacity={0.2} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#grainA)" />
        <Rect width="100%" height="100%" fill="url(#grainB)" />
        <Rect width="100%" height="100%" fill="url(#wash)" />
        <Rect width="100%" height="100%" fill="url(#vignette)" />
      </Svg>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  paper: { flex: 1, backgroundColor: colors.paper },
});
