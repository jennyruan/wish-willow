import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { commentKind } from "./schema";

// A comment enriched for display: media URL resolved + author handle attached.
const resolvedComment = v.object({
  _id: v.id("comments"),
  _creationTime: v.number(),
  wishId: v.id("wishes"),
  authorId: v.id("users"),
  authorHandle: v.union(v.string(), v.null()),
  kind: commentKind,
  body: v.optional(v.string()),
  mediaId: v.optional(v.id("_storage")),
  mediaUrl: v.union(v.string(), v.null()),
  parentId: v.optional(v.id("comments")),
  approved: v.boolean(),
  createdAt: v.number(),
});

// Upper bound on how many comments a single reactive read returns, so we never
// do an unbounded .collect() on a wish that accumulates many comments.
const MAX_COMMENTS = 500;

/**
 * Add a comment. Comments are ALL PUBLIC — inserted approved:true so they appear
 * immediately (no pre-moderation gate). The wish owner can still remove a reply
 * after the fact via `reject` (post-moderation safety net).
 *
 * NOTE: authorId is client-supplied for the hackathon identity model; production
 * derives it from the authenticated identity. See README.
 */
export const add = mutation({
  args: {
    wishId: v.id("wishes"),
    authorId: v.id("users"),
    kind: commentKind,
    body: v.optional(v.string()),
    mediaId: v.optional(v.id("_storage")),
    parentId: v.optional(v.id("comments")),
  },
  returns: v.id("comments"),
  handler: async (ctx, args) => {
    const wish = await ctx.db.get(args.wishId);
    if (!wish) throw new Error("wish not found");
    const author = await ctx.db.get(args.authorId);
    if (!author) throw new Error("author not found");

    if (args.parentId) {
      const parent = await ctx.db.get(args.parentId);
      if (!parent) throw new Error("parent comment not found");
      if (parent.wishId !== args.wishId) {
        throw new Error("parent comment belongs to a different wish");
      }
    }

    // A comment should carry either text or media (or be a 'match' marker).
    if (
      args.kind === "text" &&
      (args.body === undefined || args.body.trim().length === 0)
    ) {
      throw new Error("text comments require a non-empty body");
    }
    if ((args.kind === "photo" || args.kind === "video") && !args.mediaId) {
      throw new Error(`${args.kind} comments require a mediaId`);
    }

    return await ctx.db.insert("comments", {
      wishId: args.wishId,
      authorId: args.authorId,
      kind: args.kind,
      body: args.body,
      mediaId: args.mediaId,
      parentId: args.parentId,
      approved: true, // comments are all public — appear immediately; owner can remove via reject
      createdAt: Date.now(),
    });
  },
});

/**
 * Reactive list of a wish's comments. When onlyApproved is true, only approved
 * comments are returned (the public view); otherwise all comments are returned
 * (the owner's moderation view). Resolves mediaId -> URL and author handle.
 */
export const listForWish = query({
  args: {
    wishId: v.id("wishes"),
    onlyApproved: v.boolean(),
    // "desc" = newest first (default), "asc" = oldest first.
    order: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    limit: v.optional(v.number()),
  },
  returns: v.array(resolvedComment),
  handler: async (ctx, args) => {
    const order = args.order ?? "desc";
    const limit = Math.min(
      Math.max(1, Math.floor(args.limit ?? MAX_COMMENTS)),
      MAX_COMMENTS,
    );

    const rows = args.onlyApproved
      ? await ctx.db
          .query("comments")
          .withIndex("by_wish_approved", (q) =>
            q.eq("wishId", args.wishId).eq("approved", true),
          )
          .order(order)
          .take(limit)
      : await ctx.db
          .query("comments")
          .withIndex("by_wish", (q) => q.eq("wishId", args.wishId))
          .order(order)
          .take(limit);

    // Resolve author handles + media URLs. Cache handle lookups per author.
    const handleCache = new Map<string, string | null>();
    const resolved = [];
    for (const c of rows) {
      let authorHandle = handleCache.get(c.authorId) ?? null;
      if (!handleCache.has(c.authorId)) {
        const author = await ctx.db.get(c.authorId);
        authorHandle = author?.handle ?? null;
        handleCache.set(c.authorId, authorHandle);
      }
      const mediaUrl = c.mediaId
        ? await ctx.storage.getUrl(c.mediaId)
        : null;
      resolved.push({
        _id: c._id,
        _creationTime: c._creationTime,
        wishId: c.wishId,
        authorId: c.authorId,
        authorHandle,
        kind: c.kind,
        body: c.body,
        mediaId: c.mediaId,
        mediaUrl,
        parentId: c.parentId,
        approved: c.approved,
        createdAt: c.createdAt,
      });
    }
    return resolved;
  },
});

/**
 * Approve a comment. Only the wish owner may approve.
 *
 * NOTE: requesterId is client-supplied for the hackathon identity model and is
 * compared against the wish's ownerId. Production replaces this with a
 * server-derived identity check. See README.
 */
export const approve = mutation({
  args: {
    wishId: v.id("wishes"),
    commentId: v.id("comments"),
    requesterId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const wish = await ctx.db.get(args.wishId);
    if (!wish) throw new Error("wish not found");
    if (wish.ownerId !== args.requesterId) {
      throw new Error("403: only the wish owner may approve comments");
    }
    const comment = await ctx.db.get(args.commentId);
    if (!comment) throw new Error("comment not found");
    if (comment.wishId !== args.wishId) {
      throw new Error("comment does not belong to this wish");
    }
    if (!comment.approved) {
      await ctx.db.patch(args.commentId, { approved: true });
    }
    return null;
  },
});

/**
 * Reject (delete) a comment. Only the wish owner may reject.
 */
export const reject = mutation({
  args: {
    wishId: v.id("wishes"),
    commentId: v.id("comments"),
    requesterId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const wish = await ctx.db.get(args.wishId);
    if (!wish) throw new Error("wish not found");
    if (wish.ownerId !== args.requesterId) {
      throw new Error("403: only the wish owner may reject comments");
    }
    const comment = await ctx.db.get(args.commentId);
    if (!comment) {
      // Idempotent: already gone.
      return null;
    }
    if (comment.wishId !== args.wishId) {
      throw new Error("comment does not belong to this wish");
    }
    await ctx.db.delete(args.commentId);
    return null;
  },
});
