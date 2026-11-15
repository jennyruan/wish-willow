import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";

/**
 * Idempotent demo seed for the community layer.
 *
 * Seeds exactly ONE public demo wish owned by a seeded demo user, plus a few
 * APPROVED demo comments. Every seeded row is self-evidently sample data:
 * handles are prefixed `demo_` and all comment bodies are prefixed `[demo]`.
 * This satisfies the project's hard rule: no fabricated data presented as real.
 *
 * Safe to run repeatedly — it reuses existing demo rows by their stable handles
 * and will not create duplicates.
 */
export const demo = mutation({
  args: {},
  returns: v.object({
    userId: v.id("users"),
    wishId: v.id("wishes"),
    commentIds: v.array(v.id("comments")),
    created: v.boolean(),
  }),
  handler: async (ctx) => {
    const now = Date.now();

    // --- demo wish owner -----------------------------------------------------
    const ownerHandle = "demo_rowan";
    let owner = await ctx.db
      .query("users")
      .withIndex("by_handle", (q) => q.eq("handle", ownerHandle))
      .first();
    let createdAnything = false;
    if (!owner) {
      const ownerId = await ctx.db.insert("users", {
        handle: ownerHandle,
        deviceToken: "demo-device-rowan",
        createdAt: now,
      });
      owner = await ctx.db.get(ownerId);
      createdAnything = true;
    }
    if (!owner) throw new Error("failed to seed demo owner");

    // --- the single demo wish ------------------------------------------------
    // Keyed by owner + exact text so re-running finds the same wish.
    const wishText = "I wish I had a girlfriend";
    const existingWish = (
      await ctx.db
        .query("wishes")
        .withIndex("by_owner", (q) => q.eq("ownerId", owner!._id))
        .collect()
    ).find((w) => w.text === wishText);

    let wishId: Id<"wishes">;
    if (existingWish) {
      wishId = existingWish._id;
    } else {
      wishId = await ctx.db.insert("wishes", {
        ownerId: owner._id,
        text: wishText,
        kind: "girlfriend",
        locality: "local",
        location: "San Francisco (sample)",
        visibility: "public",
        status: "open",
        realized: false,
        createdAt: now,
      });
      createdAnything = true;
    }

    // --- demo commenters + approved demo comments ----------------------------
    const commenterSpecs = [
      {
        handle: "demo_amelie",
        deviceToken: "demo-device-amelie",
        body: "[demo] Hi! This is sample community data. I'd love to grab coffee.",
      },
      {
        handle: "demo_priya",
        deviceToken: "demo-device-priya",
        body: "[demo] Sample comment — rooting for you! Adding a photo soon.",
      },
      {
        handle: "demo_jules",
        deviceToken: "demo-device-jules",
        body: "[demo] Example reply. Everything here is seeded placeholder content.",
      },
    ];

    const commentIds: Id<"comments">[] = [];
    for (const spec of commenterSpecs) {
      let commenter = await ctx.db
        .query("users")
        .withIndex("by_handle", (q) => q.eq("handle", spec.handle))
        .first();
      if (!commenter) {
        const cid = await ctx.db.insert("users", {
          handle: spec.handle,
          deviceToken: spec.deviceToken,
          createdAt: now,
        });
        commenter = await ctx.db.get(cid);
        createdAnything = true;
      }
      if (!commenter) throw new Error("failed to seed demo commenter");

      // Dedupe: a demo comment from this author with this body on this wish.
      const existingComment = (
        await ctx.db
          .query("comments")
          .withIndex("by_wish", (q) => q.eq("wishId", wishId))
          .collect()
      ).find((c) => c.authorId === commenter!._id && c.body === spec.body);

      if (existingComment) {
        commentIds.push(existingComment._id);
      } else {
        const commentId = await ctx.db.insert("comments", {
          wishId,
          authorId: commenter._id,
          kind: "text",
          body: spec.body,
          approved: true, // demo comments are pre-approved so the feed is lively
          createdAt: now,
        });
        commentIds.push(commentId);
        createdAnything = true;
      }
    }

    return {
      userId: owner._id,
      wishId,
      commentIds,
      created: createdAnything,
    };
  },
});
