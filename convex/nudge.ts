import { v } from "convex/values";
import OpenAI from "openai";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  internalAction,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";

const KEIKI_BASE_URL = "https://onkeiki.com/api/v1/openai";
// The Willow agent's name in the Keiki dashboard, used as the `model`.
const WILLOW_AGENT = "willow";
// A user who checked in within this window already saw Willow today: no nudge.
const CHECKED_IN_WINDOW_MS = 20 * 60 * 60 * 1000;

/** Whether this user has opted in to the daily nudge over text. */
export const status = query({
  args: { userId: v.id("users") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    return user?.dailyNudge === true;
  },
});

/** Opt in or out of Willow's daily check-in over text. */
export const setDailyNudge = mutation({
  args: { userId: v.id("users"), enabled: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("user not found");
    await ctx.db.patch(args.userId, { dailyNudge: args.enabled });
    return null;
  },
});

/** Record today's wish check-in and the client's current streak count. */
export const checkIn = mutation({
  args: { userId: v.id("users"), streak: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!Number.isInteger(args.streak) || args.streak < 1) {
      throw new Error("streak must be a positive integer");
    }
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("user not found");
    await ctx.db.patch(args.userId, { streak: args.streak, lastCheckInAt: Date.now() });
    return null;
  },
});

/** Opted-in users who have not checked in within the last day. */
export const dueUsers = internalQuery({
  args: {},
  returns: v.array(v.id("users")),
  handler: async (ctx) => {
    const cutoff = Date.now() - CHECKED_IN_WINDOW_MS;
    const users = await ctx.db
      .query("users")
      .withIndex("by_dailyNudge", (q) => q.eq("dailyNudge", true))
      .collect();
    return users.filter((u) => (u.lastCheckInAt ?? 0) < cutoff).map((u) => u._id);
  },
});

/** The real facts the check-in is written from: handle, streak, open wishes. */
export const checkInContext = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(
    v.null(),
    v.object({
      handle: v.string(),
      streak: v.number(),
      openWishes: v.array(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.dailyNudge !== true) return null;
    const wishes = await ctx.db
      .query("wishes")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.userId))
      .collect();
    const fresh = Date.now() - (user.lastCheckInAt ?? 0) < 2 * CHECKED_IN_WINDOW_MS;
    return {
      handle: user.handle,
      streak: fresh ? (user.streak ?? 0) : 0,
      openWishes: wishes.filter((w) => w.status === "open" && !w.realized).map((w) => w.text),
    };
  },
});

/**
 * Send one user their daily wish check-in through the Willow agent on Keiki.
 * The agent is named as the model and the user's id is the Keiki conversation,
 * so every nudge for a user lands in one thread with the agent's memory.
 * KEIKI_API_KEY stays server-side in the Convex environment.
 */
export const sendDailyNudge = internalAction({
  args: { userId: v.id("users") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args): Promise<string | null> => {
    const apiKey = process.env.KEIKI_API_KEY;
    if (!apiKey) throw new Error("KEIKI_API_KEY is not set on this deployment");

    const facts: { handle: string; streak: number; openWishes: string[] } | null = await ctx.runQuery(internal.nudge.checkInContext, { userId: args.userId });
    if (!facts) return null;

    const wishes = facts.openWishes.length
      ? facts.openWishes.map((w) => `- ${w}`).join("\n")
      : "(no open wishes yet)";
    const keiki = new OpenAI({ baseURL: KEIKI_BASE_URL, apiKey });
    const completion = await keiki.chat.completions.create(
      {
        model: WILLOW_AGENT,
        messages: [
          {
            role: "user",
            content: [
              `Daily wish check-in for @${facts.handle}.`,
              `Current wish-check streak: ${facts.streak} day(s).`,
              `Open wishes:\n${wishes}`,
              "Send them a short, warm check-in text with one next step. Use only these facts.",
            ].join("\n"),
          },
        ],
      },
      { headers: { "x-conversation-id": args.userId } },
    );
    return completion.choices[0]?.message?.content ?? null;
  },
});

/** Daily fan-out: schedule one nudge per opted-in user who hasn't checked in. */
export const sendDailyNudges = internalAction({
  args: {},
  returns: v.number(),
  handler: async (ctx): Promise<number> => {
    const userIds: Id<"users">[] = await ctx.runQuery(internal.nudge.dueUsers, {});
    await Promise.all(
      userIds.map((userId) => ctx.scheduler.runAfter(0, internal.nudge.sendDailyNudge, { userId })),
    );
    return userIds.length;
  },
});
