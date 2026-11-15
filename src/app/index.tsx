import { useMutation } from "convex/react";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../convex/_generated/api";
import { VoiceCapture } from "../components/VoiceCapture";
import { WillowTree } from "../components/WillowTree";
import { DEMO_USER_ID } from "../lib/demoUser";

export default function Home() {
  const startWish = useMutation(api.wishes.start);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Wish Willow</Text>
      <View style={styles.tree}>
        <WillowTree size={260} />
      </View>
      <VoiceCapture
        label="Make a Wish"
        placeholder="I wish..."
        onSubmit={async (text) => {
          const wishId = await startWish({ userId: DEMO_USER_ID, text });
          router.push({ pathname: "/intake", params: { wishId, wish: text } });
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4F8F1",
    padding: 24,
  },
  title: {
    fontSize: 34,
    fontWeight: "700",
    color: "#2F4A2B",
  },
  tree: {
    marginVertical: 32,
  },
});
