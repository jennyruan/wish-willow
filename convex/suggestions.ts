import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { recordFeedback } from "./preferences";
import { suggestionStatus } from "./schema";

export const listPending = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const [pending, ranking] = await Promise.all([
      ctx.db
        .query("suggestions")
        .withIndex("by_status", (q) => q.eq("status", "pending"))
        .collect(),
      ctx.db
        .query("rankings")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .unique(),
    ]);
    const rank = new Map<string, number>(ranking?.orderedIds.map((id, index) => [id, index]));
    const unranked = Number.MAX_SAFE_INTEGER;
    return pending.sort((a, b) => (rank.get(a._id) ?? unranked) - (rank.get(b._id) ?? unranked));
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
    await ctx.scheduler.runAfter(0, internal.ranking.rankSuggestions, {
      userId,
      requestedAt: Date.now(),
    });
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
  args: { userId: v.string(), orderedIds: v.array(v.id("suggestions")), requestedAt: v.number() },
  handler: async (ctx, { userId, orderedIds, requestedAt }) => {
    const existing = await ctx.db
      .query("rankings")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!existing) {
      await ctx.db.insert("rankings", { userId, orderedIds, requestedAt });
    } else if (existing.requestedAt <= requestedAt) {
      await ctx.db.patch(existing._id, { orderedIds, requestedAt });
    }
  },
});
