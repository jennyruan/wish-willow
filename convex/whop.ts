import { WhopClient, WhopEnvironment } from "@whop/sdk";
import { unwrapWebhook } from "@whop/sdk/helpers";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  action,
  httpAction,
  internalMutation,
  type MutationCtx,
} from "./_generated/server";
import { paymentKind } from "./schema";

/**
 * Whop is the merchant-of-record rail for Engine B; Convex holds reward state.
 * Escrow is charge-on-select: the wisher is charged when they pick a helper, and
 * the reward releases when Whop's payment.succeeded webhook reaches /whop.
 *
 * Requires WHOP_API_KEY, WHOP_WEBHOOK_SECRET and WHOP_ENVIRONMENT in the Convex
 * env. Anything other than WHOP_ENVIRONMENT=production talks to the sandbox.
 */
function whopClient() {
  const token = process.env.WHOP_API_KEY;
  if (!token) throw new Error("WHOP_API_KEY is not set on this deployment");
  return new WhopClient({
    token,
    environment:
      process.env.WHOP_ENVIRONMENT === "production"
        ? WhopEnvironment.Production
        : WhopEnvironment.Sandbox,
  });
}

const money = (amount: number) => `$${Number.isInteger(amount) ? amount : amount.toFixed(2)}`;

async function handleOf(ctx: MutationCtx, userId: Id<"users">) {
  return (await ctx.db.get(userId))?.handle ?? "someone";
}

async function releaseReward(
  ctx: MutationCtx,
  wish: Doc<"wishes">,
  helperId: Id<"users">,
  amount: number,
) {
  const now = Date.now();
  await ctx.db.patch(wish._id, { helperId, rewardReleasedAt: now });
  const [owner, helper] = await Promise.all([
    handleOf(ctx, wish.ownerId),
    handleOf(ctx, helperId),
  ]);
  await ctx.db.insert("notifications", {
    userId: helperId,
    kind: "reward",
    text:
      amount > 0
        ? `@${owner} picked you — ${money(amount)} reward released for “${wish.text}”`
        : `@${owner} picked you as the helper for “${wish.text}” — thank you!`,
    wishId: wish._id,
    read: false,
    createdAt: now,
  });
  await ctx.db.insert("notifications", {
    userId: wish.ownerId,
    kind: "reward",
    text:
      amount > 0
        ? `Your ${money(amount)} reward was released to @${helper}`
        : `You thanked @${helper} for helping with your wish`,
    wishId: wish._id,
    read: false,
    createdAt: now,
  });
}

/**
 * Validate a reward selection or a crowdfunding contribution and record it as a
 * pending payment. A $0 (free, thanks-only) reward releases immediately and
 * returns null because there is nothing to charge.
 */
export const openPayment = internalMutation({
  args: {
    wishId: v.id("wishes"),
    userId: v.id("users"),
    kind: paymentKind,
    helperId: v.optional(v.id("users")),
    amount: v.optional(v.number()),
  },
  returns: v.union(
    v.null(),
    v.object({ paymentId: v.id("payments"), amount: v.number(), title: v.string() }),
  ),
  handler: async (ctx, args) => {
    const wish = await ctx.db.get(args.wishId);
    if (!wish) throw new Error("wish not found");
    if (wish.visibility !== "public") {
      throw new Error("only public wishes take rewards or contributions");
    }
    if (!(await ctx.db.get(args.userId))) throw new Error("user not found");

    if (args.kind === "fund") {
      const amount = Math.round((args.amount ?? 0) * 100) / 100;
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("contribution must be a positive amount");
      }
      const paymentId = await ctx.db.insert("payments", {
        wishId: wish._id,
        payerId: args.userId,
        kind: "fund",
        amount,
        status: "pending",
        createdAt: Date.now(),
      });
      return { paymentId, amount, title: `Chip in: ${wish.text}`.slice(0, 80) };
    }

    if (wish.ownerId !== args.userId) {
      throw new Error("only the wisher can select a helper");
    }
    if (wish.rewardReleasedAt !== undefined) {
      throw new Error("this wish's reward was already released");
    }
    const helperId = args.helperId;
    if (!helperId) throw new Error("select a helper to reward");
    if (helperId === wish.ownerId) throw new Error("you can't reward yourself");
    const replied = await ctx.db
      .query("comments")
      .withIndex("by_wish", (q) => q.eq("wishId", wish._id))
      .filter((q) => q.eq(q.field("authorId"), helperId))
      .first();
    if (!replied) throw new Error("the helper must have replied to this wish");

    const amount = wish.reward ?? 0;
    if (amount === 0) {
      await releaseReward(ctx, wish, helperId, 0);
      return null;
    }
    const paymentId = await ctx.db.insert("payments", {
      wishId: wish._id,
      payerId: args.userId,
      kind: "reward",
      helperId,
      amount,
      status: "pending",
      createdAt: Date.now(),
    });
    return { paymentId, amount, title: `Reward: ${wish.text}`.slice(0, 80) };
  },
});

