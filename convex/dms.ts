import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

const messageDoc = v.object({
  _id: v.id("messages"),
  _creationTime: v.number(),
  conversationId: v.id("conversations"),
  authorId: v.id("users"),
  body: v.optional(v.string()),
  mediaId: v.optional(v.id("_storage")),
  createdAt: v.number(),
});

// Normalize a pair so (user1, user2) is order-independent: user1 <= user2 by id
// string. This lets a single composite-index lookup find an existing DM.
function normalizePair(
  a: Id<"users">,
  b: Id<"users">,
): { user1: Id<"users">; user2: Id<"users"> } {
  return a <= b ? { user1: a, user2: b } : { user1: b, user2: a };
}

/**
 * Find or create the 1:1 conversation between two users. Order-independent and
 * idempotent: calling with (a, b) or (b, a) always resolves to the same row.
 */
export const getOrCreateConversation = mutation({
  args: { a: v.id("users"), b: v.id("users") },
  returns: v.id("conversations"),
  handler: async (ctx, args) => {
    if (args.a === args.b) {
      throw new Error("cannot start a conversation with yourself");
    }
    const ua = await ctx.db.get(args.a);
    const ub = await ctx.db.get(args.b);
    if (!ua || !ub) throw new Error("both users must exist");

    const { user1, user2 } = normalizePair(args.a, args.b);

    const existing = await ctx.db
      .query("conversations")
      .withIndex("by_users", (q) =>
        q.eq("user1", user1).eq("user2", user2),
      )
      .unique();
    if (existing) return existing._id;

    return await ctx.db.insert("conversations", {
      user1,
      user2,
      createdAt: Date.now(),
    });
  },
});

/**
 * Send a message into a conversation.
 *
 * NOTE: authorId is client-supplied for the hackathon identity model; production
 * derives it from the authenticated identity and verifies the author is a member
 * of the conversation. See README.
 */
export const sendMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    authorId: v.id("users"),
    body: v.optional(v.string()),
    mediaId: v.optional(v.id("_storage")),
  },
  returns: v.id("messages"),
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) throw new Error("conversation not found");

    // Author must be a participant.
    if (
      conversation.user1 !== args.authorId &&
      conversation.user2 !== args.authorId
    ) {
      throw new Error("403: author is not a participant in this conversation");
    }

    const hasBody = args.body !== undefined && args.body.trim().length > 0;
    if (!hasBody && !args.mediaId) {
      throw new Error("message must have a body or media");
    }

    return await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      authorId: args.authorId,
      body: args.body,
      mediaId: args.mediaId,
      createdAt: Date.now(),
    });
  },
});

/**
 * Paginated message history for a conversation, newest first. Media URLs are
 * resolved per message.
 */
export const listMessages = query({
  args: {
    conversationId: v.id("conversations"),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("messages"),
        _creationTime: v.number(),
        conversationId: v.id("conversations"),
        authorId: v.id("users"),
        body: v.optional(v.string()),
        mediaId: v.optional(v.id("_storage")),
        mediaUrl: v.union(v.string(), v.null()),
        mediaContentType: v.union(v.string(), v.null()),
        createdAt: v.number(),
      }),
    ),
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
    const result = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .order("desc")
      .paginate(args.paginationOpts);

    const page = [];
    for (const m of result.page) {
      const mediaUrl = m.mediaId ? await ctx.storage.getUrl(m.mediaId) : null;
      const media = m.mediaId ? await ctx.db.system.get(m.mediaId) : null;
      page.push({
        _id: m._id,
        _creationTime: m._creationTime,
        conversationId: m.conversationId,
        authorId: m.authorId,
        body: m.body,
        mediaId: m.mediaId,
        mediaUrl,
        mediaContentType: media?.contentType ?? null,
        createdAt: m.createdAt,
      });
    }
    return { ...result, page };
  },
});

/**
 * A user's conversations for the DM inbox, most recently active first, with the
 * other participant's handle and the latest message preview. Bounded per side.
 *
 * NOTE: userId is client-supplied for the hackathon identity model; production
 * derives it from the authenticated identity. See README.
 */
export const listMine = query({
  args: { userId: v.id("users") },
  returns: v.array(
    v.object({
      _id: v.id("conversations"),
      otherId: v.id("users"),
      otherHandle: v.union(v.string(), v.null()),
      lastBody: v.union(v.string(), v.null()),
      lastHasMedia: v.boolean(),
      lastAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const [asUser1, asUser2] = await Promise.all([
      ctx.db
        .query("conversations")
        .withIndex("by_user1", (q) => q.eq("user1", args.userId))
        .take(100),
      ctx.db
        .query("conversations")
        .withIndex("by_user2", (q) => q.eq("user2", args.userId))
        .take(100),
    ]);

    const rows = [];
    for (const c of [...asUser1, ...asUser2]) {
      const otherId = c.user1 === args.userId ? c.user2 : c.user1;
      const other = await ctx.db.get(otherId);
      const last = await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) => q.eq("conversationId", c._id))
        .order("desc")
        .first();
      rows.push({
        _id: c._id,
        otherId,
        otherHandle: other?.handle ?? null,
        lastBody: last?.body ?? null,
        lastHasMedia: last?.mediaId !== undefined,
        lastAt: last?.createdAt ?? c.createdAt,
      });
    }
    return rows.sort((a, b) => b.lastAt - a.lastAt);
  },
});
