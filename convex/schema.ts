import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const suggestionStatus = v.union(
  v.literal("pending"),
  v.literal("accepted"),
  v.literal("declined"),
);

export default defineSchema({
  wishes: defineTable({
    text: v.string(),
    type: v.optional(v.string()),
    timeline: v.optional(v.string()),
    createdAt: v.number(),
  }),
  suggestions: defineTable({
    title: v.string(),
    place: v.string(),
    when: v.string(),
    category: v.string(),
    neighborhood: v.string(),
    zip: v.string(),
    status: suggestionStatus,
  }).index("by_status", ["status"]),
  preferences: defineTable({
    userId: v.string(),
    liked: v.array(v.string()),
    disliked: v.array(v.string()),
  }).index("by_userId", ["userId"]),
});