export const attachCheckout = internalMutation({
  args: { paymentId: v.id("payments"), checkoutId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.paymentId, { checkoutId: args.checkoutId });
    return null;
  },
});

/**
 * Create a Whop checkout for a wish. kind "reward": the wisher (userId) selects
 * helperId and is charged the wish's reward (charge-on-select). kind "fund": any
 * user chips in `amount` toward the wish. Returns the Whop purchase_url for the
 * app to open, or null when a free reward released with nothing to charge.
 */
export const createCheckout = action({
  args: {
    wishId: v.id("wishes"),
    userId: v.id("users"),
    kind: paymentKind,
    helperId: v.optional(v.id("users")),
    amount: v.optional(v.number()),
  },
  returns: v.object({ purchaseUrl: v.union(v.string(), v.null()) }),
  handler: async (ctx, args): Promise<{ purchaseUrl: string | null }> => {
    const pending = await ctx.runMutation(internal.whop.openPayment, args);
    if (!pending) return { purchaseUrl: null };

    const checkout = await whopClient().checkoutConfigurations.create({
      metadata: {
        userId: args.userId,
        wishId: args.wishId,
        paymentId: pending.paymentId,
        kind: args.kind,
        ...(args.helperId ? { helperId: args.helperId } : {}),
      },
      variant: {
        title: pending.title,
        initial_price: pending.amount,
        billing_type: "one_time",
        currency: "usd",
      },
    });
    if (!checkout.purchase_url) throw new Error("Whop returned no purchase_url");
    await ctx.runMutation(internal.whop.attachCheckout, {
      paymentId: pending.paymentId,
      checkoutId: checkout.id,
    });
    return { purchaseUrl: checkout.purchase_url };
  },
});

/**
 * Mark a payment paid and apply it. Idempotent: Whop delivers each event at
 * least once, so a payment that is already paid is left alone.
 */
export const settlePayment = internalMutation({
  args: { paymentId: v.string(), whopPaymentId: v.string() },
  returns: v.string(),
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("payments", args.paymentId);
    const payment = id && (await ctx.db.get(id));
    if (!payment) return "unknown payment";
    if (payment.status === "paid") return "duplicate";

    await ctx.db.patch(payment._id, {
      status: "paid",
      whopPaymentId: args.whopPaymentId,
      paidAt: Date.now(),
    });
    const wish = await ctx.db.get(payment.wishId);
    if (!wish) return "wish gone";

    if (payment.kind === "reward") {
      if (wish.rewardReleasedAt !== undefined || !payment.helperId) {
        return "reward already released";
      }
      await releaseReward(ctx, wish, payment.helperId, payment.amount);
      return "reward released";
    }

    await ctx.db.patch(wish._id, { funded: (wish.funded ?? 0) + payment.amount });
    const payer = await handleOf(ctx, payment.payerId);
    await ctx.db.insert("notifications", {
      userId: wish.ownerId,
      kind: "fund",
      text: `@${payer} chipped in ${money(payment.amount)} toward “${wish.text}”`,
      wishId: wish._id,
      read: false,
      createdAt: Date.now(),
    });
    return "funded";
  },
});

type WhopEvent = {
  type: string;
  data: { id: string; metadata?: Record<string, unknown> | null };
};

/** POST /whop: Whop webhook receiver, verified with the Standard Webhooks signature. */
export const webhook = httpAction(async (ctx, request) => {
  const key = process.env.WHOP_WEBHOOK_SECRET;
  if (!key) return new Response("webhook secret is not configured", { status: 500 });

  const raw = await request.text();
  const headers: Record<string, string> = {};
  request.headers.forEach((value, name) => {
    headers[name] = value;
  });

  let event: WhopEvent;
  try {
    event = unwrapWebhook<WhopEvent>(raw, { headers, key });
  } catch {
    return new Response("bad signature", { status: 401 });
  }

  if (event.type === "payment.succeeded" || event.type === "payment_succeeded") {
    const paymentId = event.data.metadata?.paymentId;
    if (typeof paymentId === "string") {
      await ctx.runMutation(internal.whop.settlePayment, {
        paymentId,
        whopPaymentId: event.data.id,
      });
    }
  }
  return new Response(null, { status: 200 });
});
