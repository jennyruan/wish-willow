import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { recordFeedback } from "./preferences";
import { suggestionStatus } from "./schema";

export const listPending = query({
  args: {},
  handler: async (ctx) => {
    const pending = await ctx.db
      .query("suggestions")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
    return pending.sort(
      (a, b) => (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER),
    );
  },
});

export const setStatus = mutation({
  args: { id: v.id("suggestions"), status: suggestionStatus, userId: v.string() },
  handler: async (ctx, { id, status, userId }) => {
    const suggestion = await ctx.db.get(id);
    if (!suggestion) throw new Error("Suggestion not found");
    await ctx.db.patch(id, { status });
    if (status === "pending") return;

    const accepted = status === "accepted";
    await recordFeedback(ctx, userId, suggestion.category, accepted);
    const text = `${accepted ? "Likes" : "Dislikes"} ${suggestion.category}: ${status} "${suggestion.title}" at ${suggestion.place} in ${suggestion.neighborhood} (${suggestion.when}).`;
    await ctx.scheduler.runAfter(0, internal.memory.rememberPreference, { userId, text });
    await ctx.scheduler.runAfter(0, internal.ranking.rankSuggestions, { userId });
  },
});

export const listPendingInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("suggestions")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
  },
});

export const applyRanking = internalMutation({
  args: { orderedIds: v.array(v.id("suggestions")) },
  handler: async (ctx, { orderedIds }) => {
    for (const [rank, id] of orderedIds.entries()) {
      await ctx.db.patch(id, { rank });
    }
  },
});
