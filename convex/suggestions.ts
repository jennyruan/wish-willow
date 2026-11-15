import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { suggestionStatus } from "./schema";

export const listPending = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("suggestions")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
  },
});

export const setStatus = mutation({
  args: { id: v.id("suggestions"), status: suggestionStatus },
  handler: async (ctx, { id, status }) => {
    await ctx.db.patch(id, { status });
  },
});
