import { Anton_400Regular } from "@expo-google-fonts/anton/400Regular";
import { DMSans_400Regular } from "@expo-google-fonts/dm-sans/400Regular";
import { DMSans_500Medium } from "@expo-google-fonts/dm-sans/500Medium";
import { DMSans_700Bold } from "@expo-google-fonts/dm-sans/700Bold";
import { YesevaOne_400Regular } from "@expo-google-fonts/yeseva-one/400Regular";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Root } from "./src/Root";
import { colors } from "./src/theme";

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, {
  unsavedChangesWarning: false,
});

export default function App() {
  const [fontsLoaded] = useFonts({
    Anton: Anton_400Regular,
    YesevaOne: YesevaOne_400Regular,
    DMSans: DMSans_400Regular,
    "DMSans-Medium": DMSans_500Medium,
    "DMSans-Bold": DMSans_700Bold,
  });

  return (
    <ConvexProvider client={convex}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        {fontsLoaded ? <Root /> : <View style={{ flex: 1, backgroundColor: colors.paper, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={colors.red} /></View>}
      </SafeAreaProvider>
    </ConvexProvider>
  );
}
