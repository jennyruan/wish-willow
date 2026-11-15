import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Returns a short-lived upload URL. The client POSTs the file bytes to this URL
 * and receives back a storageId, which it then stores as `mediaId` on a comment
 * or message (or `avatarId` on a user). See README for the full flow.
 */
export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});
