import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalQuery, mutation, type MutationCtx } from "./_generated/server";
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
    await rememberAndRerank(ctx, args.userId, args.text, args.intake);
    return wishId;
  },
});

export const start = mutation({
  args: { userId: v.string(), text: v.string() },
  handler: async (ctx, { userId, text }) => {
    return await ctx.db.insert("wishes", { userId, text, createdAt: Date.now() });
  },
});

export const completeIntake = mutation({
  args: { wishId: v.id("wishes"), intake: intakeValidator },
  handler: async (ctx, { wishId, intake }) => {
    const wish = await ctx.db.get(wishId);
    if (!wish) throw new Error("Wish not found");
    await ctx.db.patch(wishId, { intake });
    await rememberAndRerank(ctx, wish.userId, wish.text, intake);
  },
});

async function rememberAndRerank(
  ctx: MutationCtx,
  userId: string,
  wishText: string,
  intake: Record<string, string> | undefined,
) {
  await ctx.scheduler.runAfter(0, internal.memory.rememberWish, { userId, wishText, intake });
  await ctx.scheduler.runAfter(0, internal.ranking.rankSuggestions, {
    userId,
    requestedAt: Date.now(),
  });
}

export const getInternal = internalQuery({
  args: { wishId: v.id("wishes") },
  handler: async (ctx, { wishId }) => await ctx.db.get(wishId),
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
