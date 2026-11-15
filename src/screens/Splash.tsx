import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Platform, Pressable } from "react-native";
import { LogoMark, Wordmark } from "../components/Logo";
import { Paper } from "../components/Paper";
import { useScale } from "../theme";

const native = Platform.OS !== "web";

/** 2s logo welcome; fades out once the timer is up (or it's tapped) and identity is resolved. */
export function Splash({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const { s } = useScale();
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.93)).current;
  const [elapsed, setElapsed] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 800, easing: Easing.out(Easing.ease), useNativeDriver: native }),
      Animated.timing(scale, { toValue: 1, duration: 800, easing: Easing.out(Easing.ease), useNativeDriver: native }),
    ]).start();
    const timer = setTimeout(() => setElapsed(true), 2000);
    return () => clearTimeout(timer);
  }, [opacity, scale]);

  useEffect(() => {
    if (!elapsed || !ready) return;
    Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: native }).start(() => onDone());
  }, [elapsed, ready, opacity, onDone]);

  return (
    <Paper>
      <Pressable style={{ flex: 1 }} onPress={() => setElapsed(true)} accessibilityLabel="Wish Willow — tap to continue">
        <Animated.View style={{ flex: 1, alignItems: "center", justifyContent: "center", opacity, transform: [{ scale }] }}>
          <LogoMark size={104 * s} detailed />
          <Animated.View style={{ marginTop: 18 * s, alignSelf: "stretch", paddingHorizontal: 24 * s }}>
            <Wordmark size={30 * s} align="center" />
          </Animated.View>
        </Animated.View>
      </Pressable>
    </Paper>
  );
}
