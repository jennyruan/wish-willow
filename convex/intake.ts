import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";

const OPENAI_MODEL = "gpt-6-luna";
const GEMINI_MODEL = "gemini-3.8-flash";
const ANTHROPIC_MODEL = "claude-haiku-4-5";

const DEFAULT_QUESTIONS = [
  "What kind of connection or person are you hoping to find?",
  "How soon would you like this to happen?",
];

export const generateQuestions = action({
  args: { wishId: v.id("wishes") },
  returns: v.array(v.string()),
  handler: async (ctx, { wishId }): Promise<string[]> => {
    const wish = await ctx.runQuery(internal.wishes.getInternal, { wishId });
    if (!wish) throw new Error("Wish not found");
    const prompt = [
      "You are Willow, a warm companion helping the user keep one wish by suggesting real places and events where they can meet people.",
      `The user's wish: ${wish.text}`,
      "Write 2 or 3 short, friendly clarifying questions the user will answer out loud.",
      "One must ask what kind of connection or person they want, and one must ask how soon they want it to happen.",
      "Keep each question under 15 words.",
      'Reply with only a JSON array of question strings, for example ["Question one?","Question two?"].',
    ].join("\n\n");

    for (const provider of configuredProviders()) {
      try {
        const text = await provider.complete(prompt);
        const parsed: unknown = JSON.parse(text.slice(text.indexOf("["), text.lastIndexOf("]") + 1));
        if (!Array.isArray(parsed)) throw new Error("Questions were not a JSON array");
        const questions = [
          ...new Set(
            parsed
              .filter((q): q is string => typeof q === "string")
              .map((q) =>
                q
                  .replace(/[\u2018\u2019]/g, "'")
                  .replace(/[\u201C\u201D]/g, '"')
                  .replace(/[^\x20-\x7E]/g, "")
                  .trim(),
              )
              .filter((q) => q.length > 0 && !q.startsWith("$") && !q.startsWith("_")),
          ),
        ].slice(0, 3);
        if (questions.length >= 2) return questions;
        throw new Error(`Expected 2 to 3 questions, got ${questions.length}`);
      } catch (error) {
        console.warn(`${provider.name} intake questions failed`, error);
      }
    }
    return DEFAULT_QUESTIONS;
  },
});

function configuredProviders() {
  const { OPENAI_API_KEY, GEMINI_API_KEY, ANTHROPIC_API_KEY } = process.env;
  return [
    OPENAI_API_KEY && { name: "OpenAI", complete: (prompt: string) => askOpenAi(OPENAI_API_KEY, prompt) },
    GEMINI_API_KEY && { name: "Gemini", complete: (prompt: string) => askGemini(GEMINI_API_KEY, prompt) },
    ANTHROPIC_API_KEY && {
      name: "Anthropic",
      complete: (prompt: string) => askAnthropic(ANTHROPIC_API_KEY, prompt),
    },
  ].filter((provider) => !!provider);
}

async function askOpenAi(apiKey: string, prompt: string): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ model: OPENAI_MODEL, messages: [{ role: "user", content: prompt }] }),
  });
  if (!response.ok) throw new Error(`OpenAI responded ${response.status}`);
  const body = await response.json();
  return body.choices?.[0]?.message?.content ?? "";
}

async function askGemini(apiKey: string, prompt: string): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "content-type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    },
  );
  if (!response.ok) throw new Error(`Gemini responded ${response.status}`);
  const body = await response.json();
  return body.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

async function askAnthropic(apiKey: string, prompt: string): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!response.ok) throw new Error(`Anthropic responded ${response.status}`);
  const body = await response.json();
  return body.content?.[0]?.text ?? "";
}
