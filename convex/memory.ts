"use node";

import { v } from "convex/values";
import Supermemory from "supermemory";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { intakeValidator } from "./schema";

function supermemoryClient() {
  const apiKey = process.env.SUPERMEMORY_API_KEY;
  return apiKey ? new Supermemory({ apiKey }) : null;
}

export const rememberWish = internalAction({
  args: {
    userId: v.string(),
    wishText: v.string(),
    intake: v.optional(intakeValidator),
  },
  handler: async (_ctx, { userId, wishText, intake }) => {
    const supermemory = supermemoryClient();
    if (!supermemory) return;
    const answers = Object.entries(intake ?? {}).map(
      ([question, answer]) => `${question}: ${answer}`,
    );
    await supermemory.add(userId, {
      id: "wish:core",
      content: [`The user's wish: ${wishText}`, ...answers].join("\n"),
      metadata: { kind: "wish" },
    });
  },
});

export const rememberPreference = internalAction({
  args: { userId: v.string(), text: v.string() },
  handler: async (_ctx, { userId, text }) => {
    const supermemory = supermemoryClient();
    if (!supermemory) return;
    await supermemory.add(userId, {
      id: "pref:core",
      content: text,
      metadata: { kind: "preference" },
    });
  },
});

export const recallUser = internalAction({
  args: { userId: v.string(), query: v.string() },
  returns: v.string(),
  handler: async (ctx, { userId, query }): Promise<string> => {
    const supermemory = supermemoryClient();
    if (supermemory) {
      try {
        const { results } = await supermemory.search(userId, { query, limit: 5 });
        return results
          .map((result) => result.memory ?? result.chunk)
          .filter((text): text is string => Boolean(text))
          .join("\n");
      } catch (error) {
        console.warn("Supermemory recall failed, using the preferences table", error);
      }
    }
    const preferences = await ctx.runQuery(internal.preferences.forUser, { userId });
    if (!preferences) return "";
    return [
      preferences.liked.length > 0 && `Likes: ${preferences.liked.join(", ")}`,
      preferences.disliked.length > 0 && `Dislikes: ${preferences.disliked.join(", ")}`,
    ]
      .filter(Boolean)
      .join("\n");
  },
});
