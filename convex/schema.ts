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

export const paymentKind = v.union(v.literal("reward"), v.literal("fund"));

export const notificationKind = v.union(
  v.literal("comment"),
  v.literal("fund"),
  v.literal("rsvp"),
  v.literal("reward"),
  v.literal("match"),
);

export default defineSchema({
  users: defineTable({
    handle: v.string(),
    avatarId: v.optional(v.id("_storage")),
    deviceToken: v.string(),
    createdAt: v.number(),
    // Opt-in Keiki "daily nudge over text" (free shared iMessage number / Telegram).
    dailyNudge: v.optional(v.boolean()),
    // Server copy of the client's daily wish-check streak, used to word the nudge.
    streak: v.optional(v.number()),
    lastCheckInAt: v.optional(v.number()),
  })
    .index("by_deviceToken", ["deviceToken"])
    .index("by_handle", ["handle"])
    .index("by_dailyNudge", ["dailyNudge"]),

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
    // Engine B reward state. helperId is the honorer the wisher selected; it is
    // locked in when the reward is paid (free rewards immediately, paid ones on
    // the Whop payment.succeeded webhook). rewardReleasedAt is set once the
    // helper has the money: immediately for free rewards, or when the Whop
    // payout claim link is created.
    helperId: v.optional(v.id("users")),
    rewardReleasedAt: v.optional(v.number()),
    // Running total of paid crowdfunding contributions, in dollars.
    funded: v.optional(v.number()),
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

  // One Whop checkout. Charge-on-select escrow: a reward row is created when the
  // wisher selects a helper, flips to paid on the payment.succeeded webhook, and
  // is then paid out to the recipient as a Whop claim link. A reward payment that
  // lands after the wish already has a paid helper is refunded.
  payments: defineTable({
    wishId: v.id("wishes"),
    payerId: v.id("users"),
    kind: paymentKind,
    // Who the money goes to: the selected helper for a reward, the wisher for a
    // crowdfunding contribution.
    recipientId: v.id("users"),
    amount: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("canceled"),
      v.literal("paid"),
      v.literal("refunding"),
      v.literal("refunded"),
    ),
    checkoutId: v.optional(v.string()),
    checkoutUrl: v.optional(v.string()),
    // The Whop account (biz_) the checkout charged into; payouts are sent from it.
    accountId: v.optional(v.string()),
    whopPaymentId: v.optional(v.string()),
    payout: v.optional(
      v.union(v.literal("sending"), v.literal("sent"), v.literal("failed")),
    ),
    claimUrl: v.optional(v.string()),
    createdAt: v.number(),
    paidAt: v.optional(v.number()),
  }).index("by_wish", ["wishId"]),

  notifications: defineTable({
    userId: v.id("users"),
    kind: notificationKind,
    text: v.string(),
    wishId: v.optional(v.id("wishes")),
    read: v.boolean(),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),
});
