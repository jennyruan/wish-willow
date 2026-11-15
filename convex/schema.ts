import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const suggestionStatus = v.union(
  v.literal("pending"),
  v.literal("accepted"),
  v.literal("declined"),
);

export const intakeValidator = v.record(v.string(), v.string());

export default defineSchema({
  wishes: defineTable({
    userId: v.string(),
    text: v.string(),
    type: v.optional(v.string()),
    timeline: v.optional(v.string()),
    intake: v.optional(intakeValidator),
    createdAt: v.number(),
  }).index("by_userId", ["userId"]),
  suggestions: defineTable({
    title: v.string(),
    place: v.string(),
    when: v.string(),
    category: v.string(),
    neighborhood: v.string(),
    zip: v.string(),
    status: suggestionStatus,
    rank: v.optional(v.number()),
  }).index("by_status", ["status"]),
  preferences: defineTable({
    userId: v.string(),
    liked: v.array(v.string()),
    disliked: v.array(v.string()),
  }).index("by_userId", ["userId"]),
});
