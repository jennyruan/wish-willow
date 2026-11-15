import { useAction, useMutation } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { VoiceCapture } from "../components/VoiceCapture";

export default function Intake() {
  const params = useLocalSearchParams<{ wishId: string; wish: string }>();
  const wishId = params.wishId as Id<"wishes">;
  const generateQuestions = useAction(api.intake.generateQuestions);
  const completeIntake = useMutation(api.wishes.completeIntake);
  const [questions, setQuestions] = useState<string[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const loadQuestions = useCallback(() => {
    generateQuestions({ wishId })
      .then(setQuestions)
      .catch((error) => {
        console.warn("Loading intake questions failed", error);
        setLoadFailed(true);
      });
  }, [generateQuestions, wishId]);

  useEffect(loadQuestions, [loadQuestions]);

  const finish = async (intake: Record<string, string>) => {
    await completeIntake({ wishId, intake });
    router.replace("/suggestions");
  };

  if (loadFailed) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>{"We couldn't load your questions."}</Text>
        <Pressable accessibilityRole="button" style={styles.retry} onPress={() => {
            setLoadFailed(false);
            loadQuestions();
          }}
        >
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => finish(answers).catch((error) => console.warn("Skipping intake failed", error))}
        >
          <Text style={styles.link}>Skip to suggestions</Text>
        </Pressable>
      </View>
    );
  }

  if (!questions) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.message}>Willow is thinking about your wish...</Text>
      </View>
    );
  }

  const question = questions[index];
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {params.wish && <Text style={styles.wish}>{`"${params.wish}"`}</Text>}
      <Text style={styles.progress}>
        Question {index + 1} of {questions.length}
      </Text>
      <Text style={styles.question}>{question}</Text>
      <VoiceCapture
        key={index}
        label="Answer"
        placeholder="Your answer"
        onSubmit={async (text) => {
          const next = { ...answers, [question]: text };
          setAnswers(next);
          if (index + 1 < questions.length) {
            setIndex(index + 1);
          } else {
            await finish(next);
          }
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: "#F4F8F1",
  },
  content: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 16,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4F8F1",
    padding: 24,
    gap: 16,
  },
  wish: {
    fontSize: 16,
    fontStyle: "italic",
    color: "#5B6B57",
    textAlign: "center",
  },
  progress: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    color: "#4E7D3A",
  },
  question: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1F2D1C",
    textAlign: "center",
    marginBottom: 16,
  },
  message: {
    fontSize: 16,
    color: "#5B6B57",
    textAlign: "center",
  },
  retry: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 999,
    backgroundColor: "#4E7D3A",
  },
  retryText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
  },
  link: {
    color: "#4E7D3A",
    fontSize: 16,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
});
