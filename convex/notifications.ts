import { v } from "convex/values";
import { query } from "./_generated/server";
import { notificationKind } from "./schema";

const notificationDoc = v.object({
  _id: v.id("notifications"),
  _creationTime: v.number(),
  userId: v.id("users"),
  kind: notificationKind,
  text: v.string(),
  wishId: v.optional(v.id("wishes")),
  read: v.boolean(),
  createdAt: v.number(),
});

/** A user's newest notifications (reward releases, crowdfunding contributions, ...). */
export const listMine = query({
  args: { userId: v.id("users") },
  returns: v.array(notificationDoc),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(100);
  },
});
