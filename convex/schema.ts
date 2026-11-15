import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Shared validator fragments reused across functions.
export const wishKind = v.union(
  v.literal("girlfriend"),
  v.literal("boyfriend"),
  v.literal("iphone"),
  v.literal("hackathon"),
  v.literal("other"),
);

export const locality = v.union(v.literal("local"), v.literal("remote"));

export const timeUnit = v.union(
  v.literal("days"),
  v.literal("weeks"),
  v.literal("months"),
  v.literal("years"),
);

export const visibility = v.union(v.literal("private"), v.literal("public"));

export const wishStatus = v.union(
  v.literal("open"),
  v.literal("fulfilled"),
  v.literal("closed"),
);

export const commentKind = v.union(
  v.literal("text"),
  v.literal("photo"),
  v.literal("video"),
  v.literal("match"),
);

export default defineSchema({
  users: defineTable({
    handle: v.string(),
    avatarId: v.optional(v.id("_storage")),
    deviceToken: v.string(),
    createdAt: v.number(),
  })
    .index("by_deviceToken", ["deviceToken"])
    .index("by_handle", ["handle"]),

  wishes: defineTable({
    ownerId: v.id("users"),
    text: v.string(),
    kind: wishKind,
    // intake is free-form per-kind structured data; v.any() is intentional.
    intake: v.optional(v.any()),
    locality: v.optional(locality),
    location: v.optional(v.string()),
    budget: v.optional(v.number()),
    timeNum: v.optional(v.number()),
    timeUnit: v.optional(timeUnit),
    visibility: visibility,
    reward: v.optional(v.number()),
    status: wishStatus,
    // "Reality": a wish that has come true. Realized wishes are marked as reality in the UI.
    realized: v.boolean(),
    realizedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    // Public feed: filter on visibility, order by _creationTime (newest first).
    .index("by_visibility", ["visibility"]),

  comments: defineTable({
    wishId: v.id("wishes"),
    authorId: v.id("users"),
    kind: commentKind,
    body: v.optional(v.string()),
    mediaId: v.optional(v.id("_storage")),
    parentId: v.optional(v.id("comments")),
    approved: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_wish", ["wishId"])
    .index("by_wish_approved", ["wishId", "approved"]),

  conversations: defineTable({
    user1: v.id("users"),
    user2: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_user1", ["user1"])
    .index("by_user2", ["user2"])
    // Normalized (user1 <= user2) composite lookup for getOrCreate.
    .index("by_users", ["user1", "user2"]),

  messages: defineTable({
    conversationId: v.id("conversations"),
    authorId: v.id("users"),
    body: v.optional(v.string()),
    mediaId: v.optional(v.id("_storage")),
    createdAt: v.number(),
  }).index("by_conversation", ["conversationId"]),
});
