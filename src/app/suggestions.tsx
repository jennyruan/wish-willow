import { useMutation, useQuery } from "convex/react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { api } from "../../convex/_generated/api";
import { DEMO_USER_ID } from "../lib/demoUser";

export default function Suggestions() {
  const suggestions = useQuery(api.suggestions.listPending);
  const setStatus = useMutation(api.suggestions.setStatus);

  if (suggestions === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={suggestions}
      keyExtractor={(item) => item._id}
      ListEmptyComponent={
        <Text style={styles.empty}>No pending suggestions right now.</Text>
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.category}>{item.category}</Text>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.detail}>{item.place}</Text>
          <Text style={styles.detail}>
            {item.neighborhood} · {item.zip}
          </Text>
          <Text style={styles.detail}>{item.when}</Text>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              style={[styles.action, styles.accept]}
              onPress={() => setStatus({ id: item._id, status: "accepted", userId: DEMO_USER_ID })}
            >
              <Text style={styles.actionText}>Accept</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={[styles.action, styles.decline]}
              onPress={() => setStatus({ id: item._id, status: "declined", userId: DEMO_USER_ID })}
            >
              <Text style={[styles.actionText, styles.declineText]}>Decline</Text>
            </Pressable>
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    backgroundColor: "#F4F8F1",
  },
  content: {
    padding: 16,
    gap: 12,
  },
  empty: {
    textAlign: "center",
    marginTop: 48,
    color: "#5B6B57",
    fontSize: 16,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    gap: 4,
  },
  category: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    color: "#4E7D3A",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2D1C",
  },
  detail: {
    fontSize: 14,
    color: "#5B6B57",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  action: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  accept: {
    backgroundColor: "#4E7D3A",
  },
  decline: {
    backgroundColor: "#EEF1EC",
  },
  actionText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
  declineText: {
    color: "#3D4A3A",
  },
});
