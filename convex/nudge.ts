import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { nudgeChannel, nudgeDelivery as delivery } from "./schema";

const KEIKI_API = "https://onkeiki.com/api/v1/developer";
// A user who checked in within this window already saw Willow today: no nudge.
const CHECKED_IN_WINDOW_MS = 20 * 60 * 60 * 1000;

/**
 * The Keiki contact identity for what the user typed: an E.164 number for
 * iMessage (a bare 10-digit number is read as US), or "tg:<id>" for Telegram,
 * where Keiki addresses contacts by numeric user id, not by @username.
 */
function recipientFor(channel: "imessage" | "telegram", input: string) {
  const raw = input.trim();
  if (channel === "telegram") {
    if (!/^\d{5,15}$/.test(raw)) throw new Error("enter your numeric Telegram user ID");
    return `tg:${raw}`;
  }
  const digits = raw.replace(/[\s().-]/g, "");
  const e164 = /^\d{10}$/.test(digits) ? `+1${digits}` : digits;
  if (!/^\+[1-9]\d{7,14}$/.test(e164)) throw new Error("enter your iMessage number with its country code, like +14155550123");
  return e164;
}

/** The user's nudge settings and how the latest send went. */
export const status = query({
  args: { userId: v.id("users") },
  returns: v.object({
    enabled: v.boolean(),
    channel: v.optional(nudgeChannel),
    recipient: v.optional(v.string()),
    delivery: v.optional(delivery),
  }),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    return {
      enabled: user?.dailyNudge === true,
      channel: user?.nudgeChannel,
      recipient: user?.nudgeRecipient,
      delivery: user?.nudgeDelivery,
    };
  },
});

/**
 * How a user reaches Willow on Keiki the first time. Keiki only reaches a
 * contact who has a conversation with the agent, so the user texts it once.
 * Values come from the deployment's env; null when not configured.
 */
export const joinInfo = query({
  args: {},
  returns: v.object({
    imessageNumber: v.union(v.string(), v.null()),
    joinCode: v.union(v.string(), v.null()),
    telegramBot: v.union(v.string(), v.null()),
  }),
  handler: async () => ({
    imessageNumber: process.env.KEIKI_SHARED_LINE ?? null,
    joinCode: process.env.KEIKI_JOIN_CODE ?? null,
    telegramBot: process.env.KEIKI_TELEGRAM_BOT ?? null,
  }),
});

/**
 * Opt in to Willow's daily check-in over text, bound to where it is delivered,
 * or opt out. Opting in needs the channel and the user's iMessage number or
 * Telegram user ID.
 */
export const setDailyNudge = mutation({
  args: {
    userId: v.id("users"),
    enabled: v.boolean(),
    channel: v.optional(nudgeChannel),
    address: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("user not found");
    if (!args.enabled) {
      await ctx.db.patch(args.userId, { dailyNudge: false });
      return null;
    }
    if (!args.channel || !args.address) throw new Error("choose iMessage or Telegram and enter where to text you");
    const recipient = recipientFor(args.channel, args.address);
    await ctx.db.patch(args.userId, {
      dailyNudge: true,
      nudgeChannel: args.channel,
      nudgeRecipient: recipient,
      nudgeDelivery: recipient === user.nudgeRecipient ? user.nudgeDelivery : undefined,
    });
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

/** Opted-in users with a recipient who have not checked in within the last day. */
export const dueUsers = internalQuery({
  args: {},
  returns: v.array(v.id("users")),
  handler: async (ctx) => {
    const cutoff = Date.now() - CHECKED_IN_WINDOW_MS;
    const users = await ctx.db
      .query("users")
      .withIndex("by_dailyNudge", (q) => q.eq("dailyNudge", true))
      .collect();
    return users
      .filter((u) => u.nudgeRecipient && (u.lastCheckInAt ?? 0) < cutoff)
      .map((u) => u._id);
  },
});

/** The real facts the check-in is written from, and where it goes. */
export const checkInContext = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(
    v.null(),
    v.object({
      recipient: v.string(),
      handle: v.string(),
      streak: v.number(),
      openWishes: v.array(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.dailyNudge !== true || !user.nudgeRecipient) return null;
    const wishes = await ctx.db
      .query("wishes")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.userId))
      .collect();
    const fresh = Date.now() - (user.lastCheckInAt ?? 0) < 2 * CHECKED_IN_WINDOW_MS;
    return {
      recipient: user.nudgeRecipient,
      handle: user.handle,
      streak: fresh ? (user.streak ?? 0) : 0,
      openWishes: wishes.filter((w) => w.status === "open" && !w.realized).map((w) => w.text),
    };
  },
});

export const recordNudge = internalMutation({
  args: { userId: v.id("users"), recipient: v.string(), delivery },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.nudgeRecipient !== args.recipient) return null;
    await ctx.db.patch(args.userId, { nudgeDelivery: args.delivery, lastNudgeAt: Date.now() });
    return null;
  },
});

/**
 * Send one user their daily wish check-in through the Willow agent on Keiki.
 * It posts a notice to the agent's conversation with the user's iMessage number
 * or Telegram identity; the agent then texts them over that channel in its own
 * words, from the facts given. Keiki answers 404 when the user has never texted
 * the agent, which is recorded as unreachable so the app can tell them to.
 * KEIKI_API_KEY (agents:write) and KEIKI_AGENT_ID stay in the Convex env.
 */
export const sendDailyNudge = internalAction({
  args: { userId: v.id("users") },
  returns: v.union(delivery, v.null()),
  handler: async (ctx, args): Promise<"delivered" | "queued" | "unreachable" | null> => {
    const apiKey = process.env.KEIKI_API_KEY;
    const agentId = process.env.KEIKI_AGENT_ID;
    if (!apiKey || !agentId) throw new Error("KEIKI_API_KEY and KEIKI_AGENT_ID must be set on this deployment");

    const facts: { recipient: string; handle: string; streak: number; openWishes: string[] } | null =
      await ctx.runQuery(internal.nudge.checkInContext, { userId: args.userId });
    if (!facts) return null;

    const wishes = facts.openWishes.length
      ? facts.openWishes.map((w) => `- ${w}`).join("\n")
      : "(no open wishes yet)";
    const response = await fetch(`${KEIKI_API}/agents/${encodeURIComponent(agentId)}/notice`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: facts.recipient,
        text: [
          `@${facts.handle} opted in to a daily wish check-in text from Willow and hasn't checked in today.`,
          `Current wish-check streak: ${facts.streak} day(s).`,
          `Open wishes:\n${wishes}`,
          "Send them a short, warm check-in with one next step, using only these facts.",
        ].join("\n"),
      }),
    });

    let result: "delivered" | "queued" | "unreachable";
    if (response.status === 404) {
      result = "unreachable";
    } else if (response.ok) {
      const body = (await response.json()) as { results?: { outcome?: string }[] };
      const outcome = body.results?.[0]?.outcome;
      result = outcome === "ran" ? "delivered" : outcome === "queued" ? "queued" : "unreachable";
    } else {
      throw new Error(`Keiki notice failed: ${response.status} ${await response.text()}`);
    }
    await ctx.runMutation(internal.nudge.recordNudge, { userId: args.userId, recipient: facts.recipient, delivery: result });
    return result;
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
