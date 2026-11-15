import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WillowTree } from "../components/WillowTree";

export default function Home() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Wish Willow</Text>
      <View style={styles.tree}>
        <WillowTree size={260} />
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/suggestions")}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      >
        <Text style={styles.buttonText}>Make a Wish</Text>
      </Pressable>
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
  button: {
    width: "100%",
    maxWidth: 360,
    paddingVertical: 22,
    borderRadius: 999,
    backgroundColor: "#4E7D3A",
    alignItems: "center",
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "700",
  },
});
