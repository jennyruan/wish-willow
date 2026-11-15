import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Reusable validator for a returned user document.
const userDoc = v.object({
  _id: v.id("users"),
  _creationTime: v.number(),
  handle: v.string(),
  avatarId: v.optional(v.id("_storage")),
  deviceToken: v.string(),
  createdAt: v.number(),
});

/**
 * Lightweight "join by handle" identity for the hackathon.
 *
 * Upserts a user keyed by deviceToken: if this device already has a user, its
 * handle is updated to the supplied one; otherwise a new user is created.
 * Returns the resulting user document.
 *
 * NOTE: There is no password / server-derived identity here. In production this
 * becomes real auth and the device would not be trusted to pick an arbitrary
 * handle. See README.
 */
export const joinByHandle = mutation({
  args: {
    handle: v.string(),
    deviceToken: v.string(),
  },
  returns: userDoc,
  handler: async (ctx, args) => {
    const handle = args.handle.trim();
    if (handle.length === 0) {
      throw new Error("handle must not be empty");
    }
    if (handle.length > 40) {
      throw new Error("handle must be 40 characters or fewer");
    }

    const existing = await ctx.db
      .query("users")
      .withIndex("by_deviceToken", (q) =>
        q.eq("deviceToken", args.deviceToken),
      )
      .unique();

    if (existing) {
      if (existing.handle !== handle) {
        const taken = await ctx.db
          .query("users")
          .withIndex("by_handle", (q) => q.eq("handle", handle))
          .first();
        if (taken && taken._id !== existing._id) {
          throw new Error("handle already taken — pick another");
        }
        await ctx.db.patch(existing._id, { handle });
      }
      const refreshed = await ctx.db.get(existing._id);
      if (!refreshed) throw new Error("user vanished after patch");
      return refreshed;
    }

    // Enforce unique handles so a handle is a valid DM address.
    const taken = await ctx.db
      .query("users")
      .withIndex("by_handle", (q) => q.eq("handle", handle))
      .first();
    if (taken) throw new Error("handle already taken — pick another");

    const now = Date.now();
    const id = await ctx.db.insert("users", {
      handle,
      deviceToken: args.deviceToken,
      createdAt: now,
    });
    const created = await ctx.db.get(id);
    if (!created) throw new Error("user vanished after insert");
    return created;
  },
});

/**
 * Resolve the current user from a device token, or null if this device has not
 * joined yet.
 */
export const me = query({
  args: { deviceToken: v.string() },
  returns: v.union(userDoc, v.null()),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_deviceToken", (q) =>
        q.eq("deviceToken", args.deviceToken),
      )
      .unique();
    return user ?? null;
  },
});

/**
 * Resolve a user by their (unique) handle — lets a client start a DM or look
 * someone up by just typing a handle. Returns null if no such handle.
 */
export const getByHandle = query({
  args: { handle: v.string() },
  returns: v.union(userDoc, v.null()),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_handle", (q) => q.eq("handle", args.handle.trim()))
      .first();
    return user ?? null;
  },
});
