import { v } from "convex/values";
import { internalQuery, type MutationCtx } from "./_generated/server";

export const forUser = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("preferences")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
  },
});

export async function recordFeedback(
  ctx: MutationCtx,
  userId: string,
  category: string,
  liked: boolean,
) {
  const existing = await ctx.db
    .query("preferences")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
  const likedSet = new Set(existing?.liked ?? []);
  const dislikedSet = new Set(existing?.disliked ?? []);
  (liked ? likedSet : dislikedSet).add(category);
  (liked ? dislikedSet : likedSet).delete(category);
  const next = { liked: [...likedSet], disliked: [...dislikedSet] };
  if (existing) {
    await ctx.db.patch(existing._id, next);
  } else {
    await ctx.db.insert("preferences", { userId, ...next });
  }
}
