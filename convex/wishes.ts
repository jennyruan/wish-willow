import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  locality,
  timeUnit,
  visibility,
  wishKind,
} from "./schema";

// Reusable validator for a returned wish document.
const wishDoc = v.object({
  _id: v.id("wishes"),
  _creationTime: v.number(),
  ownerId: v.id("users"),
  text: v.string(),
  kind: wishKind,
  intake: v.optional(v.any()),
  locality: v.optional(locality),
  location: v.optional(v.string()),
  budget: v.optional(v.number()),
  timeNum: v.optional(v.number()),
  timeUnit: v.optional(timeUnit),
  visibility: visibility,
  reward: v.optional(v.number()),
  helperId: v.optional(v.id("users")),
  rewardReleasedAt: v.optional(v.number()),
  funded: v.optional(v.number()),
  status: v.union(
    v.literal("open"),
    v.literal("fulfilled"),
    v.literal("closed"),
  ),
  realized: v.boolean(),
  realizedAt: v.optional(v.number()),
  createdAt: v.number(),
});

// Guard a free-magnitude numeric field: reject NaN / Infinity / negative.
function assertMoney(value: number | undefined, name: string) {
  if (value === undefined) return;
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a finite, non-negative number`);
  }
}

export const create = mutation({
  args: {
    ownerId: v.id("users"),
    text: v.string(),
    kind: wishKind,
    intake: v.optional(v.any()),
    locality: v.optional(locality),
    location: v.optional(v.string()),
    budget: v.optional(v.number()),
    timeNum: v.optional(v.number()),
    timeUnit: v.optional(timeUnit),
    visibility: visibility,
    reward: v.optional(v.number()),
  },
  returns: v.id("wishes"),
  handler: async (ctx, args) => {
    const owner = await ctx.db.get(args.ownerId);
    if (!owner) throw new Error("owner not found");

    const text = args.text.trim();
    if (text.length === 0) throw new Error("wish text must not be empty");

    assertMoney(args.budget, "budget");
    assertMoney(args.reward, "reward");
    if (args.timeNum !== undefined) {
      if (!Number.isFinite(args.timeNum) || args.timeNum < 0) {
        throw new Error("timeNum must be a finite, non-negative number");
      }
    }

    return await ctx.db.insert("wishes", {
      ownerId: args.ownerId,
      text,
      kind: args.kind,
      intake: args.intake,
      locality: args.locality,
      location: args.location,
      budget: args.budget,
      timeNum: args.timeNum,
      timeUnit: args.timeUnit,
      visibility: args.visibility,
      reward: args.reward,
      status: "open",
      realized: false,
      createdAt: Date.now(),
    });
  },
});

/**
 * Mark a wish as REALITY — it came true. Owner-only (requesterId must match the
 * wish's ownerId). Sets realized + realizedAt and moves status to "fulfilled".
 * Pass realized:false to undo. In production, replace requesterId with
 * server-derived identity (see README).
 */
export const markRealized = mutation({
  args: {
    wishId: v.id("wishes"),
    requesterId: v.id("users"),
    realized: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const wish = await ctx.db.get(args.wishId);
    if (!wish) throw new Error("wish not found");
    if (wish.ownerId !== args.requesterId) {
      throw new Error("only the wish owner can mark it as reality");
    }
    const realized = args.realized ?? true;
    await ctx.db.patch(args.wishId, {
      realized,
      realizedAt: realized ? Date.now() : undefined,
      status: realized ? "fulfilled" : "open",
    });
    return null;
  },
});

/**
 * Flip a wish between private and public, optionally setting a reward.
 *
 * NOTE: ownership is NOT enforced here because the hackathon identity model has
 * no server-derived caller. In production this must load the wish and compare
 * its ownerId against the authenticated identity. See README.
 */
export const setVisibility = mutation({
  args: {
    wishId: v.id("wishes"),
    visibility: visibility,
    reward: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const wish = await ctx.db.get(args.wishId);
    if (!wish) throw new Error("wish not found");
    assertMoney(args.reward, "reward");
    if (args.reward !== undefined && wish.rewardReleasedAt !== undefined) {
      throw new Error("the reward was already released");
    }

    const patch: { visibility: "private" | "public"; reward?: number } = {
      visibility: args.visibility,
    };
    if (args.reward !== undefined) patch.reward = args.reward;
    await ctx.db.patch(args.wishId, patch);
    return null;
  },
});

/**
 * Public feed, newest first, paginated.
 */
export const listPublic = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(wishDoc),
    isDone: v.boolean(),
    continueCursor: v.string(),
    splitCursor: v.optional(v.union(v.string(), v.null())),
    pageStatus: v.optional(
      v.union(
        v.literal("SplitRecommended"),
        v.literal("SplitRequired"),
        v.null(),
      ),
    ),
  }),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("wishes")
      .withIndex("by_visibility", (q) => q.eq("visibility", "public"))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

// Lightweight wish-list row for a user's own wishes.
const myWishRow = v.object({
  _id: v.id("wishes"),
  _creationTime: v.number(),
  text: v.string(),
  kind: wishKind,
  visibility: visibility,
  status: v.union(
    v.literal("open"),
    v.literal("fulfilled"),
    v.literal("closed"),
  ),
  realized: v.boolean(),
  realizedAt: v.optional(v.number()),
  reward: v.optional(v.number()),
  createdAt: v.number(),
});

// Upper bound so a single read is never an unbounded scan of one user's wishes.
const MAX_MINE = 200;

/**
 * A user's own wish list, newest first, via the by_owner index. Includes BOTH
 * private and public wishes (this is the owner's own view). Capped with .take()
 * rather than paginated — a personal wish list is small; swap in
 * paginationOptsValidator if lists are expected to grow past the cap.
 */
export const listMine = query({
  args: {
    ownerId: v.id("users"),
    limit: v.optional(v.number()),
  },
  returns: v.array(myWishRow),
  handler: async (ctx, args) => {
    const limit = Math.min(
      Math.max(1, Math.floor(args.limit ?? MAX_MINE)),
      MAX_MINE,
    );
    const rows = await ctx.db
      .query("wishes")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId))
      .order("desc")
      .take(limit);
    return rows.map((w) => ({
      _id: w._id,
      _creationTime: w._creationTime,
      text: w.text,
      kind: w.kind,
      visibility: w.visibility,
      status: w.status,
      realized: w.realized,
      realizedAt: w.realizedAt,
      reward: w.reward,
      createdAt: w.createdAt,
    }));
  },
});

/**
 * Count of a user's wishes. Bounded by one user's own wish list, so a direct
 * index read + length is fine here.
 */
export const countMine = query({
  args: { ownerId: v.id("users") },
  returns: v.number(),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("wishes")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId))
      .collect();
    return rows.length;
  },
});

export const get = query({
  args: { wishId: v.id("wishes") },
  returns: v.union(wishDoc, v.null()),
  handler: async (ctx, args) => {
    const wish = await ctx.db.get(args.wishId);
    return wish ?? null;
  },
});
