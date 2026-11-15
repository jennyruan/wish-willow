import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalQuery, mutation } from "./_generated/server";
import { intakeValidator } from "./schema";

export const create = mutation({
  args: {
    userId: v.string(),
    text: v.string(),
    type: v.optional(v.string()),
    timeline: v.optional(v.string()),
    intake: v.optional(intakeValidator),
  },
  handler: async (ctx, args) => {
    const wishId = await ctx.db.insert("wishes", { ...args, createdAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.memory.rememberWish, {
      userId: args.userId,
      wishText: args.text,
      intake: args.intake,
    });
    await ctx.scheduler.runAfter(0, internal.ranking.rankSuggestions, {
      userId: args.userId,
      requestedAt: Date.now(),
    });
    return wishId;
  },
});

export const latestForUser = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("wishes")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .order("desc")
      .first();
  },
});
