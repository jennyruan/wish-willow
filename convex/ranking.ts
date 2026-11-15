import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";

const RANKING_MODEL = "claude-haiku-4-5";

export const rankSuggestions = internalAction({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const [pending, wish, preferences] = await Promise.all([
      ctx.runQuery(internal.suggestions.listPendingInternal, {}),
      ctx.runQuery(internal.wishes.latestForUser, { userId }),
      ctx.runQuery(internal.preferences.forUser, { userId }),
    ]);
    if (pending.length === 0) return;

    const memory = await ctx.runAction(internal.memory.recallUser, {
      userId,
      query: wish
        ? `What does the user like and dislike while working toward: ${wish.text}`
        : "What kinds of activities and places does the user like and dislike?",
    });

    const llmOrder = await rankWithLlm(buildRankingPrompt(pending, wish, memory), pending);
    const orderedIds =
      llmOrder ??
      [...pending]
        .sort((a, b) => preferenceScore(b, preferences) - preferenceScore(a, preferences))
        .map((suggestion) => suggestion._id);
    await ctx.runMutation(internal.suggestions.applyRanking, { orderedIds });
  },
});

function buildRankingPrompt(
  pending: Doc<"suggestions">[],
  wish: Doc<"wishes"> | null,
  memory: string,
) {
  const candidates = pending
    .map(
      (s) =>
        `- id: ${s._id} | ${s.category} | ${s.title} | ${s.place}, ${s.neighborhood} | ${s.when}`,
    )
    .join("\n");
  return [
    "You are Willow, a warm companion helping the user keep one wish by suggesting real places and events.",
    `The user's wish: ${wish?.text ?? "unknown yet"}`,
    "What you remember about the user (lean into what they like, avoid what they dislike):",
    memory || "Nothing yet.",
    "Rank these candidate suggestions from best to worst fit for the user right now:",
    candidates,
    'Reply with only a JSON array of the candidate ids in ranked order, for example ["id1","id2"].',
  ].join("\n\n");
}

async function rankWithLlm(
  prompt: string,
  pending: Doc<"suggestions">[],
): Promise<Id<"suggestions">[] | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: RANKING_MODEL,
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!response.ok) throw new Error(`Anthropic responded ${response.status}`);
    const body = await response.json();
    const text: string = body.content?.[0]?.text ?? "";
    const ranked: unknown = JSON.parse(text.slice(text.indexOf("["), text.lastIndexOf("]") + 1));
    if (!Array.isArray(ranked)) throw new Error("Ranking was not a JSON array");
    const known = new Set<string>(pending.map((s) => s._id));
    const ordered = [...new Set(ranked.filter((id): id is Id<"suggestions"> => known.has(id)))];
    const missing = pending.map((s) => s._id).filter((id) => !ordered.includes(id));
    return [...ordered, ...missing];
  } catch (error) {
    console.warn("LLM ranking failed, using preference order", error);
    return null;
  }
}

function preferenceScore(suggestion: Doc<"suggestions">, preferences: Doc<"preferences"> | null) {
  if (preferences?.liked.includes(suggestion.category)) return 1;
  if (preferences?.disliked.includes(suggestion.category)) return -1;
  return 0;
}
